'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCollection, firestoreService } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/Button';
import {
    Plus,
    Edit2,
    Trash2,
    Eye,
    CheckCircle2,
    XCircle,
    Award,
    Clock,
    BookOpen,
    X,
    Save,
    Calendar,
    PlayCircle,
    ArrowRight,
    RotateCcw,
    Download
} from 'lucide-react';
import { clsx } from 'clsx';
import { where, Timestamp, increment, doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: number;
    points: number;
    timeLimit: number; // seconds per question
}

interface BaseQuiz {
    id: string;
    title: string;
    description: string;
    baseId: string;
    questions: QuizQuestion[];
    xpReward: number; // Total XP (sum of questions)
    timeLimit?: number; // legacy global limit (not used in new logic)
    createdBy: string;
    createdAt: any;
    isActive: boolean;
    // Date settings
    enforceDate: boolean;
    startDate?: any;
    endDate?: any;
}

interface QuizAttempt {
    id: string;
    quizId: string;
    userId: string;
    score: number;
    submittedAt: any;
}

export default function BaseQuizPage() {
    const { user } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAnswerModal, setShowAnswerModal] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<BaseQuiz | null>(null);
    const [answeringQuiz, setAnsweringQuiz] = useState<BaseQuiz | null>(null);

    // Answering State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAnswers, setCurrentAnswers] = useState<Record<number, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [timeExpired, setTimeExpired] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        timeLimit: 0,
        enforceDate: false,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        questions: [
            {
                question: '',
                options: ['', '', '', ''],
                correctAnswer: 0,
                points: 10,
                timeLimit: 30 // default 30s
            }
        ]
    });

    // Load quizzes for the user's base
    const constraints = user?.baseId ? [where('baseId', '==', user.baseId)] : [];
    const { data: quizzes, loading } = useCollection<BaseQuiz>('base_quizzes', constraints);

    // Load user attempts to check what they've already done
    const attemptConstraints = user ? [where('userId', '==', user.uid)] : [];
    const { data: attempts } = useCollection<QuizAttempt>('base_quiz_attempts', attemptConstraints);

    const isCoordinator = ['master', 'coord_geral', 'coord_distrital', 'coord_base'].includes(user?.role || '');

    // Computed Total XP
    const totalXp = useMemo(() => {
        return formData.questions.reduce((acc, q) => acc + (q.points || 0), 0);
    }, [formData.questions]);

    // Check if quiz is attempted
    const getAttemptForQuiz = (quizId: string) => {
        return attempts.find(a => a.quizId === quizId);
    };

    // --- Timer Logic for Current Question ---
    useEffect(() => {
        if (!showAnswerModal || !answeringQuiz) return;

        if (timerRef.current) clearInterval(timerRef.current);

        const question = answeringQuiz.questions[currentQuestionIndex];

        if (question.timeLimit && question.timeLimit > 0) {
            setTimeLeft(question.timeLimit);
            setTimeExpired(false);

            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev !== null && prev > 1) return prev - 1;
                    setTimeExpired(true);
                    return 0;
                });
            }, 1000);
        } else {
            setTimeLeft(null);
            setTimeExpired(false);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [currentQuestionIndex, showAnswerModal, answeringQuiz]);

    // Clean up when modal closes
    useEffect(() => {
        if (!showAnswerModal) {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [showAnswerModal]);


    const handleAddQuestion = () => {
        setFormData({
            ...formData,
            questions: [
                ...formData.questions,
                {
                    question: '',
                    options: ['', '', '', ''],
                    correctAnswer: 0,
                    points: 10,
                    timeLimit: 30
                }
            ]
        });
    };

    const handleRemoveQuestion = (index: number) => {
        if (formData.questions.length <= 1) {
            return alert('O quiz deve ter pelo menos uma pergunta!');
        }
        const newQuestions = formData.questions.filter((_, i) => i !== index);
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleQuestionChange = (qIndex: number, field: string, value: any) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].options[optIndex] = value;
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleSaveQuiz = async () => {
        if (!formData.title || !user?.baseId) {
            return alert('Preencha o título do quiz!');
        }

        if (formData.questions.some(q => !q.question || q.options.some(o => !o))) {
            return alert('Preencha todas as perguntas e opções!');
        }

        if (formData.enforceDate) {
            if (new Date(formData.endDate) < new Date(formData.startDate)) {
                return alert('A data de fim não pode ser anterior à data de início!');
            }
        }

        try {
            const quizData = {
                title: formData.title,
                description: formData.description,
                baseId: user.baseId,
                questions: formData.questions,
                xpReward: totalXp,
                timeLimit: 0,
                enforceDate: formData.enforceDate,
                startDate: formData.enforceDate ? Timestamp.fromDate(new Date(formData.startDate)) : null,
                endDate: formData.enforceDate ? Timestamp.fromDate(new Date(formData.endDate)) : null,
                createdBy: user.uid,
                isActive: true,
                createdAt: new Date(),
            };

            if (editingQuiz) {
                await firestoreService.update('base_quizzes', editingQuiz.id, {
                    ...quizData,
                    updatedAt: new Date()
                });
                alert('Quiz atualizado com sucesso!');
            } else {
                await firestoreService.add('base_quizzes', quizData);
                alert('Quiz criado com sucesso!');
            }

            setShowCreateModal(false);
            setEditingQuiz(null);
            resetForm();
        } catch (error) {
            console.error('Error saving quiz:', error);
            alert('Erro ao salvar quiz');
        }
    };

    const handleEditQuiz = (quiz: BaseQuiz) => {
        setEditingQuiz(quiz);

        const start = quiz.startDate?.toDate ? quiz.startDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const end = quiz.endDate?.toDate ? quiz.endDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        setFormData({
            title: quiz.title,
            description: quiz.description,
            timeLimit: 0,
            enforceDate: quiz.enforceDate || false,
            startDate: start,
            endDate: end,
            questions: quiz.questions.map(q => ({
                ...q,
                points: q.points || 0,
                timeLimit: q.timeLimit || 30 // Default for edits
            }))
        });
        setShowCreateModal(true);
    };

    const handleDeleteQuiz = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este quiz?')) return;

        try {
            await firestoreService.delete('base_quizzes', id);
            alert('Quiz excluído com sucesso!');
        } catch (error) {
            console.error('Error deleting quiz:', error);
            alert('Erro ao excluir quiz');
        }
    };

    const handleToggleActive = async (quiz: BaseQuiz) => {
        try {
            await firestoreService.update('base_quizzes', quiz.id, {
                isActive: !quiz.isActive
            });
        } catch (error) {
            console.error('Error toggling quiz:', error);
            alert('Erro ao atualizar status');
        }
    };

    const handleResetAttempt = async (attemptId: string) => {
        if (!confirm('Deseja resetar essa tentativa? O histórico será apagado e o quiz poderá ser respondido novamente.')) return;
        try {
            await firestoreService.delete('base_quiz_attempts', attemptId);
            alert('Tentativa resetada com sucesso!');
        } catch (error: any) {
            console.error("Error resetting attempt:", error);
            alert(error.message || 'Erro ao resetar tentativa');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            timeLimit: 0,
            enforceDate: false,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            questions: [
                {
                    question: '',
                    options: ['', '', '', ''],
                    correctAnswer: 0,
                    points: 10,
                    timeLimit: 30
                }
            ]
        });
    };

    // --- Answering Logic Step-by-Step ---

    const openAnswerModal = (quiz: BaseQuiz) => {
        const existingAttempt = getAttemptForQuiz(quiz.id);
        if (existingAttempt) {
            return alert('Você já respondeu este quiz!');
        }

        if (quiz.enforceDate) {
            const now = new Date();
            const start = quiz.startDate?.toDate ? quiz.startDate.toDate() : new Date(0);
            const end = quiz.endDate?.toDate ? quiz.endDate.toDate() : new Date(0);
            const endOfDay = new Date(end);
            endOfDay.setHours(23, 59, 59, 999);

            if (now < start) return alert('Este quiz ainda não começou!');
            if (now > endOfDay) return alert('Este quiz já encerrou!');
        }

        setAnsweringQuiz(quiz);
        setCurrentQuestionIndex(0);
        setCurrentAnswers({});
        setShowAnswerModal(true);
    };

    const handleSelectAnswer = (optionIndex: number) => {
        if (timeExpired) return;
        setCurrentAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: optionIndex
        }));
    };

    const handleNextQuestion = () => {
        if (!answeringQuiz) return;

        if (!timeExpired && currentAnswers[currentQuestionIndex] === undefined) {
            return alert('Selecione uma resposta antes de continuar!');
        }

        if (currentQuestionIndex < answeringQuiz.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            submitQuiz();
        }
    };

    const submitQuiz = async () => {
        if (!answeringQuiz || !user) return;
        setIsSubmitting(true);

        try {
            let totalScore = 0;
            let correctCount = 0;

            answeringQuiz.questions.forEach((q, idx) => {
                if (currentAnswers[idx] === q.correctAnswer) {
                    totalScore += q.points;
                    correctCount++;
                }
            });

            // 1. Save Attempt History
            await addDoc(collection(db, "base_quiz_attempts"), {
                quizId: answeringQuiz.id,
                userId: user.uid,
                score: totalScore,
                totalQuestions: answeringQuiz.questions.length,
                correctCount: correctCount,
                answers: currentAnswers,
                submittedAt: serverTimestamp(),
                baseId: user.baseId
            });

            // 2. Award XP/Stats (Always update history, even if 0 XP)
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                "stats.currentXp": increment(totalScore),
            });

            await addDoc(collection(db, "users", user.uid, "xp_history"), {
                amount: totalScore,
                type: 'quiz_base',
                reason: `Quiz: ${answeringQuiz.title}`,
                createdAt: serverTimestamp()
            });

            await addDoc(collection(db, "notifications"), {
                userId: user.uid,
                title: "Quiz Completado! 🎓",
                message: `Você acertou ${correctCount}/${answeringQuiz.questions.length} e ganhou ${totalScore} XP no quiz "${answeringQuiz.title}"!`,
                createdAt: new Date(),
                read: false,
                type: "success"
            });

            alert(`Quiz finalizado! Você acertou ${correctCount} de ${answeringQuiz.questions.length} e ganhou ${totalScore} XP!`);
            setShowAnswerModal(false);
            setAnsweringQuiz(null);
            setCurrentAnswers({});
            setCurrentQuestionIndex(0);

        } catch (error: any) {
            console.error("Error submitting quiz:", error);
            const errorMessage = error?.code === 'permission-denied'
                ? 'Erro de permissão: Você não tem acesso para salvar estas respostas.'
                : (error?.message || "Erro ao enviar respostas. Tente novamente.");
            alert(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <BookOpen size={32} className="text-primary" />
                        Quiz da Base
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {isCoordinator ? 'Gerencie os quizzes da sua base' : 'Responda para ganhar XP!'}
                    </p>
                </div>
                {isCoordinator && (
                    <Button
                        onClick={() => {
                            setEditingQuiz(null);
                            resetForm();
                            setShowCreateModal(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-white border-none"
                    >
                        <Plus size={20} className="mr-2" />
                        Novo Quiz
                    </Button>
                )}
            </div>

            {/* Quizzes Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-40" />
                    ))}
                </div>
            ) : quizzes.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {quizzes.map(quiz => {
                        const now = new Date();
                        const start = quiz.startDate?.toDate ? quiz.startDate.toDate() : null;
                        const end = quiz.endDate?.toDate ? quiz.endDate.toDate() : null;
                        let endOfDay = end ? new Date(end) : null;
                        if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

                        const isOpen = !quiz.enforceDate || (start && endOfDay && now >= start && now <= endOfDay);
                        const statusLabel = !quiz.isActive ? 'Inativo' : (!isOpen ? 'Fechado' : 'Aberto');
                        const statusColor = !quiz.isActive ? 'bg-gray-100 text-gray-600' : (!isOpen ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700');

                        const attempt = getAttemptForQuiz(quiz.id);
                        const isCompleted = !!attempt;

                        return (
                            <div
                                key={quiz.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-gray-900">{quiz.title}</h3>
                                            <span className={clsx("px-2 py-1 text-xs font-bold rounded-full", statusColor)}>
                                                {statusLabel}
                                            </span>
                                            {isCompleted && (
                                                <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> Respondido ({attempt.score} XP)
                                                </span>
                                            )}
                                        </div>
                                        {quiz.description && (
                                            <p className="text-gray-600 mb-4">{quiz.description}</p>
                                        )}

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <BookOpen size={16} />
                                                <span>{quiz.questions.length} perguntas</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Award size={16} className="text-primary" />
                                                <span className="font-bold text-primary">{quiz.xpReward} XP total</span>
                                            </div>
                                            {quiz.enforceDate && start && end && (
                                                <div className="flex items-center gap-2 text-orange-600 font-medium">
                                                    <Calendar size={16} />
                                                    <span>{start.toLocaleDateString('pt-BR')} até {end.toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {isCoordinator && (
                                            <>
                                                <Button
                                                    onClick={() => handleToggleActive(quiz)}
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-none text-sm"
                                                >
                                                    {quiz.isActive ? 'Desativar' : 'Ativar'}
                                                </Button>
                                                <Button
                                                    onClick={() => handleEditQuiz(quiz)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white border-none text-sm"
                                                >
                                                    <Edit2 size={16} className="mr-1" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    onClick={() => handleDeleteQuiz(quiz.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white border-none text-sm"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                        {!isCoordinator && quiz.isActive && isOpen && !isCompleted && (
                                            <Button
                                                onClick={() => openAnswerModal(quiz)}
                                                className="bg-primary hover:bg-primary/90 text-white border-none"
                                            >
                                                <PlayCircle size={16} className="mr-1" />
                                                Responder
                                            </Button>
                                        )}
                                        {!isCoordinator && isCompleted && (
                                            <Button disabled className="bg-gray-100 text-gray-400 border-none cursor-not-allowed">
                                                Concluído
                                            </Button>
                                        )}
                                        {/* Reset Button (Visible for user to re-test if needed, or if requested) */}
                                        {isCompleted && (isCoordinator || user?.role === 'master' || user?.role === 'admin') && (
                                            <Button
                                                onClick={() => handleResetAttempt(attempt.id)}
                                                className="bg-orange-100 hover:bg-orange-200 text-orange-600 border-none"
                                                title="Resetar Tentativa (Teste)"
                                            >
                                                <RotateCcw size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">Nenhum quiz encontrado</h3>
                    <p className="text-gray-600">
                        {isCoordinator
                            ? 'Crie o primeiro quiz para sua base!'
                            : 'Aguarde novos quizzes serem lançados.'}
                    </p>
                </div>
            )}

            {/* Legacy Create/Edit Modal - Upgraded for Question Timer */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 bg-primary text-white flex justify-between items-center flex-none">
                            <div>
                                <h2 className="text-2xl font-bold">
                                    {editingQuiz ? 'Editar Quiz' : 'Novo Quiz'}
                                </h2>
                                <p className="text-white/70 text-sm">
                                    Total de XP do Quiz: <span className="font-bold text-yellow-300">{totalXp} XP</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
                            {/* Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <Edit2 size={18} /> Configurações Gerais
                                </h3>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Ex: Desafio Bíblico Semanal"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        rows={2}
                                    />
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.enforceDate}
                                            onChange={(e) => setFormData({ ...formData, enforceDate: e.target.checked })}
                                            id="enforceDate"
                                            className="w-5 h-5 text-primary rounded focus:ring-primary"
                                        />
                                        <label htmlFor="enforceDate" className="font-bold text-gray-700 cursor-pointer">
                                            Limitar por Data
                                        </label>
                                    </div>

                                    {formData.enforceDate && (
                                        <div className="grid grid-cols-2 gap-3 pl-7">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Início</label>
                                                <input
                                                    type="date"
                                                    value={formData.startDate}
                                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Fim</label>
                                                <input
                                                    type="date"
                                                    value={formData.endDate}
                                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Questions */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <BookOpen size={18} /> Perguntas ({formData.questions.length})
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => setShowImportModal(true)}
                                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 border-none text-sm"
                                        >
                                            <Download size={16} className="mr-1" />
                                            Importar Geral
                                        </Button>
                                        <Button
                                            onClick={handleAddQuestion}
                                            className="bg-green-600 hover:bg-green-700 text-white border-none text-sm"
                                        >
                                            <Plus size={16} className="mr-1" />
                                            Nova Pergunta
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {formData.questions.map((q, qIndex) => (
                                        <div key={qIndex} className="bg-white border-2 border-gray-100 rounded-xl p-5 hover:border-primary/30 transition-colors relative">
                                            <div className="absolute top-4 right-4">
                                                {formData.questions.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveQuestion(qIndex)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                                                <div className="md:col-span-8">
                                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Pergunta {qIndex + 1}</label>
                                                    <input
                                                        type="text"
                                                        value={q.question}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 font-medium"
                                                        placeholder="Digite o enunciado da pergunta..."
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-bold text-primary mb-1 uppercase flex items-center gap-1">
                                                        <Award size={12} /> XP
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={q.points}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value) || 0)}
                                                        className="w-full p-3 bg-yellow-50 text-yellow-800 border-none rounded-lg focus:ring-2 focus:ring-yellow-400 font-bold text-center"
                                                        min="0"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-bold text-red-600 mb-1 uppercase flex items-center gap-1">
                                                        <Clock size={12} /> Segundos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={q.timeLimit}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'timeLimit', parseInt(e.target.value) || 0)}
                                                        className="w-full p-3 bg-red-50 text-red-800 border-none rounded-lg focus:ring-2 focus:ring-red-400 font-bold text-center"
                                                        min="0"
                                                        placeholder="30"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {q.options.map((option, optIndex) => (
                                                    <div key={optIndex} className="flex items-center gap-3 group">
                                                        <button
                                                            onClick={() => handleQuestionChange(qIndex, 'correctAnswer', optIndex)}
                                                            className={clsx(
                                                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                                                q.correctAnswer === optIndex
                                                                    ? "bg-green-500 border-green-500 text-white"
                                                                    : "border-gray-300 group-hover:border-primary"
                                                            )}
                                                        >
                                                            {q.correctAnswer === optIndex && <CheckCircle2 size={14} />}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={option}
                                                            onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                                                            className={clsx(
                                                                "flex-1 p-2 border-b-2 border-transparent focus:border-primary outline-none bg-transparent transition-all",
                                                                q.correctAnswer === optIndex ? "font-bold text-green-700" : "text-gray-600"
                                                            )}
                                                            placeholder={`Opção ${String.fromCharCode(65 + optIndex)}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Import Modal */}
                        {showImportModal && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                                    <div className="p-6 border-b flex justify-between items-center">
                                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                            Importar Quiz Master
                                        </h3>
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="p-0 max-h-[60vh] overflow-y-auto">
                                        <ImportMasterQuizList
                                            onImport={(questions) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    questions: questions as QuizQuestion[]
                                                }));
                                                setShowImportModal(false);
                                                alert(`${questions.length} perguntas importadas com sucesso!`);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100 flex-none">
                        <Button
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border-none py-3"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveQuiz}
                            className="flex-1 bg-primary hover:bg-primary/90 text-white border-none py-3"
                        >
                            <Save size={20} className="mr-2" />
                            Salvar Quiz
                        </Button>
                    </div>
                </div>
            )}

            {/* Answer Modal */}
            {
                showAnswerModal && answeringQuiz && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 bg-primary text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">{answeringQuiz.title}</h2>
                                    <p className="text-white/80 text-sm">
                                        Pergunta {currentQuestionIndex + 1} de {answeringQuiz.questions.length}
                                    </p>
                                </div>
                                {timeLeft !== null && (
                                    <div className={clsx(
                                        "flex items-center gap-2 px-3 py-1 rounded-full font-bold",
                                        timeLeft <= 10 ? "bg-red-500 animate-pulse" : "bg-white/20"
                                    )}>
                                        <Clock size={16} />
                                        {timeLeft}s
                                    </div>
                                )}
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 font-display">
                                    {answeringQuiz.questions[currentQuestionIndex].question}
                                </h3>

                                <div className="space-y-3">
                                    {answeringQuiz.questions[currentQuestionIndex].options.map((opt, idx) => {
                                        const isSelected = currentAnswers[currentQuestionIndex] === idx;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectAnswer(idx)}
                                                disabled={timeExpired && !isSelected}
                                                className={clsx(
                                                    "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group",
                                                    isSelected
                                                        ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                                                        : "border-gray-100 hover:border-primary/50 hover:bg-gray-50"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors",
                                                    isSelected ? "bg-primary border-primary text-white" : "border-gray-300 text-gray-400 group-hover:border-primary group-hover:text-primary"
                                                )}>
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <span className={clsx("font-medium", isSelected ? "text-primary" : "text-gray-700")}>{opt}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 border-t flex justify-end">
                                <Button
                                    onClick={handleNextQuestion}
                                    disabled={isSubmitting}
                                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/20"
                                >
                                    {isSubmitting ? 'Enviando...' : (currentQuestionIndex < answeringQuiz.questions.length - 1 ? 'Próxima Pergunta' : 'Finalizar Quiz')}
                                    {!isSubmitting && <ArrowRight size={20} className="ml-2" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// --- Subcomponent for Importing Master Quizzes ---
function ImportMasterQuizList({ onImport }: { onImport: (questions: any[]) => void }) {
    const { data: masterQuizzes, loading } = useCollection<any>('master_quizzes');

    if (loading) return <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;

    if (masterQuizzes.length === 0) return (
        <div className="p-8 text-center text-gray-500">
            <p>Nenhum quiz master disponível para importação.</p>
        </div>
    );

    return (
        <div className="divide-y divide-gray-100">
            {masterQuizzes.map(quiz => (
                <div key={quiz.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                    <div>
                        <h4 className="font-bold text-gray-900">{quiz.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><BookOpen size={12} /> {quiz.questions?.length || 0} questões</span>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => {
                            const mappedQuestions = (quiz.questions || []).map((q: any) => ({
                                question: q.statement,
                                options: q.alternatives.map((a: any) => a.text),
                                correctAnswer: q.alternatives.findIndex((a: any) => a.isCorrect),
                                points: q.xpValue || 10,
                                timeLimit: q.timeLimit || 30
                            }));

                            onImport(mappedQuestions);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-green-100 text-green-700 hover:bg-green-200 border-none"
                    >
                        Importar
                    </Button>
                </div>
            ))}
        </div>
    );
}
