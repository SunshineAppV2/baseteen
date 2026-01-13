"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";
import { firestoreService } from "@/hooks/useFirestore";
import { CheckCircle, Upload, FileText, AlertCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";
import { checkAchievements } from "@/services/achievementService";
import { where } from "firebase/firestore";

interface BaseSubmission {
    id: string;
    taskId: string;
    baseId: string;
    baseName: string;
    submittedBy: string;
    submittedByName: string;
    proof: {
        content: string;
        submittedAt: any;
    };
    status: 'pending' | 'approved' | 'rejected';
    xpReward: number;
    districtId?: string;
    regionId?: string;
    associationId?: string;
    timeline?: Array<{
        status: string;
        at: Date;
        by: string;
        action: string;
        note?: string;
    }>;
}

interface Task {
    id: string;
    title: string;
    points: number;
    type: "upload" | "text" | "check" | "link";
}

interface District {
    id: string;
    name: string;
}

interface Base {
    id: string;
    name: string;
}

export default function AprovacoesGAPage() {
    const { user: currentUser } = useAuth();

    // Constraints based on hierarchy
    const constraints = [];
    if (currentUser?.role === 'coord_distrital' && currentUser.districtId) {
        constraints.push(where('districtId', '==', currentUser.districtId));
    } else if (currentUser?.role === 'coord_regiao' && currentUser.regionId) {
        constraints.push(where('regionId', '==', currentUser.regionId));
    } else if (currentUser?.role === 'coord_associacao' && currentUser.associationId) {
        constraints.push(where('associationId', '==', currentUser.associationId));
    }

    const { data: baseSubmissions, loading } = useCollection<BaseSubmission>("base_submissions", constraints as any);
    const { data: tasks } = useCollection<Task>("tasks");
    const { data: districtsRaw } = useCollection<District>("districts");
    const { data: basesRaw } = useCollection<Base>("bases");

    // Sort alphabetically
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);
    const bases = useMemo(() => [...basesRaw].sort((a, b) => a.name.localeCompare(b.name)), [basesRaw]);

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [selectedSubmission, setSelectedSubmission] = useState<BaseSubmission | null>(null);

    const getTaskTitle = (taskId: string) => {
        return tasks.find(t => t.id === taskId)?.title || "Requisito";
    };

    const getTaskPoints = (taskId: string) => {
        return tasks.find(t => t.id === taskId)?.points || 0;
    };

    const getDistrictName = (districtId?: string) => {
        if (!districtId) return "";
        return districts.find(d => d.id === districtId)?.name || "";
    };

    const getBaseName = (baseId: string, fallbackName: string) => {
        return bases.find(b => b.id === baseId)?.name || fallbackName;
    };

    const handleApprove = async (submission: BaseSubmission) => {
        try {
            const { doc, updateDoc, increment } = await import("firebase/firestore");
            const { db } = await import("@/services/firebase");

            const timelineEvent = {
                action: 'approved',
                status: 'approved',
                at: new Date(),
                by: currentUser?.uid || 'admin'
            };

            await firestoreService.update("base_submissions", submission.id, {
                status: "approved",
                reviewedAt: new Date(),
                approvedBy: currentUser?.uid,
                timeline: [...(submission.timeline || []), timelineEvent]
            });

            // Update base stats using increment
            const baseRef = doc(db, "bases", submission.baseId);
            await updateDoc(baseRef, {
                totalXp: increment(submission.xpReward),
                completedTasks: increment(1)
            });

            // Check and unlock achievements for the base
            try {
                const newAchievements = await checkAchievements(submission.baseId);
                if (newAchievements.length > 0) {
                    console.log(`🏆 New achievements unlocked for base ${submission.baseName}:`, newAchievements);
                }
            } catch (error) {
                console.error('Error checking achievements:', error);
            }

            alert(`✅ Requisito aprovado! ${submission.xpReward} PTS creditado à base ${submission.baseName}.`);
        } catch (error) {
            console.error(error);
            alert("Erro ao aprovar requisito.");
        }
    };

    const handleRevertApproval = async (submission: BaseSubmission) => {
        if (!confirm(`Deseja reverter a aprovação deste requisito? \n\n⚠️ ${submission.xpReward} PTS serão removidos da base ${submission.baseName}.`)) return;

        try {
            const { doc, updateDoc, increment } = await import("firebase/firestore");
            const { db } = await import("@/services/firebase");

            const timelineEvent = {
                action: 'reverted',
                status: 'pending',
                at: new Date(),
                by: currentUser?.uid || 'admin',
                note: 'Aprovação revertida por coordenador.'
            };

            await firestoreService.update("base_submissions", submission.id, {
                status: "pending",
                reviewedAt: null,
                approvedBy: null,
                timeline: [...(submission.timeline || []), timelineEvent]
            });

            // Revert base stats using negative increment
            const baseRef = doc(db, "bases", submission.baseId);
            await updateDoc(baseRef, {
                totalXp: increment(-submission.xpReward),
                completedTasks: increment(-1)
            });

            alert("🔄 Aprovação revertida com sucesso. O requisito voltou para a lista de pendentes.");
        } catch (error) {
            console.error(error);
            alert("Erro ao reverter aprovação.");
        }
    };

    const handleReject = async (submission: BaseSubmission) => {
        const feedback = window.prompt("Motivo da reprovação:");
        if (!feedback) return;

        try {
            const timelineEvent = {
                action: 'rejected',
                status: 'rejected',
                at: new Date(),
                by: currentUser?.uid || 'admin',
                note: feedback
            };

            await firestoreService.update("base_submissions", submission.id, {
                status: "rejected",
                review: {
                    feedback,
                    reviewedAt: new Date()
                },
                rejectedBy: currentUser?.uid,
                timeline: [...(submission.timeline || []), timelineEvent]
            });

            alert("❌ Requisito reprovado com feedback enviado.");
        } catch (error) {
            console.error(error);
            alert("Erro ao reprovar requisito.");
        }
    };

    const filteredSubmissions = baseSubmissions.filter(s => {
        if (activeTab === 'pending') return s.status === 'pending';
        return s.status === 'approved' || s.status === 'rejected';
    });

    if (!currentUser || currentUser.role === 'membro' || currentUser.role === 'coord_base') {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <p className="text-text-secondary">Acesso restrito a Coordenadores Hierárquicos.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Target className="text-primary" />
                    Aprovações GA
                </h1>
                <p className="text-text-secondary">Aprove ou reprove requisitos respondidos pelas bases.</p>
            </div>

            <div className="flex border-b border-gray-100 gap-8 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'pending' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    Pendentes ({baseSubmissions.filter(s => s.status === 'pending').length})
                    {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'history' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    Histórico ({baseSubmissions.filter(s => s.status !== 'pending').length})
                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card-soft p-6 animate-pulse h-32" />
                    ))}
                </div>
            ) : filteredSubmissions.length > 0 ? (
                <div className="space-y-4">
                    {filteredSubmissions.map(submission => (
                        <div key={submission.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                            {submission.status === 'approved' && <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />}
                            {submission.status === 'rejected' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}

                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                                                🏠
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">
                                                    {getBaseName(submission.baseId, submission.baseName)} - {getDistrictName(submission.districtId)}
                                                </h3>
                                                <p className="text-sm text-text-secondary uppercase font-medium">
                                                    {submission.submittedByName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "px-3 py-1 rounded-full text-xs font-bold",
                                            submission.status === 'pending' ? "bg-orange-50 text-orange-600" :
                                                submission.status === 'approved' ? "bg-green-50 text-green-600" :
                                                    "bg-red-50 text-red-600"
                                        )}>
                                            {submission.status === 'pending' ? "⏳ PENDENTE" :
                                                submission.status === 'approved' ? "✓ APROVADO" :
                                                    "✗ REPROVADO"}
                                        </div>
                                    </div>

                                    <div className="bg-surface rounded-xl p-4">
                                        <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                                            <FileText size={16} className="text-primary" />
                                            {getTaskTitle(submission.taskId)}
                                        </h4>
                                        <p className="text-sm text-text-secondary mb-2 whitespace-pre-wrap">
                                            {submission.proof.content}
                                        </p>

                                        {submission.status === 'rejected' && (submission as any).review?.feedback && (
                                            <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                                <p className="text-xs font-bold text-red-700 uppercase mb-1">Motivo da reprovação:</p>
                                                <p className="text-sm text-red-600 font-medium lowercase first-letter:uppercase">{(submission as any).review.feedback}</p>
                                            </div>
                                        )}

                                        {submission.proof.content.startsWith("http") && (
                                            <a
                                                href={submission.proof.content}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary font-bold hover:underline"
                                            >
                                                🔗 Abrir evidência
                                            </a>
                                        )}
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                                                {getTaskPoints(submission.taskId)} PTS
                                            </span>
                                            <span className="text-xs text-text-secondary">
                                                Enviado em: {submission.proof.submittedAt?.toDate?.().toLocaleString() || 'Data não disponível'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex md:flex-col gap-3 md:w-auto w-full justify-end">
                                    {submission.status === 'pending' ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="flex-1 md:flex-none border-error text-error hover:bg-red-50"
                                                onClick={() => handleReject(submission)}
                                            >
                                                ✗ Reprovar
                                            </Button>
                                            <Button
                                                className="flex-1 md:flex-none"
                                                onClick={() => setSelectedSubmission(submission)}
                                            >
                                                ✓ Aprovar
                                            </Button>
                                        </>
                                    ) : submission.status === 'approved' ? (
                                        <Button
                                            variant="outline"
                                            className="flex-1 md:flex-none border-orange-500 text-orange-600 hover:bg-orange-50"
                                            onClick={() => handleRevertApproval(submission)}
                                        >
                                            ↺ Reverter Aprovação
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="flex-1 md:flex-none"
                                            onClick={() => setSelectedSubmission(submission)}
                                        >
                                            ✓ Aprovar Agora
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle size={48} className="mx-auto text-success/20 mb-4" />
                    <h3 className="text-lg font-bold text-text-primary">
                        {activeTab === 'pending' ? 'Tudo em dia!' : 'Nenhum histórico'}
                    </h3>
                    <p className="text-text-secondary">
                        {activeTab === 'pending' ? 'Nenhuma submissão pendente de aprovação.' : 'As submissões aprovadas ou reprovadas aparecerão aqui.'}
                    </p>
                </div>
            )}

            {/* Modal de Confirmação de Aprovação */}
            {selectedSubmission && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 bg-primary text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle size={24} />
                                Confirmar Aprovação
                            </h2>
                            <p className="text-white/80 text-sm">Revise os detalhes antes de validar o requisito.</p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase">Base</label>
                                    <p className="font-bold text-lg text-text-primary">
                                        {getBaseName(selectedSubmission.baseId, selectedSubmission.baseName)}
                                    </p>
                                    <p className="text-sm text-text-secondary">
                                        {getDistrictName(selectedSubmission.districtId)}
                                    </p>
                                </div>

                                <div className="p-4 bg-surface rounded-2xl border border-gray-100">
                                    <h4 className="font-bold text-primary flex items-center gap-2 mb-2">
                                        <FileText size={18} />
                                        {getTaskTitle(selectedSubmission.taskId)}
                                    </h4>
                                    <div className="text-sm text-text-primary bg-white p-3 rounded-xl border border-gray-100 min-h-[60px] whitespace-pre-wrap">
                                        {selectedSubmission.proof.content}
                                    </div>
                                    {selectedSubmission.proof.content.startsWith("http") && (
                                        <a
                                            href={selectedSubmission.proof.content}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-3 inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline bg-primary/5 px-3 py-2 rounded-lg"
                                        >
                                            🔗 Abrir evidência (Link externo)
                                        </a>
                                    )}
                                </div>

                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                                    <span className="text-sm font-bold text-green-700">Recompensa:</span>
                                    <span className="text-xl font-black text-green-600">
                                        {getTaskPoints(selectedSubmission.taskId)} PTS
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setSelectedSubmission(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                        handleApprove(selectedSubmission);
                                        setSelectedSubmission(null);
                                    }}
                                >
                                    ✓ Confirmar Aprovação
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
