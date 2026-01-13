"use client";

import { useState } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import { Upload, Plus, X, CheckCircle, AlertCircle } from "lucide-react";

interface Association {
    id: string;
    name: string;
    unionId: string;
}

interface District {
    id: string;
    name: string;
    associationId: string;
    unionId: string;
}

export default function BulkDistrictsPage() {
    const { data: associations } = useCollection<Association>("associations");
    const { data: districts } = useCollection<District>("districts");

    const [selectedAssocId, setSelectedAssocId] = useState<string>("");
    const [districtText, setDistrictText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<{ added: string[], skipped: string[], errors: string[] } | null>(null);

    const handleBulkImport = async () => {
        if (!selectedAssocId) {
            alert("Selecione uma associação!");
            return;
        }

        if (!districtText.trim()) {
            alert("Cole a lista de distritos!");
            return;
        }

        setIsProcessing(true);
        setResults(null);

        const selectedAssoc = associations.find(a => a.id === selectedAssocId);
        if (!selectedAssoc) {
            alert("Associação não encontrada!");
            setIsProcessing(false);
            return;
        }

        // Parse district names (one per line)
        const districtNames = districtText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Check existing districts
        const existingNames = new Set(
            districts
                .filter(d => d.associationId === selectedAssocId)
                .map(d => d.name.toLowerCase().trim())
        );

        const added: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];

        for (const districtName of districtNames) {
            const normalizedName = districtName.toLowerCase().trim();

            if (existingNames.has(normalizedName)) {
                skipped.push(districtName);
                continue;
            }

            try {
                await firestoreService.add("districts", {
                    name: districtName,
                    associationId: selectedAssocId,
                    unionId: selectedAssoc.unionId,
                    createdAt: new Date()
                });
                added.push(districtName);
                existingNames.add(normalizedName);

                // Small delay to avoid overwhelming Firestore
                await new Promise(resolve => setTimeout(resolve, 150));
            } catch (error) {
                console.error(`Error adding ${districtName}:`, error);
                errors.push(districtName);
            }
        }

        setResults({ added, skipped, errors });
        setIsProcessing(false);
        setDistrictText("");
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Importação em Lote de Distritos
                </h1>
                <p className="text-text-secondary mt-1">Adicione múltiplos distritos de uma vez</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600">Associação</label>
                    <select
                        className="w-full bg-gray-50 rounded-xl p-3 border-none"
                        value={selectedAssocId}
                        onChange={(e) => setSelectedAssocId(e.target.value)}
                    >
                        <option value="">Selecione a associação...</option>
                        {associations.map(assoc => (
                            <option key={assoc.id} value={assoc.id}>{assoc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600">Lista de Distritos (um por linha)</label>
                    <textarea
                        className="w-full bg-gray-50 rounded-xl p-3 border-none min-h-[300px] font-mono text-sm"
                        value={districtText}
                        onChange={(e) => setDistrictText(e.target.value)}
                        placeholder="Guamá&#10;Vigia&#10;Aurora do Pará&#10;Bragança I&#10;..."
                    />
                    <p className="text-xs text-gray-500">
                        Cole a lista de nomes de distritos, um por linha. Distritos que já existem serão pulados.
                    </p>
                </div>

                <Button
                    className="w-full gap-2"
                    onClick={handleBulkImport}
                    disabled={isProcessing || !selectedAssocId || !districtText.trim()}
                >
                    {isProcessing ? (
                        <>Processando...</>
                    ) : (
                        <>
                            <Upload size={18} />
                            Importar Distritos
                        </>
                    )}
                </Button>
            </div>

            {results && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <h2 className="text-xl font-bold">Resultado da Importação</h2>

                    {results.added.length > 0 && (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={18} className="text-green-600" />
                                <h3 className="font-bold text-green-700">Adicionados ({results.added.length})</h3>
                            </div>
                            <div className="text-sm text-green-600 space-y-1">
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
                                <h3 className="font-bold text-orange-700">Pulados - Já existem ({results.skipped.length})</h3>
                            </div>
                            <div className="text-sm text-orange-600 space-y-1">
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
                            <div className="text-sm text-red-600 space-y-1">
                                {results.errors.map((name, i) => (
                                    <div key={i}>✗ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                            Total processado: {results.added.length + results.skipped.length + results.errors.length} distritos
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
