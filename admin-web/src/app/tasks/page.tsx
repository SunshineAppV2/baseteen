"use client";

import { useState, useMemo } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { where } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import {
    Plus,
    Filter,
    Pencil,
    Trash2,
    BookOpen,
    MapPin,
    Globe,
    Building2,
    SearchX,
    X,
    Save,
    Clock
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";

interface Task {
    id: string;
    title: string;
    description: string;
    type: "upload" | "text" | "check";
    points: number;
    baseId?: string;
    districtId?: string;
    startDate?: string;
    deadline?: string;
    classification?: 'pre-adolescente' | 'adolescente' | 'todos';
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

export default function TasksPage() {
    const { user: currentUser } = useAuth();
    const { data: tasks, loading } = useCollection<Task>("tasks");
    const { data: districts } = useCollection<District>("districts");
    const { data: bases } = useCollection<Base>("bases");

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Member Submission State
    const [viewingTask, setViewingTask] = useState<Task | null>(null);
    const [submissionData, setSubmissionData] = useState({ text: "", link: "", completed: false });
    const [isSubmitSaving, setIsSubmitSaving] = useState(false);

    // Fetch user's submissions to check status
    // Safe constraints if user is not logged in (empty fetch)
    const userSubmissionConstraints = useMemo(() => {
        if (!currentUser) return [where('id', '==', '0')];
        return [where('userId', '==', currentUser.uid)];
    }, [currentUser]);

    // Map taskId -> submission (to check status)
    const { data: userSubmissions } = useCollection<any>("submissions", userSubmissionConstraints);
    const submissionMap = useMemo(() => {
        const map = new Map<string, any>();
        userSubmissions.forEach(sub => {
            map.set(sub.taskId, sub);
        });
        return map;
    }, [userSubmissions]);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "check",
        points: 100,
        scope: "general", // "general", "district", "base"
        districtId: "",
        baseId: "",
        startDate: "",
        deadline: "",
        classification: "todos" as 'pre-adolescente' | 'adolescente' | 'todos',
    });

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            type: "check",
            points: 10,
            startDate: "",
            deadline: "",
            scope: currentUser?.role === 'coord_base' ? 'base' :
                currentUser?.role === 'coord_distrital' ? 'district' : 'general',
            districtId: currentUser?.districtId || "",
            baseId: currentUser?.baseId || "",
            classification: "todos" as 'pre-adolescente' | 'adolescente' | 'todos'
        });
        setEditingTask(null);
    };

    const handleCreateClick = () => {
        resetForm();
        setIsCreateModalOpen(true);
    };

    const handleEditClick = (task: Task) => {
        let scope = "general";
        if (task.districtId) scope = "district";
        if (task.baseId) scope = "base";

        setFormData({
            title: task.title,
            description: task.description,
            type: task.type as any,
            points: task.points,
            startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
            deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '', // Populate deadline
            scope,
            districtId: task.districtId || "",
            baseId: task.baseId || "",
            classification: task.classification || "todos"
        });
        setEditingTask(task);
        setIsCreateModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.points) return alert("Preencha os campos obrigatórios.");

        setIsSaving(true);
        try {
            const data: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                points: Number(formData.points),
                updatedAt: new Date(),
                startDate: formData.startDate ? new Date(`${formData.startDate}T00:01:00`).toISOString() : null,
                deadline: formData.deadline ? new Date(`${formData.deadline}T23:59:59`).toISOString() : null,
                classification: formData.classification
            };

            // Scope Logic
            if (formData.scope === 'general') {
                data.districtId = null;
                data.baseId = null;
            } else if (formData.scope === 'district') {
                data.districtId = formData.districtId;
                data.baseId = null;
            } else if (formData.scope === 'base') {
                data.districtId = null; // Ideally keep district reference? But rules check baseId. 
                // Usually a base belongs to a district, but the requirement is "base specific".
                data.baseId = formData.baseId;
            }

            if (editingTask) {
                await firestoreService.update("tasks", editingTask.id, data);
                alert("Requisito atualizado!");
            } else {
                data.createdAt = new Date();
                await firestoreService.add("tasks", data);
                alert("Requisito criado!");
            }
            setIsCreateModalOpen(false);
            resetForm();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        try {
            await firestoreService.delete("tasks", id);
        } catch (error: any) {
            alert("Erro ao excluir: " + error.message);
        }
    };

    const handleSubmitResponse = async () => {
        if (!viewingTask || !currentUser) return;

        setIsSubmitSaving(true);
        try {
            // Format content for ApprovalsPage (expects simple 'content' string)
            let proofContent = "";
            if (viewingTask.type === 'check') proofContent = submissionData.completed ? "Marcado como concluído" : "Não concluído";
            else if (viewingTask.type === 'text') proofContent = submissionData.text;
            else if (viewingTask.type === 'upload') proofContent = submissionData.link;

            const submissionId = `${viewingTask.id}_${currentUser.uid}`;

            await firestoreService.set("submissions", submissionId, {
                taskId: viewingTask.id,
                userId: currentUser.uid,
                userDisplayName: currentUser.displayName,
                // Match ApprovalsPage schema
                districtId: currentUser.districtId,
                baseId: currentUser.baseId,
                taskTitle: viewingTask.title,
                xpReward: viewingTask.points, // Changed from taskPoints
                status: 'pending',
                proof: {
                    content: proofContent,
                    submittedAt: new Date()
                },
                createdAt: new Date()
            });
            alert("Resposta enviada com sucesso! Aguarde a aprovação.");
            setViewingTask(null);
            setSubmissionData({ text: "", link: "", completed: false });
        } catch (error: any) {
            console.error(error);
            alert("Erro ao enviar resposta: " + error.message);
        } finally {
            setIsSubmitSaving(false);
        }
    };

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        // Members see: General + Their District + Their Base
        if (currentUser?.role === 'membro') {
            const isGeneral = !task.districtId && !task.baseId;
            const isMyDistrict = task.districtId === currentUser.districtId;
            const isMyBase = task.baseId === currentUser.baseId;
            // User requested ONLY Base requirements
            return isMyBase;
        }

        // Coords see: General + Their Scope
        // Actually, coords probably want to see everything they CAN manage, plus maybe general ones?
        // Let's stick to "See everything available to me".

        // If I am Base Coord, I see General + My District + My Base
        if (currentUser?.role === 'coord_base') {
            const isGeneral = !task.districtId && !task.baseId;
            const isMyDistrict = task.districtId === currentUser.districtId; // Inherited
            const isMyBase = task.baseId === currentUser.baseId;
            return isGeneral || isMyDistrict || isMyBase;
        }

        // If I am District Coord, I see General + My District + All Bases in my District
        if (currentUser?.role === 'coord_distrital') {
            const isGeneral = !task.districtId && !task.baseId;
            const isMyDistrict = task.districtId === currentUser.districtId;
            // Also need to check if a base task belongs to a base in my district. 
            // Currently task only stores baseId. I need to lookup base -> district.
            const taskBase = bases.find(b => b.id === task.baseId);
            const isBaseInMyDistrict = taskBase?.districtId === currentUser.districtId;

            return isGeneral || isMyDistrict || isBaseInMyDistrict;
        }

        // Master/General/Secretary sees ALL
        return true;
    });

    const canEdit = (task: Task) => {
        if (['master', 'admin', 'coord_geral', 'secretaria'].includes(currentUser?.role || '')) return true;
        if (currentUser?.role === 'coord_distrital' && task.districtId === currentUser.districtId) return true;
        if (currentUser?.role === 'coord_base' && task.baseId === currentUser.baseId) return true;
        return false;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Requisitos</h1>
                    <p className="text-text-secondary">Gerencie as atividades e pontuações.</p>
                </div>
                {currentUser?.role !== 'membro' && (
                    <Button onClick={handleCreateClick} className="flex items-center gap-2">
                        <Plus size={20} /> Novo Requisito
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <p>Carregando...</p>
                ) : filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                        <div key={task.id} className="card-soft p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {task.baseId ? (
                                        <span className="badge bg-cyan-100 text-cyan-700 flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                            <Building2 size={10} /> {bases.find(b => b.id === task.baseId)?.name || "Base"}
                                        </span>
                                    ) : task.districtId ? (
                                        <span className="badge bg-orange-100 text-orange-700 flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                            <MapPin size={10} /> {districts.find(d => d.id === task.districtId)?.name || "Distrito"}
                                        </span>
                                    ) : (
                                        <span className="badge bg-purple-100 text-purple-700 flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                            <Globe size={10} /> Geral
                                        </span>
                                    )}
                                    <span className="text-text-secondary text-xs font-medium uppercase tracking-wider">{task.type}</span>
                                    <span className={clsx(
                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                        task.classification === 'adolescente' ? "bg-indigo-100 text-indigo-700" :
                                            task.classification === 'pre-adolescente' ? "bg-teal-100 text-teal-700" :
                                                "bg-gray-100 text-gray-700"
                                    )}>
                                        {task.classification || 'todos'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg text-text-primary">{task.title}</h3>
                                {task.description && <p className="text-sm text-text-secondary line-clamp-2">{task.description}</p>}
                            </div>

                            <div className="flex items-center gap-4 self-end md:self-auto">
                                <div className="text-right">
                                    <div className="flex items-center gap-2 text-primary font-bold">
                                        {task.deadline && (
                                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(task.deadline).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                        <span>{task.points} XP</span>
                                    </div>
                                </div>

                                {canEdit(task) && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleEditClick(task)} className="p-2 hover:bg-surface rounded-lg text-text-secondary hover:text-primary transition-colors">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(task.id)} className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500 transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}

                                {currentUser?.role === 'membro' && (() => {
                                    const submission = submissionMap.get(task.id);
                                    const status = submission?.status;

                                    if (status === 'pending' || status === 'approved') {
                                        return (
                                            <span className={clsx(
                                                "text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1",
                                                status === 'pending' ? "text-orange-600 bg-orange-50 border-orange-200" : "text-green-600 bg-green-50 border-green-200"
                                            )}>
                                                {status === 'pending' ? "Respondido - Aguardando" : "Respondido - Aprovado"}
                                            </span>
                                        );
                                    }

                                    const now = new Date();

                                    if (task.startDate) {
                                        const startDate = new Date(task.startDate);
                                        if (now < startDate) {
                                            return (
                                                <span className="text-xs font-bold px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-500 flex items-center gap-1 cursor-not-allowed">
                                                    <Clock size={12} />
                                                    DISPONÍVEL EM {startDate.toLocaleDateString('pt-BR')} ÀS {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            );
                                        }
                                    } else if (task.deadline) {
                                        // Legacy fallback or just ignore? Leaving original logic just in case but it seems odd.
                                        // The user specifically asked for Start/End times.
                                        // Let's keep it but prioritized startDate.
                                        const deadlineObj = new Date(task.deadline);
                                        // ... (Logic removed for cleaner switch or kept if needed?)
                                        // Actually the previous logic was basically "Starts at 1AM on deadline day".
                                        // We'll trust startDate is the new standard.
                                    }

                                    return (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setViewingTask(task);
                                                setSubmissionData({ text: "", link: "", completed: false });
                                            }}
                                            className={clsx(
                                                "gap-2 text-white",
                                                status === 'rejected' ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
                                            )}
                                        >
                                            <BookOpen size={16} /> {status === 'rejected' ? "Tentar Novamente" : "Responder"}
                                        </Button>
                                    );
                                })()}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-text-secondary border border-dashed border-gray-200 rounded-2xl">
                        <SearchX className="mx-auto mb-2 opacity-50" size={32} />
                        Nenhum requisito encontrado.
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingTask ? "Editar Requisito" : "Novo Requisito"}</h2>
                            <button onClick={() => setIsCreateModalOpen(false)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-1">Título</label>
                                <input className="w-full input-field p-3 rounded-xl bg-surface" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-1">Descrição</label>
                                <textarea className="w-full input-field p-3 rounded-xl bg-surface" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Pontos (XP)</label>
                                    <input type="number" className="w-full input-field p-3 rounded-xl bg-surface" value={formData.points} onChange={e => setFormData({ ...formData, points: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Tipo</label>
                                    <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="check">Checklist Simples</option>
                                        <option value="text">Resposta de Texto</option>
                                        <option value="upload">Envio de Arquivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Data Inicial (00:01)</label>
                                    <input
                                        type="date"
                                        className="w-full input-field p-3 rounded-xl bg-surface"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Data Final (23:59)</label>
                                    <input
                                        type="date"
                                        className="w-full input-field p-3 rounded-xl bg-surface"
                                        value={formData.deadline}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                    />
                                    <p className="text-[10px] text-text-secondary mt-1 leading-tight">
                                        Data limite. 100% dos pontos até 23:59.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Classificação</label>
                                    <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.classification} onChange={e => setFormData({ ...formData, classification: e.target.value as any })}>
                                        <option value="todos">Todos</option>
                                        <option value="pre-adolescente">Pre-adolescente</option>
                                        <option value="adolescente">Adolescente</option>
                                    </select>
                                </div>
                            </div>

                            {/* Scope Selection */}
                            {(currentUser?.role === 'master' || currentUser?.role === 'coord_geral' || currentUser?.role === 'secretaria') && (
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Abrangência</label>
                                    <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value })}>
                                        <option value="general">Geral (Todos)</option>
                                        <option value="district">Distritais</option>
                                        <option value="base">Base Específica</option>
                                    </select>
                                </div>
                            )}

                            {formData.scope === 'district' && (
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Distrito</label>
                                    <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.districtId} onChange={e => setFormData({ ...formData, districtId: e.target.value })} disabled={currentUser?.role === 'coord_distrital'}>
                                        <option value="">Selecione...</option>
                                        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {formData.scope === 'base' && (
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-1">Base</label>
                                    <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.baseId} onChange={e => setFormData({ ...formData, baseId: e.target.value })} disabled={currentUser?.role === 'coord_base'}>
                                        <option value="">Selecione...</option>
                                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <Button disabled={isSaving} onClick={handleSave} className="w-full mt-4">
                                {isSaving ? "Salvando..." : "Salvar Requisito"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Response Modal (Member) */}
            {viewingTask && currentUser?.role === 'membro' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">Responder Requisito</h2>
                                <p className="text-white/80 text-sm">{viewingTask.title}</p>
                            </div>
                            <button onClick={() => setViewingTask(null)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-text-secondary">{viewingTask.description}</p>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <h4 className="font-bold text-sm text-text-primary mb-2">Sua Resposta</h4>

                                {viewingTask.type === 'check' && (
                                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-primary transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 text-primary rounded focus:ring-primary"
                                            checked={submissionData.completed}
                                            onChange={e => setSubmissionData({ ...submissionData, completed: e.target.checked })}
                                        />
                                        <span className="text-sm">Marcar como concluído</span>
                                    </label>
                                )}

                                {viewingTask.type === 'text' && (
                                    <textarea
                                        className="w-full input-field p-3 rounded-xl bg-white min-h-[100px]"
                                        placeholder="Digite sua resposta aqui..."
                                        value={submissionData.text}
                                        onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })}
                                    />
                                )}

                                {viewingTask.type === 'upload' && (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            className="w-full input-field p-3 rounded-xl bg-white"
                                            placeholder="Cole o link do arquivo (Google Drive, etc)..."
                                            value={submissionData.link}
                                            onChange={e => setSubmissionData({ ...submissionData, link: e.target.value })}
                                        />
                                        <p className="text-xs text-text-secondary">Por enquanto, aceitamos apenas links externos.</p>
                                    </div>
                                )}
                            </div>

                            <Button disabled={isSubmitSaving} onClick={handleSubmitResponse} className="w-full mt-2">
                                {isSubmitSaving ? "Enviando..." : "Enviar Resposta"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
