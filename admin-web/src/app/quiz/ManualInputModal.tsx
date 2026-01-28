
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { X, Search, CheckCircle2 } from "lucide-react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { where, collection, query, getDocs, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";

interface ManualInputModalProps {
    quizTitle: string;
    quizId: string;
    baseId: string;
    onClose: () => void;
}

export function ManualInputModal({ quizTitle, quizId, baseId, onClose }: ManualInputModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [points, setPoints] = useState(100); // Default points per user
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch users from the base
    const { data: users, loading } = useCollection<any>(
        "users",
        [where("baseId", "==", baseId)]
    );

    const filteredUsers = users.filter(u =>
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleUser = (userId: string) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(prev => prev.filter(id => id !== userId));
        } else {
            setSelectedUsers(prev => [...prev, userId]);
        }
    };

    const handleSelectAll = () => {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(filteredUsers.map(u => u.id));
        }
    };

    const handleSave = async () => {
        if (selectedUsers.length === 0) return alert("Selecione pelo menos um usuário!");
        if (points <= 0) return alert("A pontuação deve ser maior que zero!");

        if (!confirm(`Confirma o lançamento de ${points} XP para ${selectedUsers.length} usuários?`)) return;

        setIsSaving(true);
        try {
            let successCount = 0;
            const batchPromises = selectedUsers.map(async (userId) => {
                const user = users.find(u => u.id === userId);
                if (!user) return;

                // 1. Add XP to User
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    "stats.currentXp": increment(points),
                    "xp": increment(points)
                });

                // 2. Add History Entry
                await firestoreService.add(`users/${userId}/xp_history`, {
                    amount: points,
                    reason: `Quiz Manual: ${quizTitle}`,
                    type: "quiz_manual",
                    createdAt: serverTimestamp(),
                    quizId: quizId
                });

                successCount++;
            });

            await Promise.all(batchPromises);
            alert(`${successCount} lançamentos realizados com sucesso!`);
            onClose();
        } catch (error: any) {
            console.error("Error saving manual input:", error);
            alert("Erro ao salvar lançamentos: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl scale-in-center flex flex-col max-h-[90vh]">
                <div className="p-6 bg-primary text-white flex justify-between items-center rounded-t-3xl shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">Lançamento Manual de Pontos</h2>
                        <p className="text-white/70 text-sm font-bold uppercase tracking-widest">{quizTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 border-b border-gray-100 bg-gray-50 space-y-4 shrink-0">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar membro..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-32">
                            <input
                                type="number"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-bold text-center"
                                placeholder="Pontos"
                                value={points}
                                onChange={e => setPoints(Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-bold">{selectedUsers.length} selecionados</span>
                        <button
                            onClick={handleSelectAll}
                            className="text-primary text-sm font-bold hover:underline"
                        >
                            {selectedUsers.length === filteredUsers.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Carregando membros...</div>
                    ) : filteredUsers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => toggleUser(user.id)}
                                    className={`
                                        p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all select-none
                                        ${selectedUsers.includes(user.id) ? "bg-primary/5 border-primary" : "bg-white border-transparent hover:bg-gray-50"}
                                    `}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                                            ${selectedUsers.includes(user.id) ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}
                                        `}>
                                            {(user.displayName?.[0] || "U").toUpperCase()}
                                        </div>
                                        <div className="truncate">
                                            <p className={`font-bold text-sm truncate ${selectedUsers.includes(user.id) ? "text-primary" : "text-gray-700"}`}>
                                                {user.displayName}
                                            </p>
                                            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                                        </div>
                                    </div>
                                    {selectedUsers.includes(user.id) && <CheckCircle2 size={18} className="text-primary shrink-0" />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-400">Nenhum membro encontrado.</div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-white shrink-0 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || selectedUsers.length === 0}>
                        {isSaving ? "Lançando..." : `Lançar para ${selectedUsers.length} Membros`}
                    </Button>
                </div>
            </div>
        </div>
    );
}
