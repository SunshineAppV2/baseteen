"use client";

import { use, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { auth } from "@/services/firebase"; // Added auth
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
    AlertCircle,
    UploadCloud, // Added
    FileText, // Added
    Edit3,
    Target, // Added
    Loader2, // Added
    Heart,
    Clock // Added
} from "lucide-react";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    writeBatch,
    updateDoc,
    arrayUnion,
    arrayRemove,
    limit,
    orderBy,
    DocumentData
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
// import { toast } from "react-hot-toast"; // Module not found
import IndividualQuizPlayer from "@/app/quiz/IndividualQuizPlayer";
import { clsx } from "clsx";

interface Event {
    id: string;
    title: string;
    description: string;
    startDate: any;
    endDate: any;
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

interface EventTask {
    id: string;
    eventId: string;
    title: string;
    description: string;
    points: number;
    type: "upload" | "text" | "check" | "link" | "text_link" | "text_upload";
    deadline?: string;
    releaseDate?: string;
}

interface BaseSubmission {
    id: string;
    taskId: string;
    baseId: string;
    baseName: string;
    status: 'pending' | 'approved' | 'rejected';
    proof: {
        content: string;
        submittedAt: any;
    };
    xpReward: number;
    eventId: string;
}

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    // Data
    const { data: events } = useCollection<Event>("events", [where("__name__", "==", eventId)]);
    const event = events[0];
    const { data: allQuizzes } = useCollection<MasterQuiz>("master_quizzes");

    const isManager = user?.role === 'master' || user?.role === 'coord_geral' || user?.role === 'admin' || user?.role === 'secretaria' || user?.role === 'coord_associacao';
    const isBaseCoord = user?.role === 'coord_base';

