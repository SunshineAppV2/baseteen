"use client";

import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Clock,
    CheckCircle2,
    XCircle,
    ExternalLink,
    User,
    FileText,
    MessageSquare,
    Check,
    Award
} from "lucide-react";
import { clsx } from "clsx";

import {
    increment,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { where, orderBy } from "firebase/firestore";
import { useMemo, useState, useEffect } from "react";

interface Submission {
    id: string;
    taskId: string;
    userId: string;
    status: "pending" | "approved" | "rejected";
    proof: {
        content: string;
        submittedAt: any;
    };
    userName?: string;
    taskTitle?: string;
    xpReward?: number;
    baseId?: string;
    districtId?: string;
    userBaseId?: string;
    userDistrictId?: string;
    userDisplayName?: string;
    taskDeadline?: string; // populated via fetching or join
}

import { useAuth } from "@/context/AuthContext";

export default function ApprovalsPage() {
    const { user: currentUser } = useAuth();

    // Determine query constraints based on role
    const constraints = useMemo(() => {
        if (!currentUser) return [where('id', '==', '0')]; // Safe fallback if unauth

        if (['master', 'coord_geral', 'secretaria'].includes(currentUser.role || '')) {
            return []; // All (sort client side)
        }

        if (currentUser.role === 'coord_distrital' && currentUser.districtId) {
            return [
                where('districtId', '==', currentUser.districtId)
            ];
        }

        if (currentUser.role === 'coord_base' && currentUser.baseId) {
            return [
                where('baseId', '==', currentUser.baseId)
            ];
        }

        // Fallback
        return [where('id', '==', '0')];
    }, [currentUser]);

    const { data: submissions, loading } = useCollection<Submission>("submissions", constraints);

    const filteredSubmissions = useMemo(() => {
        return [...submissions].sort((a, b) => {
            const dateA = a.proof?.submittedAt?.seconds || 0;
            const dateB = b.proof?.submittedAt?.seconds || 0;
            return dateB - dateA;
        });
    }, [submissions]);

    const handleApprove = async (submission: Submission, finalXp?: number) => {
        try {
            const xpToAward = finalXp !== undefined ? finalXp : (submission.xpReward || 0);

            // 1. Update submission status
            await firestoreService.update("submissions", submission.id, {
                status: "approved",
                reviewedAt: new Date(),
                awardedXp: xpToAward
            });

            // 2. Award XP to User (Root level 'xp')
            if (submission.userId && xpToAward > 0) {
                const userRef = doc(db, "users", submission.userId);

                // Fetch just to be safe or just increment
                // For safety and history total accuracy we might need to know current total, but increment is atomic.
                await updateDoc(userRef, {
                    "stats.currentXp": increment(xpToAward),
                    "stats.completedTasks": increment(1)
                });

                // 3. Add to XP History
                const userSnap = await getDoc(userRef);
                const currentTotal = userSnap.data()?.stats?.currentXp || 0;

                await addDoc(collection(db, "users", submission.userId, "xp_history"), {
                    amount: xpToAward,
                    totalXp: currentTotal,
                    type: 'task',
                    taskTitle: submission.taskTitle,
                    timestamp: serverTimestamp()
                });

                // 4. Create Notification
                await addDoc(collection(db, "notifications"), {
                    userId: submission.userId,
                    title: "Tarefa Aprovada! 🎉",
                    message: `Sua prova para "${submission.taskTitle}" foi validada. Você ganhou ${xpToAward} XP!`,
                    createdAt: new Date(),
                    read: false,
                    type: "success"
                });

                alert(`Prova aprovada e ${xpToAward} XP concedido!`);
            }
        } catch (error) {
            console.error("Error approving submission:", error);
            alert("Erro ao aprovar prova.");
        }
    };

    const handleReject = async (submission: Submission) => {
        const feedback = window.prompt("Motivo da rejeição:");
        if (feedback === null) return;

        try {
            await firestoreService.update("submissions", submission.id, {
                status: "rejected",
                review: {
                    feedback,
                    reviewedAt: new Date()
                }
            });

            // Notify User
            await addDoc(collection(db, "notifications"), {
                userId: submission.userId,
                title: "Tarefa Recusada ⚠️",
                message: `Sua prova para "${submission.taskTitle}" foi recusada. Motivo: ${feedback}`,
                createdAt: new Date(),
                read: false,
                type: "warning"
            });

            alert("Prova rejeitada com feedback enviado.");
        } catch (error) {
            console.error("Error rejecting submission:", error);
            alert("Erro ao rejeitar prova.");
        }
    };

    const pendingSubmissions = filteredSubmissions.filter(s => s.status === "pending");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Fila de Aprovação</h1>
                <p className="text-text-secondary">Revise e valide o cumprimento dos desafios.</p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card-soft p-6 animate-pulse h-32" />
                    ))}
                </div>
            ) : pendingSubmissions.length > 0 ? (
                <div className="space-y-4">
                    {pendingSubmissions.map((sub) => (
                        <SubmissionCard
                            key={sub.id}
                            submission={sub}
                            onApprove={handleApprove}
                            onReject={handleReject}
                        />
                    ))}
                </div >
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle2 size={48} className="mx-auto text-success/20 mb-4" />
                    <h3 className="text-lg font-bold text-text-primary">Tudo em dia!</h3>
                    <p className="text-text-secondary">Nenhuma prova pendente para análise no momento.</p>
                </div>
            )}
        </div>
    );
}

