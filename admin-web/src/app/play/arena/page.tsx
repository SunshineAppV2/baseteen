"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue, set, off } from "firebase/database";
import { rtdb } from "@/services/firebase";
import { Button } from "@/components/ui/Button";
import { Loader2, CheckCircle2 } from "lucide-react";

interface SessionData {
    pin: string;
    userId: string;
    userName: string;
    quizId: string;
    baseId: string | null;
}

export default function ArenaPage() {
    const router = useRouter();
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);

    // Game State
    const [gameState, setGameState] = useState<any>(null);
    const [hasAnswered, setHasAnswered] = useState(false);

    useEffect(() => {
        // Load Session
        if (typeof window !== "undefined") {
            const stored = sessionStorage.getItem("quiz_session");
            if (!stored) {
                router.replace("/play");
                return;
            }
            setSession(JSON.parse(stored));
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        if (!session) return;

        const quizRef = ref(rtdb, `active_quizzes/${session.pin}`);

        const unsubscribe = onValue(quizRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setGameState(data);

                // Reset 'answered' state if question changed
                if (data.currentQuestionIndex !== gameState?.currentQuestionIndex) {
                    setHasAnswered(false);
                    checkIfAnswered(session.pin, data.currentQuestion?.id, session.userId);
                }
            } else {
                // Quiz closed or invalid
                alert("O quiz foi encerrado.");
                router.replace("/play");
            }
        });

        return () => off(quizRef);
    }, [session, gameState?.currentQuestionIndex]); // Dependency on index to detect change logic safely

    const checkIfAnswered = async (pin: string, questionId: string | undefined, userId: string) => {
        if (!questionId) return;
        // In a real optimized app, we would listen to THIS node too, but for now we trust local state reset and optimistic update
        // or we check once.
        // Actually, let's just rely on local state 'hasAnswered' for simplicity in V1 for "Guest" users.
    };

    const submitAnswer = async (alternativeIndex: number) => {
        if (!session || !gameState?.currentQuestion || hasAnswered) return;

        const question = gameState.currentQuestion;
        const isCorrect = alternativeIndex === question.correctAnswer;

        // Save Answer
        const answerPath = `active_quizzes/${session.pin}/answers/${question.id}/${session.userId}`;

        try {
            await set(ref(rtdb, answerPath), {
                userId: session.userId,
                userName: session.userName || "Visitante",
                answerIdx: alternativeIndex,
                isCorrect,
                xpValue: isCorrect ? (question.xpValue || 100) : 0,
                timestamp: Date.now()
            });
            setHasAnswered(true);
        } catch (err: any) {
            console.error(err);
            alert(`Erro: ${err.message || err.code || err}`);
        }
    };

    if (loading || !session) {
        return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="text-white animate-spin w-12 h-12" /></div>;
    }

    if (!gameState || gameState.status === 'waiting' || !gameState.currentQuestion) {
        return (
            <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-pulse mb-8">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="animate-spin w-10 h-10" />
                    </div>
                </div>
                <h1 className="text-3xl font-black mb-2">Você está na Área!</h1>
                <p className="text-xl opacity-80 mb-8">{session.userName}</p>
                <div className="bg-white/10 px-6 py-3 rounded-xl backdrop-blur-md">
                    <p className="font-bold text-sm tracking-widest uppercase opacity-60 mb-1">AGUARDANDO O INÍCIO</p>
                    <p className="text-lg font-bold">Prepare-se...</p>
                </div>
            </div>
        );
    }

    // Render Game Interface
    const question = gameState.currentQuestion;
    const colors = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];
    const labels = ["A", "B", "C", "D"];

    if (gameState.showLeaderboard) {
        return (
            <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-bounce mb-6">
                    <div className="bg-yellow-400 text-primary w-20 h-20 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-4xl">🏆</span>
                    </div>
                </div>
                <h2 className="text-3xl font-black mb-4">Ranking</h2>
                <p className="text-xl opacity-80">Olhe para o telão para ver quem está na liderança!</p>
            </div>
        );
    }

    if (gameState.showResults) {
        return (
            <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center p-6 text-center">
                <CheckCircle2 size={80} className="mb-6 opacity-80" />
                <h2 className="text-3xl font-black mb-4">Tempo Esgotado!</h2>
                <p className="text-xl opacity-80">Olhe para o telão para ver os resultados.</p>
            </div>
        );
    }

    if (hasAnswered) {
        return (
            <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white text-primary w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl scale-in-center">
                    <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-black mb-4">Resposta Enviada!</h2>
                <p className="text-xl opacity-80">Aguarde o resultado...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex justify-between items-center">
                <div className="font-bold text-gray-800 truncate max-w-[200px]">{session.userName}</div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                    Q{gameState.currentQuestionIndex + 1}
                </div>
            </div>

            {/* Question Statement (Optional - Kahoot usually hides it on phone, but helpful here) */}
            <div className="bg-white p-6 m-4 mt-4 rounded-2xl shadow-sm border-2 border-gray-100 text-center flex-1 flex items-center justify-center">
                <p className="text-xl md:text-2xl font-bold text-gray-800">{question.statement}</p>
            </div>

            {/* Options Grid */}
            <div className="p-4 grid grid-cols-1 gap-4 mb-4">
                {question.alternatives.map((alt: string, idx: number) => (
                    <button
                        key={idx}
                        onClick={() => submitAnswer(idx)}
                        className={`${colors[idx % 4]} text-white p-6 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center`}
                    >
                        <div className="w-16 h-16 bg-black/20 rounded-full flex items-center justify-center text-4xl font-black shadow-inner border-2 border-white/20">
                            {labels[idx % 4]}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
