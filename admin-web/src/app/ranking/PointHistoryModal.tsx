
import { useCollection } from "@/hooks/useFirestore";
import { X, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PointHistoryModalProps {
    userId: string;
    userName: string;
    onClose: () => void;
}

interface XpHistoryItem {
    id: string;
    amount: number;
    reason: string;
    createdAt: any; // Firestore Timestamp
    type?: 'credit' | 'debit';
}

export default function PointHistoryModal({ userId, userName, onClose }: PointHistoryModalProps) {
    const { data: history, loading } = useCollection<XpHistoryItem>(`users/${userId}/xp_history`, [
        // We usually want recent first. If we can't sort here easily due to index, we sort client side.
    ]);

    // Client-side sort and filter
    const sortedHistory = history
        .filter(h => h.createdAt && h.createdAt.toDate) // Only items with valid date
        .sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-in-center flex flex-col max-h-[80vh]">
                <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center relative z-10 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Histórico de Pontos</h2>
                        <p className="text-gray-500 text-sm">{userName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-gray-50/50">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 space-y-2">
                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                            <p>Carregando histórico...</p>
                        </div>
                    ) : sortedHistory.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                            <p>Nenhum registro com data encontrado.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {sortedHistory.map((item) => (
                                <div key={item.id} className="p-4 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 p-2 rounded-xl bg-opacity-10 ${item.amount >= 0 ? 'bg-green-500 text-green-600' : 'bg-red-500 text-red-600'}`}>
                                            {item.amount >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{item.reason || "Ajuste de Pontos"}</p>
                                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                                <Calendar size={10} />
                                                {format(item.createdAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`font-bold text-lg ${item.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {item.amount > 0 ? '+' : ''}{item.amount}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
