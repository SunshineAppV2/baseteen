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
    Award,
    X
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
    review?: {
        feedback: string;
        reviewedAt: any;
    };
    awardedXp?: number;
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

        if (currentUser.role === 'coord_uniao' && currentUser.unionId) {
            return [where('unionId', '==', currentUser.unionId)];
        }

        if (currentUser.role === 'coord_associacao' && currentUser.associationId) {
            return [where('associationId', '==', currentUser.associationId)];
        }

        if (currentUser.role === 'coord_regiao' && currentUser.regionId) {
            return [where('regionId', '==', currentUser.regionId)];
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
    const { data: baseSubmissions, loading: loadingBaseSubmissions } = useCollection<any>("base_submissions", constraints);

    const [activeTab, setActiveTab] = useState<'individual' | 'base'>('individual');
    const [viewMode, setViewMode] = useState<'queue' | 'history'>('queue');

    const filteredSubmissions = useMemo(() => {
        return [...submissions]
            .filter(s => viewMode === 'queue' ? s.status === 'pending' : (s.status === 'approved' || s.status === 'rejected'))
            .sort((a, b) => {
                const dateA = a.proof?.submittedAt?.seconds || 0;
                const dateB = b.proof?.submittedAt?.seconds || 0;
                return dateB - dateA;
            });
    }, [submissions, viewMode]);

    const filteredBaseSubmissions = useMemo(() => {
        return [...baseSubmissions]
            .filter(s => viewMode === 'queue' ? s.status === 'pending' : (s.status === 'approved' || s.status === 'rejected'))
            .sort((a, b) => {
                const dateA = a.proof?.submittedAt?.seconds || 0;
                const dateB = b.proof?.submittedAt?.seconds || 0;
                return dateB - dateA;
            });
    }, [baseSubmissions, viewMode]);

    const [approvalModal, setApprovalModal] = useState<{ submission: any, finalXp: number, type: 'individual' | 'base' } | null>(null);

    // Initial Trigger (Opens Modal)
    const handleApprove = (submission: Submission, finalXp?: number) => {
        setApprovalModal({
            submission,
            finalXp: finalXp !== undefined ? finalXp : (submission.xpReward || 0),
            type: 'individual'
        });
    };

    const handleApproveBase = (submission: any, finalXp?: number) => {
        setApprovalModal({
            submission,
            finalXp: finalXp !== undefined ? finalXp : (submission.xpReward || 0),
            type: 'base'
        });
    };

    // Final Execution (Called by Modal)
    const executeApprove = async (submission: any, xpToAward: number, type: 'individual' | 'base') => {
        try {
            if (type === 'individual') {
                // 1. Update submission status
                await firestoreService.update("submissions", submission.id, {
                    status: "approved",
                    reviewedAt: new Date(),
                    awardedXp: xpToAward
                });

                // 2. Award XP to User (Root level 'xp')
                if (submission.userId) {
                    const userRef = doc(db, "users", submission.userId);

                    // Update Stats
                    await updateDoc(userRef, {
                        "stats.currentXp": increment(xpToAward),
                        "stats.completedTasks": increment(1)
                    });

                    // 3. Add to XP History
                    if (xpToAward !== 0) {
                        await addDoc(collection(db, "users", submission.userId, "xp_history"), {
                            amount: xpToAward,
                            reason: `Tarefa: ${submission.taskTitle}`,
                            type: 'task',
                            createdAt: serverTimestamp()
                        });
                    }

                    // 4. Update Base Stats (Global Ranking)
                    if (submission.baseId) {
                        const baseRef = doc(db, "bases", submission.baseId);
                        await updateDoc(baseRef, {
                            totalXp: increment(xpToAward)
                        });
                    }

                    // 5. Create Notification
                    await addDoc(collection(db, "notifications"), {
                        userId: submission.userId,
                        title: "Tarefa Aprovada! 🎉",
                        message: `Sua prova para "${submission.taskTitle}" foi validada. Você ganhou ${xpToAward} XP!`,
                        createdAt: new Date(),
                        read: false,
                        type: "success"
                    });
                }
            } else {
                // Base Approval
                // 1. Update submission status
                await firestoreService.update("base_submissions", submission.id, {
                    status: "approved",
                    reviewedAt: new Date(),
                    approvedBy: currentUser?.uid,
                    awardedXp: xpToAward
                });

                // 2. Update base stats (increment totalXp and completedTasks)
                const baseRef = doc(db, "bases", submission.baseId);
                await updateDoc(baseRef, {
                    totalXp: increment(xpToAward),
                    completedTasks: increment(1)
                });
            }

            setApprovalModal(null); // Close modal
            // alert(`Aprovação confirmada com sucesso!`); // Optional feedback
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

    const handleRejectBase = async (submission: any) => {
        const feedback = window.prompt("Motivo da rejeição:");
        if (feedback === null) return;

        try {
            await firestoreService.update("base_submissions", submission.id, {
                status: "rejected",
                review: {
                    feedback,
                    reviewedAt: new Date()
                },
                rejectedBy: currentUser?.uid
            });

            alert("Prova da base rejeitada com feedback enviado.");
        } catch (error) {
            console.error("Error rejecting base submission:", error);
            alert("Erro ao rejeitar prova da base.");
        }
    };

    const handleRevoke = async (submission: any) => {
        if (!window.confirm("Tem certeza que deseja revogar esta aprovação? Os pontos serão removidos do usuário.")) return;

        try {
            const xpToRemove = submission.awardedXp || 0;

            // 1. Update submission status
            await firestoreService.update("submissions", submission.id, {
                status: "pending",
                revokedAt: new Date(),
                revokedBy: currentUser?.uid
            });

            // 2. Remove XP from User
            if (submission.userId) {
                const userRef = doc(db, "users", submission.userId);
                await updateDoc(userRef, {
                    "stats.currentXp": increment(-xpToRemove),
                    "stats.completedTasks": increment(-1)
                });

                // 3. Add negative entry to history
                await addDoc(collection(db, "users", submission.userId, "xp_history"), {
                    amount: -xpToRemove,
                    reason: `REVOGADO: ${submission.taskTitle}`,
                    type: 'revocation',
                    createdAt: serverTimestamp()
                });

                // 4. Update Base Stats
                if (submission.baseId) {
                    const baseRef = doc(db, "bases", submission.baseId);
                    await updateDoc(baseRef, {
                        totalXp: increment(-xpToRemove)
                    });
                }

                // 5. Create Notification
                await addDoc(collection(db, "notifications"), {
                    userId: submission.userId,
                    title: "Pontuação Revogada ⚠️",
                    message: `A aprovação da tarefa "${submission.taskTitle}" foi revogada. ${xpToRemove} XP foram removidos.`,
                    createdAt: new Date(),
                    read: false,
                    type: "warning"
                });

                alert(`Aprovação revogada. ${xpToRemove} XP removidos.`);
            }
        } catch (error) {
            console.error("Error revoking submission:", error);
            alert("Erro ao revogar aprovação.");
        }
    };

    const handleRevokeBase = async (submission: any) => {
        if (!window.confirm("Tem certeza que deseja revogar esta aprovação de base? Os pontos serão removidos da base.")) return;

        try {
            const xpToRemove = submission.awardedXp || 0;

            // 1. Update submission status
            await firestoreService.update("base_submissions", submission.id, {
                status: "pending",
                revokedAt: new Date(),
                revokedBy: currentUser?.uid
            });

            // 2. Update base stats
            const baseRef = doc(db, "bases", submission.baseId);
            await updateDoc(baseRef, {
                totalXp: increment(-xpToRemove),
                completedTasks: increment(-1)
            });

            // 3. Create Notification for the person who submitted
            if (submission.submittedBy) {
                await addDoc(collection(db, "notifications"), {
                    userId: submission.submittedBy,
                    title: "Aprovação de Base Revogada 🏠",
                    message: `A aprovação do requisito de base "${submission.taskTitle || 'Tarefa'}" foi revogada.`,
                    createdAt: new Date(),
                    read: false,
                    type: "warning"
                });
            }

            alert(`Aprovação de base revogada. ${xpToRemove} XP removidos da base.`);
        } catch (error) {
            console.error("Error revoking base submission:", error);
            alert("Erro ao revogar aprovação de base.");
        }
    };

    const pendingSubmissionsCount = submissions.filter(s => s.status === "pending").length;
    const pendingBaseSubmissionsCount = baseSubmissions.filter(s => s.status === "pending").length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Fila de Aprovação</h1>
                <p className="text-text-secondary">Revise e valide o cumprimento dos desafios.</p>
            </div>

            {/* View Toggle */}
            <div className="flex bg-surface p-1 rounded-xl w-fit border border-gray-100 shadow-sm mb-2">
                <button
                    onClick={() => setViewMode('queue')}
                    id="btn-pendentes"
                    className={clsx(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        viewMode === 'queue' ? "bg-white shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    Fila de Pendentes
                </button>
                <button
                    onClick={() => setViewMode('history')}
                    id="btn-historico"
                    className={clsx(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        viewMode === 'history' ? "bg-white shadow-sm text-primary" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    Ver Tudo (Histórico)
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('individual')}
                    className={`px-6 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'individual'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                >
                    Requisitos Individuais
                    {pendingSubmissionsCount > 0 && (
                        <span className="ml-2 px-2 py-1 bg-primary text-white text-xs rounded-full">
                            {pendingSubmissionsCount}
                        </span>
                    )}
                </button>
                {currentUser?.role !== 'coord_base' && (
                    <button
                        onClick={() => setActiveTab('base')}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'base'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        Requisitos de Bases
                        {pendingBaseSubmissionsCount > 0 && (
                            <span className="ml-2 px-2 py-1 bg-primary text-white text-xs rounded-full">
                                {pendingBaseSubmissionsCount}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Individual Submissions Tab */}
            {activeTab === 'individual' && (
                loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card-soft p-6 animate-pulse h-32" />
                        ))}
                    </div>
                ) : filteredSubmissions.length > 0 ? (
                    <div className="space-y-4">
                        {filteredSubmissions.map((sub) => (
                            <SubmissionCard
                                key={sub.id}
                                submission={sub}
                                onApprove={handleApprove}
                                onReject={handleReject}
                                onRevoke={handleRevoke}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <CheckCircle2 size={48} className="mx-auto text-success/20 mb-4" />
                        <h3 className="text-lg font-bold text-text-primary">
                            {viewMode === 'queue' ? "Tudo em dia!" : "Nenhum histórico"}
                        </h3>
                        <p className="text-text-secondary">
                            {viewMode === 'queue'
                                ? "Nenhuma prova individual pendente para análise no momento."
                                : "Ainda não há registros de aprovações ou rejeições."
                            }
                        </p>
                    </div>
                )
            )}

            {/* Base Submissions Tab */}
            {activeTab === 'base' && (
                loadingBaseSubmissions ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card-soft p-6 animate-pulse h-32" />
                        ))}
                    </div>
                ) : filteredBaseSubmissions.length > 0 ? (
                    <div className="space-y-4">
                        {filteredBaseSubmissions.map((sub) => (
                            <BaseSubmissionCard
                                key={sub.id}
                                submission={sub}
                                onApprove={handleApproveBase}
                                onReject={handleRejectBase}
                                onRevoke={handleRevokeBase}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <CheckCircle2 size={48} className="mx-auto text-success/20 mb-4" />
                        <h3 className="text-lg font-bold text-text-primary">
                            {viewMode === 'queue' ? "Tudo em dia!" : "Nenhum histórico"}
                        </h3>
                        <p className="text-text-secondary">
                            {viewMode === 'queue'
                                ? "Nenhuma prova de base pendente para análise no momento."
                                : "Ainda não há registros de aprovações ou rejeições de bases."
                            }
                        </p>
                    </div>
                )
            )}

            {/* Approval Verification Modal */}
            {approvalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle2 /> Confirmar Aprovação
                            </h2>
                            <button onClick={() => setApprovalModal(null)} className="text-white/80 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-surface p-4 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-text-secondary uppercase mb-1">Tarefa</p>
                                <p className="font-bold text-lg text-text-primary">{approvalModal.submission.taskTitle || "Sem título"}</p>
                            </div>

                            <div className="bg-surface p-4 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-text-secondary uppercase mb-1">Evidência enviada</p>
                                <div className="text-sm text-text-primary break-words whitespace-pre-wrap">
                                    {approvalModal.submission.proof?.content}
                                </div>
                                {approvalModal.submission.proof?.content?.startsWith("http") && (
                                    <div className="mt-3">
                                        <a
                                            href={approvalModal.submission.proof.content}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-primary font-bold bg-primary/10 p-2 rounded-lg hover:bg-primary/20 transition-colors w-fit"
                                        >
                                            <ExternalLink size={16} />
                                            Abrir Anexo / Link
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                                <span className="font-bold text-green-800">Pontuação a conceder:</span>
                                <span className="text-xl font-black text-green-600">{approvalModal.finalXp} XP</span>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setApprovalModal(null)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white border-none"
                                    onClick={() => executeApprove(approvalModal.submission, approvalModal.finalXp, approvalModal.type)}
                                >
                                    Confirmar e Aprovar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubmissionCard({ submission, onApprove, onReject, onRevoke }: { submission: Submission, onApprove: any, onReject: any, onRevoke: any }) {
    const [taskDeadline, setTaskDeadline] = useState<string | null>(null);
    const [taskPoints, setTaskPoints] = useState<number>(submission.xpReward || 0);

    useEffect(() => {
        const fetchTask = async () => {
            if (submission.taskId) {
                try {
                    const taskRef = doc(db, "tasks", submission.taskId);
                    const taskSnap = await getDoc(taskRef);
                    if (taskSnap.exists()) {
                        const data = taskSnap.data();
                        setTaskDeadline(data.deadline || null);
                        // Only override if the task doc has points (to handle potential legacy issues)
                        if (data.points !== undefined && data.points !== 0) {
                            setTaskPoints(data.points);
                        }
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
                        {submission.status === 'pending' ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <Clock size={14} />
                                Pendente
                            </div>
                        ) : submission.status === 'approved' ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <CheckCircle2 size={14} />
                                Aprovado
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <XCircle size={14} />
                                Rejeitado
                            </div>
                        )}
                        {isLate && submission.status === 'pending' && (
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
                {submission.status === 'pending' ? (
                    <>
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
                    </>
                ) : submission.status === 'approved' ? (
                    <Button
                        variant="outline"
                        className="flex-1 md:flex-none border-warning text-warning hover:bg-yellow-50"
                        onClick={() => onRevoke(submission)}
                    >
                        <X size={20} className="mr-2" />
                        Revogar Pontuação
                    </Button>
                ) : (
                    <div className="text-sm text-text-secondary italic">
                        Rejeitado em {submission.review?.reviewedAt?.toDate ? submission.review.reviewedAt.toDate().toLocaleDateString() : 'N/A'}
                    </div>
                )}
            </div>
        </div >
    );
}

function BaseSubmissionCard({ submission, onApprove, onReject, onRevoke }: { submission: any, onApprove: any, onReject: any, onRevoke: any }) {

    const [taskTitle, setTaskTitle] = useState<string>(submission.taskTitle || "Requisito Coletivo");
    const [taskPoints, setTaskPoints] = useState<number>(submission.xpReward || 0);
    const [taskDeadline, setTaskDeadline] = useState<string | null>(null);

    useEffect(() => {
        const fetchTask = async () => {
            if (submission.taskId) {
                try {
                    const taskRef = doc(db, "tasks", submission.taskId);
                    const taskSnap = await getDoc(taskRef);
                    if (taskSnap.exists()) {
                        const data = taskSnap.data();
                        setTaskTitle(data.title || "Requisito Coletivo");
                        setTaskDeadline(data.deadline || null);
                        if (data.points !== undefined && data.points !== 0) {
                            setTaskPoints(data.points);
                        }
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
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            🏠
                        </div>
                        <div>
                            <p className="font-bold text-text-primary">{submission.baseName || "Base"}</p>
                            <p className="text-xs text-text-secondary">
                                Enviado por: {submission.submittedByName} • {submission.proof.submittedAt?.toDate ? submission.proof.submittedAt.toDate().toLocaleString() : new Date(submission.proof.submittedAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {submission.status === 'pending' ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <Clock size={14} />
                                Pendente
                            </div>
                        ) : submission.status === 'approved' ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <CheckCircle2 size={14} />
                                Aprovado
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                <XCircle size={14} />
                                Rejeitado
                            </div>
                        )}
                        {isLate && submission.status === 'pending' && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                                ⚠️ ATRASADO (-70% XP)
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-gray-50">
                    <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                        <FileText size={16} className="text-primary" />
                        {taskTitle}
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
                            <span className={isLate ? "text-red-500 line-through mr-1" : ""}>{taskPoints || submission.xpReward} XP para a Base</span>
                            {isLate && <span className="text-red-600 font-bold">{finalPoints} XP</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 gap-3 w-full md:w-auto">
                {submission.status === 'pending' ? (
                    <>
                        <Button
                            variant="outline"
                            className="flex-1 md:flex-none border-error text-error hover:bg-red-50"
                            onClick={() => onReject(submission)}
                        >
                            <XCircle size={20} className="mr-2" />
                            Reprovar
                        </Button>
                        <Button
                            className="flex-1 md:flex-none"
                            onClick={() => onApprove(submission, finalPoints)}
                        >
                            <CheckCircle2 size={20} className="mr-2" />
                            Aprovar ({finalPoints} XP)
                        </Button>
                    </>
                ) : submission.status === 'approved' ? (
                    <Button
                        variant="outline"
                        className="flex-1 md:flex-none border-warning text-warning hover:bg-yellow-50"
                        onClick={() => onRevoke(submission)}
                    >
                        <X size={20} className="mr-2" />
                        Revogar Pontuação
                    </Button>
                ) : (
                    <div className="text-sm text-text-secondary italic">
                        Rejeitado
                    </div>
                )}
            </div>
        </div>
    );
}

// End of file
