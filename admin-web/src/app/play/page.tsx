"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ref, get } from "firebase/database";
import { collection, getDocs, query, where } from "firebase/firestore";
import { rtdb, db } from "@/services/firebase";
import { Button } from "@/components/ui/Button";
import { Loader2, Users } from "lucide-react";

export default function PlayPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <PlayContent />
        </Suspense>
    );
}

function PlayContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    // State
    const [pin, setPin] = useState("");
    const [step, setStep] = useState<"pin" | "base" | "user">("pin");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [quizData, setQuizData] = useState<any>(null);
    const [bases, setBases] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Selection
    const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        if (code) {
            setPin(code);
            verifyPin(code);
        }
    }, [searchParams]);

    const verifyPin = async (code: string) => {
        setLoading(true);
        setError(null);
        try {
            const snapshot = await get(ref(rtdb, `active_quizzes/${code}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                setQuizData(data);

                // Determine next step
                if (user) {
                    // Logged in user: Skip selection
                    handleUserSelectLoggedIn(code, user, data);
                    return;
                }

                if (data.baseId) {
                    // Base specific
                    setSelectedBaseId(data.baseId);
                    await fetchUsers(data.baseId);
                    setStep("user");
                } else {
                    // Global -> Select Base
                    await fetchBases();
                    setStep("base");
                }
            } else {
                setError("PIN inválido. Verifique e tente novamente.");
            }
        } catch (err) {
            console.error(err);
            setError("Erro ao verificar PIN.");
        } finally {
            setLoading(false);
        }
    };

    const fetchBases = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "bases"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            setBases(list);
        } catch (err) {
            console.error(err);
            setError("Erro ao carregar bases.");
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async (baseId: string) => {
        setLoading(true);
        try {
            const q = query(collection(db, "users"), where("baseId", "==", baseId));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            setUsers(list);
        } catch (err) {
            console.error(err);
            setError("Erro ao carregar alunos.");
        } finally {
            setLoading(false);
        }
    };

    const handleBaseSelect = async (baseId: string) => {
        setSelectedBaseId(baseId);
        await fetchUsers(baseId);
        setStep("user");
    };

    const handleUserSelectLoggedIn = (validPin: string, currentUser: any, data: any) => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("quiz_session", JSON.stringify({
                pin: validPin,
                userId: currentUser.uid,
                userName: currentUser.displayName || "Membro",
                quizId: data.quizId,
                baseId: currentUser.baseId || data.baseId || null
            }));
            router.push("/play/arena");
        }
    };

    const handleUserSelect = (userId: string, userName: string) => {
        // Save session
        if (typeof window !== "undefined") {
            sessionStorage.setItem("quiz_session", JSON.stringify({
                pin,
                userId,
                userName,
                quizId: quizData.quizId,
                baseId: selectedBaseId
            }));
            router.push("/play/arena");
        }
    };

    if (loading && !quizData) {
        return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="text-white animate-spin w-12 h-12" /></div>;
    }

    return (
        <div className="min-h-screen bg-primary flex flex-col items-center p-6 text-white">
            <h1 className="text-3xl font-black mb-8 mt-12">PLAY QUIZ</h1>

            {step === "pin" && (
                <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-gray-900 shadow-xl">
                    <h2 className="text-xl font-bold text-center mb-6">Digite o PIN</h2>
                    <input
                        type="tel"
                        maxLength={6}
                        className="w-full bg-gray-100 border-2 border-transparent focus:border-primary text-center text-4xl font-black tracking-widest p-4 rounded-xl outline-none transition-all mb-4"
                        placeholder="000000"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                    />
                    {error && <p className="text-red-500 text-center mb-4 text-sm font-medium">{error}</p>}
                    <Button
                        className="w-full h-14 text-lg font-bold"
                        onClick={() => verifyPin(pin)}
                        disabled={pin.length < 6 || loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "ENTRAR"}
                    </Button>
                </div>
            )}

            {step === "base" && (
                <div className="w-full max-w-md">
                    <h2 className="text-xl font-bold text-center mb-6">Selecione sua Base</h2>
                    <div className="grid gap-3">
                        {bases.map(base => (
                            <button
                                key={base.id}
                                onClick={() => handleBaseSelect(base.id)}
                                className="bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-sm p-4 rounded-xl text-left font-bold text-lg transition-all border border-white/10 flex items-center gap-3"
                            >
                                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                {base.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === "user" && (
                <div className="w-full max-w-md">
                    <h2 className="text-xl font-bold text-center mb-6">Quem é você?</h2>

                    {/* Back Button if global */}
                    {!quizData?.baseId && (
                        <button onClick={() => setStep("base")} className="mb-4 text-sm opacity-70 hover:opacity-100">
                            ← Voltar para Bases
                        </button>
                    )}

                    <div className="bg-white rounded-3xl overflow-hidden shadow-xl max-h-[60vh] overflow-y-auto">
                        {users.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Nenhum aluno encontrado.</div>
                        ) : (
                            users.map((user, idx) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleUserSelect(user.id, user.displayName || user.name)}
                                    className={`w-full p-4 text-left font-bold text-lg text-gray-800 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-4 transition-colors ${idx === users.length - 1 ? 'border-none' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Users size={20} />
                                    </div>
                                    {user.displayName || user.name}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
