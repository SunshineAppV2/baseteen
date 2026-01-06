"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, ArrowRight, X, Award, ChevronRight } from "lucide-react";
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

    const handleSubmit = (idx: number) => {
        if (answered) return;

        const isCorrect = idx === currentQuestion.correctAnswer;
        setSelectedAlt(idx);
        setAnswered(true);

        if (isCorrect) {
            setScore(prev => prev + (currentQuestion.xpValue || 100));
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
        setFinished(true);
        setIsSaving(true);

        if (score > 0) {
            try {
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    xp: increment(score),
                    "stats.currentXp": increment(score)
                });

                await addDoc(collection(db, "users", userId, "xp_history"), {
                    amount: score,
                    type: 'quiz',
                    taskTitle: `Quiz: ${quiz.title}`,
                    createdAt: serverTimestamp(),
                    reason: `Participação Individual no Quiz: ${quiz.title}`
                });
            } catch (err) {
                console.error("Error saving individual quiz result:", err);
            }
        }
        setIsSaving(false);
    };

    if (finished) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-3xl w-full max-w-md p-8 text-center scale-in-center shadow-2xl">
                    <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                        <Award size={48} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2">Incrível!</h2>
                    <p className="text-gray-500 mb-8">Você arrasou nesse quiz.</p>

                    <div className="bg-primary/5 rounded-3xl p-6 mb-8 border border-primary/10">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">TOTAL GANHO</p>
                        <p className="text-5xl font-black text-primary">{score} XP</p>
                    </div>

                    <Button
                        onClick={onClose}
                        className="w-full py-6 rounded-2xl text-lg font-bold"
                        disabled={isSaving}
                    >
                        {isSaving ? "Salvando..." : "Voltar à Lista"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-fade-in overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Award size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 leading-tight">{quiz.title}</h2>
                            <p className="text-xs text-gray-500 font-medium">Questão {currentIdx + 1} de {questions.length}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto w-full p-4 flex-1 flex flex-col justify-center py-12">
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100 mb-8">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-4 uppercase tracking-wider">
                        Quiz Individual
                    </span>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 leading-tight">
                        {currentQuestion.statement}
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(currentQuestion.alternatives || []).map((alt: any, idx: number) => {
                            const isSelected = selectedAlt === idx;
                            const isCorrect = currentQuestion.correctAnswer === idx;

                            let stateClass = "border-slate-100 hover:border-primary/30 hover:bg-slate-50";
                            if (answered) {
                                if (isCorrect) stateClass = "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500/20";
                                else if (isSelected) stateClass = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20";
                                else stateClass = "border-slate-100 opacity-50";
                            } else if (isSelected) {
                                stateClass = "border-primary bg-primary/5 ring-2 ring-primary/20";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleSubmit(idx)}
                                    disabled={answered}
                                    className={clsx(
                                        "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group",
                                        stateClass
                                    )}
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors",
                                        isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary",
                                        answered && isCorrect && "bg-green-500 text-white",
                                        answered && isSelected && !isCorrect && "bg-red-500 text-white"
                                    )}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className="font-semibold text-lg">{alt.text || alt}</span>
                                    {answered && isCorrect && <CheckCircle2 className="ml-auto text-green-500" size={24} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {answered && (
                    <div className="flex justify-end animate-slide-up">
                        <Button
                            onClick={handleNext}
                            className="px-12 py-7 rounded-2xl text-xl font-black gap-3 shadow-xl hover:translate-x-1 transition-transform"
                        >
                            {currentIdx < questions.length - 1 ? "Próxima Questão" : "Ver Resultado"}
                            <ChevronRight size={24} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