function SubmissionCard({ submission, onApprove, onReject }: { submission: Submission, onApprove: any, onReject: any }) {
    const { getDoc, doc } = require("firebase/firestore");
    const { db } = require("@/services/firebase");

    const [taskDeadline, setTaskDeadline] = useState<string | null>(null);
    const [taskPoints, setTaskPoints] = useState<number>(0);

    useEffect(() => {
        const fetchTask = async () => {
            if (submission.taskId) {
                try {
                    const taskRef = doc(db, "tasks", submission.taskId);
                    const taskSnap = await getDoc(taskRef);
                    if (taskSnap.exists()) {
                        const data = taskSnap.data();
                        setTaskDeadline(data.deadline || null);
                        setTaskPoints(data.points || 0);
                    }
                } catch (err) {
                    console.error("Err fetch task", err);
                }
            }
        };
        fetchTask();
    }, [submission.taskId]);

    // Check availability
    const isLate = useMemo(() => {
        if (!taskDeadline) return false;
        if (!submission.proof.submittedAt) return false;

        // deadline is YYYY-MM-DDTHH:mm:ss.sssZ (ISO)
        // submission date
        const subDate = submission.proof.submittedAt.toDate ? submission.proof.submittedAt.toDate() : new Date(submission.proof.submittedAt);
        const deadDate = new Date(taskDeadline);

        return subDate > deadDate;
    }, [taskDeadline, submission.proof.submittedAt]);

    const finalPoints = isLate ? Math.floor(taskPoints * 0.3) : taskPoints;

    return (
        <div className="card-soft p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-secondary">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-text-primary">{submission.userDisplayName || submission.userName || "Membro " + submission.userId.slice(-4)}</p>
                            <p className="text-xs text-text-secondary">
                                {submission.proof.submittedAt?.toDate ? submission.proof.submittedAt.toDate().toLocaleString() : new Date(submission.proof.submittedAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider">
                            <Clock size={14} />
                            Pendente
                        </div>
                        {isLate && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                                ⚠️ ATRASADO (-70% XP)
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-gray-50">
                    <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                        <FileText size={16} className="text-primary" />
                        {submission.taskTitle || "Link/Foto do Desafio"}
                    </h4>
                    <p className="text-sm text-text-secondary break-all">
                        {submission.proof.content}
                    </p>
                    {submission.proof.content.startsWith("http") && (
                        <a
                            href={submission.proof.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary font-bold mt-2 hover:underline"
                        >
                            Abrir evidência <ExternalLink size={12} />
                        </a>
                    )}
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-1 text-primary font-bold text-xs bg-primary/5 px-2 py-1 rounded-lg">
                            <Award size={14} />
                            <span className={isLate ? "text-red-500 line-through mr-1" : ""}>{taskPoints} XP</span>
                            {isLate && <span className="text-red-600 font-bold">{finalPoints} XP</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 gap-3 w-full md:w-auto">
                <Button
                    variant="outline"
                    className="flex-1 md:flex-none border-error text-error hover:bg-red-50"
                    onClick={() => onReject(submission)}
                >
                    <XCircle size={20} className="mr-2" />
                    Rejeitar
                </Button>
                <Button
                    className="flex-1 md:flex-none"
                    onClick={() => onApprove(submission, finalPoints)}
                >
                    <CheckCircle2 size={20} className="mr-2" />
                    Aprovar ({finalPoints} XP)
                </Button>
            </div>
        </div >
    );
}

// End of file
