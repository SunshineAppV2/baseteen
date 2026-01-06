"use client";

import { useState } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import {
    CalendarCheck,
    Plus,
    Trash2,
    Calendar,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface Quarter {
    id: string; // e.g. "2026-T1"
    label: string; // "1º Trimestre 2026"
    dates: any[]; // Timestamp[] or { date: Timestamp, label: string }[] - keeping simple Timestamp[] for now or object?
    // Let's use objects for better labels if needed, but simple dates are fine.
    // User asked for "1º Sábado (dd/mm)". We can compute the label from the date.
}

export default function QuartersPage() {
    const { user, loading: authLoading } = useAuth();
    const { data: quarters, loading: loadingQuarters } = useCollection<Quarter>("quarters");

    const [newQuarterLabel, setNewQuarterLabel] = useState("");
    const [newQuarterId, setNewQuarterId] = useState(""); // Manual ID or Auto?

    // Form for Adding Date to a Quarter
    const [selectedQuarterId, setSelectedQuarterId] = useState<string | null>(null);
    const [newDate, setNewDate] = useState("");

    const handleCreateQuarter = async () => {
        if (!newQuarterLabel) return alert("Digite o nome do trimestre (ex: 1º Trimestre 2026)");
        if (!newDate) return alert("Selecione a data do primeiro sábado para gerar automaticamente.");

        // Generate a clean ID
        const cleanLabel = newQuarterLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const id = `${new Date().getFullYear()}-${cleanLabel}`;

        // Auto-generate 13 Saturdays
        const dates = [];
        const startDate = new Date(newDate + "T12:00:00"); // Avoid timezone issues

        for (let i = 0; i < 13; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + (i * 7)); // Add 7 days * i
            dates.push(Timestamp.fromDate(d));
        }

        try {
            await firestoreService.set("quarters", id, {
                label: newQuarterLabel,
                dates: dates
            });
            setNewQuarterLabel("");
            setNewDate(""); // Reset start date
            alert("Trimestre criado com 13 sábados gerados!");
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao criar: ${error.message || error}`);
        }
    };

    const handleDeleteQuarter = async (id: string) => {
        if (!confirm("Excluir este trimestre?")) return;
        await firestoreService.delete("quarters", id);
    };

    const handleAddDate = async (quarter: Quarter) => {
        if (!newDate) return alert("Selecione uma data");
        // Create timestamp from input (YYYY-MM-DD)
        // Assume 12:00 PM to avoid timezone edge cases for simple day tracking
        const dateObj = new Date(newDate + "T12:00:00");
        const timestamp = Timestamp.fromDate(dateObj);

        const currentDates = quarter.dates || [];
        const updatedDates = [...currentDates, timestamp].sort((a, b) => a.toMillis() - b.toMillis());

        await firestoreService.update("quarters", quarter.id, { dates: updatedDates });
        setNewDate("");
    };

    const handleRemoveDate = async (quarter: Quarter, indexToRemove: number) => {
        if (!confirm("Remover esta data?")) return;
        const updatedDates = quarter.dates.filter((_, i) => i !== indexToRemove);
        await firestoreService.update("quarters", quarter.id, { dates: updatedDates });
    };

    if (authLoading || loadingQuarters) return <div className="p-8">Carregando...</div>;
    if (user?.role !== 'master' && user?.role !== 'admin' && user?.role !== 'coord_geral') return <div className="p-8 text-red-500">Acesso Restrito</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Gerenciar Trimestres</h1>
                <p className="text-text-secondary">Defina os Sábados de atividades para cada trimestre.</p>
            </div>

            {/* Create Quarter */}
            <div className="card-soft p-6 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="text-sm font-bold text-text-secondary block mb-2">Novo Trimestre (Nome)</label>
                    <input
                        className="w-full p-3 rounded-xl border border-gray-200"
                        placeholder="ex: 1º Trimestre 2026"
                        value={newQuarterLabel}
                        onChange={e => setNewQuarterLabel(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-auto">
                    <label className="text-sm font-bold text-text-secondary block mb-2">Data Início (1º Sábado)</label>
                    <input
                        type="date"
                        className="w-full p-3 rounded-xl border border-gray-200"
                        value={newDate} // Reusing newDate state for creation start date
                        onChange={e => setNewDate(e.target.value)}
                    />
                </div>
                <Button onClick={handleCreateQuarter} className="w-full md:w-auto whitespace-nowrap">
                    <Plus size={20} className="mr-2" />
                    Criar Automático
                </Button>
            </div>

            {/* List */}
            <div className="space-y-6">
                {quarters.sort((a, b) => a.label.localeCompare(b.label)).map(quarter => (
                    <div key={quarter.id} className="card-soft p-6">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CalendarCheck className="text-primary" />
                                {quarter.label}
                            </h2>
                            <button onClick={() => handleDeleteQuarter(quarter.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                                <Trash2 size={20} />
                            </button>
                        </div>

                        {/* Dates List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {(quarter.dates || []).map((date: any, index: number) => {
                                const d = date.toDate ? date.toDate() : new Date(date.seconds * 1000);
                                const label = `${index + 1}º Sábado (${d.getDate()}/${d.getMonth() + 1})`;
                                return (
                                    <div key={index} className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className="text-text-secondary" />
                                            <span className="font-bold text-sm">{label}</span>
                                        </div>
                                        <button onClick={() => handleRemoveDate(quarter, index)} className="text-gray-400 hover:text-red-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )
                            })}
                            {(quarter.dates || []).length === 0 && (
                                <p className="text-text-secondary text-sm italic col-span-full">Nenhuma data cadastrada.</p>
                            )}
                        </div>

                        {/* Add Date */}
                        <div className="flex gap-2 items-center bg-blue-50/50 p-3 rounded-xl">
                            <input
                                type="date"
                                className="bg-white border text-sm rounded-lg p-2"
                                value={selectedQuarterId === quarter.id ? newDate : ""}
                                onChange={e => {
                                    setSelectedQuarterId(quarter.id);
                                    setNewDate(e.target.value);
                                }}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddDate(quarter)}
                                disabled={selectedQuarterId !== quarter.id || !newDate}
                            >
                                <Plus size={16} className="mr-1" />
                                Adicionar Sábado
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function X({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
    )
}
