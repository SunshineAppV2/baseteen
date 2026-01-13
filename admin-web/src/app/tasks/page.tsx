"use client";

import { useState, useMemo } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { auth } from "@/services/firebase";
import { where } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import {
    Plus,
    Pencil,
    Trash2,
    BookOpen,
    MapPin,
    Globe,
    Building2,
    Loader2,
    Clipboard,
    Users,
    Search,
    ChevronDown,
    Settings2,
    X,
    Save,
    Clock,
    UploadCloud,
    SearchX,
    CheckSquare,
    Square,
    CheckCircle, Upload, FileText, AlertCircle, Target, Copy
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";
import BaseTypeBadge from "@/components/BaseTypeBadge";
import { checkAchievements } from "@/services/achievementService";

interface Task {
    id: string;
    title: string;
    description: string;
    type: "upload" | "text" | "check" | "link";
    points: number;

    // Hierarchical Visibility
    visibilityScope: 'all' | 'union' | 'association' | 'region' | 'district' | 'base';
    unionId?: string;
    associationId?: string;
    regionId?: string;
    districtId?: string;
    baseId?: string;

    // Base Collective Requirements
    isBaseCollective?: boolean;  // true = respondido pela base, false/undefined = individual

    // NOVO: Target Base Type
    targetBaseType?: 'soul+' | 'teen' | 'both'; // Tipo de base alvo

    startDate?: string;
    deadline?: string;
    classification?: 'pre-adolescente' | 'adolescente' | 'todos';
    isCustomized?: boolean; // Identifica se foi personalizada por uma base
}

interface District {
    id: string;
    name: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
    baseType?: 'soul+' | 'teen'; // Type of base (Soul+ or Teen)
}

interface Region {
    id: string;
    name: string;
    associationId?: string;
}

interface Association {
    id: string;
    name: string;
    unionId?: string;
}

interface Union {
    id: string;
    name: string;
}

export default function TasksPage() {
    const { user: currentUser } = useAuth();
    const { data: tasks, loading } = useCollection<Task>("tasks");
    const { data: districtsRaw } = useCollection<District>("districts");
    const { data: basesRaw } = useCollection<Base>("bases");
    const { data: regionsRaw } = useCollection<Region>("regions");
    const { data: associationsRaw } = useCollection<Association>("associations");
    const { data: unionsRaw } = useCollection<Union>("unions");

    // Sort alphabetically
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);
    const bases = useMemo(() => [...basesRaw].sort((a, b) => a.name.localeCompare(b.name)), [basesRaw]);
    const regions = useMemo(() => [...regionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [regionsRaw]);
    const associations = useMemo(() => [...associationsRaw].sort((a, b) => a.name.localeCompare(b.name)), [associationsRaw]);
    const unions = useMemo(() => [...unionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [unionsRaw]);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Member Submission State
    const [viewingTask, setViewingTask] = useState<Task | null>(null);
    const [submissionData, setSubmissionData] = useState({ text: "", link: "", completed: false });
    const [isSubmitSaving, setIsSubmitSaving] = useState(false);

    // Fetch user's submissions to check status
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
        visibilityScope: "all" as 'all' | 'union' | 'association' | 'region' | 'district' | 'base',
        unionId: "",
        associationId: "",
        regionId: "",
        districtId: "",
        baseId: "",
        isBaseCollective: true,
        targetBaseType: "both" as 'soul+' | 'teen' | 'both',
        startDate: "",
        deadline: "",
        classification: "todos" as 'pre-adolescente' | 'adolescente' | 'todos',
    });

    // Bulk & Filter States
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClassification, setFilterClassification] = useState("all");
    const [filterType, setFilterType] = useState("all");
    const [filterScope, setFilterScope] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'collective' | 'individual' | 'base_specific'>('all');
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkFormData, setBulkFormData] = useState({
        points: "",
        classification: "all",
        type: "all",
        targetBaseType: "all",
        requirementType: "all", // individual, base-collective
        visibilityScope: "all",
        deadline: "",
        clearDeadline: false
    });

    const [isUploading, setIsUploading] = useState(false);
    const [isTextImportOpen, setIsTextImportOpen] = useState(false);
    const [textImportValue, setTextImportValue] = useState("");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        setIsUploading(true);
        try {
            const token = await auth.currentUser.getIdToken();
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

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file
            });

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Falha no envio do arquivo: ${uploadRes.status} ${uploadRes.statusText}`);
            }

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

    const resetForm = () => {
        let defaultScope: any = 'all';
        if (currentUser?.role === 'coord_base') defaultScope = 'base';
        else if (currentUser?.role === 'coord_distrital') defaultScope = 'district';
        else if (currentUser?.role === 'coord_regiao') defaultScope = 'region';
        else if (currentUser?.role === 'coord_associacao') defaultScope = 'association';
        else if (currentUser?.role === 'coord_uniao') defaultScope = 'union';

        setFormData({
            title: "",
            description: "",
            type: "check",
            points: 10,
            startDate: "",
            deadline: "",
            visibilityScope: defaultScope,
            unionId: currentUser?.unionId || "",
            associationId: currentUser?.associationId || "",
            regionId: currentUser?.regionId || "",
            districtId: currentUser?.districtId || "",
            baseId: currentUser?.baseId || "",
            isBaseCollective: false,
            targetBaseType: "both",
            classification: "todos"
        });
        setEditingTask(null);
    };

    const handleCreateClick = () => {
        resetForm();
        setIsCreateModalOpen(true);
    };

    const handleEditClick = (task: Task) => {
        const toInputDate = (isoStr: string | undefined) => {
            if (!isoStr) return "";
            const d = new Date(isoStr);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setFormData({
            title: task.title,
            description: task.description,
            type: task.type as any,
            points: task.points,
            startDate: toInputDate(task.startDate),
            deadline: toInputDate(task.deadline),
            visibilityScope: task.visibilityScope || 'all',
            unionId: task.unionId || "",
            associationId: task.associationId || "",
            regionId: task.regionId || "",
            districtId: task.districtId || "",
            baseId: task.baseId || "",
            isBaseCollective: task.isBaseCollective || false,
            targetBaseType: task.targetBaseType || "both",
            classification: task.classification || "todos"
        });
        setEditingTask(task);
        setIsCreateModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.points) return alert("Preencha os campos obrigatórios.");

        setIsSaving(true);
        try {
            // logic: If I'm coord_base and this task doesn't belong to my base and scope isn't base
            const isPersonalizing = currentUser?.role === 'coord_base' &&
                (editingTask?.visibilityScope !== 'base' || editingTask?.baseId !== currentUser.baseId);

            const effectiveScope = isPersonalizing ? 'base' : formData.visibilityScope;

            const data: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                points: Number(formData.points),
                xpReward: Number(formData.points),
                updatedAt: new Date(),
                startDate: formData.startDate ? new Date(`${formData.startDate}T00:01:00`).toISOString() : null,
                deadline: formData.deadline ? new Date(`${formData.deadline}T23:59:59`).toISOString() : null,
                classification: formData.classification,
                isBaseCollective: formData.isBaseCollective || false,
                targetBaseType: formData.targetBaseType,
                visibilityScope: effectiveScope,
                isCustomized: isPersonalizing || editingTask?.isCustomized || false
            };

            // Set hierarchy IDs based on scope
            if (effectiveScope === 'all') {
                data.unionId = data.associationId = data.regionId = data.districtId = data.baseId = null;
            } else if (effectiveScope === 'union') {
                data.unionId = formData.unionId || currentUser?.unionId;
                data.associationId = data.regionId = data.districtId = data.baseId = null;
            } else if (effectiveScope === 'association') {
                data.associationId = formData.associationId || currentUser?.associationId;
                const assoc = associations.find(a => a.id === data.associationId);
                data.unionId = assoc?.unionId || currentUser?.unionId || null;
                data.regionId = data.districtId = data.baseId = null;
            } else if (effectiveScope === 'region') {
                data.regionId = formData.regionId || currentUser?.regionId;
                const region = regions.find(r => r.id === data.regionId);
                data.associationId = region?.associationId || currentUser?.associationId || null;
                const assoc = associations.find(a => a.id === data.associationId);
                data.unionId = assoc?.unionId || currentUser?.unionId || null;
                data.districtId = data.baseId = null;
            } else if (effectiveScope === 'district') {
                data.districtId = formData.districtId || currentUser?.districtId;
                const district = districts.find(d => d.id === data.districtId);
                data.regionId = district?.regionId || currentUser?.regionId || null;
                data.associationId = district?.associationId || currentUser?.associationId || null;
                data.unionId = district?.unionId || currentUser?.unionId || null;
                data.baseId = null;
            } else if (effectiveScope === 'base') {
                data.baseId = formData.baseId || currentUser?.baseId;
                const base = bases.find(b => b.id === data.baseId);
                data.districtId = base?.districtId || currentUser?.districtId || null;
                data.regionId = base?.regionId || currentUser?.regionId || null;
                data.associationId = base?.associationId || currentUser?.associationId || null;
                data.unionId = base?.unionId || currentUser?.unionId || null;
            }

            if (editingTask && !isPersonalizing) {
                await firestoreService.update("tasks", editingTask.id, data);
            } else {
                data.createdAt = new Date();
                await firestoreService.add("tasks", data);
            }
            setIsCreateModalOpen(false);
            resetForm();
        } catch (error: any) {
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
            const isCollective = viewingTask.isBaseCollective;
            const collectionName = isCollective ? "base_submissions" : "submissions";
            const submissionId = isCollective ? `${viewingTask.id}_${currentUser.baseId}` : `${viewingTask.id}_${currentUser.uid}`;

            const data: any = {
                taskId: viewingTask.id,
                taskTitle: viewingTask.title,
                xpReward: viewingTask.points,
                status: 'pending',
                proof: {
                    content: submissionData.text || submissionData.link || "Cumprido",
                    submittedAt: new Date()
                },
                updatedAt: new Date(),
                districtId: currentUser.districtId || userBase?.districtId || null,
                baseId: currentUser.baseId || null,
                associationId: currentUser.associationId || null,
                regionId: currentUser.regionId || null,
                unionId: currentUser.unionId || null,
            };

            if (isCollective) {
                data.baseName = userBase?.name || "Base";
                data.submittedBy = currentUser.uid;
                data.submittedByName = currentUser.displayName;
            } else {
                data.userId = currentUser.uid;
                data.userDisplayName = currentUser.displayName;
            }

            await firestoreService.set(collectionName, submissionId, data);

            alert("Prova enviada com sucesso! Aguarde a aprovação do coordenador.");
            setViewingTask(null);
            setSubmissionData({ text: "", link: "", completed: false });
        } catch (error: any) {
            alert("Erro ao enviar: " + error.message);
        } finally {
            setIsSubmitSaving(false);
        }
    };

    const handleTextImport = async () => {
        if (!textImportValue.trim()) return;
        const lines = textImportValue.split("\n").filter(l => l.trim());
        setIsSaving(true);
        try {
            let count = 0;
            for (const line of lines) {
                if (line.trim().length < 3) continue;
                const parts = line.split(";").map(p => p.trim());
                let data: any;

                if (parts.length > 1) {
                    const title = parts[0];
                    const desc = parts[1] || "";
                    let points = 10;
                    let type: any = "check";
                    let finalStartDate = null;
                    let finalDeadline = null;

                    // Parse parts 2 to 5 smart-ly
                    if (parts[2]) points = Number(parts[2]) || 10;

                    if (parts[3]) {
                        const t = parts[3].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        if (t.includes("texto")) type = "text";
                        else if (t.includes("anexo") || t.includes("upload")) type = "upload";
                        else if (t.includes("link")) type = "link";
                        else type = "check";
                    }

                    const parseDate = (val: string, time: string) => {
                        if (!val) return null;
                        const dParts = val.split("/");
                        if (dParts.length === 3) {
                            const [d, m, y] = dParts;
                            // Usar formato ISO com tempo local para evitar drift de fuso horário
                            return new Date(`${y}-${m}-${d}T${time}`).toISOString();
                        }
                        return new Date(`${val}T${time}`).toISOString();
                    };

                    if (parts[4]) finalStartDate = parseDate(parts[4], "09:00:00");
                    if (parts[5]) finalDeadline = parseDate(parts[5], "21:00:00");

                    // Fallback: if only one date provided in parts[2] or parts[6]
                    if (parts.length === 3 && parts[2].includes("/")) {
                        finalDeadline = parseDate(parts[2], "23:59:59");
                        points = 10; // reset points if it was a date
                    }

                    const isColetivo = parts.some(p => p.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("COLETIVO"));

                    data = {
                        title,
                        description: desc,
                        points,
                        xpReward: points,
                        type,
                        startDate: finalStartDate,
                        deadline: finalDeadline,
                        visibilityScope: currentUser?.role === 'coord_base' ? 'base' : 'district',
                        classification: "todos",
                        isBaseCollective: isColetivo,
                        targetBaseType: "both",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        unionId: currentUser?.unionId || null,
                        associationId: currentUser?.associationId || null,
                        regionId: currentUser?.regionId || null,
                        districtId: currentUser?.districtId || null,
                        baseId: currentUser?.baseId || null
                    };
                } else {
                    data = {
                        title: line.trim(), description: "", points: 10, xpReward: 10, type: "check",
                        visibilityScope: currentUser?.role === 'coord_base' ? 'base' : 'district',
                        classification: "todos", isBaseCollective: false, targetBaseType: "both",
                        createdAt: new Date(), updatedAt: new Date(),
                        unionId: currentUser?.unionId || null,
                        associationId: currentUser?.associationId || null,
                        regionId: currentUser?.regionId || null,
                        districtId: currentUser?.districtId || null,
                        baseId: currentUser?.baseId || null
                    };
                }
                await firestoreService.add("tasks", data);
                count++;
            }
            alert(`${count} requisitos importados!`);
            setIsTextImportOpen(false);
            setTextImportValue("");
        } catch (error: any) {
            alert("Erro: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const userBase = useMemo(() => bases.find(b => b.id === currentUser?.baseId), [currentUser, bases]);

    const filteredTasks = tasks.filter(task => {
        // 0. Filter by category buttons
        if (categoryFilter === 'collective' && !task.isBaseCollective) return false;
        if (categoryFilter === 'individual' && task.isBaseCollective) return false;
        if (categoryFilter === 'base_specific' && (task.visibilityScope !== 'base' || task.baseId !== currentUser?.baseId)) return false;

        // 0.1 Hide duplicates for coord_base (if they customized a task, hide the original)
        if (currentUser?.role === 'coord_base' && task.visibilityScope !== 'base' && !task.isBaseCollective) {
            const hasCustomized = tasks.some(t => t.visibilityScope === 'base' && t.baseId === currentUser.baseId && t.title === task.title);
            if (hasCustomized) return false;
        }

        if (currentUser?.role === 'membro') {
            // 1. Esconder Requisitos Coletivos para membros (Apenas coordenador vê)
            if (task.isBaseCollective) return false;

            // 2. Filtrar por tipo de base (Soul+ / Teen)
            if (task.targetBaseType && task.targetBaseType !== 'both' && userBase) {
                if (task.targetBaseType === 'soul+' && userBase.baseType !== 'soul+') return false;
                if (task.targetBaseType === 'teen' && userBase.baseType !== 'teen') return false;
            }

            // 3. Filtrar por Escopo / Hierarquia (Ranking GA ou Requisitos da Base)
            let isVisibleByScope = false;
            if (task.visibilityScope === 'all') isVisibleByScope = true;
            else if (task.visibilityScope === 'union' && task.unionId === currentUser.unionId) isVisibleByScope = true;
            else if (task.visibilityScope === 'association' && task.associationId === currentUser.associationId) isVisibleByScope = true;
            else if (task.visibilityScope === 'region' && task.regionId === currentUser.regionId) isVisibleByScope = true;
            else if (task.visibilityScope === 'district' && task.districtId === currentUser.districtId) isVisibleByScope = true;
            else if (task.visibilityScope === 'base' && task.baseId === currentUser.baseId) isVisibleByScope = true;

            if (!isVisibleByScope) return false;

            // 4. Data de Início: Permitimos ver (com aviso visual se for futuro)
            return true;
        }

        // --- FILTRO PARA COORDENADORES ---
        let isVisibleByHierarchy = false;

        // Master/Admin vê tudo
        if (['master', 'admin', 'coord_geral', 'secretaria'].includes(currentUser?.role || '')) {
            isVisibleByHierarchy = true;
        } else {
            // Visibilidade Hierárquica: Coordenador vê o seu nível e os níveis abaixo dele
            if (task.visibilityScope === 'all') isVisibleByHierarchy = true;
            else if (task.visibilityScope === 'union') isVisibleByHierarchy = task.unionId === currentUser?.unionId;
            else if (task.visibilityScope === 'association') isVisibleByHierarchy = task.associationId === currentUser?.associationId;
            else if (task.visibilityScope === 'region') {
                isVisibleByHierarchy = task.regionId === currentUser?.regionId || task.associationId === currentUser?.associationId;
            } else if (task.visibilityScope === 'district') {
                isVisibleByHierarchy = task.districtId === currentUser?.districtId || task.regionId === currentUser?.regionId || task.associationId === currentUser?.associationId;
            } else if (task.visibilityScope === 'base') {
                isVisibleByHierarchy = task.baseId === currentUser?.baseId || task.districtId === currentUser?.districtId || task.regionId === currentUser?.regionId || task.associationId === currentUser?.associationId;
            } else {
                isVisibleByHierarchy = true; // Fallback
            }
        }

        if (!isVisibleByHierarchy) return false;

        if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && !task.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterClassification !== 'all' && task.classification !== filterClassification) return false;
        if (filterType !== 'all' && task.type !== filterType) return false;
        if (filterScope !== 'all' && task.visibilityScope !== filterScope) return false;

        return true;
    }).sort((a, b) => {
        const getSortDate = (t: Task) => {
            if (t.deadline) return new Date(t.deadline).getTime();
            if (t.startDate) return new Date(t.startDate).getTime();
            return 9999999999999;
        };

        const dateA = getSortDate(a);
        const dateB = getSortDate(b);

        if (dateA !== dateB) return dateA - dateB;

        // If same date, sort by numeric prefix in title if exists
        const getNum = (s: string) => {
            const match = s.trim().match(/^(\d+)/);
            return match ? parseInt(match[1]) : 9999;
        };
        const numA = getNum(a.title);
        const numB = getNum(b.title);
        if (numA !== numB) return numA - numB;

        return a.title.localeCompare(b.title);
    });

    const isOwner = (task: Task) => {
        if (!currentUser || !currentUser.role) return false;
        if (['master', 'admin', 'coord_geral', 'secretaria'].includes(currentUser.role)) return true;

        if (task.visibilityScope === 'union' && currentUser.role === 'coord_uniao') return !!currentUser.unionId && task.unionId === currentUser.unionId;
        if (task.visibilityScope === 'association' && currentUser.role === 'coord_associacao') return !!currentUser.associationId && task.associationId === currentUser.associationId;
        if (task.visibilityScope === 'region' && currentUser.role === 'coord_regiao') return !!currentUser.regionId && task.regionId === currentUser.regionId;
        if (task.visibilityScope === 'district' && currentUser.role === 'coord_distrital') return !!currentUser.districtId && task.districtId === currentUser.districtId;
        if (task.visibilityScope === 'base' && currentUser.role === 'coord_base') return !!currentUser.baseId && task.baseId === currentUser.baseId;

        return false;
    };

    const canDelete = (task: Task) => isOwner(task);

    const canCopy = (task: Task) => {
        if (!currentUser || !currentUser.role || isOwner(task)) return false;
        // All coordinates can personalize/copy tasks from others to their own scope
        return ['coord_uniao', 'coord_associacao', 'coord_regiao', 'coord_distrital', 'coord_base'].includes(currentUser.role);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Requisitos</h1>
                    <p className="text-text-secondary">Gerencie as atividades e pontuações.</p>
                </div>
                {currentUser?.role !== 'membro' && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsTextImportOpen(true)} className="flex items-center gap-2 border-primary text-primary">
                            <Clipboard size={20} /> Importar Texto
                        </Button>
                        <Button onClick={handleCreateClick} className="flex items-center gap-2">
                            <Plus size={20} /> Novo Requisito
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === 'all' ? 'bg-primary text-white shadow-lg' : 'bg-white text-text-secondary border border-gray-100 hover:bg-gray-50'}`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setCategoryFilter('collective')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === 'collective' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-text-secondary border border-gray-100 hover:bg-gray-50'}`}
                >
                    Coletivo (Base)
                </button>
                <button
                    onClick={() => setCategoryFilter('individual')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === 'individual' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-text-secondary border border-gray-100 hover:bg-gray-50'}`}
                >
                    Individual (Ranking)
                </button>
                {currentUser?.role === 'coord_base' && (
                    <button
                        onClick={() => setCategoryFilter('base_specific')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === 'base_specific' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-text-secondary border border-gray-100 hover:bg-gray-50'}`}
                    >
                        Requisitos Base
                    </button>
                )}
            </div>

            {currentUser?.role !== 'membro' && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2 bg-surface rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select className="bg-surface border-none rounded-xl px-4 py-2 text-sm font-bold" value={filterClassification} onChange={e => setFilterClassification(e.target.value)}>
                        <option value="all">Todas Classificações</option>
                        <option value="todos">Todos</option>
                        <option value="pre-adolescente">Pre-adolescente</option>
                        <option value="adolescente">Adolescente</option>
                    </select>
                    <select className="bg-surface border-none rounded-xl px-4 py-2 text-sm font-bold" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Todos os Tipos</option>
                        <option value="check">Checklist</option>
                        <option value="text">Texto</option>
                        <option value="upload">Anexo</option>
                        <option value="link">Link</option>
                    </select>
                    <div className="flex items-center gap-4 ml-auto">
                        {searchTerm || filterClassification !== 'all' || filterType !== 'all' || filterScope !== 'all' ? (
                            <button onClick={() => { setSearchTerm(""); setFilterClassification("all"); setFilterType("all"); setFilterScope("all"); }} className="text-xs font-bold text-red-500 hover:underline">Limpar Filtros</button>
                        ) : null}
                        <button onClick={() => { if (selectedIds.length === filteredTasks.length) setSelectedIds([]); else setSelectedIds(filteredTasks.map(t => t.id)); }} className="text-xs font-bold text-primary hover:underline">
                            {selectedIds.length === filteredTasks.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {loading ? <p>Carregando...</p> : filteredTasks.length > 0 ? (
                    filteredTasks.map(task => {
                        const isSelected = selectedIds.includes(task.id);
                        return (
                            <div key={task.id} className={clsx("card-soft p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center transition-all", isSelected && "ring-2 ring-primary border-primary bg-primary/5")}>
                                <div className="flex items-start gap-4 flex-1">
                                    {currentUser?.role !== 'membro' && (
                                        <button onClick={() => isSelected ? setSelectedIds(selectedIds.filter(id => id !== task.id)) : setSelectedIds([...selectedIds, task.id])} className={clsx("mt-1 shrink-0 p-1 rounded transition-colors", isSelected ? "text-primary" : "text-gray-300")}>
                                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>
                                    )}
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {(task.visibilityScope === 'base' && task.baseId === currentUser?.baseId) && (
                                                <span className="badge bg-orange-100 text-orange-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ring-1 ring-orange-200">REQUISITO BASE</span>
                                            )}
                                            {task.isBaseCollective ? (
                                                <span className="badge bg-blue-100 text-blue-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ring-1 ring-blue-200">Coletivo (Base)</span>
                                            ) : (
                                                <span className="badge bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ring-1 ring-purple-200">Individual (Ranking)</span>
                                            )}
                                            {task.visibilityScope === 'all' && <span className="badge bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Ranking GA</span>}
                                            <span className="text-text-secondary text-xs font-bold uppercase">{task.type}</span>
                                            {task.targetBaseType && task.targetBaseType !== 'both' && <BaseTypeBadge type={task.targetBaseType} size="sm" showLabel={false} />}
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full font-bold uppercase">{task.classification || 'todos'}</span>
                                        </div>
                                        <h3 className="font-bold text-xl text-text-primary">{task.title}</h3>
                                        {task.description && <p className="text-base text-text-secondary line-clamp-2">{task.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-4 self-end md:self-auto">
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                {(task.startDate || task.deadline) && (
                                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                                                        <Clock size={12} />
                                                        {task.startDate ? new Date(task.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                                                        {task.startDate && task.deadline ? ' até ' : ''}
                                                        {task.deadline ? new Date(task.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                                                    </span>
                                                )}
                                                <span>{task.points} XP</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isOwner(task) ? (
                                                <button
                                                    onClick={() => handleEditClick(task)}
                                                    className="p-2 hover:bg-surface rounded-lg text-text-secondary hover:text-primary transition-colors"
                                                    title="Editar Requisito"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                            ) : canCopy(task) ? (
                                                <button
                                                    onClick={() => handleEditClick(task)}
                                                    className="p-2 bg-primary/5 hover:bg-primary/10 rounded-lg text-primary hover:text-primary-dark transition-all flex items-center gap-2 px-3 border border-primary/20"
                                                    title="Copiar para minha Base"
                                                >
                                                    <Copy size={16} />
                                                    <span className="text-[10px] font-bold uppercase">Copiar para Base</span>
                                                </button>
                                            ) : null}

                                            {canDelete(task) && (
                                                <button
                                                    onClick={() => handleDelete(task.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                        {(currentUser?.role === 'membro' || (currentUser?.role === 'coord_base' && task.isBaseCollective)) && (() => {
                                            const sub = submissionMap.get(task.id);
                                            if (sub?.status === 'pending' || sub?.status === 'approved') return <span className="text-xs font-bold px-3 py-1 rounded-full border bg-green-50 text-green-600">{sub.status === 'pending' ? 'Pendente' : 'Aprovado'}</span>;

                                            // Verificar se está disponível
                                            if (task.startDate) {
                                                const now = new Date();
                                                const startDate = new Date(task.startDate);
                                                if (now < startDate) {
                                                    return (
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-bold text-gray-400 block uppercase italic">Disponível dia</span>
                                                            <span className="text-xs font-black text-gray-500">{startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                        </div>
                                                    );
                                                }
                                            }

                                            if (task.isBaseCollective) return <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full">Coletivo</span>;
                                            return <Button size="sm" onClick={() => { setViewingTask(task); setSubmissionData({ text: "", link: "", completed: false }); }}>Responder</Button>;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : <div className="text-center py-12 text-text-secondary border border-dashed rounded-2xl"><SearchX className="mx-auto mb-2 opacity-50" size={32} /> Nenhum resultado.</div>}
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">
                                {editingTask ? (
                                    currentUser?.role === 'coord_base' && (editingTask.visibilityScope !== 'base' || editingTask.baseId !== currentUser.baseId)
                                        ? "Personalizar para minha Base"
                                        : "Editar Requisito"
                                ) : "Novo Requisito"}
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <input className="w-full input-field p-3 rounded-xl bg-surface" placeholder="Título" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            <textarea className="w-full input-field p-3 rounded-xl bg-surface" placeholder="Descrição" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" className="w-full input-field p-3 rounded-xl bg-surface" placeholder="Pontos" value={formData.points} onChange={e => setFormData({ ...formData, points: Number(e.target.value) })} />
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                    <option value="text">TEXTO</option><option value="upload">ANEXO</option><option value="link">LINK</option><option value="check">CHECKLIST</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold px-1">Início</label><input type="date" className="w-full input-field p-3 rounded-xl bg-surface" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
                                <div><label className="text-xs font-bold px-1">Fim</label><input type="date" className="w-full input-field p-3 rounded-xl bg-surface" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} /></div>
                            </div>
                            <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.classification} onChange={e => setFormData({ ...formData, classification: e.target.value as any })}>
                                <option value="todos">Todos</option><option value="pre-adolescente">Pre-adolescente</option><option value="adolescente">Adolescente</option>
                            </select>
                            <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.targetBaseType} onChange={e => setFormData({ ...formData, targetBaseType: e.target.value as any })}>
                                <option value="both">Ambas (Soul+ e Teen)</option><option value="soul+">Soul+</option><option value="teen">Teen</option>
                            </select>
                            <div className="space-y-2">
                                <label className="text-xs font-bold px-1 uppercase text-text-secondary">Âmbito de Visibilidade</label>
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.visibilityScope} onChange={e => setFormData({ ...formData, visibilityScope: e.target.value as any })}>
                                    <option value="all">Ranking GA (Global)</option>
                                    <option value="union">União</option>
                                    <option value="association">Associação</option>
                                    <option value="region">Região</option>
                                    <option value="district">Distrito</option>
                                    <option value="base">SÓ Base (Específica)</option>
                                </select>
                            </div>

                            {formData.visibilityScope === 'union' && (
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.unionId} onChange={e => setFormData({ ...formData, unionId: e.target.value })}>
                                    <option value="">Selecionar União</option>
                                    {unions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            )}
                            {formData.visibilityScope === 'association' && (
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.associationId} onChange={e => setFormData({ ...formData, associationId: e.target.value })}>
                                    <option value="">Selecionar Associação</option>
                                    {associations.filter(a => !formData.unionId || a.unionId === formData.unionId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            )}
                            {formData.visibilityScope === 'region' && (
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.regionId} onChange={e => setFormData({ ...formData, regionId: e.target.value })}>
                                    <option value="">Selecionar Região</option>
                                    {regions.filter(r => !formData.associationId || r.associationId === formData.associationId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            )}
                            {formData.visibilityScope === 'district' && (
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.districtId} onChange={e => setFormData({ ...formData, districtId: e.target.value })}>
                                    <option value="">Selecionar Distrito</option>
                                    {districts.filter(d => !formData.regionId || d.regionId === formData.regionId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            )}
                            {formData.visibilityScope === 'base' && (
                                <select className="w-full input-field p-3 rounded-xl bg-surface" value={formData.baseId} onChange={e => setFormData({ ...formData, baseId: e.target.value })}>
                                    <option value="">Selecionar Base</option>
                                    {bases.filter(b => !formData.districtId || b.districtId === formData.districtId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            )}
                            <label className="flex items-center gap-2 p-1 cursor-pointer hover:bg-surface rounded-lg transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.isBaseCollective}
                                    onChange={e => setFormData({ ...formData, isBaseCollective: e.target.checked })}
                                />
                                <span className="text-sm font-bold text-text-primary uppercase">Requisito Coletivo (Destinado à Base)</span>
                            </label>
                            <Button disabled={isSaving} onClick={handleSave} className="w-full">{isSaving ? "Salvando..." : "Salvar"}</Button>
                        </div>
                    </div>
                </div>
            )}

            {viewingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
                        <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{viewingTask.title}</h2><button onClick={() => setViewingTask(null)}><X /></button></div>
                        <p className="text-text-secondary">{viewingTask.description}</p>
                        {viewingTask.type === 'text' && <textarea className="w-full input-field p-3 rounded-xl bg-surface" rows={4} value={submissionData.text} onChange={e => setSubmissionData({ ...submissionData, text: e.target.value })} />}
                        {viewingTask.type === 'check' && <label className="flex items-center gap-2"><input type="checkbox" checked={submissionData.completed} onChange={e => setSubmissionData({ ...submissionData, completed: e.target.checked })} /> Confirmar conclusão</label>}
                        <Button disabled={isSubmitSaving} onClick={handleSubmitResponse} className="w-full">{isSubmitSaving ? "Enviando..." : "Enviar"}</Button>
                    </div>
                </div>
            )}

            {isTextImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Importar do Texto</h2>
                            <button onClick={() => setIsTextImportOpen(false)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-sm text-text-secondary bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                                <p className="font-bold text-blue-800">Formatos aceitos (use ponto e vírgula):</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>Simples:</strong> NOME; DESCRIÇÃO; DATA_FIM</li>
                                    <li><strong>Completo:</strong> NOME; DESCRIÇÃO; PONTOS; TIPO; DATA_INICIO; DATA_FIM</li>
                                </ul>
                                <p className="text-[11px] leading-tight mt-2 italic px-1">
                                    * Tipos: <strong>Texto, Anexo, Link, Checklist</strong>.<br />
                                    Ex: Lição 3; Estudar lição; 50; Checklist; 01/01/2026; 10/01/2026
                                </p>
                            </div>
                            <textarea
                                className="w-full input-field p-3 rounded-xl bg-surface min-h-[250px] font-mono text-sm"
                                placeholder={"Tarefa 1;Descrição;10;GLOBAL;TODOS;COLETIVO;31/01/2026"}
                                value={textImportValue}
                                onChange={e => setTextImportValue(e.target.value)}
                            />
                            <Button disabled={isSaving || !textImportValue.trim()} onClick={handleTextImport} className="w-full">
                                {isSaving ? <Loader2 className="animate-spin text-white" /> : "Importar tudo agora"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6">
                    <span className="text-sm font-medium">{selectedIds.length} selecionados</span>
                    <Button size="sm" variant="outline" className="text-white border-white/20" onClick={() => setIsBulkEditModalOpen(true)}>Alterar</Button>
                    <Button size="sm" variant="danger" onClick={async () => {
                        if (confirm("Deseja excluir os itens que você possui permissão?")) {
                            for (const id of selectedIds) {
                                const task = tasks.find(t => t.id === id);
                                if (task && canDelete(task)) {
                                    await firestoreService.delete("tasks", id);
                                }
                            }
                            setSelectedIds([]);
                        }
                    }}>Excluir</Button>
                    <button onClick={() => setSelectedIds([])}><X size={20} /></button>
                </div>
            )}

            {isBulkEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Alteração em Massa</h2>
                            <button onClick={() => setIsBulkEditModalOpen(false)} className="text-white/80 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-sm text-text-secondary">Os campos preenchidos serão aplicados aos <b>{selectedIds.length}</b> requisitos selecionados.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Pontuação (XP)</label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 150"
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={bulkFormData.points}
                                        onChange={e => setBulkFormData({ ...bulkFormData, points: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Classificação</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={bulkFormData.classification}
                                        onChange={e => setBulkFormData({ ...bulkFormData, classification: e.target.value })}
                                    >
                                        <option value="all">Manter Original</option>
                                        <option value="todos">Todos</option>
                                        <option value="pre-adolescente">Pre-adolescente</option>
                                        <option value="adolescente">Adolescente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Tipo de Resposta</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={bulkFormData.type}
                                        onChange={e => setBulkFormData({ ...bulkFormData, type: e.target.value })}
                                    >
                                        <option value="all">Manter Original</option>
                                        <option value="text">TEXTO</option>
                                        <option value="upload">ANEXO</option>
                                        <option value="link">LINK</option>
                                        <option value="check">CHECKLIST</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Tipo de Base Alvo</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={bulkFormData.targetBaseType}
                                        onChange={e => setBulkFormData({ ...bulkFormData, targetBaseType: e.target.value })}
                                    >
                                        <option value="all">Manter Original</option>
                                        <option value="both">Ambas (Soul+ e Teen)</option>
                                        <option value="soul+">Apenas Soul+</option>
                                        <option value="teen">Apenas Teen</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Tipo de Requisito</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={bulkFormData.requirementType}
                                        onChange={e => setBulkFormData({ ...bulkFormData, requirementType: e.target.value })}
                                    >
                                        <option value="all">Manter Original</option>
                                        <option value="individual">Individual (Membros respondem)</option>
                                        <option value="base-collective">Coletivo (Base responde)</option>
                                    </select>
                                </div>
                                {['master', 'admin', 'coord_geral', 'secretaria'].includes(currentUser?.role || '') && (
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Escopo de Visibilidade</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                            value={bulkFormData.visibilityScope}
                                            onChange={e => setBulkFormData({ ...bulkFormData, visibilityScope: e.target.value })}
                                        >
                                            <option value="all">Manter Original</option>
                                            <option value="global">Tornar Global</option>
                                            <option value="district">Tornar do meu Distrito</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-text-secondary uppercase block mb-1">Prazo (Deadline)</label>
                                    <div className="space-y-2">
                                        <input
                                            type="date"
                                            disabled={bulkFormData.clearDeadline}
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 font-bold"
                                            value={bulkFormData.deadline}
                                            onChange={e => setBulkFormData({ ...bulkFormData, deadline: e.target.value })}
                                        />
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bulkFormData.clearDeadline}
                                                onChange={e => setBulkFormData({ ...bulkFormData, clearDeadline: e.target.checked })}
                                                className="w-4 h-4 text-primary rounded"
                                            />
                                            <span className="text-sm font-medium text-text-secondary">Remover Prazo</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setIsBulkEditModalOpen(false)}>Cancelar</Button>
                                <Button
                                    className="flex-1"
                                    onClick={async () => {
                                        setIsSaving(true);
                                        try {
                                            const updates: any = {};
                                            if (bulkFormData.points) updates.points = parseInt(bulkFormData.points);
                                            if (bulkFormData.classification !== 'all') updates.classification = bulkFormData.classification;
                                            if (bulkFormData.type !== 'all') updates.type = bulkFormData.type;
                                            if (bulkFormData.targetBaseType !== 'all') updates.targetBaseType = bulkFormData.targetBaseType;
                                            if (bulkFormData.requirementType !== 'all') updates.isBaseCollective = bulkFormData.requirementType === 'base-collective';

                                            if (bulkFormData.visibilityScope !== 'all') {
                                                if (bulkFormData.visibilityScope === 'global') {
                                                    updates.visibilityScope = 'all';
                                                    updates.unionId = updates.associationId = updates.regionId = updates.districtId = updates.baseId = null;
                                                } else if (bulkFormData.visibilityScope === 'district') {
                                                    updates.visibilityScope = 'district';
                                                    updates.districtId = currentUser?.districtId || null;
                                                    updates.regionId = currentUser?.regionId || null;
                                                    updates.associationId = currentUser?.associationId || null;
                                                    updates.unionId = currentUser?.unionId || null;
                                                    updates.baseId = null;
                                                }
                                            }

                                            if (bulkFormData.clearDeadline) updates.deadline = null;
                                            else if (bulkFormData.deadline) updates.deadline = new Date(`${bulkFormData.deadline}T23:59:59`).toISOString();

                                            if (Object.keys(updates).length === 0) {
                                                alert("Nenhuma alteração definida.");
                                                return;
                                            }

                                            for (const id of selectedIds) {
                                                const task = tasks.find(t => t.id === id);
                                                if (!task) continue;

                                                const isPersonalizing = currentUser?.role === 'coord_base' &&
                                                    (task.visibilityScope !== 'base' || task.baseId !== currentUser.baseId);

                                                if (isPersonalizing) {
                                                    // Create personalized copy for the base
                                                    const baseData = bases.find(b => b.id === currentUser.baseId);
                                                    const personalizedData = {
                                                        ...task,
                                                        ...updates,
                                                        visibilityScope: 'base',
                                                        isCustomized: true,
                                                        baseId: currentUser.baseId,
                                                        districtId: baseData?.districtId || currentUser.districtId || null,
                                                        regionId: baseData?.regionId || currentUser.regionId || null,
                                                        associationId: baseData?.associationId || currentUser.associationId || null,
                                                        unionId: baseData?.unionId || currentUser.unionId || null,
                                                        createdAt: new Date(),
                                                        updatedAt: new Date()
                                                    };
                                                    delete (personalizedData as any).id;
                                                    await firestoreService.add("tasks", personalizedData);
                                                } else {
                                                    // Normal update (for tasks they own or if they have master permissions)
                                                    await firestoreService.update("tasks", id, {
                                                        ...updates,
                                                        updatedAt: new Date()
                                                    });
                                                }
                                            }

                                            setSelectedIds([]);
                                            setIsBulkEditModalOpen(false);
                                            alert("Alteração concluída com sucesso!");
                                        } catch (err: any) {
                                            alert("Erro: " + err.message);
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                >
                                    Aplicar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
