"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";
import { Calendar, Lock, Unlock, ChevronRight, AlertCircle, CalendarCheck, Plus } from "lucide-react";
import AttendanceSheet from "./AttendanceSheet";
import { clsx } from "clsx";

interface Quarter {
    id: string;
    label: string;
    dates: any[]; // Timestamps
}

import { Button } from "@/components/ui/Button";

export default function AttendancePage() {
    const { user, loading: authLoading } = useAuth();
    const { data: quarters, loading: quartersLoading } = useCollection<Quarter>("quarters");

    const [selectedQuarterId, setSelectedQuarterId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const { data: existingCalls, loading: existingLoading } = useCollection<any>("attendance_days", [
        where('baseId', '==', user?.baseId || '0'),
        orderBy('date', 'desc')
    ]);
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    // Initial Selection of Quarter
    if (!selectedQuarterId && quarters.length > 0) {
        // Try to find one that matches current date? Or just first.
        // Let's default to the first one alphabetically (usually T1, T2...)
        const sorted = [...quarters].sort((a, b) => a.label.localeCompare(b.label));
        setSelectedQuarterId(sorted[0].id);
    }

    const currentQuarter = quarters.find(q => q.id === selectedQuarterId);

    // Render Logic
    if (authLoading || quartersLoading) return <div className="p-8 text-center">Carregando...</div>;

    // Permission Check: Base Coord, Admin, Master, Secretary. NOT Members.
    if (!['coord_base', 'admin', 'master', 'secretaria', 'coord_geral'].includes(user?.role || '')) {
        return <div className="p-8 text-center text-red-500 font-bold">Acesso Restrito</div>;
    }

    if (!user?.baseId && user?.role === 'coord_base') {
        return <div className="p-8 text-center text-yellow-600">Você precisa estar vinculado a uma base.</div>;
    }

    // If a date is selected, show the sheet
    if (selectedDate && user?.baseId) {
        return (
            <AttendanceSheet
                date={selectedDate}
                baseId={user.baseId}
                onClose={() => setSelectedDate(null)}
            />
        );
    }

    // If master/admin wants to test, they need a baseId? 
    // If Admin/Master has no baseId, they can't mark attendance easily unless we allow selecting a base.
    // For now, let's assume they have a baseId or we block them. 
    // Or we provide a base selector for Admins? 
    // The requirement implies "O Prof/Lider (Coord Base) clicará". Let's stick to base scope.
    // If Master wants to see/edit, they should probably go to Reports or Reports Page, but strictly speaking 
    // the system allows Master to have a baseId if configured, or use "Setup Master" flow.
    // Let's show a warning if no baseId for Master.
    if (!user?.baseId) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
                <h2 className="text-xl font-bold">Atenção</h2>
                <p>Você é administrador mas não está vinculado a uma base para preencher a chamada.</p>
                <p className="text-sm text-text-secondary mt-2">Use o menu "Organização" ou seu perfil para se vincular se desejar testar.</p>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-8 justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                        <CalendarCheck size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Controle de Chamada</h1>
                        <p className="text-text-secondary">Marque a presença e atividades semanais.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {['coord_base', 'admin', 'master'].includes(user?.role || '') && (
                        <button
                            onClick={() => setShowCustomDate(!showCustomDate)}
                            className="text-sm font-bold bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Chamada Avulsa
                        </button>
                    )}
                    {['coord_base', 'admin', 'master'].includes(user?.role || '') && (
                        <button
                            onClick={() => window.location.href = '/attendance/config'}
                            className="text-sm font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-xl transition-colors border border-primary/20"
                        >
                            Configurar Pontuação
                        </button>
                    )}
                </div>
            </div>

            {showCustomDate && (
                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex flex-col md:flex-row items-end gap-4 animate-in slide-in-from-top-4">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-primary mb-2">Selecione a Data da Chamada</label>
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full p-3 rounded-xl border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <Button
                        className="w-full md:w-auto"
                        onClick={() => {
                            if (customDate) {
                                // Important: parse as local date to avoid timezone shifts
                                const [year, month, day] = customDate.split('-').map(Number);
                                const dateObj = new Date(year, month - 1, day, 12, 0, 0);
                                setSelectedDate(dateObj);
                            }
                        }}
                    >
                        Abrir Chamada
                    </Button>
                </div>
            )}

            {/* Quarter Tabs */}
            <div className="flex gap-2 border-b border-gray-100 overflow-x-auto pb-1 mb-6">
                {quarters.sort((a, b) => a.label.localeCompare(b.label)).map(quarter => (
                    <button
                        key={quarter.id}
                        onClick={() => setSelectedQuarterId(quarter.id)}
                        className={clsx(
                            "px-4 py-2 font-bold text-sm whitespace-nowrap transition-colors rounded-t-lg",
                            selectedQuarterId === quarter.id
                                ? "text-primary border-b-2 border-primary bg-primary/5"
                                : "text-text-secondary hover:text-text-primary hover:bg-gray-50"
                        )}
                    >
                        {quarter.label}
                    </button>
                ))}
            </div>

            {/* Dates List */}
            {currentQuarter ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(currentQuarter.dates || []).map((dateVal: any, index: number) => {
                        const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal.seconds * 1000);

                        // Timelock Logic: 01:00 AM of that day
                        const unlockTime = new Date(date);
                        unlockTime.setHours(1, 0, 0, 0); // 01:00 AM

                        const now = new Date();
                        // Bypass lock for coordinators and admins
                        const isLocked = (now < unlockTime) && !['coord_base', 'admin', 'master', 'secretaria', 'coord_geral'].includes(user?.role || '');

                        return (
                            <button
                                key={index}
                                onClick={() => !isLocked && setSelectedDate(date)}
                                disabled={isLocked}
                                className={clsx(
                                    "p-6 rounded-2xl border text-left transition-all flex justify-between items-center group",
                                    isLocked
                                        ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-70"
                                        : "bg-white border-gray-100 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx("p-3 rounded-xl", isLocked ? "bg-gray-200 text-gray-500" : "bg-blue-50 text-blue-600")}>
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-text-primary">
                                            {index + 1}º Sábado
                                        </h3>
                                        <p className="text-sm text-text-secondary">
                                            {date.toLocaleDateString("pt-BR", { day: '2-digit', month: 'long' })}
                                        </p>
                                        {isLocked && (
                                            <p className="text-xs text-red-500 font-medium mt-1">
                                                Disponível às 01:00
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className={isLocked ? "text-gray-400" : "text-primary opacity-0 group-hover:opacity-100 transition-opacity"}>
                                    {isLocked ? <Lock size={20} /> : <ChevronRight size={24} />}
                                </div>
                            </button>
                        );
                    })}
                    {(currentQuarter.dates || []).length === 0 && (
                        <div className="col-span-full p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <p className="text-text-secondary">Nenhuma data cadastrada para este trimestre.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-8 text-center text-text-secondary">
                    Nenhum trimestre encontrado.
                </div>
            )}

            {/* Extra/Existing Calls Section */}
            {existingCalls.length > 0 && (
                <div className="mt-12 space-y-4">
                    <h2 className="text-lg font-bold text-text-primary px-1">Chamadas Gravadas</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {existingCalls.map((call: any) => {
                            const date = call.date?.toDate ? call.date.toDate() : new Date(call.date.seconds * 1000);

                            // Check if this date is already in the official schedule to avoid duplicates
                            const isInSchedule = currentQuarter?.dates?.some((d: any) => {
                                const schedDate = d.toDate ? d.toDate() : new Date(d.seconds * 1000);
                                return schedDate.toDateString() === date.toDateString();
                            });

                            if (isInSchedule) return null;

                            return (
                                <button
                                    key={call.id}
                                    onClick={() => setSelectedDate(date)}
                                    className="p-6 rounded-2xl border text-left bg-white border-gray-100 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer flex justify-between items-center group transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-xl bg-green-50 text-green-600">
                                            <CalendarCheck size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-text-primary">
                                                Chamada Extra
                                            </h3>
                                            <p className="text-sm text-text-secondary">
                                                {date.toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={24} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
