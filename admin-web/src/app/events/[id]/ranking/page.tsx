"use client";

import { use, useEffect, useState } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { db } from "@/services/firebase";
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { Award, Trophy, Timer, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

interface RankingEntry {
    userId: string;
    userName: string;
    baseName: string;
    totalScore: number;
    quizzesPlayed: number;
}

export default function EventRankingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = use(params);
    const router = useRouter();
    const [ranking, setRanking] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [eventTitle, setEventTitle] = useState("");

    // Fetch Ranking Data
    const fetchRanking = async () => {
        setLoading(true);
        try {
            // 1. Get Event Data
            const eventDoc = await getDoc(doc(db, "events", eventId));
            if (!eventDoc.exists()) {
                alert("Evento não encontrado");
                return;
            }
            const eventData = eventDoc.data();
            setEventTitle(eventData.title);
            const linkedQuizIds = eventData.linkedQuizzes || [];

            if (linkedQuizIds.length === 0) {
                setRanking([]);
                setLoading(false);
                return;
            }

            // 2. Get Quiz Titles (to match history)
            const quizzesTitles: string[] = [];
            for (const qId of linkedQuizIds) {
                const qDoc = await getDoc(doc(db, "master_quizzes", qId));
                if (qDoc.exists()) {
                    quizzesTitles.push(qDoc.data().title);
                }
            }

            // 3. Get Registered Users
            const regsSnap = await getDocs(query(collection(db, "event_registrations"), where("eventId", "==", eventId)));
            const registrations = regsSnap.docs.map(d => d.data());

            // 4. Calculate Scores
            const leaderboard: RankingEntry[] = [];

            // Execute in batches/parallel
            const promises = registrations.map(async (reg: any) => {
                try {
                    // Fetch recent history (optimization: assumption event is recent/today)
                    // If event date is available, could filter history by date >= event.date
                    // For now, let's fetch all 'quiz' type history and filter by title match
                    // This creates a read per user. Scale warning: 100 users = 100 reads.

                    const historyRef = collection(db, "users", reg.userId, "xp_history");
                    // Optimization: Limit to 'quiz' type to reduce index scan?? No, strictly need composite index.
                    // Let's just client-side filter for robustness right now.
                    const qHistory = query(historyRef, where("type", "==", "quiz"));
                    const historySnap = await getDocs(qHistory);

                    let userTotal = 0;
                    let playedCount = 0;

                    historySnap.forEach(h => {
                        const hData = h.data();
                        // Check if this history entry belongs to one of the event quizzes
                        const match = quizzesTitles.some(title =>
                            (hData.taskTitle && hData.taskTitle.includes(title)) ||
                            (hData.reason && hData.reason.includes(title))
                        );

                        if (match) {
                            userTotal += (hData.amount || 0);
                            playedCount++;
                        }
                    });

                    if (userTotal > 0) {
                        leaderboard.push({
                            userId: reg.userId,
                            userName: reg.userDisplayName || "Usuário",
                            baseName: reg.baseName || "Base",
                            totalScore: userTotal,
                            quizzesPlayed: playedCount
                        });
                    }
                } catch (err) {
                    console.error(`Error processing user ${reg.userId}`, err);
                }
            });

            await Promise.all(promises);

            // Sort DESC
            leaderboard.sort((a, b) => b.totalScore - a.totalScore);
            setRanking(leaderboard);
            setLastUpdated(new Date());

        } catch (error) {
            console.error("Error generating ranking:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRanking();
        // Auto-refresh every 60s
        const interval = setInterval(fetchRanking, 60000);
        return () => clearInterval(interval);
    }, [eventId]);

    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-purple-500/30">
            {/* Navbar / Header */}
            <div className="fixed top-0 left-0 w-full p-4 z-50 flex justify-between items-center bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full w-12 h-12 p-0">
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight">{eventTitle}</h1>
                        <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">Ranking Oficial</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] uppercase font-bold text-white/30">Participantes</p>
                        <p className="font-mono text-sm text-purple-400">{ranking.length}</p>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] uppercase font-bold text-white/30">Última atualização</p>
                        <p className="font-mono text-sm">{lastUpdated?.toLocaleTimeString()}</p>
                    </div>
                    <Button
                        onClick={fetchRanking}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/40"
                    >
                        <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-24 pb-20 px-4 md:px-8 max-w-7xl mx-auto">

                {/* Podium Top 3 */}
                {ranking.length > 0 && (
                    <div className="flex flex-col md:flex-row items-end justify-center mb-16 gap-4 md:gap-8 mt-8">
                        {/* 2nd Place */}
                        {ranking[1] && (
                            <div className="order-2 md:order-1 flex-1 max-w-xs w-full flex flex-col items-center animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                                <div className="w-24 h-24 rounded-full border-4 border-gray-300 bg-gray-800 shadow-xl mb-4 flex items-center justify-center overflow-hidden relative">
                                    <span className="text-3xl font-black text-gray-500">{ranking[1].userName.charAt(0)}</span>
                                </div>
                                <div className="text-center mb-4">
                                    <h3 className="font-bold text-lg leading-tight truncate w-full">{ranking[1].userName}</h3>
                                    <span className="text-xs font-bold text-gray-400 uppercase">{ranking[1].baseName}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-gray-400 to-gray-300 h-40 rounded-t-[32px] flex items-end justify-center pb-4 shadow-[0_0_40px_rgba(255,255,255,0.1)] relative overflow-hidden">
                                    <span className="text-6xl font-black text-white/20 absolute -top-4">2</span>
                                    <div className="text-center z-10">
                                        <span className="block text-4xl font-black text-gray-900 tabular-nums">{ranking[1].totalScore}</span>
                                        <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">XP Total</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {ranking[0] && (
                            <div className="order-1 md:order-2 flex-1 max-w-xs w-full flex flex-col items-center animate-fade-in-up z-10">
                                <div className="relative mb-6">
                                    <Trophy size={64} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-bounce-slow" />
                                    <div className="absolute inset-0 bg-yellow-500/20 blur-3xl -z-10 rounded-full" />
                                </div>

                                <div className="w-32 h-32 rounded-full border-4 border-yellow-400 bg-yellow-900/50 shadow-2xl mb-4 flex items-center justify-center overflow-hidden relative ring-4 ring-yellow-400/20">
                                    <span className="text-4xl font-black text-yellow-200">{ranking[0].userName.charAt(0)}</span>
                                </div>
                                <div className="text-center mb-6">
                                    <h3 className="font-black text-2xl leading-tight truncate w-full bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">{ranking[0].userName}</h3>
                                    <span className="text-sm font-bold text-yellow-500/80 uppercase">{ranking[0].baseName}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300 h-56 rounded-t-[40px] flex items-end justify-center pb-6 shadow-[0_0_60px_rgba(234,179,8,0.3)] relative overflow-hidden">
                                    <div className="absolute inset-x-0 top-0 h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
                                    <span className="text-8xl font-black text-white/20 absolute -top-6">1</span>
                                    <div className="text-center z-10">
                                        <span className="block text-5xl font-black text-yellow-950 tabular-nums">{ranking[0].totalScore}</span>
                                        <span className="text-xs font-black text-yellow-900 uppercase tracking-widest">XP Total</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {ranking[2] && (
                            <div className="order-3 md:order-3 flex-1 max-w-xs w-full flex flex-col items-center animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                                <div className="w-24 h-24 rounded-full border-4 border-orange-400 bg-orange-900/30 shadow-xl mb-4 flex items-center justify-center overflow-hidden relative">
                                    <span className="text-3xl font-black text-orange-400">{ranking[2].userName.charAt(0)}</span>
                                </div>
                                <div className="text-center mb-4">
                                    <h3 className="font-bold text-lg leading-tight truncate w-full">{ranking[2].userName}</h3>
                                    <span className="text-xs font-bold text-orange-400 uppercase">{ranking[2].baseName}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-orange-500 to-orange-400 h-32 rounded-t-[32px] flex items-end justify-center pb-4 shadow-[0_0_40px_rgba(249,115,22,0.1)] relative overflow-hidden">
                                    <span className="text-6xl font-black text-white/20 absolute -top-4">3</span>
                                    <div className="text-center z-10">
                                        <span className="block text-4xl font-black text-orange-950 tabular-nums">{ranking[2].totalScore}</span>
                                        <span className="text-[10px] font-black text-orange-900 uppercase tracking-widest">XP Total</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* List Remainder */}
                <div className="space-y-3 max-w-3xl mx-auto">
                    {ranking.slice(3).map((item, idx) => (
                        <div key={item.userId}
                            className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all animate-fade-in"
                            style={{ animationDelay: `${(idx * 50) + 500}ms` }}
                        >
                            <div className="flex items-center gap-6">
                                <span className="font-black text-xl text-white/30 w-8 text-center">{idx + 4}º</span>
                                <div>
                                    <p className="font-bold text-lg text-white">{item.userName}</p>
                                    <p className="text-xs font-bold text-white/40 uppercase">{item.baseName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <span className="block font-black text-2xl text-purple-400 tabular-nums">{item.totalScore}</span>
                                    <span className="text-[10px] text-purple-400/50 uppercase tracking-widest">XP</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {ranking.length === 0 && !loading && (
                        <div className="text-center py-20 opacity-50">
                            <h2 className="text-2xl font-bold">Ainda não há pontuações registradas.</h2>
                        </div>
                    )}

                    {loading && ranking.length === 0 && (
                        <div className="text-center py-20 text-white/50 animate-pulse">
                            Carregando dados do evento...
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
