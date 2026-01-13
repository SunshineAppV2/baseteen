"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";
import { firestoreService } from "@/hooks/useFirestore";
import { where } from "firebase/firestore";
import { auth } from "@/services/firebase";
import { CheckCircle, Upload, FileText, AlertCircle, Plus, Target, Globe, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Task {
    id: string;
    title: string;
    description: string;
    type: "upload" | "text" | "check" | "link";
    points: number;
    isBaseCollective?: boolean;
    visibilityScope: string;
    districtId?: string;
    regionId?: string;
    associationId?: string;
    deadline?: string;
    startDate?: string;
    classification?: string;
}

interface BaseSubmission {
    id: string;
    taskId: string;
    baseId: string;
    baseName: string;
    proof: {
        content: string;
        submittedAt: Date;
    };
    status: 'pending' | 'approved' | 'rejected';
    xpReward: number;
    submittedBy: string;
    submittedByName: string;
    timeline?: Array<{
        status: string;
        at: Date;
        by: string;
        action: string;
        note?: string;
    }>;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
}

interface District {
    id: string;
    name: string;
}

export default function RotaGAPage() {
    const { user: currentUser } = useAuth();

    // 1. Base Constraints (Security + Context)
    const baseConstraints = useMemo(() => {
        if (!currentUser) return [];
        const { role, districtId, regionId, associationId, unionId, baseId } = currentUser;

        if (role === 'coord_base' && baseId) return [where('id', '==', baseId)];
        if (role === 'coord_distrital' && districtId) return [where('districtId', '==', districtId)];
        if (role === 'coord_regiao' && regionId) return [where('regionId', '==', regionId)];
        if (role === 'coord_associacao' && associationId) return [where('associationId', '==', associationId)];
        if (role === 'coord_uniao' && unionId) return [where('unionId', '==', unionId)];

        return [];
    }, [currentUser]);

    const { data: tasks, loading: loadingTasks } = useCollection<Task>("tasks");
    const { data: submissions } = useCollection<BaseSubmission>("base_submissions");
    const { data: bases } = useCollection<Base>("bases", baseConstraints);
    const { data: districtsRaw } = useCollection<District>("districts");

    // Sort alphabetically
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);

    const [districtFilter, setDistrictFilter] = useState<string>("all");
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [submissionData, setSubmissionData] = useState({ text: "", link: "", completed: false });
    const [isSaving, setIsSaving] = useState(false);

    // Upload State
    const [isUploading, setIsUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        setIsUploading(true);
        try {
            const token = await auth.currentUser.getIdToken();

            // 1. Get Resumable Upload URL
            const initRes = await fetch('/api/drive/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                    size: file.size
                })
            });

            if (!initRes.ok) {
                const errorData = await initRes.json();
                throw new Error(errorData.error || "Falha ao iniciar upload");
            }
            const { uploadUrl } = await initRes.json();

            // 2. Upload File to Drive
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file
            });

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                // Check if it's the quota error
                if (uploadRes.status === 403 && errorText.includes("storage quota")) {
                    alert("ERRO DE CONFIGURAÇÃO DO DRIVE: A Service Account não tem espaço de armazenamento.\n\nSOLUÇÃO: Use uma pasta dentro de um 'Drive Compartilhado' (Shared Drive) ou mude para o Firebase Storage.");
                }
                console.error("Drive PUT Error:", errorText);
                throw new Error(`Falha no envio do arquivo: ${uploadRes.status} ${uploadRes.statusText}`);
            }

            const driveFile = await uploadRes.json();

            // 3. Save Link
            const link = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view?usp=sharing`;

            setSubmissionData(prev => ({ ...prev, link }));

        } catch (error: any) {
            console.error(error);
            alert("Erro ao fazer upload: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // 2. Filter Bases based on UI Selection
    const filteredBases = useMemo(() => {
        if (districtFilter === 'all') return bases;
        return bases.filter(b => b.districtId === districtFilter);
    }, [bases, districtFilter]);

    // 3. Calculate Stats per Task
    const getTaskStats = (taskId: string) => {
        const totalBases = filteredBases.length;
        if (totalBases === 0) return { count: 0, total: 0, percent: 0 };

        const approvedCount = submissions.filter(s =>
            s.taskId === taskId &&
            s.status === 'approved' &&
            filteredBases.some(b => b.id === s.baseId)
        ).length;

        return {
            count: approvedCount,
            total: totalBases,
            percent: Math.round((approvedCount / totalBases) * 100)
        };
    };

    // Filter only base collective tasks visible to this base
    const collectiveTasks = tasks.filter(task => {
        if (!task.isBaseCollective) return false;

        // Check visibility scope
        if (task.visibilityScope === 'all') return true;
        if (task.visibilityScope === 'district' && task.districtId === currentUser?.districtId) return true;
        if (task.visibilityScope === 'region' && task.regionId === currentUser?.regionId) return true;
        if (task.visibilityScope === 'association' && task.associationId === currentUser?.associationId) return true;

        return false;
    }).sort((a, b) => {
        const getNum = (s: string) => {
            const match = s.trim().match(/^(\d+)/);
            return match ? parseInt(match[1]) : 9999;
        };
        return getNum(a.title) - getNum(b.title);
    });

    // Check if base already submitted this task
    const hasSubmitted = (taskId: string) => {
        return submissions.some(s => s.taskId === taskId && s.baseId === currentUser?.baseId);
    };

    const getSubmissionStatus = (taskId: string) => {
        const submission = submissions.find(s => s.taskId === taskId && s.baseId === currentUser?.baseId);
        return submission?.status || null;
    };

    const handleSubmit = async () => {
        if (!selectedTask || !currentUser?.baseId) return;

        setIsSaving(true);
        try {
            let proofContent = "";
            if (selectedTask.type === 'check') proofContent = submissionData.completed ? "Marcado como concluído" : "Não concluído";
            else if (selectedTask.type === 'text') proofContent = submissionData.text;
            else if (selectedTask.type === 'upload') proofContent = submissionData.link;
            else if (selectedTask.type === 'link') proofContent = submissionData.link;

            const submissionId = `${selectedTask.id}_${currentUser.baseId}`;

            const currentBase = bases.find(b => b.id === currentUser.baseId);

            const timelineEvent = {
                action: 'submitted',
                status: 'pending',
                at: new Date(),
                by: currentUser.uid,
                note: proofContent
            };

            const existingSubmission = submissions.find(s => s.taskId === selectedTask.id && s.baseId === currentUser.baseId);
            const timeline = existingSubmission?.timeline ? [...existingSubmission.timeline, timelineEvent] : [timelineEvent];

            await firestoreService.set("base_submissions", submissionId, {
                taskId: selectedTask.id,
                baseId: currentUser.baseId,
                baseName: currentBase?.name || "Base",
                districtId: currentUser.districtId || "",
                regionId: currentUser.regionId || "",
                associationId: currentUser.associationId || "",
                unionId: currentUser.unionId || "",
                submittedBy: currentUser.uid,
                submittedByName: currentUser.displayName || "Coordenador",
                proof: {
                    content: proofContent,
                    submittedAt: new Date()
                },
                status: 'pending',
                xpReward: selectedTask.points,
                createdAt: new Date(),
                timeline: timeline
            });

            alert("Resposta enviada com sucesso! Aguarde a aprovação.");
            setSelectedTask(null);
            setSubmissionData({ text: "", link: "", completed: false });
        } catch (error: any) {
            console.error(error);
            alert("Erro ao enviar resposta: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser || currentUser.role === 'membro') {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <p className="text-text-secondary">Acesso restrito a Coordenadores.</p>
                </div>
            </div>
        );
    }

    const isBaseCoordinator = currentUser.role === 'coord_base';
    const isHierarchicalCoordinator = ['coord_distrital', 'coord_regiao', 'coord_associacao', 'coord_uniao', 'coord_geral', 'master', 'admin', 'secretaria'].includes(currentUser.role || '');

    // Hierarchical coordinators interface (Management View)
    if (isHierarchicalCoordinator) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">🎯 ROTA GA</h1>
                        <p className="text-text-secondary">Gerencie os requisitos coletivos das bases.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={districtFilter}
                            onChange={(e) => setDistrictFilter(e.target.value)}
                            className="p-2 border rounded-lg bg-white text-sm min-w-[200px]"
                        >
                            <option value="all">Todos os Distritos</option>
                            {districts
                                .filter(d => bases.some(b => b.districtId === d.id)) // Only show relevant districts
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))
                            }
                        </select>
                        <Button onClick={() => window.location.href = '/tasks'} className="bg-primary text-white">
                            <Plus size={20} className="mr-2" />
                            Gerenciar em Tarefas
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loadingTasks ? (
                        <div className="text-center py-12 text-text-secondary">
                            Carregando requisitos...
                        </div>
                    ) : collectiveTasks.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Target size={48} className="mx-auto text-gray-200 mb-4" />
                            <h3 className="text-lg font-bold text-text-primary">Nenhum requisito encontrado</h3>
                            <p className="text-text-secondary">Nenhum requisito coletivo foi criado ainda.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left p-4 text-xs font-bold text-text-secondary uppercase">Título</th>
                                        <th className="text-left p-4 text-xs font-bold text-text-secondary uppercase">PTS</th>
                                        <th className="text-left p-4 text-xs font-bold text-text-secondary uppercase">Adesão</th>
                                        <th className="text-left p-4 text-xs font-bold text-text-secondary uppercase">Tipo</th>
                                        <th className="text-left p-4 text-xs font-bold text-text-secondary uppercase">Visibilidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {collectiveTasks.map(task => (
                                        <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-text-primary">{task.title}</div>
                                                <div className="text-sm text-text-secondary line-clamp-1">{task.description}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                                                    {task.points} PTS
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {(() => {
                                                    const stats = getTaskStats(task.id);
                                                    return (
                                                        <div className="w-32">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="font-bold text-text-primary">{stats.count}/{stats.total}</span>
                                                                <span className="text-text-secondary">{stats.percent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${(() => {
                                                                        if (stats.percent >= 75) return 'bg-green-500';
                                                                        if (stats.percent >= 40) return 'bg-yellow-500';
                                                                        return 'bg-red-500';
                                                                    })()}`}
                                                                    style={{ width: `${stats.percent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-text-secondary capitalize">
                                                    {task.type === 'check' && <CheckCircle size={16} />}
                                                    {task.type === 'text' && <FileText size={16} />}
                                                    {task.type === 'upload' && <Upload size={16} />}
                                                    {task.type === 'check' ? 'Marcar' : task.type === 'text' ? 'Texto' : 'Upload'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs font-medium text-text-secondary bg-gray-100 px-2 py-1 rounded">
                                                    {task.visibilityScope === 'all' ? 'Geral' :
                                                        task.visibilityScope === 'district' ? 'Distrital' :
                                                            task.visibilityScope === 'region' ? 'Regional' : 'Associativo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <p className="text-base text-blue-800 flex-1">
                        ℹ️ <strong>Dica:</strong> Para criar, editar ou excluir requisitos, utilize o botão "Gerenciar em Tarefas".
                        As aprovações devem ser feitas na página <strong>Aprovações GA</strong>.
                    </p>
                </div>
            </div>
        );
    }

    // Base coordinators see response interface
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">🎯 ROTA GA</h1>
                <p className="text-text-secondary">Requisitos coletivos da sua base.</p>
            </div>

            {/* Task List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loadingTasks ? (
                    <div className="col-span-full text-center py-12 text-text-secondary">
                        Carregando requisitos...
                    </div>
                ) : collectiveTasks.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-text-secondary">
                        Nenhum requisito coletivo disponível no momento.
                    </div>
                ) : (
                    collectiveTasks.map(task => {
                        const submitted = hasSubmitted(task.id);
                        const status = getSubmissionStatus(task.id);
                        const isExpired = !!(task.deadline && new Date(task.deadline) < new Date());
                        const isOverdue = isExpired && status !== 'approved' && status !== 'pending';

                        return (
                            <div
                                key={task.id}
                                className={`bg-white rounded-2xl p-6 border-2 transition-all ${status === 'approved' ? 'border-green-500 bg-green-50' :
                                    isOverdue ? 'border-red-500 bg-red-50 shadow-inner' :
                                        status === 'rejected' ? 'border-red-500 bg-red-50' :
                                            submitted ? 'border-yellow-500 bg-yellow-50' :
                                                'border-gray-100 hover:border-primary/50 hover:shadow-lg'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-bold text-lg">{task.title}</h3>
                                    <div className="flex items-center gap-2">
                                        {task.type === 'check' && <CheckCircle size={20} className="text-primary" />}
                                        {task.type === 'text' && <FileText size={20} className="text-primary" />}
                                        {task.type === 'upload' && <Upload size={20} className="text-primary" />}
                                        {task.type === 'link' && <Globe size={20} className="text-primary" />}
                                    </div>
                                </div>

                                <p className="text-sm text-text-secondary mb-4 line-clamp-2">{task.description}</p>

                                <div className="flex items-center justify-between">
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-primary">{task.points} PTS</span>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            {task.startDate && (
                                                <div className="text-[10px] text-gray-400 font-medium uppercase">
                                                    Início: {new Date(task.startDate).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                            {task.deadline && (
                                                <div className={`text-[10px] font-medium uppercase ${isExpired ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                    Prazo: {new Date(task.deadline).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {status === 'approved' ? (
                                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                            ✓ Aprovado
                                        </span>
                                    ) : isOverdue ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-sm">
                                                ✗ Vencido
                                            </span>
                                            <span className="text-[10px] text-red-600 font-bold uppercase tracking-tighter">
                                                Prazo encerrado
                                            </span>
                                        </div>
                                    ) : status === 'rejected' ? (
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                                                ✗ Reprovado
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedTask(task)}
                                                className="text-xs border-red-200 text-red-600 hover:bg-red-50 h-7"
                                            >
                                                Tentar Novamente
                                            </Button>
                                        </div>
                                    ) : submitted ? (
                                        <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                                            ⏳ Pendente
                                        </span>
                                    ) : (task.startDate && new Date(task.startDate) > new Date()) ? (
                                        <Button
                                            disabled
                                            className="text-sm bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-200"
                                        >
                                            Disponível em {new Date(task.startDate).toLocaleDateString('pt-BR')}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setSelectedTask(task)}
                                            className="text-sm"
                                        >
                                            Responder
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Submission Modal */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                            <p className="text-sm text-text-secondary mt-1">{selectedTask.description}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            {selectedTask.type === 'check' && (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="completed"
                                        checked={submissionData.completed}
                                        onChange={e => setSubmissionData({ ...submissionData, completed: e.target.checked })}
                                        className="w-5 h-5 rounded border-gray-300"
                                    />
                                    <label htmlFor="completed" className="text-sm font-medium">
                                        Marcar como concluído
                                    </label>
                                </div>
                            )}

                            {selectedTask.type === 'text' && (
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-2">
                                        Resposta
                                    </label>
                                    <textarea
                                        className="w-full p-3 rounded-xl bg-surface border-none focus:ring-2 focus:ring-primary/20"
                                        rows={4}
                                        placeholder="Digite sua resposta..."
                                        value={submissionData.text}
                                        onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })}
                                    />
                                </div>
                            )}

                            {selectedTask.type === 'upload' && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-text-secondary mb-2">
                                        Anexo (PDF/JPG/Vídeo)
                                    </label>
                                    {!submissionData.link ? (
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                                            {isUploading ? (
                                                <div className="flex flex-col items-center gap-2 text-primary">
                                                    <Loader2 className="animate-spin" size={24} />
                                                    <span className="text-sm font-medium">Enviando para o Drive...</span>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer flex flex-col items-center gap-2">
                                                    <UploadCloud className="text-gray-400" size={32} />
                                                    <span className="text-sm font-medium text-gray-700">Clique para selecionar um arquivo</span>
                                                    <span className="text-xs text-text-secondary">Imagens, Vídeos ou PDF</span>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={handleFileUpload}
                                                        accept="image/*,video/*,application/pdf"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="p-2 bg-green-100 rounded-lg text-green-700">
                                                    <UploadCloud size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-green-800">Arquivo enviado!</p>
                                                    <p className="text-xs text-green-600 truncate underline">{submissionData.link}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSubmissionData(prev => ({ ...prev, link: "" }))}
                                                className="p-1 text-green-700 hover:bg-green-100 rounded-full"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-text-secondary text-center">
                                        Os arquivos serão salvos com segurança no Google Drive.
                                    </p>
                                </div>
                            )}

                            {selectedTask.type === 'link' && (
                                <div>
                                    <label className="block text-sm font-bold text-text-secondary mb-2">
                                        Link (URL)
                                    </label>
                                    <input
                                        type="url"
                                        className="w-full p-3 rounded-xl bg-surface border-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="https://..."
                                        value={submissionData.link}
                                        onChange={e => setSubmissionData({ ...submissionData, link: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={() => setSelectedTask(null)}
                                    className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="flex-1"
                                >
                                    {isSaving ? "Enviando..." : "Enviar Resposta"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
