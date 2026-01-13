"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/services/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, where } from "firebase/firestore";
import {
    Megaphone,
    Bell,
    Plus,
    Trash2,
    Edit,
    Send,
    Users,
    Target,
    Calendar,
    CheckCircle2,
    AlertCircle,
    X
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";

export default function CommunicationsPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'mural' | 'push'>('mural');
    const [isLoading, setIsLoading] = useState(false);

    // Mural State
    const [notices, setNotices] = useState<any[]>([]);
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [noticeForm, setNoticeForm] = useState({
        title: '',
        content: '',
        targetType: 'all',
        targetId: '',
        expiresAt: ''
    });

    // Push State
    const [pushForm, setPushForm] = useState({
        title: '',
        message: '',
        targetType: 'all', // all, user
        targetId: ''
    });

    // Fetch Notices
    useEffect(() => {
        const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    // Handlers
    const handleSaveNotice = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await addDoc(collection(db, 'notices'), {
                ...noticeForm,
                active: true,
                authorId: user?.uid,
                createdAt: serverTimestamp(),
                // If expiration is active, convert string to date, else null
                expiresAt: noticeForm.expiresAt ? new Date(noticeForm.expiresAt) : null
            });
            setIsNoticeModalOpen(false);
            setNoticeForm({ title: '', content: '', targetType: 'all', targetId: '', expiresAt: '' });
            alert("Aviso publicado no Mural!");
        } catch (error) {
            console.error("Error saving notice:", error);
            alert("Erro ao publicar aviso.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteNotice = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este aviso?")) return;
        try {
            await deleteDoc(doc(db, 'notices', id));
        } catch (error) {
            console.error("Error deleting notice:", error);
        }
    };

    const handleSendPush = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch('/api/communications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pushForm)
            });

            const data = await response.json();
            if (data.success) {
                alert("Notificação enviada com sucesso!");
                setPushForm({ title: '', message: '', targetType: 'all', targetId: '' });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            console.error("Error sending push:", error);
            alert(`Erro ao enviar notificação: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Comunicação</h1>
                <p className="text-gray-500 mt-1">Gerencie o Mural de Avisos e envie Notificações Push.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('mural')}
                    className={clsx(
                        "pb-4 px-2 font-medium transition-colors flex items-center gap-2",
                        activeTab === 'mural' ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Megaphone size={20} />
                    Mural de Avisos
                </button>
                <button
                    onClick={() => setActiveTab('push')}
                    className={clsx(
                        "pb-4 px-2 font-medium transition-colors flex items-center gap-2",
                        activeTab === 'push' ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Bell size={20} />
                    Notificações Push
                </button>
            </div>

            {/* MURAL CONTENT */}
            {activeTab === 'mural' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Avisos Ativos</h2>
                        <Button onClick={() => setIsNoticeModalOpen(true)}>
                            <Plus size={18} className="mr-2" />
                            Novo Aviso
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {notices.map(notice => (
                            <div key={notice.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative group hover:shadow-md transition-shadow">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteNotice(notice.id)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div className="mb-4">
                                    <span className={clsx(
                                        "px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                        notice.targetType === 'all' ? "bg-blue-100 text-blue-700" :
                                            notice.targetType === 'base' ? "bg-purple-100 text-purple-700" :
                                                "bg-gray-100 text-gray-700"
                                    )}>
                                        {notice.targetType === 'all' ? 'Todos' : notice.targetType}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg mb-2">{notice.title}</h3>
                                <p className="text-gray-600 text-sm mb-4 whitespace-pre-wrap">{notice.content}</p>
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Publicado em: {notice.createdAt?.toDate().toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                        {notices.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Megaphone size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500">Nenhum aviso publicado.</p>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* PUSH CONTENT */}
            {
                activeTab === 'push' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                                    <Send size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">Enviar Notificação</h2>
                                    <p className="text-sm text-gray-500">Envie alertas para os dispositivos móveis</p>
                                </div>
                            </div>

                            <form onSubmit={handleSendPush} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input
                                        type="text"
                                        required
                                        value={pushForm.title}
                                        onChange={e => setPushForm({ ...pushForm, title: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="Ex: Reunião Importante"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={pushForm.message}
                                        onChange={e => setPushForm({ ...pushForm, message: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="Digite sua mensagem aqui..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                                        <select
                                            value={pushForm.targetType}
                                            onChange={e => setPushForm({ ...pushForm, targetType: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        >
                                            <option value="all">Todos (Broadcast)</option>
                                            <option value="user">Usuário Específico</option>
                                        </select>
                                    </div>
                                    {pushForm.targetType === 'user' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ID do Usuário</label>
                                            <input
                                                type="text"
                                                value={pushForm.targetId}
                                                onChange={e => setPushForm({ ...pushForm, targetId: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                placeholder="UID do usuário"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" className="w-full py-6 text-lg" disabled={isLoading}>
                                        {isLoading ? 'Enviando...' : 'Enviar Notificação'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* MODAL - NEW NOTICE */}
            {
                isNoticeModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Novo Aviso</h3>
                                <button onClick={() => setIsNoticeModalOpen(false)}><X size={24} /></button>
                            </div>

                            <form onSubmit={handleSaveNotice} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input
                                        type="text"
                                        required
                                        value={noticeForm.title}
                                        onChange={e => setNoticeForm({ ...noticeForm, title: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={noticeForm.content}
                                        onChange={e => setNoticeForm({ ...noticeForm, content: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Público</label>
                                        <select
                                            value={noticeForm.targetType}
                                            onChange={e => setNoticeForm({ ...noticeForm, targetType: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                        >
                                            <option value="all">Todos</option>
                                            <option value="base">Base Específica</option>
                                            <option value="coord">Coordenadores</option>
                                        </select>
                                    </div>
                                    {noticeForm.targetType === 'base' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ID da Base</label>
                                            <input
                                                type="text"
                                                value={noticeForm.targetId}
                                                onChange={e => setNoticeForm({ ...noticeForm, targetId: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                                placeholder="ID"
                                            />
                                        </div>
                                    )}
                                </div>
                                <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                                    {isLoading ? 'Publicando...' : 'Publicar Aviso'}
                                </Button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
