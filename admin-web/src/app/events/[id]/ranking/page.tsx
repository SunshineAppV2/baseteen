"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { db } from "@/services/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Trophy, ArrowLeft, RefreshCw, Search, Medal, Crown, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

interface RankingEntry {
    userId: string;
    userName: string;
    userPhoto?: string;
    baseName: string;
    baseId: string;
    districtName?: string;
    districtId?: string;
    classification?: string;
    level?: number;
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
    const [targetType, setTargetType] = useState<'individual' | 'base'>('individual');

    // Lookups for Filters
    const { data: districts } = useCollection<any>("districts");
    const { data: bases } = useCollection<any>("bases");

    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDistrict, setFilterDistrict] = useState("all");
    const [filterBase, setFilterBase] = useState("all");
    const [filterClassification, setFilterClassification] = useState("all");

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
            const type = eventData.targetType || 'individual';
            const regType = eventData.registrationType || 'individual';
            setTargetType(type);

            const linkedQuizIds = eventData.linkedQuizzes || [];

            if (linkedQuizIds.length === 0) {
                setRanking([]);
                setLoading(false);
                return;
            }

            // 2. Get Quiz Titles
            // This part is no longer strictly needed if we match by quizId directly
            // but keeping it for potential future use or if quizId isn't always present in history
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

            // 4. Calculate Individual Scores first
            let individualRanking: RankingEntry[] = [];

            const promises = registrations.map(async (reg: any) => {
                try {
                    // Fetch recent history
                    const historyRef = collection(db, "users", reg.userId, "xp_history");
                    const qHistory = query(historyRef, where("type", "==", "quiz"));
                    const historySnap = await getDocs(qHistory);

                    let userTotal = 0;
                    let playedCount = 0;

                    historySnap.forEach(h => {
                        const d = h.data();
                        // Check if quizId is in linked list
                        // Some history items store quizId, ensuring it matches
                        if (linkedQuizIds.includes(d.quizId)) {
                            userTotal += (d.amount || 0);
                            playedCount++;
                        }
                    });

                    // Only include if played at least one? Or include all with 0?
                    // Include all for now

                    // Fetch User Details for UI (Photo, Level)
                    let userPhoto = undefined;
                    let level = 1;
                    let classification = 'pre-adolescente'; // default

                    const uSnap = await getDoc(doc(db, "users", reg.userId));
                    if (uSnap.exists()) {
                        const uData = uSnap.data();
                        userPhoto = uData.photoURL;
                        level = uData.level || 1;
                        classification = uData.classification || 'pre-adolescente';
                    }

                    return {
                        userId: reg.userId,
                        userName: reg.userName || "Usuário",
                        userPhoto,
                        baseName: reg.baseName || "Base",
                        baseId: reg.baseId,
                        districtName: reg.districtName,
                        districtId: reg.districtId,
                        classification,
                        level,
                        totalScore: userTotal,
                        quizzesPlayed: playedCount
                    } as RankingEntry;

                } catch (e) {
                    console.error("Error calc user score", reg.userId, e);
                    return null;
                }
            });

            const results = await Promise.all(promises);
            individualRanking = results.filter(r => r !== null) as RankingEntry[];

            // 5. Aggregate if Base Ranking
            if (type === 'base') {
                const baseMap = new Map<string, RankingEntry>();

                // Helper to initialize or get base entry
                const getOrCreateBase = (baseId: string, name: string, districtId?: string, districtName?: string) => {
                    if (!baseMap.has(baseId)) {
                        baseMap.set(baseId, {
                            userId: baseId, // use baseId as key
                            userName: name || "Base",
                            baseName: name || "Base",
                            baseId: baseId,
                            districtId: districtId,
                            districtName: districtName,
                            userPhoto: undefined,
                            level: undefined,
                            classification: undefined,
                            totalScore: 0,
                            quizzesPlayed: 0
                        });
                    }
                    return baseMap.get(baseId)!;
                };

                if (regType === 'base') {
                    // --- DIRECT BASE PARTICIPATION ---
                    // 1. Identify Registered Bases
                    // Filter event_registrations where type is implicit (userId is coordinator) BUT we want unique bases
                    registrations.forEach(r => {
                        if (r.baseId) {
                            // Fetch base name if not present (optimization: rely on reg data)
                            getOrCreateBase(r.baseId, r.baseName || "Base", r.districtId, r.districtName);
                        }
                    });

                    // 2. Fetch Base Submissions (Tasks) and Sum Points
                    const subsRef = collection(db, "base_submissions");
                    const qSubs = query(subsRef, where("eventId", "==", eventId), where("status", "==", "approved"));
                    const subsSnap = await getDocs(qSubs);

                    subsSnap.forEach(doc => {
                        const sub = doc.data();
                        if (sub.baseId) {
                            // Ensure base is in map (even if not registered? Logic: Yes, if they submitted and approved, they count)
                            // But usually they must be registered to submit.
                            const entry = getOrCreateBase(sub.baseId, sub.baseName, sub.districtId);
                            entry.totalScore += (sub.xpReward || 0);
                        }
                    });

                } else {
                    // --- MEMBER AGGREGATION (EXISTING LOGIC) ---
                    individualRanking.forEach(u => {
                        const existing = baseMap.get(u.baseId);
                        if (existing) {
                            existing.totalScore += u.totalScore;
                            existing.quizzesPlayed += u.quizzesPlayed;
                        } else {
                            baseMap.set(u.baseId, {
                                ...u,
                                userId: u.baseId, // use baseId as key
                                userName: u.baseName, // Display Base Name
                                userPhoto: undefined,
                                level: undefined,
                                classification: undefined
                            });
                        }
                    });
                }

                setRanking(Array.from(baseMap.values()).sort((a, b) => b.totalScore - a.totalScore));
            } else {
                setRanking(individualRanking.sort((a, b) => b.totalScore - a.totalScore));
            }

            setLastUpdated(new Date());

        } catch (err) {
            console.error("Err ranking", err);
            alert("Erro ao carregar ranking");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRanking();
    }, [eventId]);

    // Derived State for Filtering
    const filteredRanking = useMemo(() => {
        let filtered = [...ranking];

        if (filterDistrict !== "all") {
            filtered = filtered.filter(u => u.districtId === filterDistrict);
        }

        if (filterBase !== "all") {
            filtered = filtered.filter(u => u.baseId === filterBase);
        }

        if (targetType === 'individual' && filterClassification !== "all") {
            filtered = filtered.filter(u => (u.classification || 'pre-adolescente') === filterClassification);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(u => u.userName.toLowerCase().includes(lower));
        }

        return filtered;
    }, [ranking, filterDistrict, filterBase, filterClassification, searchTerm, targetType]);

    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return "text-yellow-500";
            case 1: return "text-gray-400";
            case 2: return "text-amber-700";
            default: return "text-gray-400";
        }
    };

    // Helper to get Names
    const getDistrictName = (id?: string) => districts?.find(d => d.id === id)?.name || "-";
    const getBaseName = (id?: string) => bases?.find(b => b.id === id)?.name || "-";

    const podium = filteredRanking.slice(0, 3);
    const list = filteredRanking.slice(3);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 safe-top">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" className="h-10 w-10 p-0" onClick={() => router.back()}>
                            <ArrowLeft size={24} className="text-gray-600" />
                        </Button>
                        <div>
                            <h1 className="font-bold text-lg text-gray-900 leading-tight uppercase">
                                {eventTitle}
                            </h1>
                            <p className="text-xs text-blue-600 font-bold tracking-wider">
                                {targetType === 'base' ? 'RANKING POR BASE' : 'RANKING OFICIAL DO EVENTO'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Participantes</p>
                            <p className="text-lg font-black text-gray-900 leading-none">{filteredRanking.length}</p>
                        </div>
                        <Button onClick={fetchRanking} className="h-10 w-10 p-0 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center">
                            <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder={targetType === 'base' ? "Buscar base..." : "Buscar adolescente..."}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-primary/20 rounded-xl font-medium text-gray-900 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        <select
                            className="px-4 py-3 rounded-xl bg-gray-50 text-sm font-bold text-gray-600 focus:text-primary outline-none cursor-pointer min-w-[140px]"
                            value={filterDistrict}
                            onChange={e => setFilterDistrict(e.target.value)}
                        >
                            <option value="all">Todos Distritos</option>
                            {districts?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>

                        <select
                            className="px-4 py-3 rounded-xl bg-gray-50 text-sm font-bold text-gray-600 focus:text-primary outline-none cursor-pointer min-w-[140px]"
                            value={filterBase}
                            onChange={e => setFilterBase(e.target.value)}
                        >
                            <option value="all">Todas Bases</option>
                            {bases?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>

                        {targetType === 'individual' && (
                            <select
                                className="px-4 py-3 rounded-xl bg-gray-50 text-sm font-bold text-gray-600 focus:text-primary outline-none cursor-pointer min-w-[140px]"
                                value={filterClassification}
                                onChange={e => setFilterClassification(e.target.value)}
                            >
                                <option value="all">Classificações</option>
                                <option value="pre-adolescente">Pré-Adolescentes</option>
                                <option value="adolescente">Adolescentes</option>
                            </select>
                        )}
                    </div>
                </div>

                {/* Podium */}
                {podium.length > 0 && (
                    <div className="relative pt-10 pb-4">
                        <div className="flex justify-center items-end gap-2 sm:gap-6">
                            {/* Silver */}
                            {podium[1] && (
                                <div className="flex flex-col items-center gap-3 w-1/3 sm:w-32 order-1">
                                    <div className="relative">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-gray-300 shadow-xl overflow-hidden bg-white">
                                            {targetType === 'individual' && podium[1].userPhoto ? (
                                                <img src={podium[1].userPhoto} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                    {targetType === 'base' ? <Users size={32} /> : <span className="text-2xl font-black">{podium[1].userName[0]}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-300 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-md">
                                            2º
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-gray-900 text-sm line-clamp-1">{podium[1].userName}</p>
                                        <p className="text-xs text-gray-500 font-medium">{podium[1].baseName}</p>
                                        <div className="mt-1 bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black text-gray-600 inline-block">
                                            {podium[1].totalScore} pts
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Gold */}
                            {podium[0] && (
                                <div className="flex flex-col items-center gap-3 w-1/3 sm:w-40 order-2 -mt-10 z-10">
                                    <div className="relative">
                                        <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 fill-yellow-500 animate-bounce" size={32} />
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 shadow-2xl shadow-yellow-400/30 overflow-hidden bg-white">
                                            {targetType === 'individual' && podium[0].userPhoto ? (
                                                <img src={podium[0].userPhoto} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-yellow-50 text-yellow-500">
                                                    {targetType === 'base' ? <Users size={40} /> : <span className="text-4xl font-black">{podium[0].userName[0]}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-sm font-black px-3 py-0.5 rounded-full shadow-lg">
                                            1º
                                        </div>
                                    </div>
                                    <div className="text-center scale-110 origin-top">
                                        <p className="font-bold text-gray-900 text-base line-clamp-1">{podium[0].userName}</p>
                                        <p className="text-xs text-gray-500 font-medium">{podium[0].baseName}</p>
                                        <div className="mt-1 bg-yellow-50 px-3 py-1 rounded text-xs font-black text-yellow-600 inline-block">
                                            {podium[0].totalScore} pts
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bronze */}
                            {podium[2] && (
                                <div className="flex flex-col items-center gap-3 w-1/3 sm:w-32 order-3">
                                    <div className="relative">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-orange-300 shadow-xl overflow-hidden bg-white">
                                            {targetType === 'individual' && podium[2].userPhoto ? (
                                                <img src={podium[2].userPhoto} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                    {targetType === 'base' ? <Users size={32} /> : <span className="text-2xl font-black">{podium[2].userName[0]}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-300 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-md">
                                            3º
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-gray-900 text-sm line-clamp-1">{podium[2].userName}</p>
                                        <p className="text-xs text-gray-500 font-medium">{podium[2].baseName}</p>
                                        <div className="mt-1 bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black text-gray-600 inline-block">
                                            {podium[2].totalScore} pts
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest w-16">#</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {targetType === 'base' ? 'Base' : 'Adolescente'}
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {targetType === 'base' ? 'Distrito' : 'Base / Distrito'}
                                    </th>
                                    {targetType === 'individual' && (
                                        <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nível</th>
                                    )}
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pontos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {list.length === 0 && podium.length === 0 ? (
                                    <tr>
                                        <td colSpan={targetType === 'base' ? 4 : 5} className="px-6 py-12 text-center text-gray-400 font-medium text-sm">
                                            Nenhum resultado encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    list.map((entry, i) => (
                                        <tr key={entry.userId} className="hover:bg-gray-50 transition-colors cursor-default group">
                                            <td className="px-6 py-4">
                                                <span className="font-black text-gray-300 group-hover:text-primary transition-colors">
                                                    {i + 4}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {targetType === 'individual' && entry.userPhoto ? (
                                                        <img src={entry.userPhoto} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {targetType === 'base' ? <Users size={14} /> : entry.userName[0]}
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-gray-700 text-sm">{entry.userName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    {targetType === 'individual' && (
                                                        <span className="font-bold text-gray-600 text-xs">{entry.baseName}</span>
                                                    )}
                                                    <span className="font-medium text-gray-400 text-[10px] uppercase tracking-wide">
                                                        {entry.districtName || "Sem Distrito"}
                                                    </span>
                                                </div>
                                            </td>
                                            {targetType === 'individual' && (
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-black">
                                                        {entry.level}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-gray-900">{entry.totalScore}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
