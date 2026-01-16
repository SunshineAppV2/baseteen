"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Plus,
    MessageSquare,
    Clock,
    Award,
    Play,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    Users as UsersIcon,
    Maximize2,
    Minimize2,
    BarChart3,
    X,
    Save,
    History,
    Calendar,
    Upload,
    Download,
    FileSpreadsheet,
    ArrowRight,
    LayoutList,
    Gamepad,
    MonitorPlay,
    QrCode,
    ChevronRight,
    FileText,
    AlertCircle
} from "lucide-react";
import IndividualQuizPlayer from "./IndividualQuizPlayer";
import * as XLSX from 'xlsx';
import { clsx } from "clsx";
import QRCode from "react-qr-code";
import { Copy, Share2 } from "lucide-react";
import {
    doc,
    getDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    getDocs,
    collection,
    query,
    where,
    serverTimestamp,
    Timestamp,
    increment
} from "firebase/firestore";
import { ref, set, onValue, off, update, get } from "firebase/database";
import { rtdb, db } from "@/services/firebase";

// --- Types ---
interface QuizQuestion {
    id: string; // generated locally for list keys if needed, or index
    statement: string;
    alternatives: { text: string; isCorrect: boolean }[];
    timeLimit: number;
    xpValue: number;
}

interface MasterQuiz {
    id: string;
    title: string;
    description: string;
    questions: QuizQuestion[];
    createdAt: any;
    updatedAt?: any;
    isActive: boolean; // Just for organization
    availableToStudents?: boolean;
    baseId?: string;
    classification?: 'pre-adolescente' | 'adolescente' | 'todos';
}

interface QuizHistory {
    id: string;
    date: any;
    quizTitle: string;
    totalParticipants: number;
    leaderboard: { id: string, name: string, score: number }[];
    questionsCount: number;
}

