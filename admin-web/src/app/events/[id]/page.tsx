"use client";

import { use, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Calendar,
    MapPin,
    CheckCircle2,
    Users,
    Search,
    Save,
    ArrowLeft,
    Plus,
    Trash2,
    Share2,
    Gamepad,
    Link as LinkIcon,
    X,
    AlertCircle
} from "lucide-react";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

interface Event {
    id: string;
    title: string;
    description: string;
    date: any;
    location?: string;
    status: 'draft' | 'open' | 'active' | 'finished';
    linkedQuizzes?: string[];
}

interface User {
    id: string;
    displayName: string;
    role: string;
    baseId: string;
    baseName?: string;
}

interface Registration {
    id: string;
    userId: string;
    baseId: string;
    userDisplayName?: string;
    baseName?: string;
}

interface MasterQuiz {
    id: string;
    title: string;
    questions?: any[];
}

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    // Data
    const { data: events } = useCollection<Event>("events", [where("__name__", "==", eventId)]);
    const event = events[0];
    const { data: allQuizzes } = useCollection<MasterQuiz>("master_quizzes");

    const isManager = user?.role === 'master' || user?.role === 'coord_geral' || user?.role === 'admin' || user?.role === 'secretaria';
    const isBaseCoord = user?.role === 'coord_base';

    // Base Coord State
    const [baseMembers, setBaseMembers] = useState<User[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Manager State
    const [totalRegistrations, setTotalRegistrations] = useState(0);
    const [registrationsByBase, setRegistrationsByBase] = useState<Record<string, Registration[]>>({});
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!event || !user) return;

        const loadData = async () => {
            setLoadingMembers(true);
            try {
                if (isBaseCoord) {
                    // Base Coord: Load Members
                    const usersRef = collection(db, "users");
                    const qUsers = query(usersRef, where("baseId", "==", user.baseId));
                    const snapUsers = await getDocs(qUsers);
                    const members = snapUsers.docs
                        .map(d => ({ id: d.id, ...d.data() } as User))
                        .sort((a, b) => a.displayName.localeCompare(b.displayName));
                    setBaseMembers(members);

                    // Load Registrations for Base
                    const regsRef = collection(db, "event_registrations");
                    const qRegs = query(
                        regsRef,
                        where("eventId", "==", eventId),
                        where("baseId", "==", user.baseId)
                    );
                    const snapRegs = await getDocs(qRegs);
                    const regs = snapRegs.docs.map(d => ({ id: d.id, ...d.data() } as Registration));
                    setRegistrations(regs);
                    setSelectedUsers(new Set(regs.map(r => r.userId)));
                }

                if (isManager) {
                    // Manager: Load All Registrations
                    const regsRef = collection(db, "event_registrations");
                    const qAll = query(regsRef, where("eventId", "==", eventId));
                    const snapAll = await getDocs(qAll);
                    setTotalRegistrations(snapAll.size);

                    // Group by Base
                    const grouped: Record<string, Registration[]> = {};
                    snapAll.docs.forEach(doc => {
                        const data = doc.data() as Omit<Registration, 'id'>;
                        const bName = data.baseName || `Base ${data.baseId?.substring(0, 5)}...`;
                        if (!grouped[bName]) grouped[bName] = [];
                        grouped[bName].push({ ...data, id: doc.id });
                    });
                    setRegistrationsByBase(grouped);
                }

            } catch (err) {
                console.error(err);
                if (isBaseCoord) alert("Erro ao carregar dados.");
            } finally {
                setLoadingMembers(false);
            }
        };

        loadData();
    }, [event, user, isBaseCoord, isManager, eventId]);

    // Save Registrations Logic (Base Coord)
    const handleSaveRegistrations = async () => {
        if (!user?.baseId) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const regsRef = collection(db, "event_registrations");

            const currentRegIds = new Set(registrations.map(r => r.userId));

            // Delete removed
            registrations.forEach(reg => {
                if (!selectedUsers.has(reg.userId)) {
                    batch.delete(doc(db, "event_registrations", reg.id));
                }
            });

            // Add new
            Array.from(selectedUsers).forEach(userId => {
                if (!currentRegIds.has(userId)) {
                    const memberInfo = baseMembers.find(m => m.id === userId);
                    const newDocRef = doc(regsRef);
                    batch.set(newDocRef, {
                        eventId,
                        userId,
                        baseId: user.baseId!, // Assert non-null because of check at top
                        registeredBy: user.uid,
                        createdAt: serverTimestamp(),
                        status: 'registered',
                        userDisplayName: memberInfo?.displayName || "Membro",
                        // Note: user.baseName might not be in the user context strictly, 
                        // but we can try to get it. For now, let's use a placeholder or check if user object has it.
                        // Ideally we should have fetched the base details, but for now:
                        baseName: (user as any).baseName || "Base " + user.baseId!.substring(0, 5)
                    });
                }
            });

            await batch.commit();
            alert("Inscrições atualizadas com sucesso!");
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("Erro ao salvar inscrições.");
        } finally {
            setIsSaving(false);
        }
    };

    // Manager Logic: Quiz Linking
    const handleLinkQuiz = async (quizId: string) => {
        try {
            const eventRef = doc(db, "events", eventId);
            await updateDoc(eventRef, {
                linkedQuizzes: arrayUnion(quizId)
            });
            setIsQuizModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Erro ao vincular quiz.");
        }
    };

    const handleUnlinkQuiz = async (quizId: string) => {
        if (!confirm("Remover este quiz do evento?")) return;
        try {
            const eventRef = doc(db, "events", eventId);
            await updateDoc(eventRef, {
                linkedQuizzes: arrayRemove(quizId)
            });
        } catch (e) {
            console.error(e);
            alert("Erro ao desvincular quiz.");
        }
    };

    const toggleUser = (userId: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUsers(newSet);
    };

    const handleSelectAll = (select: boolean) => {
        const visibleIds = baseMembers.filter(m =>
            m.displayName.toLowerCase().includes(searchTerm.toLowerCase())
        ).map(m => m.id);

        const newSet = new Set(selectedUsers);
        visibleIds.forEach(id => select ? newSet.add(id) : newSet.delete(id));
        setSelectedUsers(newSet);
    };

    const filteredMembers = baseMembers.filter(m =>
        m.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!event) return <div className="p-8 text-center animate-pulse">Carregando evento...</div>;

    const linkedQuizzesList = allQuizzes.filter(q => event.linkedQuizzes?.includes(q.id));
    const availableQuizzes = allQuizzes.filter(q =>
        !event.linkedQuizzes?.includes(q.id) && (q as any).availableForEvents === true
    );

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-8 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()} className="rounded-full h-12 w-12 p-0 bg-white shadow-sm border border-gray-100">
                        <ArrowLeft className="text-gray-600" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-gray-900">{event.title}</h1>
                            <span className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest border",
                                event.status === 'active' ? "bg-green-100 text-green-700 border-green-200" :
                                    event.status === 'open' ? "bg-blue-100 text-blue-700 border-blue-200" :
                                        event.status === 'finished' ? "bg-gray-100 text-gray-700 border-gray-200" :
                                            "bg-yellow-100 text-yellow-700 border-yellow-200"
                            )}>
                                {event.status === 'active' ? "EM ANDAMENTO" :
                                    event.status === 'open' ? "INSCRIÇÕES ABERTAS" :
                                        event.status === 'finished' ? "ENCERRADO" : "RASCUNHO"}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-500 font-medium mt-1">
                            <span className="flex items-center gap-1.5"><Calendar size={16} /> {event.date?.toDate().toLocaleDateString('pt-BR')}</span>
                            {event.location && <span className="flex items-center gap-1.5"><MapPin size={16} /> {event.location}</span>}
                        </div>
                    </div>
                </div>

                {/* Manager Actions: Status Control */}
                {isManager && (
                    <div className="flex items-center gap-2">
                        {/* NOVO: Botão de Ranking ao Vivo */}
                        <Button
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 mr-2"
                            onClick={() => router.push(`/events/${eventId}/ranking`)}
                        >
                            <Gamepad size={18} className="mr-2" /> RANKING AO VIVO
                        </Button>

                        {event.status === 'draft' && (
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl shadow-lg shadow-blue-600/20"
                                onClick={async () => {
                                    if (!confirm("Ao abrir inscrições, os coordenadores de base poderão inscrever seus membros. Continuar?")) return;
                                    await updateDoc(doc(db, "events", eventId), { status: 'open' });
                                }}
                            >
                                <CheckCircle2 size={18} /> ABRIR INSCRIÇÕES
                            </Button>
                        )}

                        {event.status === 'open' && (
                            <>
                                <Button
                                    variant="outline"
                                    className="gap-2 rounded-xl text-yellow-600 hover:bg-yellow-50 border-yellow-200"
                                    onClick={async () => {
                                        if (!confirm("Isso voltará o evento para Rascunho e fechará as inscrições. Continuar?")) return;
                                        await updateDoc(doc(db, "events", eventId), { status: 'draft' });
                                    }}
                                >
                                    Pausar Inscrições
                                </Button>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-xl shadow-lg shadow-green-600/20"
                                    onClick={async () => {
                                        if (!confirm("INICIAR EVENTO: Isso disponibilizará os quizzes vinculados para todos os alunos inscritos. Certifique-se de que os quizzes estão prontos. Continuar?")) return;
                                        await updateDoc(doc(db, "events", eventId), { status: 'active' });
                                    }}
                                >
                                    <Gamepad size={18} /> INICIAR EVENTO
                                </Button>
                            </>
                        )}

                        {event.status === 'active' && (
                            <Button
                                className="bg-gray-800 hover:bg-black text-white gap-2 rounded-xl shadow-lg"
                                onClick={async () => {
                                    if (!confirm("ENCERRAR EVENTO: Os alunos não poderão mais acessar os quizzes deste evento. Continuar?")) return;
                                    await updateDoc(doc(db, "events", eventId), { status: 'finished' });
                                }}
                            >
                                <CheckCircle2 size={18} /> ENCERRAR EVENTO
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* BASE COORDINATOR VIEW */}
            {isBaseCoord && (
                <div className="card-soft p-0 overflow-hidden border border-gray-100 shadow-xl bg-white rounded-3xl">
                    <div className="p-6 bg-primary text-white flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Users size={24} /> Gerenciar Inscrições
                            </h2>
                            <p className="text-blue-100 text-sm">Selecione os membros que participarão deste evento.</p>
                        </div>
                        <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
                            <span className="block text-2xl font-black">{selectedUsers.size}</span>
                            <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Confirmados</span>
                        </div>
                    </div>

                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4 items-center sticky top-0 z-10">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-primary/50"
                                placeholder="Buscar membro..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleSelectAll(true)} className="text-xs">Todos</Button>
                            <Button variant="outline" onClick={() => handleSelectAll(false)} className="text-xs">Nenhum</Button>
                        </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto p-2">
                        {loadingMembers ? (
                            <div className="p-8 text-center text-gray-400">Carregando lista...</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {filteredMembers.map(member => {
                                    const isSelected = selectedUsers.has(member.id);
                                    return (
                                        <div
                                            key={member.id}
                                            onClick={() => toggleUser(member.id)}
                                            className={clsx(
                                                "p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]",
                                                isSelected
                                                    ? "bg-primary/5 border-primary/30"
                                                    : "bg-white border-gray-100 hover:border-gray-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors",
                                                    isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                                                )}>
                                                    {member.displayName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={clsx("font-bold text-sm", isSelected ? "text-primary" : "text-gray-700")}>
                                                        {member.displayName}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold">{member.role || 'Membro'}</p>
                                                </div>
                                            </div>

                                            <div className={clsx(
                                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                                isSelected ? "bg-primary border-primary" : "border-gray-200"
                                            )}>
                                                {isSelected && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredMembers.length === 0 && (
                                    <p className="col-span-2 text-center py-8 text-gray-400">Nenhum membro encontrado.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MANAGER VIEW */}
            {isManager && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Stats */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Inscritos Totais</p>
                                <p className="text-4xl font-black text-gray-900">{totalRegistrations}</p>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-xl text-primary">
                                <Users size={24} />
                            </div>
                        </div>

                        {/* Linked Quizzes */}
                        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <Gamepad size={20} className="text-gray-500" />
                                    <h3 className="font-bold text-lg text-gray-900">Quizzes do Evento</h3>
                                </div>
                                <Button size="sm" onClick={() => setIsQuizModalOpen(true)} className="gap-2">
                                    <Plus size={16} /> Vincular Quiz
                                </Button>
                            </div>

                            <div className="p-6">
                                {linkedQuizzesList.length > 0 ? (
                                    <div className="space-y-3">
                                        {linkedQuizzesList.map(q => (
                                            <div key={q.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-green-100 text-green-700 p-2 rounded-lg font-bold text-xs uppercase">Game</div>
                                                    <span className="font-bold text-gray-800">{q.title}</span>
                                                    <span className="text-xs text-gray-400">({q.questions?.length || 0} questões)</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleUnlinkQuiz(q.id)} className="text-gray-400 hover:text-red-500">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                        <LinkIcon size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>Nenhum quiz vinculado a este evento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Registrations List (Grouped by Base) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <Users size={20} /> Relatório de Inscrições
                            </h3>
                        </div>
                        <div className="p-6">
                            {Object.keys(registrationsByBase).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.entries(registrationsByBase).map(([baseName, regs]) => (
                                        <div key={baseName} className="border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                                                <span className="font-bold text-sm text-gray-700 truncate max-w-[70%]">{baseName}</span>
                                                <span className="bg-primary/10 text-primary text-xs font-black px-2 py-1 rounded-full">{regs.length}</span>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-2 bg-white space-y-1">
                                                {regs.map(r => (
                                                    <div key={r.userId} className="text-xs text-gray-600 px-2 py-1.5 hover:bg-gray-50 rounded flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                        {r.userDisplayName || `Usuário...`}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <p>Nenhuma inscrição realizada ainda.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isManager && !isBaseCoord && (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 col-span-full">
                    <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">Acesso Restrito</h3>
                    <p className="text-gray-400 mt-2 font-medium">Você está visualizando este evento como convidado.<br />Apenas Coordenadores podem gerenciar inscrições.</p>
                </div>
            )}

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 z-40 md:pl-64">
                <div className="max-w-5xl mx-auto flex justify-end gap-4">
                    <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
                    {isBaseCoord && (
                        <Button
                            onClick={handleSaveRegistrations}
                            disabled={isSaving}
                            className="bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                        >
                            <Save size={18} className="mr-2" />
                            Salvar Inscrições
                        </Button>
                    )}
                </div>
            </div>

            {/* Link Quiz Modal (Manager) */}
            {isQuizModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl scale-in-center">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-lg">Vincular Quiz</h3>
                            <button onClick={() => setIsQuizModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {availableQuizzes.length > 0 ? (
                                <div className="space-y-2">
                                    {availableQuizzes.map(q => (
                                        <button
                                            key={q.id}
                                            onClick={() => handleLinkQuiz(q.id)}
                                            className="w-full text-left p-4 rounded-xl border border-gray-100 hover:bg-primary/5 hover:border-primary/50 transition-all group"
                                        >
                                            <p className="font-bold text-gray-800 group-hover:text-primary">{q.title}</p>
                                            <p className="text-xs text-gray-400">{q.questions?.length || 0} questões</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Todos os quizzes já foram vinculados.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