    // Base Coord State
    const [baseMembers, setBaseMembers] = useState<User[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Tasks State
    const { data: eventTasks, loading: loadingTasks } = useCollection<EventTask>("tasks", [where("eventId", "==", eventId)]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<EventTask | null>(null);
    const [taskFormData, setTaskFormData] = useState<Partial<EventTask>>({
        title: "",
        description: "",
        points: 0,

        type: "text",
        deadline: "",
        releaseDate: ""
    });

    // Base Submission State
    const { data: mySubmissions } = useCollection<BaseSubmission>("base_submissions",
        user?.baseId ? [where("baseId", "==", user.baseId), where("eventId", "==", eventId)] : []
    );
    const { data: allSubmissions } = useCollection<BaseSubmission>("base_submissions",
        isManager ? [where("eventId", "==", eventId)] : []
    );
    const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<EventTask | null>(null);
    const [submissionData, setSubmissionData] = useState({ text: "", link: "", completed: false });
    const [isUploading, setIsUploading] = useState(false);

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
                    // Optimization: We might have many bases, so let's collect unique Base IDs first
                    const registrations = snapAll.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
                    const baseIds = new Set<string>();

                    const grouped: Record<string, Registration[]> = {};

                    // We need to resolve base names. Some registrations might have it, some might need fetching.
                    // To avoid N+1 reads, let's just make a map of baseId -> baseName if we can, or rely on what's in registration.

                    // Strategy: Use what is in registration 'baseName'. If missing, falback to ID.
                    // Ideally we should fix data at source (which we did in previous step). 
                    // But for display fix NOW without migrations:

                    // Let's settle for fixing the "future" data with the previous step. 
                    // But to fix the "view" right now for records that have ID but no Name or partial name:

                    registrations.forEach(data => {
                        const bName = data.baseName || `Base ${data.baseId?.substring(0, 5)}...`;
                        if (!grouped[bName]) grouped[bName] = [];
                        grouped[bName].push(data);
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

            // Fetch correct base name for the coordinator
            let coordinatorBaseName = "Base " + user.baseId!.substring(0, 5);
            try {
                const baseDoc = await getDoc(doc(db, "bases", user.baseId!));
                if (baseDoc.exists()) {
                    coordinatorBaseName = baseDoc.data().name;
                }
            } catch (e) { console.error("Error fetching base name:", e); }

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
                        baseName: coordinatorBaseName
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

    // Task Management Logic
    const handleSaveTask = async () => {
        if (!taskFormData.title || !taskFormData.points || !taskFormData.releaseDate || !taskFormData.deadline) {
            return alert("Preencha título, pontos e as datas de início e fim!");
        }
        setIsSaving(true);
        try {
            const payload = {
                ...taskFormData,
                eventId,
                updatedAt: serverTimestamp()
            };

            if (editingTask) {
                await firestoreService.update("tasks", editingTask.id, payload);
            } else {
                await firestoreService.add("tasks", {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }
            setIsTaskModalOpen(false);
            setEditingTask(null);
            setTaskFormData({ title: "", description: "", points: 0, type: "text", deadline: "", releaseDate: "" });
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar desafio.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Excluir este desafio?")) return;
        try {
            await firestoreService.delete("tasks", taskId);
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    // Manual Quiz Input State
    const [manualQuizData, setManualQuizData] = useState<{ isOpen: boolean; userId: string; quizId: string | null }>({
        isOpen: false,
        userId: "",
        quizId: null
    });

    // Handle Manual Quiz Start
    const handleStartManualQuiz = (userId: string) => {
        // If there's only one quiz, open it directly
        if (availableQuizzes.length === 1) {
            setManualQuizData({
                isOpen: true,
                userId: userId,
                quizId: availableQuizzes[0].id
            });
        } else if (availableQuizzes.length > 1) {
            setManualQuizData({
                isOpen: true,
                userId: userId,
                quizId: null // Triggers selection or opens directly if handled
            });
        } else {
            alert("Nenhum quiz vinculado a este evento.");
        }
    };

    // Approval Logic
    const handleApproveSubmission = async (submission: BaseSubmission) => {
        if (!confirm(`Aprovar envio de ${submission.baseName}?`)) return;
        try {
            await firestoreService.update("base_submissions", submission.id, {
                status: 'approved',
                reviewedAt: new Date(),
                reviewedBy: user?.uid
            });
            // Credit XP to base (Optional: Implement transaction for base stats)
            const { doc, updateDoc, increment } = await import("firebase/firestore");
            const { db } = await import("@/services/firebase");
            const baseRef = doc(db, "bases", submission.baseId);
            await updateDoc(baseRef, { totalXp: increment(submission.xpReward || 0) });

            alert("Aprovado!");
        } catch (e) {
            console.error(e);
            alert("Erro ao aprovar.");
        }
    };

    const handleRejectSubmission = async (submission: BaseSubmission) => {
        const reason = prompt("Motivo da reprovação:");
        if (!reason) return;
        try {
            await firestoreService.update("base_submissions", submission.id, {
                status: 'rejected',
                reviewedAt: new Date(),
                reviewedBy: user?.uid,
                rejectionReason: reason
            });
            alert("Reprovado.");
        } catch (e) {
            console.error(e);
            alert("Erro ao reprovar.");
        }
    };

    const filteredMembers = baseMembers.filter(m =>
        m.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- Submission Logic ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        setIsUploading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const initRes = await fetch('/api/drive/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
            });

            if (!initRes.ok) throw new Error("Falha ao iniciar upload");
            const { uploadUrl } = await initRes.json();

            const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file });
            if (!uploadRes.ok) throw new Error("Falha no envio do arquivo");

            const driveFile = await uploadRes.json();
            const link = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view?usp=sharing`;
            setSubmissionData(prev => ({ ...prev, link }));

        } catch (error: any) {
            console.error(error);
            alert("Erro ao fazer upload: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmitProof = async () => {
        if (!selectedTaskForSubmission || !user?.baseId) return;
        setIsSaving(true);
        try {
            let proofContent = "";
            if (selectedTaskForSubmission.type === 'check') proofContent = submissionData.completed ? "Marcado como concluído" : "Não concluído";
            else if (selectedTaskForSubmission.type === 'text') proofContent = submissionData.text;
            else if (selectedTaskForSubmission.type === 'upload') proofContent = submissionData.link;
            else if (selectedTaskForSubmission.type === 'link') proofContent = submissionData.link;
            else if (selectedTaskForSubmission.type === 'text_link') proofContent = `Texto: ${submissionData.text} \nLink: ${submissionData.link}`;
            else if (selectedTaskForSubmission.type === 'text_upload') proofContent = `Texto: ${submissionData.text} \nArquivo: ${submissionData.link}`;

            // Fetch correct base name for the coordinator (reuse previous logic or fetch again)
            let coordinatorBaseName = "Base " + user.baseId!.substring(0, 5);
            // Optimistically stick with simple name or fetch if needed. Rely on context or user data for now.

            await firestoreService.add("base_submissions", {
                taskId: selectedTaskForSubmission.id,
                eventId: eventId,
                baseId: user.baseId,
                baseName: (user as any).baseName || coordinatorBaseName,
                submittedBy: user.uid,
                submittedByName: user.displayName || "Coordenador",
                districtId: user.districtId,
                regionId: user.regionId,
                associationId: user.associationId,
                proof: {
                    content: proofContent,
                    submittedAt: new Date()
                },
                status: 'pending',
                xpReward: selectedTaskForSubmission.points,
                createdAt: new Date(),
                timeline: [{
                    action: 'submitted',
                    status: 'pending',
                    at: new Date(),
                    by: user.uid,
                    note: proofContent
                }]
            });

            alert("Resposta enviada com sucesso! Aguarde a aprovação.");
            setSelectedTaskForSubmission(null);
            setSubmissionData({ text: "", link: "", completed: false });
        } catch (error: any) {
            console.error(error);
            alert("Erro ao enviar resposta: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

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
                            <span className="flex items-center gap-1.5">
                                <Calendar size={16} />
                                {event.startDate?.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                                {event.endDate && ` a ${event.endDate.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`}
                            </span>
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
                <div className="space-y-6">
                    {/* ... (Existing Registration UI) ... */}
                    <div className="card-soft p-0 overflow-hidden border border-gray-100 shadow-xl bg-white rounded-3xl">
                        {/* ... existing header ... */}
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            {/* ... */}
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
                            {/* ... Search ... */}
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
                            {/* ... Members List ... */}
                            {loadingMembers ? (
                                <div className="p-8 text-center text-gray-400">Carregando lista...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {filteredMembers.map(member => {
                                        const isSelected = selectedUsers.has(member.id);
                                        return (
                                            <div
                                                key={member.id}
                                                className={clsx(
                                                    "p-3 rounded-xl border flex items-center justify-between transition-all active:scale-[0.98]",
                                                    isSelected
                                                        ? "bg-primary/5 border-primary/30"
                                                        : "bg-white border-gray-100 hover:border-primary/30"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleUser(member.id)}>
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                                        isSelected ? "bg-primary border-primary" : "border-gray-300"
                                                    )}>
                                                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{member.displayName}</p>
                                                        {(member as any).email && <p className="text-[10px] text-gray-400">{(member as any).email}</p>}
                                                    </div>
                                                </div>
                                                {(isBaseCoord || isManager) && availableQuizzes.length > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStartManualQuiz(member.id);
                                                        }}
                                                        className="h-8 w-8 p-0 rounded-full hover:bg-purple-100 text-purple-600"
                                                        title="Responder Quiz Manualmente"
                                                    >
                                                        <Gamepad size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {filteredMembers.length === 0 && (
                                        <p className="col-span-2 text-center py-8 text-gray-400">Nenhum membro encontrado.</p>
                                    )}
                                </div>
                            )
                            }
                        </div>
                    </div>

                    {/* BASE TASKS VIEW */}
                    <div id="base-tasks-view" className="mt-8">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Target className="text-primary" /> Desafios do Evento
                        </h2>
                        {eventTasks.length === 0 ? (
                            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                                Nenhum desafio disponível.
                            </div>
                        ) : registrations.length === 0 ? (
                            <div className="p-8 text-center bg-yellow-50 rounded-2xl border border-yellow-200">
                                <AlertCircle className="mx-auto text-yellow-600 mb-4" size={48} />
                                <h3 className="font-bold text-lg text-yellow-800">Inscrição Necessária</h3>
                                <p className="text-yellow-700">Inscreva pelo menos um membro para visualizar e participar dos desafios.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {eventTasks.map(task => {
                                    const submission = mySubmissions.find(s => s.taskId === task.id);
                                    const status = submission?.status;

                                    // Date Logic
                                    const now = new Date();
                                    const releaseDate = task.releaseDate ? new Date(task.releaseDate + 'T00:00:00') : null;
                                    const deadline = task.deadline ? new Date(task.deadline + 'T23:59:59') : null;

                                    // Visibility Check (Release Date)
                                    if (releaseDate && now < releaseDate) {
                                        return (
                                            <div key={task.id} className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200 opacity-60 flex flex-col items-center justify-center text-center gap-2">
                                                <Clock size={24} className="text-gray-400" />
                                                <p className="font-bold text-gray-400">Desafio Bloqueado</p>
                                                <p className="text-xs text-gray-400 uppercase tracking-widest">Disponível em {releaseDate.toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        );
                                    }

                                    const isExpired = deadline && now > deadline;

                                    return (
                                        <div key={task.id} className={clsx(
                                            "bg-white p-6 rounded-2xl border-2 transition-all relative overflow-hidden",
                                            status === 'approved' ? "border-green-500 bg-green-50" :
                                                status === 'rejected' ? "border-red-500 bg-red-50" :
                                                    status === 'pending' ? "border-yellow-500 bg-yellow-50" :
                                                        "border-gray-100 hover:border-primary/50"
                                        )}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg">{task.title}</h3>
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 capitalize">{task.type}</span>
                                                </div>
                                                <span className="text-2xl font-black text-primary">{task.points} PTS</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mb-6">{task.description}</p>

                                            <div className="flex justify-between items-center">
                                                {status ? (
                                                    <span className={clsx(
                                                        "px-3 py-1 rounded-full text-xs font-bold uppercase",
                                                        status === 'approved' ? "bg-green-200 text-green-800" :
                                                            status === 'rejected' ? "bg-red-200 text-red-800" :
                                                                "bg-yellow-200 text-yellow-800"
                                                    )}>
                                                        {status === 'approved' ? "Aprovado" : status === 'rejected' ? "Reprovado" : "Pendente"}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Não enviado</span>
                                                )}

                                                {!status || status === 'rejected' ? (
                                                    <Button size="sm" onClick={() => setSelectedTaskForSubmission(task)} disabled={isExpired && !status}>
                                                        {isExpired ? "Encerrado" : status === 'rejected' ? "Tentar Novamente" : "Enviar Resposta"}
                                                    </Button>
                                                ) : <div />}
                                            </div>
                                        </div>
                                    );
                                })}
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

                    {/* TASKS MANAGEMENT (Manager View) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <Target size={20} /> Desafios / Requisitos
                            </h3>
                            <Button size="sm" onClick={() => {
                                setEditingTask(null);
                                setTaskFormData({ title: "", description: "", points: 0, type: "text", deadline: "" });
                                setIsTaskModalOpen(true);
                            }} className="gap-2">
                                <Plus size={16} /> Novo Desafio
                            </Button>
                        </div>
                        <div className="p-6">
                            {eventTasks.length > 0 ? (
                                <div className="space-y-3">
                                    {eventTasks.map(task => (
                                        <div key={task.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-bold text-gray-800">{task.title}</span>
                                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">{task.points} PTS</span>
                                                    <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded">{task.type}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    setEditingTask(task);
                                                    setTaskFormData(task);
                                                    setIsTaskModalOpen(true);
                                                }}>
                                                    <Edit3 size={16} className="text-gray-400 hover:text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                                                    <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                    <Target size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhum desafio criado.</p>
                                </div>
                            )}
                        </div>
                    </div>



                    {/* SUBMISSIONS REVIEW (Manager View) */}
                    {
                        allSubmissions.filter(s => s.status === 'pending').length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-orange-50 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-orange-900 flex items-center gap-2">
                                        <AlertCircle size={20} /> Aprovações Pendentes
                                    </h3>
                                    <span className="bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">
                                        {allSubmissions.filter(s => s.status === 'pending').length}
                                    </span>
                                </div>
                                <div className="p-6 space-y-3">
                                    {allSubmissions.filter(s => s.status === 'pending').map(sub => {
                                        const task = eventTasks.find(t => t.id === sub.taskId);
                                        return (
                                            <div key={sub.id} className="p-4 border border-orange-100 bg-orange-50/30 rounded-xl">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-bold text-gray-800">{sub.baseName}</p>
                                                        <p className="text-xs text-gray-500">{task?.title || 'Desafio desconhecido'}</p>
                                                    </div>
                                                    <span className="font-bold text-orange-600">{sub.xpReward} XP</span>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-gray-100 text-sm text-gray-600 mb-3">
                                                    <span className="font-bold text-xs uppercase text-gray-400 block mb-1">Evidência:</span>
                                                    {sub.proof.content.startsWith('http') ? (
                                                        <a href={sub.proof.content} target="_blank" className="text-blue-600 underline flex items-center gap-1">
                                                            <LinkIcon size={12} /> Abrir Link / Arquivo
                                                        </a>
                                                    ) : sub.proof.content}
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="ghost" onClick={() => handleRejectSubmission(sub)} className="text-red-600 hover:bg-red-50">Reprovar</Button>
                                                    <Button size="sm" onClick={() => handleApproveSubmission(sub)} className="bg-green-600 hover:bg-green-700 text-white border-none">Aprovar</Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    }

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
                </div >
            )}


            {
                !isManager && !isBaseCoord && (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 col-span-full">
                        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Acesso Restrito</h3>
                        <p className="text-gray-400 mt-2 font-medium">Você está visualizando este evento como convidado.<br />Apenas Coordenadores podem gerenciar inscrições.</p>
                    </div>
                )
            }

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
            {
                isQuizModalOpen && (
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
                )
            }

            {/* Submission Modal */}
            {
                selectedTaskForSubmission && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl scale-in-center">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="font-black text-xl">{selectedTaskForSubmission.title}</h3>
                                <p className="text-gray-500 text-sm mt-1">{selectedTaskForSubmission.description}</p>
                            </div>
                            <div className="p-6 space-y-4">
                                {selectedTaskForSubmission.type === 'check' && (
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="completed"
                                            checked={submissionData.completed}
                                            onChange={e => setSubmissionData({ ...submissionData, completed: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300"
                                        />
                                        <label htmlFor="completed" className="text-sm font-medium">Marcado como concluído</label>
                                    </div>
                                )}

                                {selectedTaskForSubmission.type === 'text' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-2">Resposta</label>
                                        <textarea
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20"
                                            rows={4}
                                            value={submissionData.text}
                                            onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })}
                                        />
                                    </div>
                                )}

                                {selectedTaskForSubmission.type === 'link' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-2">Link</label>
                                        <input
                                            type="url"
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="https://..."
                                            value={submissionData.link}
                                            onChange={e => setSubmissionData({ ...submissionData, link: e.target.value })}
                                        />
                                    </div>
                                )}

                                {selectedTaskForSubmission.type === 'text_link' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-2">Resposta em Texto</label>
                                            <textarea
                                                className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20"
                                                rows={3}
                                                value={submissionData.text}
                                                onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-2">Link Complementar</label>
                                            <input
                                                type="url"
                                                className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="https://..."
                                                value={submissionData.link}
                                                onChange={e => setSubmissionData({ ...submissionData, link: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedTaskForSubmission.type === 'text_upload' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 mb-2">Resposta em Texto</label>
                                            <textarea
                                                className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20"
                                                rows={3}
                                                value={submissionData.text}
                                                onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-sm font-bold text-gray-500 mb-2">Anexo (Imagem/PDF)</label>
                                            {!submissionData.link ? (
                                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                                                    {isUploading ? (
                                                        <div className="flex flex-col items-center gap-2 text-primary">
                                                            <Loader2 className="animate-spin" size={24} />
                                                            <span className="text-sm font-medium">Enviando...</span>
                                                        </div>
                                                    ) : (
                                                        <label className="cursor-pointer flex flex-col items-center gap-2">
                                                            <UploadCloud className="text-gray-400" size={32} />
                                                            <span className="text-sm font-medium text-gray-700">Clique para selecionar</span>
                                                            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,application/pdf" />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <CheckCircle2 size={16} className="text-green-600" />
                                                        <span className="text-xs text-green-700 truncate underline">{submissionData.link}</span>
                                                    </div>
                                                    <button onClick={() => setSubmissionData(prev => ({ ...prev, link: "" }))} className="p-1 hover:bg-green-100 rounded-full">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedTaskForSubmission.type === 'upload' && (
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-500 mb-2">Anexo</label>
                                        {!submissionData.link ? (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                                                {isUploading ? (
                                                    <div className="flex flex-col items-center gap-2 text-primary">
                                                        <Loader2 className="animate-spin" size={24} />
                                                        <span className="text-sm font-medium">Enviando...</span>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer flex flex-col items-center gap-2">
                                                        <UploadCloud className="text-gray-400" size={32} />
                                                        <span className="text-sm font-medium text-gray-700">Clique para selecionar</span>
                                                        <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,application/pdf" />
                                                    </label>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <CheckCircle2 size={16} className="text-green-600" />
                                                    <span className="text-xs text-green-700 truncate underline">{submissionData.link}</span>
                                                </div>
                                                <button onClick={() => setSubmissionData(prev => ({ ...prev, link: "" }))} className="p-1 hover:bg-green-100 rounded-full">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <Button className="flex-1 bg-gray-100 text-gray-600 hover:bg-gray-200" onClick={() => setSelectedTaskForSubmission(null)}>Cancelar</Button>
                                    <Button className="flex-1" onClick={handleSubmitProof} disabled={isSaving}>Enviar</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Task Modal (Create/Edit) */}
            {
                isTaskModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl scale-in-center">
                            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-black text-lg">{editingTask ? "Editar Desafio" : "Novo Desafio"}</h3>
                                <button onClick={() => setIsTaskModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Título</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-primary/50"
                                        placeholder="Ex: Doação de Alimentos"
                                        value={taskFormData.title}
                                        onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Descrição</label>
                                    <textarea
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-medium text-gray-700 outline-none focus:border-primary/50 h-24 resize-none"
                                        placeholder="Detalhes do que deve ser feito..."
                                        value={taskFormData.description}
                                        onChange={e => setTaskFormData({ ...taskFormData, description: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Pontos (XP)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-primary/50"
                                            value={taskFormData.points}
                                            onChange={e => setTaskFormData({ ...taskFormData, points: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Tipo de Entrega</label>
                                        <select
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-primary/50"
                                            value={taskFormData.type}
                                            onChange={e => setTaskFormData({ ...taskFormData, type: e.target.value as any })}
                                        >
                                            <option value="text">Texto</option>
                                            <option value="text_link">Texto + Link</option>
                                            <option value="text_upload">Texto + Upload</option>
                                            <option value="upload">Upload (Foto/PDF)</option>
                                            <option value="link">Link</option>
                                            <option value="check">Apenas Marcar</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Liberação (Início)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-medium text-gray-700 outline-none focus:border-primary/50 text-sm"
                                        value={taskFormData.releaseDate || ''}
                                        onChange={e => setTaskFormData({ ...taskFormData, releaseDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 opacity-70">Prazo (Fim)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-medium text-gray-700 outline-none focus:border-primary/50 text-sm"
                                        value={taskFormData.deadline}
                                        onChange={e => setTaskFormData({ ...taskFormData, deadline: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Button onClick={handleSaveTask} className="w-full py-4 text-lg font-bold rounded-xl shadow-lg mt-4" disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Salvar Desafio"}
                            </Button>
                        </div>
                    </div>
                )}


            {/* Manual Quiz Player Modal */}
            {
                manualQuizData.isOpen && manualQuizData.quizId && (
                    <IndividualQuizPlayer
                        quiz={availableQuizzes.find(q => q.id === manualQuizData.quizId)!}
                        userId={manualQuizData.userId}
                        onClose={() => setManualQuizData({ isOpen: false, userId: "", quizId: null })}
                    />
                )
            }

            {/* Quiz Selection Modal (if needed for manual start) */}
            {
                manualQuizData.isOpen && !manualQuizData.quizId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl scale-in-center">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-black text-lg text-gray-800">Selecione o Quiz</h3>
                                <button onClick={() => setManualQuizData({ isOpen: false, userId: "", quizId: null })} className="p-2 hover:bg-gray-100 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {availableQuizzes.map(q => (
                                    <button
                                        key={q.id}
                                        onClick={() => setManualQuizData(prev => ({ ...prev, quizId: q.id }))}
                                        className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all text-left font-bold text-gray-700 hover:text-primary"
                                    >
                                        {q.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