export default function QuizManagementPage() {
    const { user } = useAuth();

    // --- Data ---
    const { data: myQuizzes, loading: loadingQuizzes } = useCollection<MasterQuiz>("master_quizzes");
    const { data: history, loading: loadingHistory } = useCollection<QuizHistory>("quiz_history");

    // --- State ---
    const [activeTab, setActiveTab] = useState<"quizzes" | "arena" | "history">("quizzes");
    const [gamePin, setGamePin] = useState<string>("");

    // Live Arena State
    const [selectedQuiz, setSelectedQuiz] = useState<MasterQuiz | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [stats, setStats] = useState<Record<number, number>>({});
    const [totalAnswers, setTotalAnswers] = useState(0);
    const [showQR, setShowQR] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'idle' | 'waiting' | 'in_progress' | 'finished'>('idle');

    // Phase Control
    const [isResultsVisible, setIsResultsVisible] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [liveLeaderboard, setLiveLeaderboard] = useState<{ name: string, score: number }[]>([]);
    const [isEnding, setIsEnding] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalParticipants, setTotalParticipants] = useState(0);

    // UI Control
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [playingIndividualQuiz, setPlayingIndividualQuiz] = useState<MasterQuiz | null>(null);

    const handleRepairDuplicates = async () => {
        if (!confirm("Deseja remover a duplicidade de pontos para Sophia, Antony e Talita (Quiz Lição 2)?")) return;

        const usersToFix = ['Sophia Damasceno', 'Antony Pantoja', 'Talita Dias'];
        const quizTitlePart = 'LIÇÃO 2 - TEEN - 1º TRIM';

        setIsSaving(true);
        try {
            let totalFixed = 0;
            for (const name of usersToFix) {
                // 1. Buscar o usuário por Nome ou DisplayName (fallback)
                let usersSnap = await getDocs(query(collection(db, "users"), where("name", "==", name)));
                if (usersSnap.empty) {
                    usersSnap = await getDocs(query(collection(db, "users"), where("displayName", "==", name)));
                }

                if (usersSnap.empty) {
                    console.log(`Usuário não encontrado: ${name}`);
                    continue;
                }

                for (const userDoc of usersSnap.docs) {
                    const userId = userDoc.id;
                    const userData = userDoc.data();

                    // 2. Buscar o histórico desse usuário
                    const historyRef = collection(db, "users", userId, "xp_history");
                    const historySnap = await getDocs(historyRef);

                    let matches: any[] = [];
                    historySnap.forEach(docSnap => {
                        const data = docSnap.data();
                        const reason = data.reason || '';
                        const taskTitle = data.taskTitle || '';
                        if (reason.includes(quizTitlePart) || taskTitle.includes(quizTitlePart)) {
                            matches.push({ id: docSnap.id, ...data });
                        }
                    });

                    console.log(`Matches para ${name}:`, matches.length);

                    if (matches.length > 1) {
                        // Ordenar por data (se houver) para manter o mais antigo
                        matches.sort((a, b) => {
                            const dateA = a.createdAt?.seconds || 0;
                            const dateB = b.createdAt?.seconds || 0;
                            return dateA - dateB;
                        });

                        // Manter o primeiro, deletar o resto
                        const toKeep = matches[0];
                        const toDelete = matches.slice(1);
                        console.log(`Mantendo ${toKeep.id}, deletando ${toDelete.length} duplicados`);

                        let pointsToSubtract = 0;
                        for (const entry of toDelete) {
                            await deleteDoc(doc(db, "users", userId, "xp_history", entry.id));
                            pointsToSubtract += entry.amount;
                        }

                        // Atualizar o total de XP do usuário
                        const userRef = doc(db, "users", userId);
                        await updateDoc(userRef, {
                            xp: increment(-pointsToSubtract),
                            "stats.currentXp": increment(-pointsToSubtract)
                        });
                        totalFixed++;
                    }
                }
            }
            alert(`${totalFixed} usuários corrigidos com sucesso!`);
        } catch (err: any) {
            console.error("Erro na reparação:", err);
            alert("Erro ao corrigir: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Helpers ---
    const calculateLiveLeaderboard = async () => {
        if (!gamePin) return [];
        const answersRef = ref(rtdb, `active_quizzes/${gamePin}/answers`);

        // Fetch once for intermediate (or could listen, but on demand is better for "Phase")
        try {
            const snapshot = await get(ref(rtdb, `active_quizzes/${gamePin}/answers`));
            if (!snapshot.exists()) return [];

            const allQuestionsAnswers = snapshot.val();
            const scores: Record<string, { score: number, name: string }> = {};

            Object.entries(allQuestionsAnswers).forEach(([qId, questionAnswers]: [string, any]) => {
                const questionObj = selectedQuiz?.questions.find(q => q.id === qId);
                const xp = questionObj?.xpValue || 100;

                Object.entries(questionAnswers).forEach(([userId, data]: [string, any]) => {
                    // Initialize if missing
                    if (!scores[userId]) scores[userId] = { score: 0, name: data.userName || "Anônimo" };

                    if (data.isCorrect) {
                        scores[userId].score += xp;
                    }
                });
            });

            return Object.values(scores)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10); // Top 10
        } catch (e) {
            console.error(e);
            return [];
        }
    };
    // Editor / Manager State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        availableToStudents: false,
        classification: "todos" as 'pre-adolescente' | 'adolescente' | 'todos',
        questions: [] as QuizQuestion[]
    });
    const [isTextImportOpen, setIsTextImportOpen] = useState(false);
    const [textImportValue, setTextImportValue] = useState("");

    // --- Copy/Distribute Logic ---
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [quizToCopy, setQuizToCopy] = useState<MasterQuiz | null>(null);
    const [targetBaseId, setTargetBaseId] = useState("");
    const { data: allBases } = useCollection<any>("bases");
    const [isSimplifiedMode, setIsSimplifiedMode] = useState(false);

    // Auto-enable simplified mode for Master and Missionários de Cristo
    useEffect(() => {
        if (user?.role === 'master') {
            setIsSimplifiedMode(true);
        } else if (user?.baseId && allBases) {
            const userBase = allBases.find(b => b.id === user.baseId);
            if (userBase?.name?.toLowerCase().includes("missionários de cristo")) {
                setIsSimplifiedMode(true);
            }
        }
    }, [user, allBases]);

    // --- Editor Logic ---
    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            availableToStudents: false,
            classification: "todos",
            questions: [
                {
                    id: crypto.randomUUID(),
                    statement: "",
                    alternatives: [
                        { text: "", isCorrect: true },
                        { text: "", isCorrect: false },
                        { text: "", isCorrect: false },
                        { text: "", isCorrect: false }
                    ],
                    timeLimit: 30,
                    xpValue: 100
                }
            ]
        });
    };

    const handleCreateClick = () => {
        setEditingId(null);
        resetForm();
        setIsModalOpen(true);
    };

    const handleStartTextImport = () => {
        setEditingId(null);
        setFormData({
            title: "",
            description: "",
            availableToStudents: false,
            classification: "todos",
            questions: []
        });
        setIsTextImportOpen(true);
    };

    const handleEditClick = (quiz: MasterQuiz) => {
        setEditingId(quiz.id);
        setFormData({
            title: quiz.title,
            description: quiz.description,
            availableToStudents: quiz.availableToStudents || false,
            classification: quiz.classification || "todos",
            questions: quiz.questions.map(q => ({
                ...q,
                id: q.id || crypto.randomUUID()
            }))
        });
        setIsModalOpen(true);
    };

    const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Tem certeza que deseja excluir este quiz?")) return;
        try {
            await firestoreService.delete("master_quizzes", id);
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    const handleSaveQuiz = async () => {
        if (!formData.title) return alert("Preencha o título!");
        if (formData.questions.length === 0) return alert("Adicione pelo menos uma questão!");
        if (formData.questions.some(q => !q.statement || q.alternatives.some(a => !a.text))) {
            return alert("Preencha todos os campos das questões!");
        }

        // Validate that each question has a correct answer marked
        for (let i = 0; i < formData.questions.length; i++) {
            const q = formData.questions[i];
            const hasCorrect = q.alternatives.some(a => a.isCorrect);
            if (!hasCorrect) {
                return alert(`Questão ${i + 1}: Marque uma alternativa como correta!`);
            }
        }

        try {
            // Normalize questions to ensure correctAnswer field is always present
            const normalizedQuestions = formData.questions.map(q => {
                const correctIdx = q.alternatives.findIndex(a => a.isCorrect);

                return {
                    id: q.id || crypto.randomUUID(),
                    statement: q.statement,
                    alternatives: q.alternatives.map(a => ({
                        text: a.text,
                        isCorrect: a.isCorrect
                    })),
                    correctAnswer: correctIdx >= 0 ? correctIdx : 0, // CRITICAL: Always include correctAnswer
                    timeLimit: q.timeLimit || 30,
                    xpValue: q.xpValue || 100
                };
            });

            const payload: any = {
                title: formData.title,
                description: formData.description,
                questions: normalizedQuestions, // Use normalized questions
                availableToStudents: formData.availableToStudents,
                classification: formData.classification,
                updatedAt: new Date()
            };

            // Se for Coord de Base, forçar o baseId e garantir availableToStudents
            if (user?.role === 'coord_base' && user?.baseId) {
                payload.baseId = user.baseId;
            }

            if (editingId) {
                await firestoreService.update("master_quizzes", editingId, payload);
                alert("Quiz atualizado!");
            } else {
                await firestoreService.add("master_quizzes", {
                    ...payload,
                    createdAt: new Date(),
                    isActive: true
                });
                alert("Quiz criado!");
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        }
    };

    // FIX QUIZZES FUNCTION - Corrige quizzes com correctAnswer undefined
    const handleFixQuizzes = async () => {
        if (!confirm('Deseja corrigir todos os quizzes com dados inconsistentes?')) return;

        try {
            console.log('🔧 Iniciando correção de quizzes...');
            const { collection: fsCollection, getDocs, doc: fsDoc, updateDoc: fsUpdateDoc } = await import('firebase/firestore');

            const quizzesRef = fsCollection(db, 'master_quizzes');
            const snapshot = await getDocs(quizzesRef);

            let fixedCount = 0;

            for (const docSnap of snapshot.docs) {
                const quiz = docSnap.data();

                if (!quiz.questions || quiz.questions.length === 0) continue;

                let needsUpdate = false;
                const fixedQuestions = quiz.questions.map((q: any) => {
                    if (q.correctAnswer === undefined || q.correctAnswer === null) {
                        let correctIdx = -1;
                        if (q.alternatives && Array.isArray(q.alternatives)) {
                            const firstAlt = q.alternatives[0];
                            if (typeof firstAlt === 'object' && 'isCorrect' in firstAlt) {
                                correctIdx = q.alternatives.findIndex((alt: any) => alt.isCorrect === true);
                            } else {
                                correctIdx = 0;
                            }
                        }

                        needsUpdate = true;
                        return {
                            ...q,
                            correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                            id: q.id || crypto.randomUUID(),
                            xpValue: q.xpValue || 100,
                            timeLimit: q.timeLimit || 30
                        };
                    }
                    return q;
                });

                if (needsUpdate) {
                    await fsUpdateDoc(fsDoc(db, 'master_quizzes', docSnap.id), {
                        questions: fixedQuestions,
                        updatedAt: new Date()
                    });
                    fixedCount++;
                }
            }

            alert(`✅ Correção concluída!\n\n${fixedCount} quizzes corrigidos.\n\nRecarregue a página e teste novamente.`);
        } catch (error) {
            console.error('Erro ao corrigir quizzes:', error);
            alert('Erro ao corrigir quizzes. Verifique o console.');
        }
    };

    // --- Question Management in Form ---
    const addQuestion = () => {
        setFormData(prev => ({
            ...prev,
            questions: [...prev.questions, {
                id: crypto.randomUUID(),
                statement: "",
                alternatives: [
                    { text: "", isCorrect: true },
                    { text: "", isCorrect: false },
                    { text: "", isCorrect: false },
                    { text: "", isCorrect: false }
                ],
                timeLimit: 30,
                xpValue: 100
            }]
        }));
    };

    const removeQuestion = (index: number) => {
        if (formData.questions.length <= 1) return alert("Mínimo de 1 questão!");
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index)
        }));
    };

    const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
        const newQuestions = [...formData.questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setFormData({ ...formData, questions: newQuestions });
    };

    const updateAlternative = (qIndex: number, aIndex: number, text: string) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].alternatives[aIndex].text = text;
        setFormData({ ...formData, questions: newQuestions });
    };

    const setCorrectAlternative = (qIndex: number, aIndex: number) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].alternatives = newQuestions[qIndex].alternatives.map((alt, i) => ({
            ...alt,
            isCorrect: i === aIndex
        }));
        setFormData({ ...formData, questions: newQuestions });
    };

    // --- Excel Import Logic ---
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = ["PERGUNTA", "RESPOSTA A", "RESPOSTA B", "RESPOSTA C", "RESPOSTA D", "RESPOSTA CORRETA", "TEMPO", "XP"];
        const data = [
            headers,
            ["Ex: Qual a cor do céu?", "Azul", "Verde", "Vermelho", "Amarelo", "A", 30, 100],
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Modelo");
        XLSX.writeFile(wb, "modelo_quiz_area.xlsx");
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                let newQuestions: QuizQuestion[] = [];
                let errors = 0;

                for (const row of data) {
                    const statement = row["PERGUNTA"];
                    const optA = row["RESPOSTA A"];
                    const optB = row["RESPOSTA B"];
                    const optC = row["RESPOSTA C"];
                    const optD = row["RESPOSTA D"];
                    let correctRaw = row["RESPOSTA CORRETA"];
                    const time = parseInt(row["TEMPO"] || "30");
                    const xp = parseInt(row["XP"] || "100");

                    if (!statement || !optA || !optB || !optC || !optD || !correctRaw) {
                        errors++;
                        continue;
                    }

                    let correctIdx = 0;
                    correctRaw = String(correctRaw).trim().toUpperCase();
                    if (correctRaw === 'A') correctIdx = 0;
                    else if (correctRaw === 'B') correctIdx = 1;
                    else if (correctRaw === 'C') correctIdx = 2;
                    else if (correctRaw === 'D') correctIdx = 3;
                    else {
                        const opts = [String(optA), String(optB), String(optC), String(optD)];
                        const matchIdx = opts.findIndex(o => o.trim().toUpperCase() === correctRaw);
                        if (matchIdx !== -1) correctIdx = matchIdx;
                    }

                    newQuestions.push({
                        id: crypto.randomUUID(),
                        statement: String(statement),
                        alternatives: [
                            { text: String(optA), isCorrect: correctIdx === 0 },
                            { text: String(optB), isCorrect: correctIdx === 1 },
                            { text: String(optC), isCorrect: correctIdx === 2 },
                            { text: String(optD), isCorrect: correctIdx === 3 }
                        ],
                        timeLimit: time,
                        xpValue: xp
                    });
                }

                if (newQuestions.length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        questions: [...prev.questions, ...newQuestions]
                    }));
                    alert(`Importado ${newQuestions.length} questões com sucesso!`);
                } else {
                    alert("Nenhuma questão válida encontrada.");
                }
                e.target.value = '';
            } catch (error) {
                console.error(error);
                alert("Erro ao ler Excel.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleTextImport = () => {
        if (!textImportValue.trim()) return alert("Cole o texto das perguntas!");

        const lines = textImportValue.split('\n').filter(l => l.trim());
        const newQuestions: QuizQuestion[] = [];
        let errorCount = 0;

        lines.forEach(line => {
            const parts = line.split(';').map(p => p.trim());

            // Expected: Pergunta; A; B; C; D; Resposta; [Tempo]; [XP]
            if (parts.length < 6) {
                errorCount++;
                return;
            }

            const [statement, a, b, c, d, correctLetter] = parts;
            const timeLimit = parseInt(parts[6]) || 30;
            const xpValue = parseInt(parts[7]) || 100;

            const correctIdx = ['A', 'B', 'C', 'D'].indexOf(correctLetter.toUpperCase());
            if (correctIdx === -1) {
                errorCount++;
                return;
            }

            newQuestions.push({
                id: crypto.randomUUID(),
                statement,
                alternatives: [
                    { text: a, isCorrect: correctIdx === 0 },
                    { text: b, isCorrect: correctIdx === 1 },
                    { text: c, isCorrect: correctIdx === 2 },
                    { text: d, isCorrect: correctIdx === 3 }
                ],
                timeLimit,
                xpValue
            });
        });

        if (newQuestions.length > 0) {
            setFormData(prev => ({
                ...prev,
                questions: [...prev.questions, ...newQuestions]
            }));
            alert(`${newQuestions.length} questões importadas! ${errorCount > 0 ? `(${errorCount} linhas ignoradas por erro)` : ""}`);
            setIsTextImportOpen(false);
            setTextImportValue("");
            setIsModalOpen(true);
        } else {
            alert("Nenhuma questão válida encontrada. Verifique o formato!");
        }
    };

    const handleCopyQuiz = async () => {
        if (!quizToCopy || !targetBaseId) return alert("Selecione uma base!");

        try {
            const selectedBase = allBases.find(b => b.id === targetBaseId);
            const baseName = selectedBase?.name || "Base Selecionada";

            const newQuiz = {
                title: `${quizToCopy.title} (Cópia - ${baseName})`,
                description: quizToCopy.description,
                questions: quizToCopy.questions,
                classification: quizToCopy.classification,
                baseId: targetBaseId, // Assign to target base
                isCopy: true,
                originalQuizId: quizToCopy.id,
                availableToStudents: true, // Usually copies are meant for students
                createdBy: user?.uid,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "master_quizzes"), newQuiz);
            alert(`Quiz copiado com sucesso para ${baseName}!`);
            setIsCopyModalOpen(false);
            setQuizToCopy(null);
            setTargetBaseId("");
        } catch (error) {
            console.error("Error copying quiz:", error);
            alert("Erro ao copiar quiz.");
        }
    };

    // --- Arena Logic ---
    const handleSelectForArena = (quiz: MasterQuiz) => {
        setSelectedQuiz(quiz);
        setActiveTab("arena");
    };

    useEffect(() => {
        // Monitor Live Status
        const statusRef = ref(rtdb, 'active_quizzes/main_event/status');
        const unsub = onValue(statusRef, (snap) => {
            const val = snap.val();
            setLiveStatus(val || 'idle');
        });
        return () => off(statusRef);
    }, []);

    useEffect(() => {
        if (currentIdx === -1 || !selectedQuiz) {
            setStats({});
            setTotalAnswers(0);
            return;
        }

        const qId = selectedQuiz.questions[currentIdx]?.id;
        if (!qId) return;

        const path = gamePin ? `active_quizzes/${gamePin}` : 'active_quizzes/main_event';
        const answersRef = ref(rtdb, `${path}/answers/${qId}`);
        const unsub = onValue(answersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const newStats: Record<number, number> = {};
                let count = 0;
                Object.values(data).forEach((ans: any) => {
                    // Use answerIdx (matching participant app) or selectedOption (legacy)
                    const opt = ans.answerIdx !== undefined ? ans.answerIdx : ans.selectedOption;
                    if (opt !== undefined) {
                        newStats[opt] = (newStats[opt] || 0) + 1;
                    }
                    count++;
                });
                setStats(newStats);
                setTotalAnswers(count);
            } else {
                setStats({});
                setTotalAnswers(0);
            }
        });

        return () => off(answersRef);
    }, [currentIdx, selectedQuiz, gamePin]);

    // Monitor Participants Count
    useEffect(() => {
        if (!gamePin) return;
        const participantsRef = ref(rtdb, `active_quizzes/${gamePin}/participants`);
        const unsub = onValue(participantsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setTotalParticipants(Object.keys(data).length);
            } else {
                setTotalParticipants(0);
            }
        });
        return () => off(participantsRef);
    }, [gamePin]);

    // Timer Logic
    useEffect(() => {
        let timer: any;
        if (liveStatus === 'in_progress' && timeLeft > 0 && !isResultsVisible && !showLeaderboard) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && liveStatus === 'in_progress' && !isResultsVisible && !showLeaderboard) {
            toggleResults(true);
        }

        return () => clearInterval(timer);
    }, [timeLeft, liveStatus, isResultsVisible, showLeaderboard]);

    // Auto-advance if everyone answered
    useEffect(() => {
        if (liveStatus === 'in_progress' && !isResultsVisible && !showLeaderboard && totalAnswers > 0 && totalParticipants > 0 && totalAnswers >= totalParticipants) {
            // Pequeno delay para não ser instantâneo demais
            const t = setTimeout(() => {
                toggleResults(true);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [totalAnswers, totalParticipants, liveStatus, isResultsVisible, showLeaderboard]);

    // Auto-toggle leaderboard after 5 seconds of results
    useEffect(() => {
        let t: any;
        if (isResultsVisible && !showLeaderboard && liveStatus === 'in_progress') {
            t = setTimeout(() => {
                toggleLeaderboard();
            }, 5000); // 5 seconds of "Result visibility" before leaderboard
        }
        return () => clearTimeout(t);
    }, [isResultsVisible, showLeaderboard, liveStatus]);

    // Resiliência: Recuperar PIN ativo ao carregar/recarregar
    useEffect(() => {
        const recoverPin = async () => {
            try {
                const mainSnap = await get(ref(rtdb, 'active_quizzes/main_event'));
                if (mainSnap.exists()) {
                    const data = mainSnap.val();
                    if (data.status === 'in_progress' || data.status === 'waiting') {
                        if (data.pin) setGamePin(data.pin);
                    }
                }
            } catch (e) {
                console.error("Erro ao recuperar PIN:", e);
            }
        };
        recoverPin();
    }, []);

    const startLiveQuiz = async () => {
        if (!selectedQuiz) return;
        setIsStarting(true);
        try {
            const newPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit PIN
            setGamePin(newPin);

            // Check if we should force simplified mode for these specific roles/bases
            const teacherBase = user?.baseId ? allBases.find(b => b.id === user.baseId) : null;
            const isMissionarios = teacherBase?.name?.toLowerCase().includes("missionários de cristo") || teacherBase?.name?.toLowerCase().includes("missionarios de cristo");
            const shouldBeSimplified = isSimplifiedMode || user?.role === 'master' || isMissionarios;

            // Save to specific PIN node
            await set(ref(rtdb, `active_quizzes/${newPin}`), {
                status: 'waiting',
                currentQuestionIndex: -1,
                startTime: Date.now(),
                participants: {},
                quizId: selectedQuiz.id,
                quizTitle: selectedQuiz.title,
                baseId: (user?.role === 'coord_base' && user.baseId) ? user.baseId : (selectedQuiz.baseId || null),
                simplifiedMode: shouldBeSimplified // Force simplified mode if applicable
            });

            // Also keep main_event active for debugging or legacy? 
            // Better to switch fully to PIN but let's keep main_event as a redirect or just use PIN.
            // Requirement is specific: "Select Base/Quiz after scanning". 
            // If we use PIN, we don't need to select Quiz, just Name.

            // Let's reset main_event to point to this PIN or just update it too for safety if someone is stuck on old app
            // Or better, main_event is NO LONGER USED.
            // But 'broadcastQuestion' uses it. We need to update that too.
            // Wait, I need to update all 'main_event' references to us `active_quizzes/${gamePin}`.

            await set(ref(rtdb, 'active_quizzes/main_event'), {
                quizId: selectedQuiz.id,
                baseId: selectedQuiz.baseId || null,
                pin: newPin,
                simplifiedMode: shouldBeSimplified,
                status: 'waiting'
            });

            setCurrentIdx(-1);
            setIsFullScreen(true);
            setShowQR(true); // Auto-show PIN/QR Code logic
        } catch (error) {
            console.error(error);
            alert(`Erro ao abrir sala: ${error}`);
        } finally {
            setIsStarting(false);
        }
    };

    const broadcastQuestion = async (index: number) => {
        if (!selectedQuiz) return;
        const question = selectedQuiz.questions[index];
        // Use PIN if set, else main_event (backwards compat)
        const path = gamePin ? `active_quizzes/${gamePin}` : 'active_quizzes/main_event';
        const quizRef = ref(rtdb, path);

        await update(quizRef, { // Use update instead of set to preserve other fields
            status: 'in_progress',
            currentQuestionIndex: index,
            currentQuestion: {
                id: question.id,
                statement: question.statement,
                alternatives: question.alternatives.map(a => a.text),
                correctAnswer: question.alternatives.findIndex(a => a.isCorrect),
                timeLimit: question.timeLimit,
                xpValue: question.xpValue
            },
            questionStartTime: Date.now(),
            showResults: false,
            showLeaderboard: false
        });
        setCurrentIdx(index);
        setIsResultsVisible(false);
        setShowLeaderboard(false);
        setTimeLeft(question.timeLimit || 30);
    };

    const toggleResults = async (show: boolean) => {
        const path = gamePin ? `active_quizzes/${gamePin}` : 'active_quizzes/main_event';
        await update(ref(rtdb, path), { showResults: show });
        setIsResultsVisible(show);
    };

    const toggleLeaderboard = async () => {
        const show = !showLeaderboard;
        let leaders: any[] = [];

        if (show) {
            leaders = await calculateLiveLeaderboard();
            setLiveLeaderboard(leaders);
        }

        const path = gamePin ? `active_quizzes/${gamePin}` : 'active_quizzes/main_event';
        await update(ref(rtdb, path), {
            showLeaderboard: show,
            leaderboard: leaders // Broadcast current leaders to participants
        });
        setShowLeaderboard(show);
    };

    const endQuiz = async () => {
        if (!selectedQuiz || isEnding) return;
        setIsEnding(true);

        try {
            let activePin = gamePin;

            // Resilience: If gamePin is lost (refresh), try to recover from main_event
            if (!activePin) {
                const mainSnap = await get(ref(rtdb, 'active_quizzes/main_event'));
                if (mainSnap.exists()) {
                    activePin = mainSnap.val().pin;
                }
            }

            const path = activePin ? `active_quizzes/${activePin}` : 'active_quizzes/main_event';
            const quizRTDBRef = ref(rtdb, path);
            const answersRTDBRef = ref(rtdb, `${path}/answers`);

            console.log(`Ending quiz at path: ${path}`);
            const snapshot = await get(answersRTDBRef);
            const allQuestionsAnswers = snapshot.val();
            const scores: Record<string, { score: number, name: string }> = {};

            if (allQuestionsAnswers) {
                Object.values(allQuestionsAnswers).forEach((questionAnswers: any) => {
                    Object.entries(questionAnswers).forEach(([userId, data]: [string, any]) => {
                        if (!scores[userId]) {
                            scores[userId] = { score: 0, name: data.userName || "Membro" };
                        }
                        if (data.isCorrect) {
                            scores[userId].score += (data.xpValue || 100);
                        }
                    });
                });

                // Award XP in Firestore
                const batchPromises = Object.entries(scores).map(async ([userId, data]) => {
                    if (userId !== 'guest_user' && data.score > 0) {
                        try {
                            const userRef = doc(db, "users", userId);
                            await updateDoc(userRef, {
                                xp: increment(data.score),
                                "stats.currentXp": increment(data.score)
                            });
                            await addDoc(collection(db, "users", userId, "xp_history"), {
                                amount: data.score,
                                type: 'quiz',
                                taskTitle: `Área: ${selectedQuiz.title}`,
                                createdAt: serverTimestamp(), // Consolidating with other history patterns
                                reason: `Participação no Quiz: ${selectedQuiz.title}`
                            });
                        } catch (err) {
                            console.error(`Error updating XP for user ${userId}:`, err);
                        }
                    }
                });
                await Promise.all(batchPromises);
            }

            const leaderboard = Object.entries(scores)
                .map(([id, data]) => ({
                    id,
                    score: data.score,
                    name: data.name
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            await update(quizRTDBRef, {
                status: 'finished',
                leaderboard: leaderboard
            });

            await firestoreService.add("quiz_history", {
                date: new Date(),
                quizTitle: selectedQuiz.title,
                totalParticipants: Object.keys(scores).length,
                leaderboard: leaderboard,
                questionsCount: selectedQuiz.questions.length,
                pin: activePin || null
            });

            try {
                // Clear main_event pin reference too
                await update(ref(rtdb, 'active_quizzes/main_event'), {
                    status: 'finished',
                    pin: null
                });
            } catch (e) { console.error("Error clearing main_event:", e); }

            alert("Quiz encerrado com sucesso! Pontos e histórico atualizados.");
            setCurrentIdx(-1);
            setLiveStatus('finished');
            setGamePin("");
        } catch (error) {
            console.error("Error ending quiz:", error);
            alert("Erro ao finalizar quiz. Verifique o console.");
        } finally {
            setIsEnding(false);
        }
    };


    if (user?.role === 'membro') {
        const userCls = user?.classification || 'pre-adolescente'; // Fallback for members
        const memberQuizzes = myQuizzes.filter(q => {
            const isAvailable = q.availableToStudents === true;
            const matchesClassification =
                !q.classification ||
                q.classification === 'todos' ||
                q.classification === userCls;

            // Isolation: only show global quizzes or quizzes from the user's base
            const matchesBase = !q.baseId || q.baseId === user?.baseId;

            return isAvailable && matchesClassification && matchesBase;
        });

        return (
            <div className="space-y-8 pb-20">
                {/* Header Member */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-2">ÁREA DO QUIZ</h1>
                        <p className="text-blue-100 mb-6 max-w-md">
                            Entre em um jogo ao vivo com o PIN do seu professor ou treine com os quizzes disponíveis abaixo!
                        </p>
                        <Link href="/play">
                            <Button className="bg-white text-primary hover:bg-blue-50 font-black px-8 py-6 rounded-2xl gap-3 text-lg shadow-lg">
                                <Play size={24} fill="currentColor" />
                                PLAY QUIZ (ENTRAR COM PIN)
                            </Button>
                        </Link>
                    </div>
                    <Gamepad size={200} className="absolute -right-10 -bottom-10 text-white/10 rotate-12" />
                </div>

                {/* List for Members */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <LayoutList className="text-primary" size={24} />
                        <h2 className="text-xl font-bold">Quizzes para você</h2>
                    </div>

                    {loadingQuizzes ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : memberQuizzes.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                            <MonitorPlay size={48} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-text-secondary">Nenhum quiz disponível no momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {memberQuizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="group relative bg-white rounded-[32px] p-8 border border-gray-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 cursor-default overflow-hidden"
                                >
                                    {/* Background Accent */}
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-700" />

                                    <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                        <Gamepad size={32} />
                                    </div>

                                    <div className="relative z-10">
                                        <h3 className="font-black text-2xl mb-2 text-gray-900 tracking-tight group-hover:text-primary transition-colors">{quiz.title}</h3>
                                        <p className="text-sm text-text-secondary line-clamp-2 mb-8 font-medium">
                                            {quiz.description || "Inicie essa jornada agora e prove seu conhecimento!"}
                                        </p>

                                        <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recompensa</span>
                                                <span className="font-black text-primary italic">Até {quiz.questions.reduce((acc: number, q: any) => acc + (q.xpValue || 0), 0)} XP</span>
                                            </div>
                                            <Button
                                                onClick={() => setPlayingIndividualQuiz(quiz)}
                                                className="rounded-2xl px-6 py-5 font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                                            >
                                                JOGAR AGORA
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {playingIndividualQuiz && (
                    <IndividualQuizPlayer
                        quiz={playingIndividualQuiz}
                        userId={user?.uid!}
                        onClose={() => setPlayingIndividualQuiz(null)}
                    />
                )}
            </div >
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header with vibrant background */}
            <div className="relative bg-[#0f172a] rounded-[40px] p-8 md:p-12 mb-10 overflow-hidden shadow-2xl">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-primary/20 rounded-2xl border border-primary/20 backdrop-blur-md">
                                <Award className="text-primary" size={32} />
                            </div>
                            <span className="text-primary font-black text-xs uppercase tracking-[0.3em]">Módulo de Gamificação</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">ÁREA QUIZ</h1>
                        <p className="text-white/50 text-lg font-medium max-w-xl">
                            Gerencie seus desafios, crie novas áreas e acompanhe o progresso dos seus alunos em tempo real.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        {user?.role === 'master' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRepairDuplicates}
                                className="text-[10px] bg-white/5 border-white/10 text-white/40 hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/5"
                            >
                                REPARAR DADOS
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={handleStartTextImport}
                            className="gap-3 bg-white/5 border-white/10 text-white hover:bg-white/10 h-14 px-8 rounded-2xl font-bold"
                        >
                            <FileText size={20} /> IMPORTAR TXT
                        </Button>
                        <Button
                            onClick={handleCreateClick}
                            className="bg-primary hover:bg-primary/90 text-white gap-3 h-14 px-8 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                        >
                            <Plus size={24} /> NOVO DESAFIO
                        </Button>
                    </div>
                </div>
            </div>

            {/* Navigation with modern tab style */}
            <div className="flex gap-2 p-1 bg-gray-100/50 rounded-2xl mb-10 w-fit">
                <button
                    onClick={() => setActiveTab("quizzes")}
                    className={clsx(
                        "py-3 px-8 font-black text-sm rounded-xl transition-all flex items-center gap-3",
                        activeTab === "quizzes"
                            ? "bg-white text-primary shadow-sm"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    )}
                >
                    <LayoutList size={20} /> MEUS DESAFIOS
                </button>
                <button
                    onClick={() => setActiveTab("arena")}
                    className={clsx(
                        "py-3 px-8 font-black text-sm rounded-xl transition-all flex items-center gap-3",
                        activeTab === "arena"
                            ? "bg-white text-primary shadow-sm"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    )}
                >
                    <Gamepad size={20} /> ÁREA AO VIVO
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={clsx(
                        "py-3 px-8 font-black text-sm rounded-xl transition-all flex items-center gap-3",
                        activeTab === "history"
                            ? "bg-white text-primary shadow-sm"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    )}
                >
                    <History size={20} /> HISTÓRICO
                </button>
            </div>

            {/* Content Tab: Quizzes (List) */}
            {activeTab === "quizzes" && (
                <div className="space-y-6">
                    {loadingQuizzes ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
                        </div>
                    ) : myQuizzes.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Gamepad size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-text-primary">Nenhum quiz criado</h3>
                            <p className="text-text-secondary mb-4">Crie seu primeiro quiz para jogar na área.</p>
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={handleStartTextImport} className="gap-2">
                                    <FileText size={20} /> Importar por Texto
                                </Button>
                                <Button onClick={handleCreateClick}>Criar Quiz</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {myQuizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="group bg-white rounded-[32px] p-8 border-2 border-transparent hover:border-primary/20 hover:shadow-[0_20px_50px_rgba(59,130,246,0.1)] transition-all duration-500 cursor-default"
                                >
                                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                                        <Gamepad size={32} />
                                    </div>
                                    <h3 className="font-black text-2xl mb-3 text-gray-900 tracking-tight">{quiz.title}</h3>
                                    <p className="text-sm text-text-secondary line-clamp-2 mb-8 font-medium italic opacity-60">
                                        {quiz.description || "Inicie a área agora e veja quem é o mais sábio!"}
                                    </p>

                                    <div className="flex flex-col gap-3">
                                        <Button
                                            onClick={() => handleSelectForArena(quiz)}
                                            className="w-full h-14 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
                                        >
                                            INICIAR ÁREA <ArrowRight size={20} />
                                        </Button>
                                        <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-2">
                                            <span>{quiz.questions.length} Questões</span>
                                            <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                            <span>Tempo: Auto</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Content Tab: Arena */}
            {
                activeTab === "arena" && (
                    <div className="space-y-6">
                        {!selectedQuiz ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <MonitorPlay size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-text-primary">Nenhum quiz selecionado</h3>
                                <p className="text-text-secondary mb-4">Vá para a aba "Meus Quizzes" e clique em "Jogar na Área".</p>
                                <Button onClick={() => setActiveTab("quizzes")}>Escolher Quiz</Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Control Bar */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div>
                                        <span className="text-xs font-bold text-primary uppercase tracking-wider mb-1 block">Quiz Selecionado</span>
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            {selectedQuiz.title}
                                            <span className={clsx(
                                                "text-xs px-2 py-1 rounded-full border",
                                                liveStatus === 'in_progress' ? "bg-green-100 text-green-700 border-green-200" :
                                                    liveStatus === 'waiting' ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                                        "bg-gray-100 text-gray-500 border-gray-200"
                                            )}>
                                                {liveStatus === 'idle' ? 'Inativo' : liveStatus === 'waiting' ? 'Aguardando' : liveStatus === 'in_progress' ? 'Ao Vivo' : 'Finalizado'}
                                            </span>
                                        </h2>
                                        <p className="text-text-secondary text-sm">{selectedQuiz.questions.length} questões na fila</p>
                                    </div>

                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        {/* Toggle Modo Simplificado (Master ou Missionários de Cristo) */}
                                        {(user?.role === 'master' || allBases?.find(b => b.id === user?.baseId)?.name?.toLowerCase().includes("missionários de cristo")) && (liveStatus === 'idle' || liveStatus === 'finished') && (
                                            <div className="flex items-center gap-3 bg-yellow-50 px-4 py-2 rounded-xl border border-yellow-100">
                                                <input
                                                    type="checkbox"
                                                    id="simplifiedMode"
                                                    className="w-5 h-5 text-yellow-600 rounded focus:ring-yellow-500"
                                                    checked={isSimplifiedMode}
                                                    onChange={e => setIsSimplifiedMode(e.target.checked)}
                                                />
                                                <label htmlFor="simplifiedMode" className="text-sm font-bold text-yellow-800 cursor-pointer">
                                                    Modo Sem Login
                                                </label>
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            {liveStatus === 'idle' || liveStatus === 'finished' ? (
                                                <Button onClick={startLiveQuiz} disabled={isStarting} className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8">
                                                    <Play size={20} /> Abrir Sala
                                                </Button>
                                            ) : (
                                                <>
                                                    <>
                                                        <Button variant="outline" onClick={() => setShowQR(true)} className="text-gray-700" title="Mostrar QR Code">
                                                            <QrCode size={20} />
                                                        </Button>

                                                        {!isResultsVisible ? (
                                                            <Button variant="outline" onClick={() => toggleResults(true)} title="Revelar Resposta" className="gap-2">
                                                                <CheckCircle2 size={20} /> Revelar
                                                            </Button>
                                                        ) : (
                                                            <Button variant="outline" onClick={toggleLeaderboard} title={showLeaderboard ? "Voltar à Pergunta" : "Ver Ranking"} className="gap-2 bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
                                                                <Award size={20} /> {showLeaderboard ? "Ocultar Ranking" : "Ranking"}
                                                            </Button>
                                                        )}

                                                        <Button
                                                            onClick={() => broadcastQuestion(currentIdx + 1)}
                                                            disabled={currentIdx >= selectedQuiz.questions.length - 1}
                                                            className="gap-2"
                                                        >
                                                            Próxima <ArrowRight size={20} />
                                                        </Button>
                                                        <Button variant="danger" onClick={endQuiz} disabled={isEnding}>
                                                            {isEnding ? "Encerrando..." : "Encerrar"}
                                                        </Button>
                                                    </>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Live View */}
                                {liveStatus !== 'idle' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Question Card */}
                                        <div className="lg:col-span-2 space-y-4">
                                            <div className="card-soft p-6 bg-white relative overflow-hidden">
                                                {currentIdx >= 0 ? (
                                                    <div className="space-y-6">
                                                        <div className="flex justify-between items-start">
                                                            <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs">
                                                                Questão {currentIdx + 1}/{selectedQuiz.questions.length}
                                                            </span>
                                                            <div className="text-right flex flex-col items-end">
                                                                <div className="font-bold text-2xl text-primary">{selectedQuiz.questions[currentIdx].xpValue} XP</div>
                                                                <div className={clsx(
                                                                    "text-xl font-black px-3 py-1 rounded-lg",
                                                                    timeLeft <= 5 ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-700"
                                                                )}>
                                                                    <Clock size={18} className="inline mr-2" />
                                                                    {timeLeft}s
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <h3 className="text-3xl md:text-5xl font-black mb-8">{selectedQuiz.questions[currentIdx].statement}</h3>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {selectedQuiz.questions[currentIdx].alternatives.filter((alt: any) => alt.text?.trim()).map((alt, idx) => {
                                                                const count = stats[idx] || 0;
                                                                const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
                                                                return (
                                                                    <div key={idx} className={clsx(
                                                                        "p-6 rounded-2xl border-2 relative overflow-hidden transition-all h-24 flex items-center",
                                                                        (isResultsVisible && alt.isCorrect) ? "bg-green-50 border-green-500 shadow-green-100" : "bg-white border-gray-100"
                                                                    )}>
                                                                        {isResultsVisible && (
                                                                            <div
                                                                                className={clsx("absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-1000 ease-out", alt.isCorrect ? "bg-green-500" : "bg-gray-400")}
                                                                                style={{ width: `${percentage}%` }}
                                                                            />
                                                                        )}
                                                                        <div className="relative z-10 flex justify-between items-center w-full">
                                                                            <span className="font-black text-2xl md:text-4xl flex items-center gap-4">
                                                                                <span className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">{String.fromCharCode(65 + idx)}</span>
                                                                                {alt.text}
                                                                            </span>
                                                                            {isResultsVisible && <span className="font-black text-2xl">{Math.round(percentage)}%</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-10">
                                                        <h3 className="text-xl font-bold text-primary animate-pulse">Aguardando início...</h3>
                                                        <p className="text-text-secondary">Os participantes estão entrando na sala.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Sidebar Stats (Inline only) */}
                                        {!isFullScreen && (
                                            <div className="space-y-4">
                                                <div className="bg-primary text-white p-6 rounded-2xl text-center space-y-4">
                                                    <div>
                                                        <UsersIcon size={32} className="mx-auto mb-2 opacity-80" />
                                                        <div className="text-4xl font-black">{totalAnswers}{totalParticipants > 0 ? ` / ${totalParticipants}` : ""}</div>
                                                        <div className="text-sm opacity-80 uppercase tracking-widest font-bold">Respostas</div>
                                                    </div>

                                                    {liveStatus === 'in_progress' && !isResultsVisible && (
                                                        <div className="pt-4 border-t border-white/20">
                                                            <div className="text-3xl font-black">{timeLeft}s</div>
                                                            <div className="text-[10px] opacity-80 uppercase font-bold">Tempo Restante</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    onClick={() => setIsFullScreen(true)}
                                                    className="w-full py-6 text-lg gap-2 bg-gray-900 text-white hover:bg-black"
                                                >
                                                    <Maximize2 size={24} /> Tela Cheia
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Full Screen Overlay */}
                                {isFullScreen && (
                                    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col font-sans selection:bg-primary/30">
                                        {/* Top Bar with Glassmorphism */}
                                        <div className="bg-white/10 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center shrink-0 z-20">
                                            <div className="flex items-center gap-6">
                                                <div className="bg-white/10 p-3 rounded-2xl">
                                                    <Gamepad2 className="text-white" size={32} />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-black text-white tracking-tight">{selectedQuiz?.title}</h2>
                                                    <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                                                        Arena de Combate • Questão {currentIdx + 1}/{selectedQuiz?.questions.length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                {liveStatus === 'in_progress' && !isResultsVisible && !showLeaderboard && (
                                                    <div className={clsx(
                                                        "px-6 py-3 rounded-2xl border-2 flex items-center gap-4 shadow-lg transition-all",
                                                        timeLeft <= 5 ? "bg-red-500 border-white text-white animate-pulse scale-110" : "bg-white/10 border-white/20 text-white"
                                                    )}>
                                                        <Clock size={32} className={timeLeft <= 5 ? "animate-spin-slow" : ""} />
                                                        <span className="text-4xl font-black tracking-tighter tabular-nums">{timeLeft}s</span>
                                                    </div>
                                                )}
                                                <div className="text-center bg-white/10 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-sm">
                                                    <span className="block text-2xl font-black text-white tabular-nums">{totalAnswers}{totalParticipants > 0 ? ` / ${totalParticipants}` : ""}</span>
                                                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Respostas</span>
                                                </div>
                                                <Button variant="ghost" onClick={() => setIsFullScreen(false)} className="text-white hover:bg-white/10 rounded-2xl p-4 transition-all hover:rotate-90">
                                                    <Minimize2 size={32} />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Main Content Area with Animated Background */}
                                        <div className="flex-1 p-8 flex flex-col overflow-hidden relative">
                                            {/* Dynamic background blobs */}
                                            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                                            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-700" />

                                            <div className="flex-1 bg-white/5 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/10 overflow-hidden relative flex flex-col z-10">
                                                {showLeaderboard ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto">
                                                        <div className="text-center mb-12">
                                                            <div className="inline-block p-4 bg-yellow-400/20 rounded-3xl mb-4">
                                                                <Award className="text-yellow-400" size={64} />
                                                            </div>
                                                            <h3 className="text-6xl font-black text-white uppercase tracking-[0.2em] mb-4">Hall da Fama</h3>
                                                            <div className="w-48 h-2 bg-gradient-to-r from-transparent via-yellow-400 to-transparent mx-auto rounded-full" />
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-4 w-full max-w-4xl">
                                                            {liveLeaderboard.map((player, idx) => (
                                                                <div key={idx} className={clsx(
                                                                    "flex items-center justify-between p-6 rounded-3xl border-2 transform transition-all hover:scale-[1.02]",
                                                                    idx === 0 ? "bg-gradient-to-r from-yellow-400 to-orange-500 border-yellow-200 text-white shadow-[0_0_50px_rgba(250,204,21,0.3)]" :
                                                                        idx === 1 ? "bg-white/10 border-white/20 text-white" :
                                                                            idx === 2 ? "bg-white/5 border-white/10 text-white" :
                                                                                "bg-black/20 border-white/5 text-white/80"
                                                                )}>
                                                                    <div className="flex items-center gap-8">
                                                                        <div className={clsx(
                                                                            "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl shadow-xl",
                                                                            idx === 0 ? "bg-white text-yellow-600" :
                                                                                idx === 1 ? "bg-gray-400/50 text-white" :
                                                                                    idx === 2 ? "bg-orange-400/50 text-white" : "bg-white/5 text-white/50"
                                                                        )}>
                                                                            {idx + 1}
                                                                        </div>
                                                                        <span className="font-black text-4xl tracking-tight">{player.name}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-black text-5xl tabular-nums">{player.score}</div>
                                                                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">XP TOTAL</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col">
                                                        {/* Question Text */}
                                                        <div className="flex-1 flex items-center justify-center p-12 text-center">
                                                            <h3 className="text-6xl md:text-7xl font-black text-white leading-[1.1] tracking-tight drop-shadow-2xl">
                                                                {selectedQuiz?.questions[currentIdx]?.statement}
                                                            </h3>
                                                        </div>

                                                        {/* Alternatives Grid */}
                                                        <div className="grid grid-cols-2 gap-6 p-12 h-[450px]">
                                                            {selectedQuiz?.questions[currentIdx]?.alternatives.filter((alt: any) => alt.text?.trim()).map((alt, idx) => {
                                                                const count = stats[idx] || 0;
                                                                const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;

                                                                const colors = [
                                                                    { bg: "bg-red-500", glow: "shadow-red-500/40", hover: "hover:bg-red-400", border: "border-red-400/30" },
                                                                    { bg: "bg-blue-500", glow: "shadow-blue-500/40", hover: "hover:bg-blue-400", border: "border-blue-400/30" },
                                                                    { bg: "bg-yellow-500", glow: "shadow-yellow-500/40", hover: "hover:bg-yellow-400", border: "border-yellow-400/30" },
                                                                    { bg: "bg-green-500", glow: "shadow-green-500/40", hover: "hover:bg-green-400", border: "border-green-400/30" },
                                                                ];
                                                                const color = colors[idx % 4];

                                                                return (
                                                                    <div key={idx} className={clsx(
                                                                        "rounded-[32px] border-4 relative overflow-hidden transition-all flex items-center px-10 shadow-xl",
                                                                        (isResultsVisible && alt.isCorrect) ? "border-white scale-[1.02] z-10" : "border-white/10",
                                                                        !isResultsVisible && "hover:scale-[1.01]",
                                                                        isResultsVisible && !alt.isCorrect && "opacity-40 grayscale-[0.5]"
                                                                    )}
                                                                        style={{ backgroundColor: isResultsVisible && alt.isCorrect ? undefined : 'rgba(255,255,255,0.05)' }}>

                                                                        {/* The Actual Color Background if correct or active */}
                                                                        {(isResultsVisible && alt.isCorrect) ? (
                                                                            <div className={clsx("absolute inset-0 opacity-90", color.bg)} />
                                                                        ) : (
                                                                            <div className={clsx("absolute left-4 top-4 w-12 h-12 rounded-2xl opacity-80 flex items-center justify-center font-black text-2xl text-white", color.bg)}>
                                                                                {["A", "B", "C", "D"][idx % 4]}
                                                                            </div>
                                                                        )}

                                                                        {isResultsVisible && (
                                                                            <div
                                                                                className={clsx("absolute left-0 top-0 bottom-0 opacity-40 transition-all duration-1000 ease-out", alt.isCorrect ? "bg-white" : color.bg)}
                                                                                style={{ width: `${percentage}%` }}
                                                                            />
                                                                        )}

                                                                        <div className="relative z-10 flex justify-between items-center w-full ml-16">
                                                                            <span className={clsx(
                                                                                "font-black text-4xl tracking-tight leading-tight",
                                                                                (isResultsVisible && alt.isCorrect) ? "text-white" : "text-white/90"
                                                                            )}>
                                                                                {alt.text}
                                                                            </span>
                                                                            {isResultsVisible && (
                                                                                <div className="flex flex-col items-end">
                                                                                    <span className="font-black text-5xl text-white">{Math.round(percentage)}%</span>
                                                                                    <span className="text-[10px] font-bold opacity-60">{count} votos</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {isResultsVisible && alt.isCorrect && (
                                                                            <div className="absolute right-6 top-6">
                                                                                <CheckCircle2 className="text-white" size={48} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom Control Bar with Glowing Buttons */}
                                        <div className="bg-white/10 backdrop-blur-md p-8 border-t border-white/10 flex justify-center gap-6 shrink-0 z-20">
                                            {!isResultsVisible ? (
                                                <Button
                                                    onClick={() => toggleResults(true)}
                                                    className="h-20 px-16 text-2xl gap-4 rounded-3xl bg-primary text-white hover:bg-primary/90 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-105 transition-all font-black"
                                                >
                                                    <CheckCircle2 size={40} /> REVELAR RESPOSTA
                                                </Button>
                                            ) : !showLeaderboard ? (
                                                <Button
                                                    onClick={toggleLeaderboard}
                                                    className="h-20 px-16 text-2xl gap-4 rounded-3xl bg-yellow-400 text-yellow-950 hover:bg-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:scale-105 transition-all font-black uppercase tracking-tighter"
                                                >
                                                    <Award size={40} /> MOSTRAR RANKING
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => broadcastQuestion(currentIdx + 1)}
                                                    disabled={currentIdx >= (selectedQuiz?.questions.length || 0) - 1}
                                                    className="h-20 px-16 text-2xl gap-4 rounded-3xl bg-white text-gray-900 hover:bg-gray-100 shadow-xl hover:scale-105 transition-all font-black disabled:opacity-50"
                                                >
                                                    {currentIdx >= (selectedQuiz?.questions.length || 0) - 1 ? "QUIZ ENCERRADO" : "PRÓXIMA PERGUNTA"} <ArrowRight size={40} />
                                                </Button>
                                            )}

                                            <div className="border-l border-white/10 ml-6 pl-6 flex items-center">
                                                <Button
                                                    variant="ghost"
                                                    onClick={endQuiz}
                                                    className="h-16 px-8 rounded-2xl font-bold text-white/30 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                >
                                                    Finalizar ÁREA
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* QR Code Modal for Big Screen */}
                                {showQR && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowQR(false)}>
                                        <div className="bg-white p-8 rounded-3xl shadow-2xl scale-in-center flex flex-col items-center gap-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                            <div className="text-center">
                                                <p className="text-gray-500 font-bold mb-1 uppercase tracking-wider text-xs">Acesse e use o PIN</p>
                                                <p className="text-xl font-black text-primary mb-6">baseteen.vercel.app/play</p>

                                                <div className="bg-white p-4 rounded-3xl shadow-inner border-2 border-primary/10 mb-6 group transition-all hover:scale-105">
                                                    <QRCode
                                                        value={`https://baseteen.vercel.app/play?code=${gamePin}`}
                                                        size={250}
                                                        level="H"
                                                        viewBox={`0 0 256 256`}
                                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                    />
                                                </div>

                                                <p className="text-sm text-gray-400 mb-2 font-bold uppercase tracking-widest">PIN DO JOGO</p>
                                                <div className="bg-primary/5 p-6 rounded-3xl text-5xl font-black tracking-[0.3em] text-center w-full text-primary border-2 border-primary/20 shadow-sm">
                                                    {gamePin || "------"}
                                                </div>
                                            </div>
                                            <Button className="w-full h-12" onClick={() => setShowQR(false)}>
                                                Fechar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

            {/* Content Tab: History */}
            {
                activeTab === "history" && (
                    <div className="space-y-6">
                        {loadingHistory ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="card-soft p-12 animate-pulse" />)}
                            </div>
                        ) : history.length > 0 ? (
                            <div className="grid grid-cols-1 gap-6">
                                {history.sort((a, b) => b.date?.seconds - a.date?.seconds).map((entry) => (
                                    <div key={entry.id} className="card-soft overflow-hidden border-l-4 border-l-primary hover:shadow-lg transition-all">
                                        <div className="p-6 bg-white border-b border-gray-50 flex flex-col md:flex-row justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                                    <Calendar size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg">{entry.quizTitle || "Quiz Sem Título"}</h3>
                                                    <p className="text-text-secondary text-sm flex items-center gap-2">
                                                        {entry.date?.toDate ? entry.date.toDate().toLocaleDateString('pt-BR') : "Data N/A"} • {entry.questionsCount} Questões
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-center md:text-right">
                                                <p className="text-2xl font-black text-primary">{entry.totalParticipants}</p>
                                                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Participantes</p>
                                            </div>
                                        </div>
                                        {/* Podium preview could go here */}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <History size={48} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-text-primary">Nenhum histórico</h3>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Modal de Criação/Edição */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl scale-in-center">
                            <div className="p-6 bg-primary text-white flex justify-between items-center shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold">{editingId ? "Editar Quiz" : "Criar Novo Quiz"}</h2>
                                    <p className="text-white/70 text-sm">Configure as perguntas e detalhes do desafio.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Título do Quiz</label>
                                        <input
                                            type="text"
                                            className="w-full bg-surface border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold"
                                            placeholder="Ex: Área da Vitória"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Classificação</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold"
                                            value={formData.classification}
                                            onChange={e => setFormData({ ...formData, classification: e.target.value as any })}
                                        >
                                            <option value="todos">Todos</option>
                                            <option value="pre-adolescente">Pre-adolescente</option>
                                            <option value="adolescente">Adolescente</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Descrição (Opcional)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-surface border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20"
                                            placeholder="Ex: Especial de férias"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    {/* Opção de Visibilidade para Alunos */}
                                    {(user?.role === 'coord_base' || user?.role === 'master' || user?.role === 'admin') && (
                                        <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-4">
                                            <input
                                                type="checkbox"
                                                id="availableToStudents"
                                                className="w-5 h-5 text-primary rounded focus:ring-primary"
                                                checked={formData.availableToStudents}
                                                onChange={e => setFormData({ ...formData, availableToStudents: e.target.checked })}
                                            />
                                            <label htmlFor="availableToStudents" className="cursor-pointer">
                                                <span className="block font-bold text-gray-900">Disponibilizar para Alunos da Base?</span>
                                                <span className="text-sm text-text-secondary">Se marcado, os alunos da sua base verão este quiz na lista de atividades.</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t pt-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <MessageSquare size={20} /> Perguntas ({formData.questions.length})
                                        </h3>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={handleDownloadTemplate} title="Baixar Modelo" size="sm">
                                                <FileSpreadsheet size={16} />
                                            </Button>
                                            <label>
                                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                                                <div className="h-9 px-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer flex items-center gap-2 text-sm font-bold transition-colors">
                                                    <Upload size={16} /> Importar Excel
                                                </div>
                                            </label>
                                            <Button variant="outline" onClick={() => setIsTextImportOpen(true)} size="sm" className="gap-2">
                                                <FileText size={16} /> Colar Texto
                                            </Button>
                                            <Button onClick={addQuestion} size="sm" className="gap-2">
                                                <Plus size={16} /> Adicionar
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {formData.questions.map((q, qIdx) => (
                                            <div key={q.id || qIdx} className="bg-gray-50 rounded-2xl p-6 relative border border-gray-100 group">
                                                <button
                                                    onClick={() => removeQuestion(qIdx)}
                                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>

                                                <div className="space-y-4 pr-10">
                                                    <div>
                                                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Enunciado</label>
                                                        <textarea
                                                            className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 min-h-[60px]"
                                                            value={q.statement}
                                                            onChange={e => updateQuestion(qIdx, 'statement', e.target.value)}
                                                            placeholder="Digite a pergunta..."
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Tempo (s)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                                                value={q.timeLimit}
                                                                onChange={e => updateQuestion(qIdx, 'timeLimit', parseInt(e.target.value))}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">XP</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                                                value={q.xpValue}
                                                                onChange={e => updateQuestion(qIdx, 'xpValue', parseInt(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-text-secondary uppercase block">Alternativas</label>
                                                        {q.alternatives.map((alt, aIdx) => (
                                                            <div key={aIdx} className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => setCorrectAlternative(qIdx, aIdx)}
                                                                    className={clsx(
                                                                        "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                                        alt.isCorrect ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-300"
                                                                    )}
                                                                >
                                                                    {alt.isCorrect ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold text-gray-400">{String.fromCharCode(65 + aIdx)}</span>}
                                                                </button>
                                                                <input
                                                                    type="text"
                                                                    className={clsx(
                                                                        "flex-1 bg-white border-none rounded-lg p-2 focus:ring-2 focus:ring-primary/20 text-sm",
                                                                        alt.isCorrect && "font-bold text-green-700 bg-green-50"
                                                                    )}
                                                                    value={alt.text}
                                                                    onChange={e => updateAlternative(qIdx, aIdx, e.target.value)}
                                                                    placeholder={`Alternativa ${String.fromCharCode(65 + aIdx)}`}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-white border-t border-gray-100 flex gap-4 shrink-0">
                                <Button variant="outline" className="flex-1 py-4" onClick={() => setIsModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button className="flex-1 py-4 gap-2" onClick={handleSaveQuiz}>
                                    <Save size={20} /> Salvar Quiz
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Importação de Texto */}
            {
                isTextImportOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl scale-in-center">
                            <div className="p-6 bg-gray-900 text-white flex justify-between items-center rounded-t-3xl">
                                <div className="flex items-center gap-3">
                                    <FileText size={24} className="text-primary" />
                                    <div>
                                        <h2 className="text-xl font-black">Importar via Texto</h2>
                                        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Colar lista formatada</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsTextImportOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">
                                        <AlertCircle size={16} /> Formato Esperado:
                                    </h4>
                                    <code className="text-[11px] text-blue-700 block bg-white/50 p-2 rounded border border-blue-200 font-mono">
                                        Pergunta; Alt A; Alt B; Alt C; Alt D; Gabarito(A,B,C ou D); [Tempo]; [XP]
                                    </code>
                                    <p className="text-[10px] text-blue-600 mt-2">
                                        * Use ponto e vírgula (;) para separar as colunas.<br />
                                        * Ex: Quem descobriu o Brasil?; Pedro Álvares; Colombo; Cabral; Vasco; C; 30; 100
                                    </p>
                                </div>
                                <textarea
                                    className="w-full h-80 bg-gray-50 rounded-2xl p-4 font-mono text-sm border-2 border-gray-100 focus:border-primary/30 focus:ring-0 transition-all"
                                    placeholder={"Cole as perguntas aqui...\nUma por linha.\nEx: Qual a cor?; Azul; Verde; Vermelho; Rosa; A"}
                                    value={textImportValue}
                                    onChange={e => setTextImportValue(e.target.value)}
                                />
                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setIsTextImportOpen(false)}>Cancelar</Button>
                                    <Button className="flex-1 gap-2" onClick={handleTextImport}>
                                        <Upload size={18} /> Processar Agora
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {isCopyModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl scale-in-center">
                        <div className="p-6 bg-primary text-white flex justify-between items-center rounded-t-3xl">
                            <div className="flex items-center gap-3">
                                <Copy size={24} />
                                <div>
                                    <h2 className="text-xl font-black">Distribuir Quiz</h2>
                                    <p className="text-blue-100 text-xs uppercase tracking-widest font-bold">Criar cópia exclusiva para base</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCopyModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Selecione a Base de Destino</label>
                                <select
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-4 focus:border-primary/30 outline-none font-bold"
                                    value={targetBaseId}
                                    onChange={e => setTargetBaseId(e.target.value)}
                                >
                                    <option value="">Escolha uma base...</option>
                                    {(allBases || []).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((base: any) => (
                                        <option key={base.id} value={base.id}>{base.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-700">
                                <p className="font-bold mb-1">Nota:</p>
                                <p>Isso criará uma cópia completa deste quiz que ficará visível apenas para os alunos da base selecionada.</p>
                            </div>

                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1" onClick={() => setIsCopyModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 gap-2" onClick={handleCopyQuiz} disabled={!targetBaseId}>
                                    <Share2 size={18} /> Confirmar Cópia
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
