"use client";

import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";

interface AttendanceConfig {
    items: {
        id: string;
        label: string;
        category: "Comunhão" | "Relacionamento" | "Missão";
        points: number;
    }[];
}

const DEFAULT_CONFIG = [
    { id: "presence", label: "Presença", category: "Presença", points: 50 }, // Added default
    { id: "punctuality", label: "Pontualidade", category: "Presença", points: 10 },
    { id: "lesson", label: "Estudaram a lição diariamente", category: "Comunhão", points: 10 },
    { id: "bible", label: "Estudaram a Bíblia diariamente", category: "Comunhão", points: 10 },
    { id: "small_group", label: "Participaram do Pequeno Grupo", category: "Relacionamento", points: 20 },
    { id: "mission_project", label: "Envolveram em projetos de missão", category: "Missão", points: 30 },
    { id: "bible_study", label: "Deram/Acompanharam estudos bíblicos", category: "Missão", points: 50 },
] as const;

export default function AttendanceConfigPage() {
    const { user, loading: authLoading } = useAuth();

    // We fetch the 'default' config doc from the base's subcollection
    // Path: bases/{baseId}/attendance_config/default
    // Since useCollection fetches a collection, we'll fetch the collection and pick 'default' or assume 1 doc?
    // Actually useCollection isn't great for single subcollection doc if we don't know the ID, but we know it's "default" ideally.
    // Let's use `useCollection` for `bases/${user.baseId}/attendance_config`

    const [configItems, setConfigItems] = useState<any[]>([...DEFAULT_CONFIG]);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch existing config
    const { data: configs, loading: loadingConfig } = useCollection<AttendanceConfig>(
        user?.baseId ? `bases/${user.baseId}/attendance_config` : "dummy_path" // Prevent fetch if no baseId
    );

    useEffect(() => {
        if (!loadingConfig && configs && configs.length > 0) {
            // Assume the first doc is the config or look for id='default'
            // If the user modified the structure earlier, we respect it.
            // Merging with defaults to ensure all keys exist for UI
            const savedItems = configs[0].items || [];
            const merged = DEFAULT_CONFIG.map(def => {
                const saved = savedItems.find((s: any) => s.id === def.id);
                return saved ? { ...def, points: saved.points, label: saved.label } : def;
            });
            setConfigItems(merged);
        }
    }, [configs, loadingConfig]);

    const handleSave = async () => {
        if (!user?.baseId) return;
        setIsSaving(true);
        try {
            // We use a fixed ID 'default' for simplicity
            await firestoreService.set(
                `bases/${user.baseId}/attendance_config`,
                "default",
                { items: configItems }
            );
            alert("Configuração salva com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePointChange = (id: string, val: string) => {
        const num = parseInt(val) || 0;
        setConfigItems(prev => prev.map(item => item.id === id ? { ...item, points: num } : item));
    };

    if (authLoading) return <div className="p-8">Carregando...</div>;
    if (user?.role !== 'coord_base' && user?.role !== 'admin' && user?.role !== 'master') {
        return <div className="p-8 text-red-500">Acesso Restrito: Apenas Coordenadores de Base.</div>;
    }
    if (!user.baseId && user.role === 'coord_base') return <div className="p-8 text-yellow-600">Você não está vinculado a uma base.</div>;

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="text-primary" />
                    Configuração de Pontuação
                </h1>
                <p className="text-text-secondary">Defina quantos pontos vale cada item da Chamada.</p>
            </div>

            <div className="card-soft p-6 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-4">
                        {/* Presença (Special Case) */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold px-3 py-1 rounded-lg w-fit text-green-700 bg-green-100 border border-green-200">Presença</h3>
                            <div className="flex flex-col items-start gap-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                <span className="text-sm font-bold text-gray-900">Pontos por comparecer (Presença)</span>
                                <div className="flex items-center gap-2 w-full">
                                    <input
                                        type="number"
                                        className="w-24 p-2 text-right font-extrabold text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                                        value={configItems.find(i => i.id === 'presence')?.points || 0}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const num = parseInt(val) || 0;
                                            setConfigItems(prev => {
                                                const exists = prev.find(i => i.id === 'presence');
                                                if (exists) {
                                                    return prev.map(item => item.id === 'presence' ? { ...item, points: num } : item);
                                                } else {
                                                    return [...prev, { id: 'presence', label: 'Presença', category: 'Presença', points: num }];
                                                }
                                            });
                                        }}
                                    />
                                    <span className="text-xs font-bold text-gray-600">pts</span>
                                </div>
                            </div>
                        </div>

                        {/* Pontualidade (Special Case) */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold px-3 py-1 rounded-lg w-fit text-blue-700 bg-blue-100 border border-blue-200">Pontualidade</h3>
                            <div className="flex flex-col items-start gap-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                <span className="text-sm font-bold text-gray-900">Pontos por chegar no horário</span>
                                <div className="flex items-center gap-2 w-full">
                                    <input
                                        type="number"
                                        className="w-24 p-2 text-right font-extrabold text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                                        value={configItems.find(i => i.id === 'punctuality')?.points || 0}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const num = parseInt(val) || 0;
                                            setConfigItems(prev => {
                                                const exists = prev.find(i => i.id === 'punctuality');
                                                if (exists) {
                                                    return prev.map(item => item.id === 'punctuality' ? { ...item, points: num } : item);
                                                } else {
                                                    return [...prev, { id: 'punctuality', label: 'Pontualidade', category: 'Presença', points: num }];
                                                }
                                            });
                                        }}
                                    />
                                    <span className="text-xs font-bold text-gray-600">pts</span>
                                </div>
                            </div>
                        </div>

                        {/* Comunhão */}
                        <Section
                            title="Comunhão"
                            color="text-blue-600 bg-blue-50"
                            items={configItems.filter(i => i.category === 'Comunhão')}
                            onChange={handlePointChange}
                        />

                        {/* Relacionamento */}
                        <Section
                            title="Relacionamento"
                            color="text-purple-600 bg-purple-50"
                            items={configItems.filter(i => i.category === 'Relacionamento')}
                            onChange={handlePointChange}
                        />

                        {/* Missão */}
                        <Section
                            title="Missão"
                            color="text-orange-600 bg-orange-50"
                            items={configItems.filter(i => i.category === 'Missão')}
                            onChange={handlePointChange}
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
                            <Save size={20} className="mr-2" />
                            {isSaving ? "Salvando..." : "Salvar Configuração"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Section({ title, color, items, onChange }: { title: string, color: string, items: any[], onChange: (id: string, val: string) => void }) {
    if (items.length === 0) return null;
    return (
        <div className="space-y-3">
            <h3 className={`text-sm font-bold px-3 py-1 rounded-lg w-fit ${color}`}>{title}</h3>
            <div className="space-y-3 pl-2">
                {items.map(item => (
                    <div key={item.id} className="flex flex-col items-start gap-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                        <span className="text-sm font-bold text-gray-900">{item.label}</span>
                        <div className="flex items-center gap-2 w-full">
                            <input
                                type="number"
                                className="w-24 p-2 text-right font-extrabold text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                                value={item.points}
                                onChange={e => onChange(item.id, e.target.value)}
                            />
                            <span className="text-xs font-bold text-gray-600">pts</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
