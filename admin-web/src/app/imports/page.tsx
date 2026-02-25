"use client";

import { useState, useMemo } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import { Upload, CheckCircle, AlertCircle, X, Network, Layers, Map as MapIcon, MapPin, Home, Users, Globe } from "lucide-react";
import { clsx } from "clsx";

interface Union { id: string; name: string; }
interface Association { id: string; name: string; unionId: string; }
interface Region { id: string; name: string; associationId: string; }
interface District { id: string; name: string; associationId: string; unionId: string; }
interface Base { id: string; name: string; districtId: string; }

type ImportTab = 'unions' | 'associations' | 'regions' | 'districts' | 'bases' | 'members' | 'hierarchy';
type ImportResult = { added: string[], skipped: string[], errors: string[] };

export default function ImportsPage() {
    const [activeTab, setActiveTab] = useState<ImportTab>('hierarchy');
    const [importText, setImportText] = useState("");
    const [selectedParentId, setSelectedParentId] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<ImportResult | null>(null);

    // Data fetching
    const { data: unionsRaw } = useCollection<Union>("unions");
    const { data: associationsRaw } = useCollection<Association>("associations");
    const { data: regionsRaw } = useCollection<Region>("regions");
    const { data: districtsRaw } = useCollection<District>("districts");
    const { data: basesRaw } = useCollection<Base>("bases");

    // Sort alphabetically
    const unions = useMemo(() => [...unionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [unionsRaw]);
    const associations = useMemo(() => [...associationsRaw].sort((a, b) => a.name.localeCompare(b.name)), [associationsRaw]);
    const regions = useMemo(() => [...regionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [regionsRaw]);
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);
    const bases = useMemo(() => [...basesRaw].sort((a, b) => a.name.localeCompare(b.name)), [basesRaw]);

    const tabs = [
        { id: 'hierarchy' as ImportTab, label: 'Hierarquia Completa', icon: Globe, needsParent: false },
        { id: 'unions' as ImportTab, label: 'Uniões', icon: Network, needsParent: false },
        { id: 'associations' as ImportTab, label: 'Associações', icon: Layers, needsParent: true, parentLabel: 'União' },
        { id: 'regions' as ImportTab, label: 'Regiões', icon: MapIcon, needsParent: true, parentLabel: 'Associação' },
        { id: 'districts' as ImportTab, label: 'Distritos', icon: MapPin, needsParent: true, parentLabel: 'Associação' },
        { id: 'bases' as ImportTab, label: 'Bases', icon: Home, needsParent: true, parentLabel: 'Distrito' },
        { id: 'members' as ImportTab, label: 'Membros', icon: Users, needsParent: true, parentLabel: 'Base' }
    ];

    const getParentOptions = () => {
        switch (activeTab) {
            case 'associations': return unions;
            case 'regions': return associations;
            case 'districts': return associations;
            case 'bases': return districts;
            case 'members': return bases;
            default: return [];
        }
    };

    const getExistingNames = () => {
        const normalize = (name: string) => name.toLowerCase().trim();
        switch (activeTab) {
            case 'unions': return new Set(unions.map(u => normalize(u.name)));
            case 'associations': return new Set(associations.filter(a => a.unionId === selectedParentId).map(a => normalize(a.name)));
            case 'regions': return new Set(regions.filter(r => r.associationId === selectedParentId).map(r => normalize(r.name)));
            case 'districts': return new Set(districts.filter(d => d.associationId === selectedParentId).map(d => normalize(d.name)));
            case 'bases': return new Set(bases.filter(b => b.districtId === selectedParentId).map(b => normalize(b.name)));
            default: return new Set();
        }
    };

    const handleHierarchyImport = async () => {
        if (!importText.trim()) return alert("Cole os dados da planilha!");

        setIsProcessing(true);
        setResults(null);

        const added: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];
        const normalize = (s: string) => s.toLowerCase().trim();

        // Local cache of IDs to avoid repeated lookups for the same names in one batch
        const resolvedUnions = new Map(unions.map(u => [normalize(u.name), u.id]));
        const resolvedAssocs = new Map(associations.map(a => [`${a.unionId}|${normalize(a.name)}`, a.id]));
        const resolvedRegions = new Map(regions.map(r => [`${r.associationId}|${normalize(r.name)}`, r.id]));
        const resolvedDistricts = new Map(districts.map(d => [`${d.associationId}|${normalize(d.name)}`, d.id]));
        const resolvedBases = new Map(bases.map(b => [`${b.districtId}|${normalize(b.name)}`, b.id]));

        const lines = importText.split('\n').filter(l => l.trim().length > 0);

        // Skip header if it looks like one
        const firstLine = lines[0].toLowerCase();
        const dataLines = (firstLine.includes('uniao') || firstLine.includes('igreja') || firstLine.includes('regiao')) ? lines.slice(1) : lines;

        for (const line of dataLines) {
            // Support TSV (tab) and CSV (semicolon/comma)
            const parts = line.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length < 4) continue;

            const [uniaoName, assocName, regionName, igrejaName, distritoName] = parts;
            if (!uniaoName || !assocName || !regionName || !igrejaName || !distritoName) {
                errors.push(`${line} (Campos vazios)`);
                continue;
            }

            try {
                // 1. UNION
                let unionId = resolvedUnions.get(normalize(uniaoName));
                if (!unionId) {
                    const docRef = await firestoreService.add("unions", { name: uniaoName, createdAt: new Date() });
                    unionId = docRef.id;
                    resolvedUnions.set(normalize(uniaoName), unionId);
                    added.push(`União: ${uniaoName}`);
                }

                // 2. ASSOCIATION
                const assocKey = `${unionId}|${normalize(assocName)}`;
                let assocId = resolvedAssocs.get(assocKey);
                if (!assocId) {
                    const docRef = await firestoreService.add("associations", { name: assocName, unionId, createdAt: new Date() });
                    assocId = docRef.id;
                    resolvedAssocs.set(assocKey, assocId);
                    added.push(`Associação: ${assocName}`);
                }

                // 3. REGION
                const regionKey = `${assocId}|${normalize(regionName)}`;
                let regionId = resolvedRegions.get(regionKey);
                if (!regionId) {
                    const docRef = await firestoreService.add("regions", { name: regionName, associationId: assocId, createdAt: new Date() });
                    regionId = docRef.id;
                    resolvedRegions.set(regionKey, regionId);
                    added.push(`Região: ${regionName}`);
                }

                // 4. DISTRICT
                const distKey = `${assocId}|${normalize(distritoName)}`;
                let distritoId = resolvedDistricts.get(distKey);
                if (!distritoId) {
                    const docRef = await firestoreService.add("districts", {
                        name: distritoName,
                        associationId: assocId,
                        regionId: regionId,
                        unionId,
                        createdAt: new Date()
                    });
                    distritoId = docRef.id;
                    resolvedDistricts.set(distKey, distritoId);
                    added.push(`Distrito: ${distritoName}`);
                }

                // 5. BASE (Igreja)
                const baseKey = `${distritoId}|${normalize(igrejaName)}`;
                let baseId = resolvedBases.get(baseKey);
                if (!baseId) {
                    await firestoreService.add("bases", {
                        name: igrejaName,
                        districtId: distritoId,
                        regionId: regionId,
                        associationId: assocId,
                        unionId,
                        baseType: 'teen',
                        totalXp: 0,
                        completedTasks: 0,
                        createdAt: new Date()
                    });
                    resolvedBases.set(baseKey, "exists"); // don't need real ID anymore for this batch
                    added.push(`Base: ${igrejaName}`);
                } else {
                    skipped.push(`Base: ${igrejaName}`);
                }

            } catch (err: any) {
                console.error("Error importing line:", line, err);
                errors.push(`${line} (${err.message})`);
            }
        }

        setResults({ added, skipped, errors });
        setIsProcessing(false);
        setImportText("");
    };

    const handleImport = async () => {
        if (activeTab === 'hierarchy') {
            await handleHierarchyImport();
            return;
        }

        const currentTab = tabs.find(t => t.id === activeTab);
        if (currentTab?.needsParent && !selectedParentId) {
            alert(`Selecione ${currentTab.parentLabel}!`);
            return;
        }

        if (!importText.trim()) {
            alert("Cole a lista de itens!");
            return;
        }

        setIsProcessing(true);
        setResults(null);

        const names = importText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const existingNames = getExistingNames();
        const added: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];

        for (const name of names) {
            const normalized = name.toLowerCase().trim();

            if (existingNames.has(normalized)) {
                skipped.push(name);
                continue;
            }

            try {
                const data: any = { name, createdAt: new Date() };

                switch (activeTab) {
                    case 'associations':
                        data.unionId = selectedParentId;
                        break;
                    case 'regions':
                        data.associationId = selectedParentId;
                        break;
                    case 'districts':
                        const assoc = associations.find(a => a.id === selectedParentId);
                        data.associationId = selectedParentId;
                        data.unionId = assoc?.unionId;
                        break;
                    case 'bases':
                        const district = districts.find(d => d.id === selectedParentId);
                        data.districtId = selectedParentId;
                        data.regionId = district ? regions.find(r => r.associationId === district.associationId)?.id : undefined;
                        data.associationId = district?.associationId;
                        data.unionId = district?.unionId;
                        data.totalXp = 0;
                        data.completedTasks = 0;
                        break;
                }

                await firestoreService.add(activeTab, data);
                added.push(name);
                existingNames.add(normalized);
                await new Promise(resolve => setTimeout(resolve, 150));
            } catch (error) {
                console.error(`Error adding ${name}:`, error);
                errors.push(name);
            }
        }

        setResults({ added, skipped, errors });
        setIsProcessing(false);
        setImportText("");
    };

    const currentTab = tabs.find(t => t.id === activeTab);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Importações em Lote
                </h1>
                <p className="text-text-secondary mt-1">Importe múltiplas entidades de uma vez</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-2">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSelectedParentId("");
                                setImportText("");
                                setResults(null);
                            }}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-primary text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Import Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
                {currentTab?.needsParent && (
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">{currentTab.parentLabel}</label>
                        <select
                            className="w-full bg-gray-50 rounded-xl p-3 border-none"
                            value={selectedParentId}
                            onChange={(e) => setSelectedParentId(e.target.value)}
                        >
                            <option value="">Selecione {currentTab.parentLabel}...</option>
                            {getParentOptions().map((item: any) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600">
                        {activeTab === 'hierarchy' ? 'Dados da Planilha (União, Associação, Região, Igreja, Distrito)' : `Lista de ${currentTab?.label} (um por linha)`}
                    </label>
                    <textarea
                        className="w-full bg-gray-50 rounded-xl p-3 border-none min-h-[300px] font-mono text-sm"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={activeTab === 'hierarchy'
                            ? "União Norte Brasileira\tAssociação Norte do Pará\tREGIÃO VI - CAPANEMA\tBairro da Paz\tCachoeira do Piriá\n..."
                            : `Cole a lista aqui...\nExemplo:\nItem 1\nItem 2\nItem 3`}
                    />
                    <p className="text-xs text-gray-500">
                        {activeTab === 'hierarchy'
                            ? "Cole os dados copiados diretamente do Excel (colunas: União, Associação, Região, Igreja, Distrito). O sistema criará toda a estrutura automaticamente."
                            : "Cole a lista de nomes, um por linha. Itens que já existem serão pulados automaticamente."}
                    </p>
                </div>

                <Button
                    className="w-full gap-2"
                    onClick={handleImport}
                    disabled={isProcessing || !importText.trim() || (currentTab?.needsParent && !selectedParentId)}
                >
                    {isProcessing ? (
                        <>Processando...</>
                    ) : (
                        <>
                            <Upload size={18} />
                            Importar {currentTab?.label}
                        </>
                    )}
                </Button>
            </div>

            {/* Results */}
            {results && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-xl font-bold">Resultado da Importação</h2>

                    {results.added.length > 0 && (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={18} className="text-green-600" />
                                <h3 className="font-bold text-green-700">Adicionados/Criados ({results.added.length})</h3>
                            </div>
                            <div className="text-sm text-green-600 space-y-1 max-h-60 overflow-y-auto">
                                {results.added.map((name, i) => (
                                    <div key={i}>✓ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.skipped.length > 0 && (
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={18} className="text-orange-600" />
                                <h3 className="font-bold text-orange-700">Pulados/Já existem ({results.skipped.length})</h3>
                            </div>
                            <div className="text-sm text-orange-600 space-y-1 max-h-60 overflow-y-auto">
                                {results.skipped.map((name, i) => (
                                    <div key={i}>⊘ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.errors.length > 0 && (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                            <div className="flex items-center gap-2 mb-2">
                                <X size={18} className="text-red-600" />
                                <h3 className="font-bold text-red-700">Erros ({results.errors.length})</h3>
                            </div>
                            <div className="text-sm text-red-600 space-y-1 max-h-60 overflow-y-auto">
                                {results.errors.map((name, i) => (
                                    <div key={i}>✗ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                            Total processado: {results.added.length + results.skipped.length + results.errors.length} operações
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
