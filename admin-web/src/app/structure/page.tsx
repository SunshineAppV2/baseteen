"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import { Building2, Plus, Edit2, Trash2, ChevronRight, Layers, Network, Map } from "lucide-react";
import { clsx } from "clsx";

interface Union {
    id: string;
    name: string;
    code?: string;
}

interface Association {
    id: string;
    name: string;
    unionId: string;
}

interface Region {
    id: string;
    name: string;
    associationId: string;
}

export default function StructurePage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <StructureContent />
        </Suspense>
    );
}

function StructureContent() {
    const searchParams = useSearchParams();
    const defaultTab = (searchParams.get('tab') as 'unions' | 'associations' | 'regions') || 'unions';
    const [activeTab, setActiveTab] = useState<'unions' | 'associations' | 'regions'>(defaultTab);

    // Update active tab if URL changes
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['unions', 'associations', 'regions'].includes(tab as any)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    // Data Fetching
    const { data: unionsRaw, loading: loadingUnions } = useCollection<Union>("unions");
    const { data: associationsRaw, loading: loadingAssociations } = useCollection<Association>("associations");
    const { data: regionsRaw, loading: loadingRegions } = useCollection<Region>("regions");

    // Sort alphabetically
    const unions = useMemo(() => [...unionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [unionsRaw]);
    const associations = useMemo(() => [...associationsRaw].sort((a, b) => a.name.localeCompare(b.name)), [associationsRaw]);
    const regions = useMemo(() => [...regionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [regionsRaw]);

    // Modal States
    const [isUnionModalOpen, setIsUnionModalOpen] = useState(false);
    const [isAssocModalOpen, setIsAssocModalOpen] = useState(false);
    const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);

    // Edit States
    const [editingUnion, setEditingUnion] = useState<Union | null>(null);
    const [editingAssoc, setEditingAssoc] = useState<Association | null>(null);
    const [editingRegion, setEditingRegion] = useState<Region | null>(null);

    // Form Data
    const [unionForm, setUnionForm] = useState({ name: "", code: "" });
    const [assocForm, setAssocForm] = useState({ name: "", unionId: "" });
    const [regionForm, setRegionForm] = useState({ name: "", associationId: "" });

    // --- HANDLERS ---

    // Unions
    const handleSaveUnion = async () => {
        if (!unionForm.name) return alert("Nome é obrigatório");
        try {
            if (editingUnion) {
                await firestoreService.update("unions", editingUnion.id, unionForm);
            } else {
                await firestoreService.add("unions", unionForm);
            }
            setIsUnionModalOpen(false);
            setUnionForm({ name: "", code: "" });
            setEditingUnion(null);
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar União.");
        }
    };

    const handleDeleteUnion = async (id: string) => {
        if (!confirm("Tem certeza? Isso pode afetar Associações vinculadas.")) return;
        await firestoreService.delete("unions", id);
    };

    // Associations
    const handleSaveAssoc = async () => {
        if (!assocForm.name || !assocForm.unionId) return alert("Preencha todos os campos");
        try {
            if (editingAssoc) {
                await firestoreService.update("associations", editingAssoc.id, assocForm);
            } else {
                await firestoreService.add("associations", assocForm);
            }
            setIsAssocModalOpen(false);
            setAssocForm({ name: "", unionId: "" });
            setEditingAssoc(null);
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar Associação.");
        }
    };

    const handleDeleteAssoc = async (id: string) => {
        if (!confirm("Tem certeza? Isso pode afetar Regiões vinculadas.")) return;
        await firestoreService.delete("associations", id);
    };

    // Regions
    const handleSaveRegion = async () => {
        if (!regionForm.name || !regionForm.associationId) return alert("Preencha todos os campos");
        try {
            if (editingRegion) {
                await firestoreService.update("regions", editingRegion.id, regionForm);
            } else {
                await firestoreService.add("regions", regionForm);
            }
            setIsRegionModalOpen(false);
            setRegionForm({ name: "", associationId: "" });
            setEditingRegion(null);
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar Região.");
        }
    };

    const handleDeleteRegion = async (id: string) => {
        if (!confirm("Tem certeza? Isso pode afetar Distritos vinculados.")) return;
        await firestoreService.delete("regions", id);
    };

    // --- RENDERERS ---

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Estrutura Organizacional
                    </h1>
                    <p className="text-text-secondary mt-1">Gerencie Uniões, Associações e Regiões</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('unions')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium",
                        activeTab === 'unions' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Network size={18} /> Uniões
                </button>
                <button
                    onClick={() => setActiveTab('associations')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium",
                        activeTab === 'associations' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Layers size={18} /> Associações
                </button>
                <button
                    onClick={() => setActiveTab('regions')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium",
                        activeTab === 'regions' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Map size={18} /> Regiões
                </button>
            </div>

            {/* CONTENT */}

            {/* UNIONS TAB */}
            {activeTab === 'unions' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Button className="gap-2" onClick={() => { setEditingUnion(null); setUnionForm({ name: "", code: "" }); setIsUnionModalOpen(true); }}>
                            <Plus size={18} /> Nova União
                        </Button>
                    </div>

                    {loadingUnions ? <p>Carregando...</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {unions.map(union => (
                                <div key={union.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">{union.name}</h3>
                                        {union.code && <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">{union.code}</span>}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingUnion(union); setUnionForm({ name: union.name, code: union.code || "" }); setIsUnionModalOpen(true); }} className="p-2 hover:bg-gray-100 rounded-full text-blue-600">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteUnion(union.id)} className="p-2 hover:bg-red-50 rounded-full text-red-600">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ASSOCIATIONS TAB */}
            {activeTab === 'associations' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Button className="gap-2" onClick={() => { setEditingAssoc(null); setAssocForm({ name: "", unionId: "" }); setIsAssocModalOpen(true); }}>
                            <Plus size={18} /> Nova Associação
                        </Button>
                    </div>

                    {loadingAssociations ? <p>Carregando...</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {associations.map(assoc => (
                                <div key={assoc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 group">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg text-gray-800">{assoc.name}</h3>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingAssoc(assoc); setAssocForm({ name: assoc.name, unionId: assoc.unionId }); setIsAssocModalOpen(true); }} className="p-2 hover:bg-gray-100 rounded-full text-blue-600">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteAssoc(assoc.id)} className="p-2 hover:bg-red-50 rounded-full text-red-600">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Network size={14} />
                                        <span>{unions.find(u => u.id === assoc.unionId)?.name || 'União desconhecida'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* REGIONS TAB */}
            {activeTab === 'regions' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Button className="gap-2" onClick={() => { setEditingRegion(null); setRegionForm({ name: "", associationId: "" }); setIsRegionModalOpen(true); }}>
                            <Plus size={18} /> Nova Região
                        </Button>
                    </div>

                    {loadingRegions ? <p>Carregando...</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {regions.map(region => (
                                <div key={region.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 group">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg text-gray-800">{region.name}</h3>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingRegion(region); setRegionForm({ name: region.name, associationId: region.associationId }); setIsRegionModalOpen(true); }} className="p-2 hover:bg-gray-100 rounded-full text-blue-600">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteRegion(region.id)} className="p-2 hover:bg-red-50 rounded-full text-red-600">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Layers size={14} />
                                        <span>{associations.find(a => a.id === region.associationId)?.name || 'Associação desconhecida'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}

            {/* UNION MODAL */}
            {isUnionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-xl font-bold">{editingUnion ? 'Editar' : 'Nova'} União</h2>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">Nome</label>
                            <input className="w-full bg-gray-50 rounded-xl p-3 border-none" value={unionForm.name} onChange={e => setUnionForm({ ...unionForm, name: e.target.value })} placeholder="Ex: União Norte Brasileira" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">Código (Opcional)</label>
                            <input className="w-full bg-gray-50 rounded-xl p-3 border-none" value={unionForm.code} onChange={e => setUnionForm({ ...unionForm, code: e.target.value })} placeholder="Ex: UNB" />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setIsUnionModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={handleSaveUnion}>Salvar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSOCIATION MODAL */}
            {isAssocModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-xl font-bold">{editingAssoc ? 'Editar' : 'Nova'} Associação</h2>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">Nome</label>
                            <input className="w-full bg-gray-50 rounded-xl p-3 border-none" value={assocForm.name} onChange={e => setAssocForm({ ...assocForm, name: e.target.value })} placeholder="Ex: Associação Maranhense" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">União Pai</label>
                            <select className="w-full bg-gray-50 rounded-xl p-3 border-none" value={assocForm.unionId} onChange={e => setAssocForm({ ...assocForm, unionId: e.target.value })}>
                                <option value="">Selecione...</option>
                                {unions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setIsAssocModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={handleSaveAssoc}>Salvar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* REGION MODAL */}
            {isRegionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-xl font-bold">{editingRegion ? 'Editar' : 'Nova'} Região</h2>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">Nome</label>
                            <input className="w-full bg-gray-50 rounded-xl p-3 border-none" value={regionForm.name} onChange={e => setRegionForm({ ...regionForm, name: e.target.value })} placeholder="Ex: Região 1" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600">Associação Pai</label>
                            <select className="w-full bg-gray-50 rounded-xl p-3 border-none" value={regionForm.associationId} onChange={e => setRegionForm({ ...regionForm, associationId: e.target.value })}>
                                <option value="">Selecione...</option>
                                {associations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setIsRegionModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={handleSaveRegion}>Salvar</Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
