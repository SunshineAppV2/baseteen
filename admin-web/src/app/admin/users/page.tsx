"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Search,
    Shield,
    Users,
    CheckCircle2,
    X,
    Save
} from "lucide-react";
import { clsx } from "clsx";

export default function UsersPage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const { data: users, loading } = useCollection<any>("users");

    // Filter users locally for simplicity (or use a search query if list is huge)
    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRoleChange = async (userId: string, role: 'admin' | 'editor' | null) => {
        try {
            await firestoreService.update("users", userId, { eventRole: role });
            alert("Permissão atualizada com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar permissão.");
        }
    };

    if (user?.role !== 'master') {
        return <div className="p-8 text-center text-red-500 font-bold">Acesso restrito ao Master.</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Users size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestão de Usuários</h1>
                    </div>
                    <p className="text-gray-500 font-medium ml-1">Gerencie permissões de acesso aos eventos.</p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
                    <Search className="text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="flex-1 outline-none text-gray-700 font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Usuário</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Email</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Cargo Base</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Permissão Eventos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                        ) : (
                            filteredUsers.slice(0, 50).map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-800">{u.displayName || "Sem nome"}</td>
                                    <td className="p-4 text-gray-600">{u.email}</td>
                                    <td className="p-4 text-gray-500 text-sm">{u.role}</td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRoleChange(u.id, null)}
                                                className={clsx(
                                                    "px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                                                    !u.eventRole ? "bg-gray-200 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                                                )}
                                            >
                                                Nenhum
                                            </button>
                                            <button
                                                onClick={() => handleRoleChange(u.id, 'editor')}
                                                className={clsx(
                                                    "px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                                                    u.eventRole === 'editor' ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-400 hover:border-blue-200 hover:text-blue-500"
                                                )}
                                            >
                                                Editor
                                            </button>
                                            <button
                                                onClick={() => handleRoleChange(u.id, 'admin')}
                                                className={clsx(
                                                    "px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                                                    u.eventRole === 'admin' ? "bg-purple-100 border-purple-200 text-purple-700" : "bg-white border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500"
                                                )}
                                            >
                                                Admin
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
