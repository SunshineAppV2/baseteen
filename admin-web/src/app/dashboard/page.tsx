"use client";

import { useCollection } from "@/hooks/useFirestore";
import {
    Users,
    CheckCircle2,
    Clock,
    TrendingUp,
    BarChart3,
    PieChart as PieChartIcon,
    Layers,
    CalendarCheck,
    X,
    Trash2,
    Filter,
    Share2,
    Copy,
    CheckCircle
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { firestoreService } from "@/hooks/useFirestore";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { clsx } from "clsx";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from "recharts";

interface User {
    id: string;
    displayName: string;
    districtId?: string;
    birthDate?: string;
    stats?: {
        level: number;
        currentXp: number;
    };
    baseId?: string;
    role?: string;
}

interface Submission {
    id: string;
    status: "pending" | "approved" | "rejected";
    taskTitle?: string;
    userName?: string; // or userDisplayName
    createdAt?: any;
    updatedAt?: any;
    baseId?: string; // For filtering
}

interface District {
    id: string;
    name: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

import { where } from "firebase/firestore";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { user: currentUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const [selectedStat, setSelectedStat] = useState<string | null>(null);
    const [modalData, setModalData] = useState<Submission[]>([]);
    const [modalTitle, setModalTitle] = useState("");
    const [filterBase, setFilterBase] = useState<string>("all");
    const [copiedLink, setCopiedLink] = useState(false);

    const userConstraints = useMemo(() => {
        if (!currentUser) return []; // Should ideally fetch nothing if not auth, but rules handle it
        if (currentUser.role === 'coord_base' && currentUser.baseId) return [where('baseId', '==', currentUser.baseId)];
        if (currentUser.role === 'coord_distrital' && currentUser.districtId) return [where('districtId', '==', currentUser.districtId)];
        return [];
    }, [currentUser]);

    const subConstraints = useMemo(() => {
        if (!currentUser) return [];

        // Membro: Apenas suas próprias
        if (currentUser.role === 'membro') return [where('userId', '==', currentUser.uid)];

        // Coord Base: Apenas da base
        if (currentUser.role === 'coord_base' && currentUser.baseId) return [where('baseId', '==', currentUser.baseId)];

        // Master, Geral, Distrital, Secretaria: TODOS
        if (['master', 'coord_geral', 'coord_distrital', 'secretaria'].includes(currentUser.role || '')) {
            return [];
        }

        return [where('id', '==', '0')]; // Fallback safe
    }, [currentUser]);

    // Only fetch if we have a user (to avoid permission errors on initial load)
    // We pass a dummy 'false' constraint key if no user to force empty? No, hook doesn't support that.
    // Instead we rely on the constraints. If currentUser is null, constraints are empty. 
    // For submissions, empty constraints = "get all" -> Permission Denied for unauth.
    // But if !currentUser, we shouldn't be here (protected route?).
    // Just in case, let's limit if !currentUser.

    const safeSubConstraints = !currentUser ? [where('id', '==', '0')] : subConstraints;
    const safeUserConstraints = !currentUser ? [where('id', '==', '0')] : userConstraints;

    const { data: users, loading: loadingUsers } = useCollection<User>("users", safeUserConstraints);
    const { data: submissions, loading: loadingSubs } = useCollection<Submission>("submissions", safeSubConstraints);
    const { data: districts, loading: loadingDistricts } = useCollection<District>("districts");
    const { data: bases } = useCollection<Base>("bases");

    const pendingCount = submissions.filter(s => s.status === "pending").length;
    const approvedCount = submissions.filter(s => s.status === "approved").length;

    // Simple engagement metric
    const engagement = users.length > 0
        ? Math.min(Math.round((approvedCount / (users.length * 2)) * 100), 100)
        : 0;

    // Filter Users by Scope: Already filtered by database query
    const filteredUsers = users;

    // Chart Data Preparation: Users per District (Filtered)
    const districtData = districts
        .filter(d => {
            if (currentUser?.role === 'coord_distrital') return d.id === currentUser.districtId;
            // Base coords usually don't see district chart, or only their district?
            // If Base Coord, show their district only
            if (currentUser?.role === 'coord_base') return d.id === currentUser.districtId;
            return true;
        })
        .map(d => {
            const districtUsers = filteredUsers.filter(u => u.districtId === d.id);
            const totalXp = districtUsers.reduce((acc, u) => acc + (u.stats?.currentXp || 0), 0);
            return {
                name: d.name,
                users: districtUsers.length,
                xp: totalXp
            };
        }).sort((a, b) => b.users - a.users);

    // Birthdays Logic
    const currentMonth = new Date().getMonth();
    const currentDay = new Date().getDate();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const birthdays = filteredUsers
        .filter(u => {
            if (!u.birthDate) return false;
            // Parse YYYY-MM-DD
            const [year, month, day] = u.birthDate.split('-').map(Number);
            // JS Month is 0-indexed, input is 1-indexed
            return (month - 1) === currentMonth;
        })
        .sort((a, b) => {
            const dayA = Number(a.birthDate!.split('-')[2]);
            const dayB = Number(b.birthDate!.split('-')[2]);
            return dayA - dayB;
        });

    const stats = [
        {
            key: "pending",
            label: "Provas Pendentes",
            value: loadingSubs ? "..." : pendingCount.toString(),
            icon: Clock,
            color: "bg-orange-500/10 text-orange-600",
            trend: pendingCount > 0 ? "Ação necessária" : "Tudo em dia",
            action: () => router.push("/approvals")
        },
        {
            key: "approved",
            label: "Tarefas Concluídas",
            value: loadingSubs ? "..." : approvedCount.toString(),
            icon: CheckCircle2,
            color: "bg-green-500/10 text-green-600",
            trend: null,
            action: () => {
                setModalData(submissions.filter(s => s.status === 'approved').sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)));
                setModalTitle("Tarefas Concluídas");
                setSelectedStat("approved");
            }
        }
    ];

    const closeDetailModal = () => {
        setSelectedStat(null);
        setModalData([]);
        setFilterBase("all");
    };

    const handleDeleteSubmission = async (submissionId: string) => {
        if (currentUser?.role !== 'master') return;

        if (!confirm("⚠️ ATENÇÃO: Deseja realmente apagar este registro de tarefa concluída?\n\nIsso remove o registro da prova, mas NÃO remove o XP que já foi creditado ao usuário. Se necessário, vá ao perfil do usuário e remova o XP manualmente.")) {
            return;
        }

        try {
            await firestoreService.delete("submissions", submissionId);
            setModalData(prev => prev.filter(item => item.id !== submissionId));
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir registro.");
        }
    };

    // Filter Logic
    const availableBases = useMemo(() => {
        const baseIds = Array.from(new Set(modalData.map(s => s.baseId).filter(Boolean)));
        return baseIds.map(bid => {
            const b = bases.find(base => base.id === bid);
            return {
                id: bid!,
                name: b ? b.name : `Base Deletada/ID: ${bid?.substring(0, 5)}...`
            };
        });
    }, [modalData, bases]);

    const filteredModalData = modalData.filter(item => {
        if (filterBase === 'all') return true;
        return item.baseId === filterBase;
    });

    const handleBulkDelete = async () => {
        if (currentUser?.role !== 'master') return;
        if (filterBase === 'all') return alert("Selecione uma base específica para excluir em massa.");

        const count = filteredModalData.length;
        if (count === 0) return;

        if (!confirm(`⚠️ PERIGO: Você está prestes a excluir ${count} registros de tarefas da base selecionada.\n\nEsta ação é IRREVERSÍVEL e não ajusta o XP dos usuários.\n\nTem certeza absoluta?`)) {
            return;
        }

        try {
            const batch = writeBatch(db);
            filteredModalData.forEach(item => {
                const ref = doc(db, "submissions", item.id);
                batch.delete(ref);
            });
            await batch.commit();

            // Update local state
            const deletedIds = filteredModalData.map(i => i.id);
            setModalData(prev => prev.filter(i => !deletedIds.includes(i.id)));
            alert("Registros excluídos com sucesso.");
        } catch (error) {
            console.error(error);
            alert("Erro na exclusão em massa.");
        }
    };

    const handleCopyInvite = () => {
        if (!currentUser) return;

        const baseUrl = window.location.origin + "/login";
        const params = new URLSearchParams({
            unionId: currentUser.unionId || "",
            associationId: currentUser.associationId || "",
            regionId: currentUser.regionId || "",
            districtId: currentUser.districtId || "",
            baseId: currentUser.baseId || ""
        });

        // Find program from current user bases or default
        const currentBase = bases.find(b => b.id === currentUser.baseId);
        if (currentBase && (currentBase as any).program) {
            params.append('program', (currentBase as any).program);
        }

        const link = `${baseUrl}?${params.toString()}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Painel de Controle</h1>
                    <p className="text-text-secondary">
                        Visão geral do engajamento e desempenho por distrito.
                    </p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                    {((currentUser?.role === 'coord_base' && currentUser.baseId) || currentUser?.role === 'master') && (
                        <Button
                            onClick={handleCopyInvite}
                            className={clsx(
                                "h-auto py-2.5 px-4 font-bold transition-all flex items-center gap-2 shadow-sm rounded-xl border-none",
                                copiedLink ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary-dark"
                            )}
                        >
                            {copiedLink ? <CheckCircle size={18} /> : <Share2 size={18} />}
                            {copiedLink ? "Copiado!" : "Convidar Membros"}
                        </Button>
                    )}
                    <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                        <Layers size={18} className="text-primary" />
                        <span className="text-sm font-bold">{districts.length} {districts.length === 1 ? 'Distrito' : 'Distritos'}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="card-soft p-6 space-y-4 cursor-pointer hover:shadow-md transition-all active:scale-95"
                        onClick={stat.action}
                    >
                        <div className="flex items-center justify-between">
                            <div className={stat.color + " p-2 rounded-lg"}>
                                <stat.icon size={24} />
                            </div>
                            {stat.value !== "..." && stat.trend && (
                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    {stat.trend}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">{stat.label}</p>
                            <p className="text-3xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {selectedStat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold text-lg">{modalTitle}</h3>
                            <button onClick={closeDetailModal} className="p-2 hover:bg-gray-200 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Filter Bar */}
                        {currentUser?.role === 'master' && availableBases.length > 0 && (
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex gap-2 overflow-x-auto">
                                <div className="flex items-center gap-1 text-xs font-bold text-text-secondary whitespace-nowrap">
                                    <Filter size={12} />
                                    Filtrar Base:
                                </div>
                                <select
                                    className="text-xs border rounded px-2 py-1"
                                    value={filterBase}
                                    onChange={(e) => setFilterBase(e.target.value)}
                                >
                                    <option value="all">Todas ({modalData.length})</option>
                                    {availableBases.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} ({modalData.filter(s => s.baseId === b.id).length})
                                        </option>
                                    ))}
                                </select>
                                {filterBase !== 'all' && filteredModalData.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="text-[10px] bg-red-100 text-red-600 font-bold px-3 py-1 rounded hover:bg-red-200 ml-auto"
                                    >
                                        Excluir {filteredModalData.length} itens
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {filteredModalData.length > 0 ? (
                                filteredModalData.map(item => (
                                    <div key={item.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center group">
                                        <div className="flex justify-between items-start flex-1">
                                            <div>
                                                <p className="font-bold text-sm text-text-primary">{item.taskTitle || "Tarefa sem título"}</p>
                                                <p className="text-xs text-text-secondary mt-1">{item.userName || "Usuário desconhecido"}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full uppercase">
                                                    {item.updatedAt?.toDate ? item.updatedAt.toDate().toLocaleDateString('pt-BR') : 'Data n/a'}
                                                </span>
                                            </div>
                                        </div>
                                        {currentUser?.role === 'master' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSubmission(item.id);
                                                }}
                                                className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                title="Apagar Registro (Master)"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-8">Nenhum registro encontrado.</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100">
                            <Button onClick={closeDetailModal} className="w-full" variant="outline">
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Section Removed by User Request */}


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card-soft p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="text-orange-500" size={20} />
                        <h2 className="text-lg font-bold">Aprovações Pendentes</h2>
                    </div>
                    {pendingCount > 0 ? (
                        <div className="space-y-4">
                            <p className="text-text-secondary text-sm">Existem {pendingCount} provas aguardando sua revisão.</p>
                            <div className="flex items-center gap-2 text-primary font-bold text-sm">
                                <a href="/approvals" className="hover:underline flex items-center gap-1">
                                    Ir para fila de aprovação <TrendingUp size={14} />
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-text-secondary">
                            <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20 text-green-500" />
                            <p>Tudo em dia! Nenhuma prova urgente pendente.</p>
                        </div>
                    )}
                </div>

                <div className="card-soft p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-primary" size={20} />
                        <h2 className="text-lg font-bold">Elite do Ranking (Top 5)</h2>
                    </div>
                    <div className="space-y-4">
                        {users
                            .sort((a, b) => (b.stats?.currentXp || 0) - (a.stats?.currentXp || 0))
                            .slice(0, 5)
                            .map((u, i) => (
                                <div key={u.id} className="flex items-center gap-4 p-2 hover:bg-surface rounded-xl transition-colors">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                        ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            i === 1 ? 'bg-gray-100 text-gray-700' :
                                                i === 2 ? 'bg-orange-100 text-orange-700' : 'text-text-secondary'}`}
                                    >
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-text-primary">{u.displayName || "Usuário"}</span>
                                            <span className="text-[10px] text-text-secondary">
                                                {districts.find(d => d.id === u.districtId)?.name || 'Sem Distrito'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-bold text-primary">{currentUser?.role !== 'membro' ? `${u.stats?.currentXp || 0} XP` : ''}</span>
                                    </div>
                                </div>
                            ))}
                        {users.length === 0 && !loadingUsers && (
                            <p className="text-center py-4 text-text-secondary">Nenhum usuário cadastrado.</p>
                        )}
                    </div>
                </div>


                {/* Birthdays Widget */}
                <div className="card-soft p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarCheck className="text-pink-500" size={20} />
                        <h2 className="text-lg font-bold">Aniversários de {monthNames[currentMonth]}</h2>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {birthdays.length > 0 ? (
                            birthdays.map(u => {
                                const d = new Date(u.birthDate! + 'T12:00:00');
                                const day = d.getDate();
                                const isToday = day === currentDay;

                                return (
                                    <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isToday ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-100'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs ${isToday ? 'bg-pink-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                                            <span className="text-[10px] uppercase opacity-80">{monthNames[currentMonth].substring(0, 3)}</span>
                                            <span className="text-lg leading-none">{day}</span>
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${isToday ? 'text-pink-700' : 'text-text-primary'}`}>{u.displayName}</p>
                                            {isToday && <p className="text-[10px] font-bold text-pink-500 uppercase flex items-center gap-1">🎉 É hoje!</p>}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center py-8 text-text-secondary">
                                <p>Nenhum aniversariante este mês.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );
}
