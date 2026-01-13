"use client";

import { useState, useEffect } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Save, ChevronLeft, Check, X } from "lucide-react";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

interface AttendanceSheetProps {
    date: Date;
    baseId: string;
    onClose: () => void;
}

interface AttendanceConfig {
    items: {
        id: string;
        label: string;
        category: "Comunhão" | "Relacionamento" | "Missão";
        points: number;
    }[];
}

interface User {
    id: string;
    displayName: string;
    role: string;
    baseId?: string;
}

// Default config fallback if fetch fails or is empty
const DEFAULT_CONFIG = [
    { id: "presence", label: "Presença", category: "Presença", points: 50 },
    { id: "punctuality", label: "Pontualidade", category: "Presença", points: 10 },
    { id: "lesson", label: "Lição", category: "Comunhão", points: 10 },
    { id: "bible", label: "Bíblia", category: "Comunhão", points: 10 },
    { id: "small_group", label: "PG", category: "Relacionamento", points: 20 },
    { id: "mission_project", label: "Missão", category: "Missão", points: 30 },
    { id: "bible_study", label: "Estudo Bíblico", category: "Missão", points: 50 },
] as const;

export default function AttendanceSheet({ date, baseId, onClose }: AttendanceSheetProps) {
    const { user } = useAuth();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const docId = `${baseId}_${dateStr}`;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState<any[]>([...DEFAULT_CONFIG]);
    const [members, setMembers] = useState<User[]>([]);

    // Map: userId -> { present: bool, items: { itemId: bool } }
    const [records, setRecords] = useState<Record<string, any>>({});

    // Track original state to calculate deltas
    const [originalRecords, setOriginalRecords] = useState<Record<string, any>>({});
    const [isLocked, setIsLocked] = useState(false);

    // 1. Fetch Config & Members & Existing Records
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch Config
                const configSnap = await getDoc(doc(db, `bases/${baseId}/attendance_config/default`));
                if (configSnap.exists()) {
                    setConfig(configSnap.data().items || [...DEFAULT_CONFIG]);
                } else {
                    setConfig([...DEFAULT_CONFIG]); // Use default if not configured
                }

                // Fetch Members (This should ideally be a query, avoiding full user dump if possible, but useCollection(users) runs heavily)
                // Let's use a specialized query if possible. Use predefined custom hook logic or direct query?
                // For now, let's assume we can fetch all users and filter. If efficient query needed: where('baseId', '==', baseId)
                // We'll use the firestoreService.getCollection with constraints if we had that exposed cleanly in useEffect.
                // Let's rely on standard logic: query users collection.
                // Since this is a specialized load, I'll write the query manually to avoid hook complexity in useEffect.

                // Fetch members manually
                // We use the `useCollection` hook logic pattern, but here we just need one-shot load
                const { collection, getDocs, query, where } = await import("firebase/firestore");
                const q = query(collection(db, "users"), where("baseId", "==", baseId), where("role", "==", "membro"));
                const querySnapshot = await getDocs(q);
                const fetchedMembers: User[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedMembers.push({ id: doc.id, ...doc.data() } as User);
                });
                setMembers(fetchedMembers.sort((a, b) => a.displayName.localeCompare(b.displayName)));

                // Fetch Existing Attendance Record
                const recordSnap = await getDoc(doc(db, "attendance_days", docId));
                if (recordSnap.exists()) {
                    const data = recordSnap.data();
                    setRecords(data.records || {});
                    setOriginalRecords(JSON.parse(JSON.stringify(data.records || {}))); // Deep copy
                    if (data.locked) setIsLocked(true);
                } else {
                    // Initialize empty
                    setRecords({});
                    setOriginalRecords({});
                }

            } catch (err) {
                console.error(err);
                alert("Erro ao carregar dados da chamada.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [baseId, docId]);

    const togglePresence = (userId: string) => {
        if (isLocked) return;
        setRecords(prev => {
            const userRec = prev[userId] || { present: false, items: {} };
            const newPresence = !userRec.present;
            const newItems = newPresence ? userRec.items : {}; // Clear items if presence is off

            return {
                ...prev,
                [userId]: { ...userRec, present: newPresence, items: newItems }
            };
        });
    };

    const toggleItem = (userId: string, itemId: string) => {
        if (isLocked) return;
        setRecords(prev => {
            const userRec = prev[userId] || { present: false, items: {} };
            const currentItems = userRec.items || {};
            // Auto-check presence if item is checked
            const newItemState = !currentItems[itemId];

            return {
                ...prev,
                [userId]: {
                    ...userRec,
                    present: newItemState ? true : userRec.present,
                    items: { ...currentItems, [itemId]: newItemState }
                }
            };
        });
    };
    const toggleColumn = (itemId: string) => {
        if (isLocked) return;

        setRecords(prev => {
            const next = { ...prev };
            // Check current state of column across all members
            // If ALL are checked, we uncheck all. Otherwise, check all.
            const allChecked = members.every(m => {
                const rec = prev[m.id] || {};
                if (itemId === 'presence') return rec.present;
                return rec.items?.[itemId];
            });

            const targetState = !allChecked;

            members.forEach(m => {
                const userRec = next[m.id] || { present: false, items: {} };

                if (itemId === 'presence') {
                    const newItems = targetState ? userRec.items : {}; // Clear items if targetState is false (unchecking presence)
                    next[m.id] = { ...userRec, present: targetState, items: newItems };
                } else {
                    const currentItems = userRec.items || {};
                    next[m.id] = {
                        ...userRec,
                        present: targetState ? true : userRec.present, // Auto-mark presence if checking item
                        items: { ...currentItems, [itemId]: targetState }
                    };
                }
            });
            return next;
        });
    };

    const calculateUserPoints = (userRec: any): number => {
        if (!userRec) return 0;
        let total = 0;

        // 1. Check for Presence
        if (userRec.present) {
            const presenceConfig = config.find(i => i.id === 'presence');
            if (presenceConfig) {
                total += (presenceConfig.points || 0);
            }
        }

        // 2. Check for other items
        if (userRec.items) {
            config.forEach(item => {
                if (item.id !== 'presence' && userRec.items[item.id]) {
                    total += (item.points || 0);
                }
            });
        }
        return total;
    };

    const handleSave = async () => {
        if (isLocked) return;
        setSaving(true);
        try {
            const { writeBatch, doc, increment, serverTimestamp, collection } = await import("firebase/firestore");

            // 1. Save Attendance Record (Main Doc)
            // We do this in the first batch or alone.
            const attendanceRef = doc(db, "attendance_days", docId);

            // We will accumulate all operations first to know how many we have?
            // Actually, calculating delta is cheap. Let's build a list of "Effects".

            interface Effect {
                type: 'user_update' | 'history';
                ref: any;
                data: any;
            }
            const effects: Effect[] = [];

            // Main Attendance Doc
            effects.push({
                type: 'user_update', // Abuse type for generic set
                ref: attendanceRef,
                data: {
                    baseId,
                    date: Timestamp.fromDate(date),
                    records,
                    locked: true,
                    updatedAt: serverTimestamp(),
                    updatedBy: user?.uid
                }
            });

            // User Updates
            for (const member of members) {
                const oldPoints = calculateUserPoints(originalRecords[member.id]);
                const newPoints = calculateUserPoints(records[member.id]);
                const delta = newPoints - oldPoints;

                if (delta !== 0) {
                    const userRef = doc(db, "users", member.id);
                    effects.push({
                        type: 'user_update',
                        ref: userRef,
                        data: { "stats.currentXp": increment(delta) }
                    });

                    const historyRef = doc(collection(db, `users/${member.id}/xp_history`));
                    effects.push({
                        type: 'history',
                        ref: historyRef,
                        data: {
                            amount: delta,
                            reason: `Chamada (${date.toLocaleDateString('pt-BR')})`,
                            type: delta > 0 ? 'earn' : 'penalty',
                            createdAt: serverTimestamp(),
                            createdBy: user?.uid
                        }
                    });
                }
            }

            // 2. Update Base Total XP (for Ranking)
            const totalDelta = members.reduce((sum, member) => {
                const oldPoints = calculateUserPoints(originalRecords[member.id]);
                const newPoints = calculateUserPoints(records[member.id]);
                return sum + (newPoints - oldPoints);
            }, 0);

            if (totalDelta !== 0) {
                const baseRef = doc(db, "bases", baseId);
                effects.push({
                    type: 'user_update',
                    ref: baseRef,
                    data: { totalXp: increment(totalDelta) }
                });
            }

            // Execute in chunks of 50 to avoid "Rule evaluation limit" or "Batch limit"
            const chunkSize = 50;
            for (let i = 0; i < effects.length; i += chunkSize) {
                const batch = writeBatch(db);
                const chunk = effects.slice(i, i + chunkSize);

                chunk.forEach(eff => {
                    if (eff.ref === attendanceRef) {
                        // Main attendance document
                        batch.set(eff.ref, eff.data, { merge: true });
                    } else if (eff.type === 'history') {
                        // XP history subcollection
                        batch.set(eff.ref, eff.data);
                    } else if (eff.type === 'user_update') {
                        // User stats update (uses increment)
                        batch.update(eff.ref, eff.data);
                    } else {
                        // Fallback
                        batch.set(eff.ref, eff.data, { merge: true });
                    }
                });
                await batch.commit();
            }

            alert("Chamada salva e pontuação atualizada!");
            onClose();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao salvar: " + (error.message || "Erro desconhecido"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center">Carregando chamada...</div>;

    const categories = Array.from(new Set(config.map((c: any) => c.category)));

    return (
        <div className="space-y-6 animate-fade-in bg-white p-6 rounded-3xl min-h-screen">
            <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        <ChevronLeft size={20} />
                        Voltar
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">
                            Chamada: {date.toLocaleDateString("pt-BR")}
                        </h2>
                        <p className="text-sm text-text-secondary">{members.length} Membros listados</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className={saving ? "opacity-50" : ""}>
                    <Save size={20} className="mr-2" />
                    {saving ? "Salvando..." : "Salvar Chamada"}
                </Button>
            </div>

            <div className="overflow-x-auto custom-scrollbar pb-12">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-text-secondary uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-xl text-gray-900 font-bold text-sm">Membro</th>
                            <th className="px-2 py-3 text-center min-w-[90px] align-bottom">
                                <div className="flex flex-col items-center justify-end h-full gap-2">
                                    <span className="leading-tight text-xs block font-extrabold text-gray-800 uppercase tracking-tight">Presença</span>
                                    <span className="text-[11px] text-gray-700 font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                                        {config.find(c => c.id === 'presence')?.points || 0} pts
                                    </span>
                                    <button
                                        onClick={() => toggleColumn('presence')}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded transition-colors mt-1"
                                        title="Marcar Todos"
                                    >
                                        <Check size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </th>
                            <th className="px-2 py-3 text-center min-w-[90px] align-bottom">
                                <div className="flex flex-col items-center justify-end h-full gap-2">
                                    <span className="leading-tight text-xs block font-extrabold text-gray-800 uppercase tracking-tight">Pontualidade</span>
                                    <span className="text-[11px] text-gray-700 font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                                        {config.find(c => c.id === 'punctuality')?.points || 0} pts
                                    </span>
                                    <button
                                        onClick={() => toggleColumn('punctuality')}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded transition-colors mt-1"
                                        title="Marcar Todos"
                                    >
                                        <Check size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </th>
                            {config.filter(item => item.id !== 'presence' && item.id !== 'punctuality').map((item: any) => (
                                <th key={item.id} className="px-2 py-3 text-center min-w-[100px] align-bottom">
                                    <div className="flex flex-col items-center justify-end h-full gap-2">
                                        <span className="whitespace-normal leading-tight text-xs block font-bold text-gray-800 uppercase tracking-tight">{item.label}</span>
                                        <span className="text-[11px] text-gray-600 font-bold bg-gray-50 px-1.5 py-0.5 rounded-md">
                                            {item.points} pts
                                        </span>
                                        <button
                                            onClick={() => toggleColumn(item.id)}
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded transition-colors mt-1"
                                            title="Marcar Todos"
                                        >
                                            <Check size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {members.map(member => {
                            const rec = records[member.id] || { present: false, items: {} };
                            return (
                                <tr key={member.id} className={`hover:bg-blue-50/30 transition-colors ${rec.present ? 'bg-blue-50/10' : ''}`}>
                                    <td className="px-4 py-4 font-medium text-text-primary whitespace-nowrap">
                                        {member.displayName}
                                    </td>
                                    <td className="px-2 py-4 text-center">
                                        <button
                                            onClick={() => togglePresence(member.id)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${rec.present ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                                }`}
                                        >
                                            {rec.present ? <Check size={18} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                                        </button>
                                    </td>
                                    {/* Punctuality Column */}
                                    <td className="px-2 py-4 text-center">
                                        <button
                                            onClick={() => toggleItem(member.id, 'punctuality')}
                                            disabled={!rec.present} // Cannot be punctual if not present? Optional rule, but logical.
                                            className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center transition-all border-2 ${rec.items?.['punctuality']
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'bg-white border-gray-200 text-transparent hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            <Check size={16} strokeWidth={4} />
                                        </button>
                                    </td>
                                    {config.filter(item => item.id !== 'presence' && item.id !== 'punctuality').map((item: any) => {
                                        const checked = rec.items?.[item.id] || false;
                                        return (
                                            <td key={item.id} className="px-2 py-4 text-center">
                                                <button
                                                    onClick={() => toggleItem(member.id, item.id)}
                                                    className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center transition-all border-2 ${checked
                                                        ? 'bg-blue-500 border-blue-500 text-white'
                                                        : 'bg-white border-gray-200 text-transparent hover:border-blue-300'
                                                        }`}
                                                >
                                                    <Check size={16} strokeWidth={4} />
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {members.length === 0 && (
                            <tr>
                                <td colSpan={2 + config.length} className="px-4 py-8 text-center text-text-secondary">
                                    Nenhum membro encontrado nesta base.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
