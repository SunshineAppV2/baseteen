"use client";

import { useState } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import {
    Plus,
    MapPin,
    Home,
    Trash2,
    Layers,
    Pencil,
    X,
    Save
} from "lucide-react";
import { clsx } from "clsx";
import { where } from "firebase/firestore";

interface District {
    id: string;
    name: string;
    coordinatorName?: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
    coordinatorName?: string;
}

export default function OrganizationPage() {
    const { user: currentUser } = useAuth();

    // Constraints for Firestore Queries
    const districtConstraints = currentUser?.role === 'coord_distrital' && currentUser.districtId
        ? [where('__name__', '==', currentUser.districtId)] // Query by Doc ID
        : [];

    const baseConstraints = currentUser?.role === 'coord_distrital' && currentUser.districtId
        ? [where('districtId', '==', currentUser.districtId)]
        : [];

    const { data: districts, loading: loadingDistricts, error: errorDistricts } = useCollection<District>("districts", districtConstraints);
    const { data: bases, loading: loadingBases, error: errorBases } = useCollection<Base>("bases", baseConstraints);

    if (errorDistricts) console.error("Error loading districts:", errorDistricts);
    if (errorBases) console.error("Error loading bases:", errorBases);

    if (errorDistricts || errorBases) {
        return (
            <div className="p-8 text-center text-red-600">
                <h3 className="text-lg font-bold">Erro ao carregar dados</h3>
                <p>Distritos: {errorDistricts?.message || "OK"}</p>
                <p>Bases: {errorBases?.message || "OK"}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Recarregar Página</Button>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState<"districts" | "bases">("districts");

    // Modal State
    const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
    const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);

    // Form State
    const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
    const [editingBase, setEditingBase] = useState<Base | null>(null);

    const [districtForm, setDistrictForm] = useState({ name: "" });
    const [baseForm, setBaseForm] = useState({ name: "", districtId: "" });

    const [isSaving, setIsSaving] = useState(false);

    // Handlers for District
    const openDistrictModal = (district?: District) => {
        if (district) {
            setEditingDistrict(district);
            setDistrictForm({ name: district.name });
        } else {
            setEditingDistrict(null);
            setDistrictForm({ name: "" });
        }
        setIsDistrictModalOpen(true);
    };

    const handleSaveDistrict = async () => {
        if (!districtForm.name) return alert("Digite o nome do distrito.");
        setIsSaving(true);
        try {
            if (editingDistrict) {
                await firestoreService.update("districts", editingDistrict.id, { name: districtForm.name });
            } else {
                await firestoreService.add("districts", { name: districtForm.name });
            }
            setIsDistrictModalOpen(false);
            alert(editingDistrict ? "Distrito atualizado!" : "Distrito criado com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar distrito.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDistrict = async (district: District) => {
        const linkedBases = bases.filter(b => b.districtId === district.id || b.districtId === district.name).length;
        if (linkedBases > 0) return alert(`Não é possível excluir. Existem ${linkedBases} bases vinculadas a este distrito.`);

        if (!confirm(`Excluir o distrito "${district.name}"?`)) return;
        try {
            await firestoreService.delete("districts", district.id);
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir distrito.");
        }
    };

    // Handlers for Base
    const openBaseModal = (base?: Base) => {
        if (base) {
            setEditingBase(base);
            // Try to find matching district ID, handle legacy data where districtId might be a name
            let distId = base.districtId;
            // If the current districtId is not in the districts list (maybe it's a name), try to find by name
            if (!districts.find(d => d.id === distId)) {
                const found = districts.find(d => d.name === distId);
                if (found) distId = found.id;
            }

            setBaseForm({ name: base.name, districtId: distId });
        } else {
            if (districts.length === 0) return alert("Crie um distrito primeiro!");
            setEditingBase(null);
            setBaseForm({ name: "", districtId: districts[0]?.id || "" });
        }
        setIsSaving(false); // Ensure clean state
        setIsBaseModalOpen(true);
    };

    const handleSaveBase = async () => {
        if (!baseForm.name || !baseForm.districtId) return alert("Preencha todos os campos.");
        setIsSaving(true);
        try {
            // Timeout promise to reject after 5s
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout: O servidor demorou muito. Verifique sua conexão.")), 5000)
            );

            if (editingBase) {
                await Promise.race([
                    firestoreService.update("bases", editingBase.id, {
                        name: baseForm.name,
                        districtId: baseForm.districtId
                    }),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    firestoreService.add("bases", {
                        name: baseForm.name,
                        districtId: baseForm.districtId
                    }),
                    timeoutPromise
                ]);
            }
            setIsBaseModalOpen(false);
            alert(editingBase ? "Base atualizada!" : "Base criada com sucesso!");
        } catch (error: any) {
            console.error(error);
            alert("Erro ao salvar base: " + (error.message || error.code || "Erro desconhecido"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBase = async (base: Base) => {
        if (!confirm(`Excluir a base "${base.name}"?`)) return;
        try {
            await firestoreService.delete("bases", base.id);
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir base.");
        }
    };

    // DEBUG: Get current auth state for diagnosis
    // (user is already got at top level)

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Organização
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerencie os Distritos e Bases do campo.
                    </p>
                </div>
                <div className="flex gap-2">
                    {['master', 'admin', 'coord_geral', 'coord_distrital'].includes(currentUser?.role || '') && (
                        <>
                            {['master', 'admin', 'coord_geral'].includes(currentUser?.role || '') && (
                                <Button variant="outline" onClick={() => openDistrictModal()} className="flex items-center gap-2">
                                    <Layers size={20} />
                                    Novo Distrito
                                </Button>
                            )}
                            <Button onClick={() => openBaseModal()} className="flex items-center gap-2">
                                <Plus size={20} />
                                Nova Base
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-100">
                <button
                    onClick={() => setActiveTab("districts")}
                    className={clsx(
                        "pb-4 px-2 font-bold text-sm transition-all relative",
                        activeTab === "districts" ? "text-primary border-b-2 border-primary" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    Distritos ({districts.length})
                </button>
                <button
                    onClick={() => setActiveTab("bases")}
                    className={clsx(
                        "pb-4 px-2 font-bold text-sm transition-all relative",
                        activeTab === "bases" ? "text-primary border-b-2 border-primary" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    Bases ({bases.length})
                </button>
            </div>

            {
                activeTab === "districts" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {districts.map(district => (
                            <div key={district.id} className="card-soft p-6 space-y-4 hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start">
                                    <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                                        <Layers size={24} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openDistrictModal(district)}
                                            className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary hover:text-primary"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDistrict(district)}
                                            className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{district.name}</h3>
                                    <p className="text-sm text-text-secondary">
                                        {bases.filter(b => b.districtId === district.id || b.districtId === district.name).length} Bases vinculadas
                                    </p>
                                </div>
                            </div>
                        ))}
                        {districts.length === 0 && !loadingDistricts && (
                            <div className="col-span-full text-center py-20 bg-white rounded-2xl border-2 border-dashed">
                                <Layers size={48} className="mx-auto text-gray-200 mb-4" />
                                <p className="text-text-secondary">Nenhum distrito cadastrado ainda.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bases.map(base => {
                            // Find district name for display
                            const dist = districts.find(d => d.id === base.districtId) || { name: 'Desconhecido' };
                            // Legacy support: if districtId IS the name
                            const displayName = dist.name !== 'Desconhecido' ? dist.name : (base.districtId.length > 5 ? 'ID: ' + base.districtId.substring(0, 5) : base.districtId);

                            return (
                                <div key={base.id} className="card-soft p-6 space-y-4 hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-green-500/10 text-green-600 p-3 rounded-2xl">
                                            <Home size={24} />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openBaseModal(base)}
                                                className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary hover:text-primary"
                                                title="Editar"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBase(base)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{base.name}</h3>
                                        <div className="flex items-center gap-1 text-xs text-text-secondary mt-1">
                                            <MapPin size={12} />
                                            <span>Distrito: {displayName}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {bases.length === 0 && !loadingBases && (
                            <div className="col-span-full text-center py-20 bg-white rounded-2xl border-2 border-dashed">
                                <Home size={48} className="mx-auto text-gray-200 mb-4" />
                                <p className="text-text-secondary">Nenhuma base cadastrada ainda.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Modal Distrito */}
            {
                isDistrictModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden scale-in-center">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold">{editingDistrict ? "Editar Distrito" : "Novo Distrito"}</h2>
                                <button onClick={() => setIsDistrictModalOpen(false)}><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Nome do Distrito</label>
                                    <input
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        placeholder="Ex: Distrito Central"
                                        value={districtForm.name}
                                        onChange={e => setDistrictForm({ ...districtForm, name: e.target.value })}
                                    />
                                </div>
                                <Button onClick={handleSaveDistrict} className="w-full" disabled={isSaving}>
                                    {isSaving ? "Salvando..." : (editingDistrict ? "Salvar Alterações" : "Criar Distrito")}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Base */}
            {
                isBaseModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden scale-in-center">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold">{editingBase ? "Editar Base" : "Nova Base"}</h2>
                                <button onClick={() => setIsBaseModalOpen(false)}><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Nome da Base</label>
                                    <input
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        placeholder="ex. Base Teen"
                                        value={baseForm.name}
                                        onChange={e => setBaseForm({ ...baseForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Distrito Vinculado</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={baseForm.districtId}
                                        onChange={e => setBaseForm({ ...baseForm, districtId: e.target.value })}
                                    >
                                        {districts.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button onClick={handleSaveBase} className="w-full" disabled={isSaving}>
                                    {isSaving ? "Salvando..." : (editingBase ? "Salvar Alterações" : "Criar Base")}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
