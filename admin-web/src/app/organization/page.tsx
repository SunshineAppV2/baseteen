"use client";

import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "../../hooks/useFirestore";
import { where } from "firebase/firestore";
import { useState } from "react";
import Link from "next/link";
import {
    Building2,
    MapPin,
    Plus,
    Search,
    Edit2,
    Trash2,
    Home,
    Monitor,
    X,
    Save,
    Network,
    Layers,
    Map as MapIcon,
    ChevronRight,
    Globe,
    MessageCircle,
    DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";
import BaseTypeBadge from "@/components/BaseTypeBadge";

interface Union { id: string; name: string; }
interface Association { id: string; name: string; unionId: string; }
interface Region { id: string; name: string; associationId?: string; }

interface District {
    id: string;
    name: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
    coordinatorName?: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
    baseType: 'soul+' | 'teen'; // NOVO: Tipo de base
    regionId?: string;
    associationId?: string;
    unionId?: string;
    coordinatorName?: string;
    totalXp?: number;
    completedTasks?: number;
    whatsapp?: string; // NOVO: Link/Número do WhatsApp
}

const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 10000)
);

export default function OrganizationPage() {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin' || currentUser?.role === 'coord_geral';

    // Fetch all data (Firestore rules will restrict what each user can see)
    const { data: districts, loading: loadingDistricts, error: errorDistricts } = useCollection<District>("districts");
    const { data: bases, loading: loadingBases, error: errorBases } = useCollection<Base>("bases");
    const { data: regions } = useCollection<Region>("regions");
    const { data: associations } = useCollection<Association>("associations");
    const { data: unions } = useCollection<Union>("unions");

    if (errorDistricts) console.error("Error loading districts:", errorDistricts);
    if (errorBases) console.error("Error loading bases:", errorBases);

    const [searchTerm, setSearchTerm] = useState("");
    const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
    const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);

    const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
    const [editingBase, setEditingBase] = useState<Base | null>(null);

    const [districtForm, setDistrictForm] = useState({ name: "", regionId: "" });
    const [baseForm, setBaseForm] = useState({
        name: "",
        districtId: "",
        baseType: 'teen' as 'soul+' | 'teen', // NOVO: Tipo padrão Teen
        regionId: "",
        associationId: "",
        unionId: "",
        whatsapp: "",
        coordinatorName: ""
    });

    const [isSaving, setIsSaving] = useState(false);

    const openDistrictModal = (district?: District) => {
        if (district) {
            setEditingDistrict(district);
            setDistrictForm({ name: district.name, regionId: district.regionId || "" });
        } else {
            setEditingDistrict(null);
            setDistrictForm({ name: "", regionId: "" });
        }
        setIsDistrictModalOpen(true);
    };

    const handleSaveDistrict = async () => {
        if (!districtForm.name) return alert("Digite o nome do distrito.");

        setIsSaving(true);
        try {
            // Validate: find parent region -> association -> union
            let associationId: string | undefined = undefined;
            let unionId: string | undefined = undefined;

            if (districtForm.regionId) {
                const region = regions.find((r: Region) => r.id === districtForm.regionId);
                if (region?.associationId) {
                    associationId = region.associationId;
                    const assoc = associations.find((a: Association) => a.id === associationId);
                    if (assoc?.unionId) {
                        unionId = assoc.unionId;
                    }
                }
            }

            const dataToSave = {
                name: districtForm.name,
                regionId: districtForm.regionId || null,
                associationId: associationId || null,
                unionId: unionId || null
            };

            if (editingDistrict) {
                await firestoreService.update("districts", editingDistrict.id, dataToSave);
            } else {
                await firestoreService.add("districts", dataToSave);
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
        if (!confirm(`Tem certeza que deseja excluir o distrito ${district.name}?`)) return;
        try {
            await firestoreService.delete("districts", district.id);
            alert("Distrito excluído!");
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    const handleSyncHierarchy = async () => {
        if (!confirm("Isso atualizará TODAS as bases para terem a mesma hierarquia (Região/Associação/União) dos seus Distritos pai. Continuar?")) return;

        setIsSaving(true);
        try {
            // --- STEP 1: SYNC BASES ---
            let basesUpdated = 0;
            const districtMap = new Map();
            districts.forEach(d => districtMap.set(d.id, d));

            // Map to store latest base data for user sync
            const baseMap = new Map();

            for (const base of bases) {
                const parentDistrict = districtMap.get(base.districtId);
                let currentBase = { ...base };

                if (parentDistrict) {
                    const needsUpdate =
                        base.regionId !== (parentDistrict.regionId || null) ||
                        base.associationId !== (parentDistrict.associationId || null) ||
                        base.unionId !== (parentDistrict.unionId || null);

                    if (needsUpdate) {
                        const updates = {
                            regionId: parentDistrict.regionId || null,
                            associationId: parentDistrict.associationId || null,
                            unionId: parentDistrict.unionId || null,
                            updatedAt: new Date(),
                            lastSync: 'manual_fix_v2'
                        };

                        try {
                            await firestoreService.update("bases", base.id, updates);
                            basesUpdated++;
                            currentBase = { ...base, ...updates };
                        } catch (err) {
                            console.error(`Erro ao atualizar base ${base.name}:`, err);
                        }
                    }
                }
                baseMap.set(currentBase.id, currentBase);
            }

            // --- STEP 2: SYNC USERS ---
            let usersUpdated = 0;
            const { collection, getDocs } = await import("firebase/firestore");
            const { db } = await import("@/services/firebase");
            const usersSnapshot = await getDocs(collection(db, "users"));

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                if (!userData.baseId) continue;

                const parentBase = baseMap.get(userData.baseId);
                // Only sync if base is known and has correct data
                if (parentBase) {
                    const needsUserUpdate =
                        userData.districtId !== parentBase.districtId ||
                        userData.regionId !== (parentBase.regionId || null) ||
                        userData.associationId !== (parentBase.associationId || null) ||
                        userData.unionId !== (parentBase.unionId || null);

                    if (needsUserUpdate) {
                        try {
                            await firestoreService.update("users", userDoc.id, {
                                districtId: parentBase.districtId,
                                regionId: parentBase.regionId || null,
                                associationId: parentBase.associationId || null,
                                unionId: parentBase.unionId || null,
                                lastSync: 'manual_fix_v2'
                            });
                            usersUpdated++;
                        } catch (err) {
                            console.error(`Erro ao atualizar usuário ${userDoc.id}:`, err);
                        }
                    }
                }
            }

            alert(`Sincronização Completa!\n\nBases Atualizadas: ${basesUpdated}\nUsuários Atualizados: ${usersUpdated}\n\nO sistema está consistente agora.`);
            window.location.reload();

        } catch (error) {
            console.error(error);
            alert("Erro fatal na sincronização.");
        } finally {
            setIsSaving(false);
        }
    };

    const openBaseModal = (base?: Base) => {
        if (base) {
            setEditingBase(base);
            setBaseForm({
                name: base.name,
                districtId: base.districtId,
                baseType: base.baseType || 'teen', // NOVO: Incluir baseType
                regionId: base.regionId || "",
                associationId: base.associationId || "",
                unionId: base.unionId || "",
                whatsapp: base.whatsapp || "",
                coordinatorName: base.coordinatorName || ""
            });
        } else {
            setEditingBase(null);
            setBaseForm({
                name: "",
                districtId: "",
                baseType: 'teen', // NOVO: Padrão Teen para novas bases
                regionId: "",
                associationId: "",
                unionId: "",
                whatsapp: "",
                coordinatorName: ""
            });
        }
        setIsBaseModalOpen(true);
    };

    const handleSaveBase = async () => {
        if (!baseForm.name || !baseForm.districtId) return alert("Preencha todos os campos.");

        setIsSaving(true);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
        );

        try {
            // Use form data first (user selection), fall back to district data
            const selectedDistrict = districts.find(d => d.id === baseForm.districtId);

            const baseData = {
                name: baseForm.name,
                districtId: baseForm.districtId,
                baseType: baseForm.baseType, // NOVO: Incluir baseType
                regionId: baseForm.regionId || selectedDistrict?.regionId || null,
                associationId: baseForm.associationId || selectedDistrict?.associationId || null,
                unionId: baseForm.unionId || selectedDistrict?.unionId || null,
                totalXp: editingBase?.totalXp || 0,
                completedTasks: editingBase?.completedTasks || 0,
                whatsapp: baseForm.whatsapp || null,
                coordinatorName: baseForm.coordinatorName || null
            };

            if (editingBase) {
                await Promise.race([
                    firestoreService.update("bases", editingBase.id, baseData),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    firestoreService.add("bases", baseData),
                    timeoutPromise
                ]);
            }

            setIsBaseModalOpen(false);
            alert(editingBase ? "Base atualizada!" : "Base criada com sucesso!");
        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert(error.message === "Timeout" ? "O servidor demorou a responder." : "Erro ao salvar base: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBase = async (base: Base) => {
        if (!confirm(`Tem certeza que deseja excluir a base ${base.name}?`)) return;
        try {
            await firestoreService.delete("bases", base.id);
            alert("Base excluída!");
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    // CLIENT-SIDE HIERARCHICAL FILTERING
    // Filter districts based on user's hierarchy level
    const visibleDistricts = districts.filter(district => {
        // Admins see everything
        if (isAdmin) return true;

        // Union Coordinator: see all districts in their union
        if (currentUser?.role === 'coord_uniao' && currentUser.unionId) {
            return district.unionId === currentUser.unionId;
        }

        // Association Coordinator: see all districts in their association
        if (currentUser?.role === 'coord_associacao' && currentUser.associationId) {
            return district.associationId === currentUser.associationId;
        }

        // Region Coordinator: see all districts in their region
        if (currentUser?.role === 'coord_regiao' && currentUser.regionId) {
            return district.regionId === currentUser.regionId;
        }

        // District Coordinator: see only their district
        if (currentUser?.role === 'coord_distrital' && currentUser.districtId) {
            return district.id === currentUser.districtId;
        }

        // Base Coordinator: see their district (to view their base)
        if (currentUser?.role === 'coord_base' && currentUser.districtId) {
            return district.id === currentUser.districtId;
        }

        return false;
    });

    // Filter bases based on visible districts and user's hierarchy
    const visibleBases = bases.filter(base => {
        // Admins see everything
        if (isAdmin) return true;

        // Union Coordinator: see all bases in their union
        if (currentUser?.role === 'coord_uniao' && currentUser.unionId) {
            return base.unionId === currentUser.unionId;
        }

        // Association Coordinator: see all bases in their association
        if (currentUser?.role === 'coord_associacao' && currentUser.associationId) {
            return base.associationId === currentUser.associationId;
        }

        // Region Coordinator: see all bases in their region
        if (currentUser?.role === 'coord_regiao' && currentUser.regionId) {
            return base.regionId === currentUser.regionId;
        }

        // District Coordinator: see all bases in their district
        if (currentUser?.role === 'coord_distrital' && currentUser.districtId) {
            return base.districtId === currentUser.districtId;
        }

        // Base Coordinator: see only their base
        if (currentUser?.role === 'coord_base' && currentUser.baseId) {
            return base.id === currentUser.baseId;
        }

        return false;
    });

    // Apply search filter
    const filteredDistricts = visibleDistricts.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // LOGICA NOVA: Ordenar distritos com bases primeiro
    const sortedDistricts = [...filteredDistricts].sort((a, b) => {
        const aHasBases = visibleBases.some(base => base.districtId === a.id);
        const bHasBases = visibleBases.some(base => base.districtId === b.id);

        if (aHasBases && !bHasBases) return -1;
        if (!aHasBases && bHasBases) return 1;

        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Organização
                    </h1>
                    <p className="text-text-secondary mt-1">Gerencie distritos e bases</p>
                </div>

                {isAdmin && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => openDistrictModal()}
                            className="flex items-center gap-2 bg-surface border border-gray-200 hover:bg-gray-50 text-text-primary px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                        >
                            <Building2 size={18} />
                            <span>Novo Distrito</span>
                        </button>
                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
                        <Button variant="outline" onClick={() => window.location.href = '/structure?tab=unions'} className="gap-2">
                            <Network size={16} /> Uniões
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = '/structure?tab=associations'} className="gap-2">
                            <Layers size={16} /> Associações
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = '/structure?tab=regions'} className="gap-2">
                            <MapIcon size={16} /> Regiões
                        </Button>
                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
                        <Button
                            onClick={() => openBaseModal()}
                            className="gap-2 shadow-lg shadow-primary/30"
                        >
                            <Plus size={18} />
                            <span>Nova Base</span>
                        </Button>

                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>

                        <button
                            onClick={handleSyncHierarchy}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                            title="Corrigir hierarquia das bases"
                        >
                            <Network size={18} />
                            <span>{isSaving ? "Sincronizando..." : "Sincronizar"}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Buscar distritos ou bases..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all outline-none shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Loading States */}
            {loadingDistricts && (
                <div className="text-center py-20">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-text-secondary animate-pulse">Carregando estrutura...</p>
                </div>
            )}

            {!loadingDistricts && (
                <div className="grid grid-cols-1 gap-8">
                    {sortedDistricts.map(district => {
                        const districtBases = visibleBases.filter(b => b.districtId === district.id);

                        return (
                            <div key={district.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                            <Building2 size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{district.name}</h3>
                                            <div className="text-sm text-text-secondary flex gap-2">
                                                <span>{districtBases.length} Bases vinculadas</span>
                                            </div>
                                            {district.regionId && (
                                                <p className="text-xs text-primary mt-1 font-medium bg-blue-50 w-fit px-2 py-1 rounded-md border border-blue-100">
                                                    Região: {regions.find(r => r.id === district.regionId)?.name || '...'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1">
                                            <button onClick={() => openDistrictModal(district)} className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-primary transition-colors">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteDistrict(district)} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-500 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Bases List - AGORA TIPO LISTA */}
                                <div className="flex flex-col gap-3">
                                    {districtBases.map(base => (
                                        <div
                                            key={base.id}
                                            onClick={() => isAdmin && openBaseModal(base)}
                                            className="group bg-surface hover:bg-white border border-transparent hover:border-primary/20 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-primary transition-all shadow-sm shrink-0">
                                                    <Home size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold group-hover:text-primary transition-colors text-lg flex items-center gap-2">
                                                        {base.name}
                                                        <BaseTypeBadge type={base.baseType || 'teen'} size="sm" />
                                                    </h4>
                                                    {base.coordinatorName && (
                                                        <div className="text-sm font-bold text-primary/80 mb-1 flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                            Resp: {base.coordinatorName}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5 font-medium">
                                                        <MapPin size={12} className="text-primary/50" />
                                                        <span>{district.name}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="text-text-secondary uppercase tracking-tight">Base {base.baseType || 'teen'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {base.whatsapp && (
                                                    <a
                                                        href={`https://wa.me/55${base.whatsapp.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm"
                                                        title="Contato WhatsApp"
                                                    >
                                                        <MessageCircle size={16} />
                                                        <span className="text-xs font-bold">{base.whatsapp}</span>
                                                    </a>
                                                )}

                                                <Link
                                                    href={`/admin/subscriptions?search=${encodeURIComponent(base.name)}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm"
                                                    title="Ver Cobrança / Assinatura"
                                                >
                                                    <DollarSign size={16} />
                                                    <span className="text-xs font-bold">Cobrança</span>
                                                </Link>

                                                <div className="flex items-center gap-2">
                                                    {isAdmin && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openBaseModal(base); }}
                                                                className="p-2 hover:bg-primary/10 rounded-xl text-text-secondary hover:text-primary transition-all"
                                                                title="Editar Base"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteBase(base); }}
                                                                className="p-2 hover:bg-red-50 rounded-xl text-text-secondary hover:text-red-500 transition-all"
                                                                title="Excluir Base"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <ChevronRight size={20} className="text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Base Card - MAIS COMPACTO PARA LISTA */}
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                setEditingBase(null);
                                                setBaseForm({
                                                    name: "",
                                                    districtId: district.id,
                                                    baseType: 'teen',
                                                    regionId: district.regionId || "",
                                                    associationId: district.associationId || "",
                                                    unionId: district.unionId || "",
                                                    whatsapp: "",
                                                    coordinatorName: ""
                                                });
                                                setIsBaseModalOpen(true);
                                            }}
                                            className="border-2 border-dashed border-gray-100 rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all w-full mt-2"
                                        >
                                            <Plus size={20} />
                                            <span className="text-sm font-bold">Adicionar Nova Base em {district.name}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {sortedDistricts.length === 0 && !loadingDistricts && (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                    <Search size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-text-secondary">Nenhum distrito encontrado.</p>
                </div>
            )}

            {/* Modal Distrito */}
            {isDistrictModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingDistrict ? "Editar Distrito" : "Novo Distrito"}</h2>
                            <button onClick={() => setIsDistrictModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">Nome do Distrito</label>
                                <input
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Ex: Distrito Central"
                                    value={districtForm.name}
                                    onChange={e => setDistrictForm({ ...districtForm, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">Região (Superior)</label>
                                <select
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={districtForm.regionId}
                                    onChange={e => setDistrictForm({ ...districtForm, regionId: e.target.value })}
                                >
                                    <option value="">-- Sem Região --</option>
                                    {regions.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <Button onClick={handleSaveDistrict} className="w-full" disabled={isSaving} size="lg">
                                {isSaving ? "Salvando..." : (editingDistrict ? "Salvar Alterações" : "Criar Distrito")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Base */}
            {isBaseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingBase ? "Editar Base" : "Nova Base"}</h2>
                            <button onClick={() => setIsBaseModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">Nome da Base</label>
                                <input
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="ex. Base Teen"
                                    value={baseForm.name}
                                    onChange={e => setBaseForm({ ...baseForm, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">WhatsApp da Base (com DDD)</label>
                                <input
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="ex. 91988887777"
                                    value={baseForm.whatsapp}
                                    onChange={e => setBaseForm({ ...baseForm, whatsapp: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">Nome do Responsável</label>
                                <input
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Nome de quem fez o cadastro"
                                    value={baseForm.coordinatorName}
                                    onChange={e => setBaseForm({ ...baseForm, coordinatorName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">Tipo de Base</label>
                                <select
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={baseForm.baseType}
                                    onChange={e => setBaseForm({ ...baseForm, baseType: e.target.value as 'soul+' | 'teen' })}
                                >
                                    <option value="teen">Teen (13-16 anos)</option>
                                    <option value="soul+">Soul+ (10-12 anos)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary">União</label>
                                <select
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={baseForm.unionId || ''}
                                    onChange={e => setBaseForm({ ...baseForm, unionId: e.target.value, associationId: '', regionId: '', districtId: '' })}
                                >
                                    <option value="">Selecione a União...</option>
                                    {unions.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {baseForm.unionId && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Associação</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        value={baseForm.associationId || ''}
                                        onChange={e => setBaseForm({ ...baseForm, associationId: e.target.value, regionId: '', districtId: '' })}
                                    >
                                        <option value="">Selecione a Associação...</option>
                                        {associations.filter(a => a.unionId === baseForm.unionId).map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {baseForm.associationId && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Região</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        value={baseForm.regionId || ''}
                                        onChange={e => setBaseForm({ ...baseForm, regionId: e.target.value, districtId: '' })}
                                    >
                                        <option value="">Selecione a Região...</option>
                                        {regions.filter(r => r.associationId === baseForm.associationId).map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {baseForm.regionId && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Distrito Vinculado</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        value={baseForm.districtId}
                                        onChange={e => setBaseForm({ ...baseForm, districtId: e.target.value })}
                                    >
                                        <option value="">Selecione o Distrito...</option>
                                        {districts.filter(d => d.regionId === baseForm.regionId).map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Button onClick={handleSaveBase} className="w-full mt-4" disabled={isSaving} size="lg">
                                {isSaving ? "Salvando..." : (editingBase ? "Salvar Alterações" : "Criar Base")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
