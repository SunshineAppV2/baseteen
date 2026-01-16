"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, ArrowRight, X, Award, ChevronRight, Gamepad } from "lucide-react";
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { clsx } from "clsx";

interface IndividualQuizPlayerProps {
    quiz: any;
    userId: string;
    onClose: () => void;
}

export default function IndividualQuizPlayer({ quiz, userId, onClose }: IndividualQuizPlayerProps) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);
    const [finished, setFinished] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const questions = quiz.questions || [];
    const currentQuestion = questions[currentIdx];

    // DEBUG: Log quiz structure on mount
    if (currentIdx === 0 && !answered) {
        console.log('[QUIZ DEBUG] Quiz loaded:', {
            title: quiz.title,
            totalQuestions: questions.length,
            firstQuestion: currentQuestion
        });
    }

    const handleSubmit = (idx: number) => {
        if (answered) return;

        // DEBUG: Log answer submission
        console.log('[QUIZ DEBUG] Answer submitted:', {
            questionIndex: currentIdx,
            selectedIndex: idx,
            correctAnswer: currentQuestion.correctAnswer,
            correctAnswerType: typeof currentQuestion.correctAnswer,
            alternatives: currentQuestion.alternatives,
            xpValue: currentQuestion.xpValue
        });

        const isCorrect = idx === currentQuestion.correctAnswer;
        console.log('[QUIZ DEBUG] Is correct?', isCorrect);

        setSelectedAlt(idx);
        setAnswered(true);

        if (isCorrect) {
            const points = currentQuestion.xpValue || 100;
            console.log('[QUIZ DEBUG] Adding points:', points);
            setScore(prev => {
                const newScore = prev + points;
                console.log('[QUIZ DEBUG] Score updated:', prev, '->', newScore);
                return newScore;
            });
        } else {
            console.log('[QUIZ DEBUG] Wrong answer - no points added');
        }
    };

    const handleNext = async () => {
        if (currentIdx < questions.length - 1) {
            setCurrentIdx(prev => prev + 1);
            setSelectedAlt(null);
            setAnswered(false);
        } else {
            await finishQuiz();
        }
    };

    const finishQuiz = async () => {
        if (isSaving || finished) return;
        console.log('[QUIZ DEBUG] Finishing quiz with final score:', score);
        setFinished(true);
        setIsSaving(true);

        if (score > 0) {
            try {
                console.log('[QUIZ DEBUG] Saving XP to Firestore...');
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    xp: increment(score),
                    "stats.currentXp": increment(score)
                });
                console.log('[QUIZ DEBUG] XP updated successfully');

                await addDoc(collection(db, "users", userId, "xp_history"), {
                    amount: score,
                    type: 'quiz',
                    taskTitle: `Quiz: ${quiz.title}`,
                    createdAt: serverTimestamp(),
                    reason: `Participação Individual no Quiz: ${quiz.title}`
                });
                console.log('[QUIZ DEBUG] XP history entry created successfully');
            } catch (err) {
                console.error("[QUIZ DEBUG] Error saving individual quiz result:", err);
                alert(`Erro ao salvar pontuação: ${err}`);
            }
        } else {
            console.warn('[QUIZ DEBUG] Score is 0, skipping XP save');
        }
        setIsSaving(false);
    };

    if (finished) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f172a]/90 backdrop-blur-xl animate-fade-in">
                <div className="bg-white rounded-[40px] w-full max-w-md p-10 text-center scale-in-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/20">
                    <div className="w-28 h-28 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_10px_30px_rgba(234,179,8,0.4)] animate-bounce">
                        <Award size={64} className="text-white" />
                    </div>
                    <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">PARABÉNS!</h2>
                    <p className="text-gray-500 font-medium mb-10">Missão cumprida com sucesso.</p>

                    <div className="bg-primary/10 rounded-[32px] p-8 mb-10 border-2 border-primary/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 opacity-60">Sua Recompensa</p>
                            <p className="text-6xl font-black text-primary tabular-nums">{score} XP</p>
                        </div>
                    </div>

                    <Button
                        onClick={onClose}
                        className="w-full py-7 rounded-[24px] text-xl font-bold shadow-xl hover:scale-[1.02] transition-all bg-primary hover:bg-primary/90"
                        disabled={isSaving}
                    >
                        {isSaving ? "PROCESSANDO..." : "CONCLUIR"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f172a] font-sans selection:bg-primary/30 animate-fade-in overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />

            {/* Header */}
            <div className="bg-white/5 backdrop-blur-lg border-b border-white/10 p-5 shrink-0 z-20">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="bg-white/10 p-3 rounded-2xl">
                            <Gamepad className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white leading-tight tracking-tight">{quiz.title}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-full border border-white/10">
                                    Questão {currentIdx + 1} / {questions.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-primary text-xl font-black tabular-nums leading-none">{score} XP</p>
                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">Acumulados</p>
                        </div>
                        <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-white/5 relative z-20 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700 ease-out"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center p-6 relative z-10 overflow-y-auto mt-4 pb-12">
                <div className="bg-white/5 backdrop-blur-2xl rounded-[40px] p-8 md:p-14 shadow-2xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-primary" />

                    <div className="flex items-center justify-between mb-8">
                        <span className="px-4 py-1.5 bg-primary/20 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-primary/20">
                            Fase Atual
                        </span>
                        <div className="flex items-center gap-2 text-white/30 font-black italic">
                            <span className="text-white text-2xl font-black">{currentQuestion.xpValue || 100}</span>
                            <span className="text-xs">XP EM JOGO</span>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white mb-14 leading-[1.1] tracking-tight drop-shadow-2xl">
                        {currentQuestion.statement}
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {(currentQuestion.alternatives || []).map((alt: any, idx: number) => {
                            const isSelected = selectedAlt === idx;
                            const isCorrect = currentQuestion.correctAnswer === idx;

                            let stateClass = "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01]";
                            if (answered) {
                                if (isCorrect) stateClass = "border-green-500/50 bg-green-500/20 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.1)] scale-[1.02] z-10";
                                else if (isSelected) stateClass = "border-red-500/50 bg-red-500/20 text-red-400 opacity-80 opacity-60";
                                else stateClass = "border-white/5 opacity-30 grayscale-[0.5]";
                            } else if (isSelected) {
                                stateClass = "border-primary bg-primary/20 scale-[1.01] shadow-[0_0_30px_rgba(59,130,246,0.15)]";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleSubmit(idx)}
                                    disabled={answered}
                                    className={clsx(
                                        "flex items-center gap-6 p-7 rounded-[32px] border-2 transition-all text-left relative group",
                                        stateClass
                                    )}
                                >
                                    <div className={clsx(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl transition-all shadow-lg",
                                        isSelected ? "bg-white text-primary" : "bg-white/10 text-white/50 group-hover:bg-primary group-hover:text-white",
                                        answered && isCorrect && "bg-green-500 text-white",
                                        answered && isSelected && !isCorrect && "bg-red-500 text-white"
                                    )}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className="font-black text-2xl md:text-3xl tracking-tight leading-tight flex-1">{alt.text || alt}</span>

                                    {answered && isCorrect && (
                                        <div className="p-2 bg-green-500 rounded-full shadow-lg scale-in-center">
                                            <CheckCircle2 className="text-white" size={24} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {answered && (
                    <div className="flex justify-center mt-12 animate-slide-up">
                        <Button
                            onClick={handleNext}
                            className="px-16 py-8 rounded-[32px] text-2xl font-black gap-4 shadow-[0_20px_40px_rgba(59,130,246,0.3)] hover:scale-105 transition-all bg-white text-gray-900 hover:bg-gray-100"
                        >
                            {currentIdx < questions.length - 1 ? "PRÓXIMA FASE" : "VER COLETA"}
                            <ArrowRight size={32} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
