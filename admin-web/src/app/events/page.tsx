"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Calendar,
    MapPin,
    Plus,
    Edit3,
    Trash2,
    Users,
    CheckCircle2,
    Clock,
    PlayCircle,
    X,
    Save,
    AlertCircle,
    ChevronRight,
    Search
} from "lucide-react";
import { Timestamp, serverTimestamp } from "firebase/firestore";
import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Types ---
interface Event {
    id: string;
    title: string;
    description: string;
    startDate: any; // Timestamp
    endDate: any; // Timestamp
    location?: string;
    status: 'draft' | 'open' | 'active' | 'finished';
    linkedQuizzes?: string[];
    createdAt?: any;
}

export default function EventsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { data: events, loading } = useCollection<Event>("events");

    // --- State ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        location: "",
        status: "draft" as Event['status']
    });

    const isManager = ['master', 'coord_geral', 'admin', 'secretaria', 'coord_associacao', 'coord_uniao', 'coord_regiao', 'coord_distrital'].includes(user?.role || '') || user?.eventRole === 'admin' || user?.eventRole === 'editor';
    const canDelete = ['master', 'coord_geral', 'admin'].includes(user?.role || '') || user?.eventRole === 'admin';

    // --- Actions ---
    const handleCreateClick = () => {
        setEditingId(null);
        setFormData({
            title: "",
            description: "",
            startDate: "",
            startTime: "09:00",
            endDate: "",
            endTime: "18:00",
            location: "",
            status: "draft"
        });
        setIsModalOpen(true);
    };

    const handleEditClick = (event: Event) => {
        setEditingId(event.id);

        // Parse timestamp to date/time strings for input
        let startDateStr = "";
        let startTimeStr = "09:00";
        let endDateStr = "";
        let endTimeStr = "18:00";

        if (event.startDate) {
            const d = event.startDate.toDate();
            startDateStr = d.toISOString().split('T')[0];
            startTimeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (event.endDate) {
            const d = event.endDate.toDate();
            endDateStr = d.toISOString().split('T')[0];
            endTimeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        setFormData({
            title: event.title,
            description: event.description || "",
            startDate: startDateStr,
            startTime: startTimeStr,
            endDate: endDateStr,
            endTime: endTimeStr,
            location: event.location || "",
            status: event.status
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este evento?")) return;
        try {
            await firestoreService.delete("events", id);
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    const handleSave = async () => {
        if (!formData.title || !formData.startDate || !formData.endDate) return alert("Preencha título e datas!");

        try {
            // Combine Date + Time
            const startObj = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
            const endObj = new Date(`${formData.endDate}T${formData.endTime || '23:59'}`);

            if (endObj < startObj) return alert("A data final deve ser maior que a inicial.");

            const payload = {
                title: formData.title,
                description: formData.description,
                startDate: Timestamp.fromDate(startObj),
                endDate: Timestamp.fromDate(endObj),
                location: formData.location,
                status: formData.status,
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await firestoreService.update("events", editingId, payload);
                alert("Evento atualizado!");
            } else {
                await firestoreService.add("events", {
                    ...payload,
                    createdAt: serverTimestamp(),
                    linkedQuizzes: [] // Init empty array
                });
                alert("Evento criado!");
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        }
    };

    const StatusBadge = ({ status }: { status: Event['status'] }) => {
        const styles = {
            draft: "bg-gray-100 text-gray-600 border-gray-200",
            open: "bg-blue-100 text-blue-700 border-blue-200",
            active: "bg-green-100 text-green-700 border-green-200",
            finished: "bg-red-100 text-red-700 border-red-200"
        };
        const labels = {
            draft: "Rascunho",
            open: "Inscrições Abertas",
            active: "Em Andamento",
            finished: "Encerrado"
        };

        return (
            <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border", styles[status])}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Calendar size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Eventos Oficiais</h1>
                    </div>
                    <p className="text-gray-500 font-medium ml-1">Gerencie eventos e inscrições da Base Teen.</p>
                </div>

                {isManager && (
                    <Button onClick={handleCreateClick} className="gap-2 shadow-lg shadow-primary/20">
                        <Plus size={20} /> Novo Evento
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {events.sort((a, b) => (b.startDate?.seconds || 0) - (a.startDate?.seconds || 0)).map(event => (
                    <div key={event.id} className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                            <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={event.status} />
                                    {event.startDate && (
                                        <span className="text-gray-400 text-xs font-bold uppercase flex items-center gap-1">
                                            <Calendar size={12} />
                                            {event.startDate.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                            {event.endDate && ` - ${event.endDate.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-2xl font-black text-gray-800">{event.title}</h3>

                                <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
                                    {event.location && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={16} className="text-gray-400" />
                                            {event.location}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={16} className="text-gray-400" />
                                        {event.startDate?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0 border-gray-50">
                                {/* Conditional Actions based on Role */}
                                {isManager ? (
                                    <>
                                        <Button variant="outline" onClick={() => handleEditClick(event)} className="h-10 w-10 p-0 rounded-full border-gray-200">
                                            <Edit3 size={18} className="text-gray-500" />
                                        </Button>
                                        {canDelete && (
                                            <Button variant="outline" onClick={() => handleDelete(event.id)} className="h-10 w-10 p-0 rounded-full border-gray-200 hover:bg-red-50 hover:border-red-200">
                                                <Trash2 size={18} className="text-red-500" />
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => router.push(`/events/${event.id}`)}
                                            className="px-6 rounded-xl font-bold bg-gray-900 text-white hover:bg-gray-800"
                                        >
                                            Gerenciar
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => router.push(`/events/${event.id}`)}
                                        className={clsx(
                                            "px-8 py-6 rounded-xl font-black text-lg shadow-lg transition-transform hover:scale-105",
                                            event.status === 'open'
                                                ? "bg-primary text-white hover:bg-primary/90"
                                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        )}
                                        disabled={event.status === 'draft'}
                                    >
                                        {event.status === 'open' ? "INSCREVER AGORA" : "Ver Detalhes"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {events.length === 0 && !loading && (
                    <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
                        <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Nenhum evento criado</h3>
                        <p className="text-gray-300 text-sm mt-1">
                            {isManager ? 'Clique em "Novo Evento" para começar.' : 'Aguarde o cadastro de novos eventos.'}
                        </p>
                    </div>
                )}
            </div>

            {/* CREATE/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl scale-in-center overflow-hidden">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-xl text-gray-800">
                                {editingId ? "Editar Evento" : "Novo Evento"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 focus-within:text-primary">Título do Evento</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 focus:border-primary/50 outline-none transition-all"
                                        placeholder="Ex: Campori 2026"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Início</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-2 font-medium text-gray-700 focus:border-primary/50 outline-none text-sm"
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                            />
                                            <input
                                                type="time"
                                                className="w-20 bg-gray-50 border-2 border-gray-100 rounded-xl p-2 font-medium text-gray-700 focus:border-primary/50 outline-none text-sm"
                                                value={formData.startTime}
                                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Fim</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-2 font-medium text-gray-700 focus:border-primary/50 outline-none text-sm"
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                            />
                                            <input
                                                type="time"
                                                className="w-20 bg-gray-50 border-2 border-gray-100 rounded-xl p-2 font-medium text-gray-700 focus:border-primary/50 outline-none text-sm"
                                                value={formData.endTime}
                                                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Localização</label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 pl-10 font-medium text-gray-700 focus:border-primary/50 outline-none"
                                            placeholder="Ex: Ginásio Municipal"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                                    <select
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-medium text-gray-700 focus:border-primary/50 outline-none"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    >
                                        <option value="draft">Rascunho (Invisível)</option>
                                        <option value="open">Inscrições Abertas</option>
                                        <option value="active">Em Andamento (Quizzes Liberados)</option>
                                        <option value="finished">Encerrado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Descrição</label>
                                    <textarea
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-medium text-gray-700 focus:border-primary/50 outline-none h-24 resize-none"
                                        placeholder="Detalhes sobre o evento..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Button onClick={handleSave} className="w-full py-4 text-lg font-bold rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                                <Save size={20} className="mr-2" />
                                {editingId ? "Salvar Alterações" : "Criar Evento"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
