"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
    Settings,
    BookOpen,
    Zap,
    Save,
    Plus,
    Trash2,
    ChevronRight,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";

interface XpConfig {
    profileCompletion: number;
    quizCorrectAnswer: number;
    streakBonus: number;
    dailyLogin: number;
}

interface ReadingMeta {
    id: string;
    title: string;
    chapters: number;
    xpReward: number;
}

export default function SettingsPage() {
    const [xpConfig, setXpConfig] = useState({
        profileCompletion: 100,
        quizCorrectAnswer: 10,
        streakBonus: 5,
        dailyLogin: 20
    });

    const [readingMetas, setReadingMetas] = useState<ReadingMeta[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const configDoc = await getDoc(doc(db, "settings", "gamification"));
                if (configDoc.exists()) {
                    setXpConfig(configDoc.data() as XpConfig);
                }

                // Load reading metas from a separate collection
                // For simplicity in this demo/MVP, we'll use a subcollection or dedicated docs
                const readingDoc = await getDoc(doc(db, "settings", "reading"));
                if (readingDoc.exists()) {
                    setReadingMetas(readingDoc.data().metas || []);
                }
            } catch (error) {
                console.error("Error loading configs:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadConfigs();
    }, []);

    const handleSaveGamification = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "settings", "gamification"), xpConfig);
            alert("Configurações de XP salvas com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar configurações.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveReading = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "settings", "reading"), { metas: readingMetas });
            alert("Metas de leitura atualizadas!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar metas.");
        } finally {
            setIsSaving(false);
        }
    };

    const addReadingMeta = () => {
        const newMeta: ReadingMeta = {
            id: Date.now().toString(),
            title: "Novo Plano",
            chapters: 1,
            xpReward: 50
        };
        setReadingMetas([...readingMetas, newMeta]);
    };

    const updateReadingMeta = (id: string, updates: Partial<ReadingMeta>) => {
        setReadingMetas(readingMetas.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const removeReadingMeta = (id: string) => {
        setReadingMetas(readingMetas.filter(m => m.id !== id));
    };

    if (isLoading) return <div className="p-8 animate-pulse text-text-secondary">Carregando configurações...</div>;

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configurações do Sistema</h1>
                <p className="text-text-secondary">Ajuste as regras de gamificação e planos de leitura.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* XP Settings */}
                <div className="card-soft p-6 space-y-6">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <Zap size={20} />
                        <h2>Ajustes de Pontuação (XP)</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary">XP por Login Diário</label>
                            <input
                                type="number"
                                className="w-full bg-surface border-none rounded-xl p-3"
                                value={xpConfig.dailyLogin}
                                onChange={e => setXpConfig({ ...xpConfig, dailyLogin: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary">XP por Acerto no Quiz</label>
                            <input
                                type="number"
                                className="w-full bg-surface border-none rounded-xl p-3"
                                value={xpConfig.quizCorrectAnswer}
                                onChange={e => setXpConfig({ ...xpConfig, quizCorrectAnswer: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary">Bônus de Ofensiva (Global)</label>
                            <input
                                type="number"
                                className="w-full bg-surface border-none rounded-xl p-3"
                                value={xpConfig.streakBonus}
                                onChange={e => setXpConfig({ ...xpConfig, streakBonus: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    <Button onClick={handleSaveGamification} disabled={isSaving} className="w-full gap-2">
                        <Save size={18} />
                        Salvar Pontuação
                    </Button>
                </div>

                {/* Reading Meta Logic */}
                <div className="card-soft p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <BookOpen size={20} />
                            <h2>Plano de Leitura</h2>
                        </div>
                        <button onClick={addReadingMeta} className="text-primary hover:bg-primary/5 p-2 rounded-lg transition-colors">
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {readingMetas.map(meta => (
                            <div key={meta.id} className="p-3 bg-surface rounded-xl border border-gray-50 flex items-center justify-between group">
                                <div className="flex-1 space-y-1">
                                    <input
                                        className="bg-transparent border-none p-0 font-bold text-sm w-full focus:ring-0"
                                        value={meta.title}
                                        onChange={e => updateReadingMeta(meta.id, { title: e.target.value })}
                                    />
                                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                                        <span>Meta:</span>
                                        <input
                                            type="number"
                                            className="bg-transparent border-none p-0 w-8 focus:ring-0 text-primary font-bold"
                                            value={meta.chapters}
                                            onChange={e => updateReadingMeta(meta.id, { chapters: parseInt(e.target.value) })}
                                        />
                                        <span>capitúlos =</span>
                                        <input
                                            type="number"
                                            className="bg-transparent border-none p-0 w-8 focus:ring-0 text-success font-bold"
                                            value={meta.xpReward}
                                            onChange={e => updateReadingMeta(meta.id, { xpReward: parseInt(e.target.value) })}
                                        />
                                        <span>XP</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeReadingMeta(meta.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {readingMetas.length === 0 && (
                            <p className="text-center text-xs text-text-secondary py-8">Nenhuma meta configurada.</p>
                        )}
                    </div>

                    <Button onClick={handleSaveReading} disabled={isSaving} variant="outline" className="w-full border-primary text-primary hover:bg-primary/5">
                        Atualizar Metas
                    </Button>
                </div>
            </div>

            {/* General Info */}
            <div className="card-soft p-6 bg-gradient-to-br from-primary to-blue-700 text-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Regras do Servidor</h3>
                        <p className="text-white/80 text-sm">Essas configurações afetam todos os usuários do aplicativo mobile em tempo real.</p>
                    </div>
                    <ChevronRight className="ml-auto opacity-50" />
                </div>
            </div>

            {/* Danger Zone */}
            {/* <DangerZone /> - Defined internally for safety */}
            <DangerZone />
        </div>

    );
}


function DangerZone() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Only fetch bases if master, otherwise we just use current user's base
    const { data: bases } = useCollection("bases");
    const [selectedBaseId, setSelectedBaseId] = useState<string>("all");
    const [resetOptions, setResetOptions] = useState({
        xp: true,
        history: true,
        attendance: true,
        submissions: true
    });

    // Enforce base selection if coord_base
    useEffect(() => {
        if (user?.role === 'coord_base' && user.baseId) {
            setSelectedBaseId(user.baseId);
        }
    }, [user]);

    // Helper: Delete in chunks of 400 to be safe
    const safeBatchDelete = async (docs: any[], db: any, writeBatch: any, doc: any) => {
        const chunkSize = 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach((d: any) => batch.delete(d.ref));
            await batch.commit();
        }
    };

    const handleSystemReset = async () => {
        if (!user) return;

        // Safety check for role
        if (user.role !== 'master' && user.role !== 'admin' && user.role !== 'coord_base') {
            alert("Sem permissão.");
            return;
        }

        const targetName = selectedBaseId === 'all'
            ? "TODAS AS BASES (GLOBAL)"
            : `BASE: ${bases.find((b: any) => b.id === selectedBaseId)?.name || 'Selecionada'}`;

        const itemsToReset = [];
        if (resetOptions.xp) itemsToReset.push('Pontuação (XP) dos membros');
        if (resetOptions.history) itemsToReset.push('Histórico de Pontos');
        if (resetOptions.attendance) itemsToReset.push('Chamadas (Attendance)');
        if (resetOptions.submissions) itemsToReset.push('Submissões');

        if (itemsToReset.length === 0) {
            alert('Selecione pelo menos uma opção para resetar.');
            return;
        }

        const confirm1 = window.confirm(`PERIGO 🚨\n\nIsso irá APAGAR PERMANENTEMENTE:\n${itemsToReset.map(item => `- ${item}`).join('\n')}\n\nAlvo: ${targetName}\n\nDeseja continuar?`);
        if (!confirm1) return;

        const phrase = "RESETAR AGORA";
        const confirm2 = window.prompt(`Digite '${phrase}' para confirmar a DESTRUIÇÃO dos dados:`);
        if (confirm2 !== phrase) return;

        setIsLoading(true);
        try {
            const { getDocs, collection, writeBatch, doc, query, where } = await import("firebase/firestore");
            const { db } = await import("@/services/firebase");

            console.log("Iniciando Reset...");

            // 1. ZERAR USUÁRIOS (Update Stats + Delete History)
            if (resetOptions.xp || resetOptions.history) {
                let usersQuery;
                if (selectedBaseId === 'all') {
                    usersQuery = collection(db, "users");
                } else {
                    usersQuery = query(collection(db, "users"), where("baseId", "==", selectedBaseId));
                }

                const usersSnap = await getDocs(usersQuery);
                console.log(`Encontrados ${usersSnap.size} usuários para resetar.`);

                const userDocs = usersSnap.docs;
                const chunkSize = 400;

                // Update Users Stats in Chunks
                if (resetOptions.xp) {
                    for (let i = 0; i < userDocs.length; i += chunkSize) {
                        const batch = writeBatch(db);
                        const chunk = userDocs.slice(i, i + chunkSize);

                        for (const userDoc of chunk) {
                            // Reset Stats
                            batch.update(doc(db, "users", userDoc.id), {
                                "stats.currentXp": 0,
                                "stats.level": 1,
                                "stats.completedTasks": 0
                            });
                        }
                        await batch.commit();
                    }
                }

                // Delete History (Iterate users individually)
                if (resetOptions.history) {
                    for (const userDoc of userDocs) {
                        const historySnap = await getDocs(collection(db, `users/${userDoc.id}/xp_history`));
                        await safeBatchDelete(historySnap.docs, db, writeBatch, doc);
                    }
                }
            }

            // 2. APAGAR CHAMADAS (Attendance Days)
            if (resetOptions.attendance) {
                let attendanceQuery;
                if (selectedBaseId === 'all') {
                    attendanceQuery = collection(db, "attendance_days");
                } else {
                    attendanceQuery = query(collection(db, "attendance_days"), where("baseId", "==", selectedBaseId));
                }
                const attSnap = await getDocs(attendanceQuery);
                console.log(`Apagando ${attSnap.size} dias de chamada...`);
                await safeBatchDelete(attSnap.docs, db, writeBatch, doc);
            }

            // 3. APAGAR SUBMISSÕES
            if (resetOptions.submissions) {
                let subsQuery;
                if (selectedBaseId === 'all') {
                    subsQuery = collection(db, "submissions");
                } else {
                    subsQuery = query(collection(db, "submissions"), where("userBaseId", "==", selectedBaseId));
                }
                const subsSnap = await getDocs(subsQuery);
                console.log(`Apagando ${subsSnap.size} submissões...`);
                await safeBatchDelete(subsSnap.docs, db, writeBatch, doc);
            }

            alert(`✅ SUCESSO!\n\nO sistema foi zerado completamente para: ${targetName}`);
        } catch (error: any) {
            console.error(error);
            alert("ERRO CRÍTICO AO RESETAR: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (user?.role !== 'master' && user?.role !== 'coord_base') return null;

    return (
        <div className="card-soft p-6 border-2 border-red-100 bg-red-50/50 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 size={20} />
                <h2>Zona de Perigo (Reset Total)</h2>
            </div>
            <p className="text-sm text-red-800">
                Ações irreversíveis. Zera pontuação, apaga histórico e chamadas.
            </p>

            {user.role === 'master' && (
                <select
                    className="w-full p-2 rounded-lg border border-red-200 bg-white mb-2"
                    value={selectedBaseId}
                    onChange={(e) => setSelectedBaseId(e.target.value)}
                >
                    <option value="all">Todas as Bases (Reset Global)</option>
                    {bases.map((base: any) => (
                        <option key={base.id} value={base.id}>{base.name}</option>
                    ))}
                </select>
            )}

            <div className="space-y-2 mb-4">
                <p className="text-sm font-semibold text-red-700">Selecione o que deseja zerar:</p>
                <label className="flex items-center gap-2 text-sm text-red-800">
                    <input
                        type="checkbox"
                        checked={resetOptions.xp}
                        onChange={(e) => setResetOptions({ ...resetOptions, xp: e.target.checked })}
                        className="rounded"
                    />
                    Pontuação (XP) dos membros
                </label>
                <label className="flex items-center gap-2 text-sm text-red-800">
                    <input
                        type="checkbox"
                        checked={resetOptions.history}
                        onChange={(e) => setResetOptions({ ...resetOptions, history: e.target.checked })}
                        className="rounded"
                    />
                    Histórico de Pontos
                </label>
                <label className="flex items-center gap-2 text-sm text-red-800">
                    <input
                        type="checkbox"
                        checked={resetOptions.attendance}
                        onChange={(e) => setResetOptions({ ...resetOptions, attendance: e.target.checked })}
                        className="rounded"
                    />
                    Chamadas (Attendance)
                </label>
                <label className="flex items-center gap-2 text-sm text-red-800">
                    <input
                        type="checkbox"
                        checked={resetOptions.submissions}
                        onChange={(e) => setResetOptions({ ...resetOptions, submissions: e.target.checked })}
                        className="rounded"
                    />
                    Submissões
                </label>
            </div>

            <Button
                disabled={isLoading}
                onClick={handleSystemReset}
                className="w-full bg-red-600 hover:bg-red-700 text-white border-none font-bold"
            >
                {isLoading ? "PROCESSANDO (Pode demorar)..." : "ZERAR BASE / SISTEMA"}
            </Button>
        </div>
    );
}
