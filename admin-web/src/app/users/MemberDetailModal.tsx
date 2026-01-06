"use client";

import { useState, useEffect } from "react";
import { User, getTheoreticalClassification } from "./page"; // Importing User interface and classification function from page
import { X, Award, History, TrendingUp, TrendingDown, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { collection, query, orderBy, limit, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { clsx } from "clsx";

interface MemberDetailModalProps {
    user: User;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh on parent
}

interface XPHistory {
    id: string;
    amount: number;
    reason?: string;
    taskTitle?: string;
    createdAt: any;
    type: "credit" | "debit";
}

export default function MemberDetailModal({ user, onClose, onUpdate }: MemberDetailModalProps) {
    const [xpAmount, setXpAmount] = useState<number>(0);
    const [xpReason, setXpReason] = useState("");
    const [xpType, setXpType] = useState<"credit" | "debit">("credit");
    const [isSaving, setIsSaving] = useState(false);

    // Profile Edit State
    const [editBirthDate, setEditBirthDate] = useState(user.birthDate || "");
    const [editParticipatesInRanking, setEditParticipatesInRanking] = useState(user.participatesInRanking !== false);

    const [history, setHistory] = useState<XPHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        fetchHistory();
        setEditBirthDate(user.birthDate || "");
        setEditParticipatesInRanking(user.participatesInRanking !== false);
    }, [user.id, user.birthDate, user.participatesInRanking]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const q = query(
                collection(db, "users", user.id, "xp_history"),
                orderBy("createdAt", "desc"),
                limit(10)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as XPHistory));
            setHistory(data);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAdjustXP = async () => {
        // Debug Identity
        // alert(`Debug: Logged as ${user.email} (You are ${currentUser?.email})`); 

        if (!xpAmount || xpAmount <= 0) return alert("Digite um valor válido.");
        if (!xpReason) return alert("Digite uma justificativa.");

        setIsSaving(true);
        try {
            const finalAmount = xpType === "credit" ? xpAmount : -xpAmount;

            // 1. Add to History
            try {
                await firestoreService.add(`users/${user.id}/xp_history`, {
                    amount: finalAmount,
                    reason: xpReason,
                    type: xpType,
                    createdAt: new Date(),
                    performedBy: "admin"
                });
            } catch (e: any) {
                throw new Error("Erro ao salvar histórico: " + e.message);
            }

            // 2. Update User Stats (Atomic increment ideal, but simple update for now)
            try {
                const currentXp = user.stats?.currentXp || 0;
                const newXp = currentXp + finalAmount;
                const newLevel = Math.floor(newXp / 1000) + 1;

                await firestoreService.update("users", user.id, {
                    "stats.currentXp": newXp,
                    "stats.level": newLevel
                });
            } catch (e: any) {
                console.error("Erro stats:", e);
                alert("O histórico foi salvo, mas erro ao atualizar o total de XP: " + e.message);
                setXpAmount(0);
                setXpReason("");
                fetchHistory();
                return;
            }

            alert("Pontuação atualizada com sucesso!");
            setXpAmount(0);
            setXpReason("");
            fetchHistory(); // Refresh history
            onUpdate(); // Refresh parent list
        } catch (error: any) {
            console.error(error);
            alert("Erro GERAL: " + (error.message || error));
        } finally {
            setIsSaving(false);
        }
    };

    const calculateAge = (dateString?: string) => {
        if (!dateString) return null;
        const today = new Date();
        const birthDate = new Date(dateString + 'T12:00:00');
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleUpdateProfile = async () => {
        setIsSaving(true);
        try {
            const data: any = {
                birthDate: editBirthDate || null,
                participatesInRanking: editParticipatesInRanking,
                // Always recalculate classification based on birth date
                classification: getTheoreticalClassification(editBirthDate)
            };

            await firestoreService.update("users", user.id, data);
            alert("Perfil atualizado com sucesso!");
            onUpdate();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao atualizar perfil: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteHistory = async (historyId: string) => {
        if (!confirm("Tem certeza que deseja apagar este histórico? \n\n⚠️ ISSO NÃO ALTERA O SALDO ATUAL DO USUÁRIO. \nSe necessário, faça um lançamento manual para corrigir.")) return;

        // Optimistic update
        setHistory(prev => prev.filter(h => h.id !== historyId));

        try {
            await firestoreService.delete(`users/${user.id}/xp_history`, historyId);
        } catch (error: any) {
            console.error(error);
            alert("Erro ao excluir histórico: " + error.message);
            fetchHistory(); // Revert on error
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm px-2 md:p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden scale-in-center flex flex-col md:flex-row max-h-[90vh] md:h-auto relative">

                {/* Left Side: Detail & Action */}
                <div className="flex-1 p-6 md:border-r border-gray-100 overflow-y-auto">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                                {(user.displayName?.[0] || "U").toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">{user.displayName}</h2>
                                <p className="text-text-secondary text-sm">{user.email}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="badge badge-primary">Nível {user.stats?.level || 1}</span>
                                    <span className="text-sm font-bold text-primary">{user.stats?.currentXp || 0} XP</span>
                                    <span className={clsx(
                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                        user.classification === 'adolescente' ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
                                    )}>
                                        {user.classification || 'pre-adolescente'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 md:hidden">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Profile Settings */}
                    <div className="bg-surface p-4 rounded-2xl space-y-4 mb-6">
                        <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                            ✏️ Dados Pessoais
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Data de Nascimento</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                    value={editBirthDate}
                                    onChange={(e) => setEditBirthDate(e.target.value)}
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={editParticipatesInRanking}
                                    onChange={(e) => setEditParticipatesInRanking(e.target.checked)}
                                />
                                <span className="text-sm font-bold text-text-primary">Participa do Ranking</span>
                            </label>

                            <Button
                                variant="outline"
                                className="w-full text-xs h-8"
                                onClick={handleUpdateProfile}
                                disabled={isSaving}
                            >
                                {isSaving ? "Salvando..." : "Salvar Dados Pessoais"}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-text-primary flex items-center gap-2">
                            <Award size={18} /> Lançamento Manual
                        </h3>

                        <div className="bg-surface p-4 rounded-2xl space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setXpType("credit")}
                                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${xpType === "credit" ? "bg-success/10 text-success" : "bg-gray-100 text-text-secondary"}`}
                                >
                                    <TrendingUp size={16} /> Adicionar
                                </button>
                                <button
                                    onClick={() => setXpType("debit")}
                                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${xpType === "debit" ? "bg-error/10 text-error" : "bg-gray-100 text-text-secondary"}`}
                                >
                                    <TrendingDown size={16} /> Remover
                                </button>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Valor (XP)</label>
                                <input
                                    type="number"
                                    className="w-full bg-white border-none rounded-xl p-3 font-bold text-lg focus:ring-2 focus:ring-primary/20"
                                    placeholder="0"
                                    value={xpAmount || ""}
                                    onChange={(e) => setXpAmount(Number(e.target.value))}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Motivo</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ex: Tarefa Extra, Comportamento..."
                                    value={xpReason}
                                    onChange={(e) => setXpReason(e.target.value)}
                                />
                            </div>

                            <Button
                                className="w-full gap-2"
                                onClick={handleAdjustXP}
                                disabled={isSaving}
                            >
                                <Save size={18} /> {isSaving ? "Lançando..." : "Lançar Pontuação"}
                            </Button>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full mt-6 border-gray-200 text-text-secondary hover:bg-gray-50"
                        onClick={onClose}
                    >
                        Fechar
                    </Button>
                </div>

                {/* Right Side: History */}
                <div className="flex-1 bg-gray-50 p-6 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-text-primary flex items-center gap-2">
                            <History size={18} /> Histórico Recente
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full md:hidden">
                            <X size={20} />
                        </button>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-black/5 rounded-full hidden md:block">
                        <X size={20} />
                    </button>

                    {loadingHistory ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
                        </div>
                    ) : history.length > 0 ? (
                        <div className="space-y-3">
                            {history.map((item) => (
                                <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-sm text-text-primary mb-1">
                                            {item.taskTitle ? (
                                                <div className="flex flex-col">
                                                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded w-fit uppercase font-bold tracking-wider mb-0.5">Requisito</span>
                                                    <span>{item.taskTitle}</span>
                                                </div>
                                            ) : (
                                                item.reason || "Ajuste Manual"
                                            )}
                                        </div>
                                        <p className="text-xs text-text-secondary flex items-center gap-1">
                                            <History size={10} />
                                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data inválida'}
                                        </p>
                                    </div>
                                    <div className={`font-bold ${item.type === 'credit' ? 'text-success' : 'text-error'} flex flex-col items-end`}>
                                        <span>{item.type === 'credit' ? '+' : ''}{item.amount} XP</span>
                                        <button
                                            onClick={() => handleDeleteHistory(item.id)}
                                            className="p-1.5 mt-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Apagar Histórico"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-text-secondary text-sm">
                            Nenhum histórico encontrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
