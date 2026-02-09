"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { db } from "@/services/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Trophy, ArrowLeft, RefreshCw, Search, Medal, Crown } from "lucide-react";
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
            const linkedQuizIds = eventData.linkedQuizzes || [];

            if (linkedQuizIds.length === 0) {
                setRanking([]);
                setLoading(false);
                return;
            }

            // 2. Get Quiz Titles
            const quizzesTitles: string[] = [];
            for (const qId of linkedQuizIds) {
                const qDoc = await getDoc(doc(db, "master_quizzes", qId));
                if (qDoc.exists()) {
                    quizzesTitles.push(qDoc.data().title);
                }
            }

            // 3. Get Registered Users
            // Fetch registrations to know WHO is in the event
            const regsSnap = await getDocs(query(collection(db, "event_registrations"), where("eventId", "==", eventId)));
            const registrations = regsSnap.docs.map(d => d.data());

            // 4. Calculate Scores
            const leaderboard: RankingEntry[] = [];

            // We need to fetch User Doc to get Classification/Level/Photo if not in registration
            // To avoid N reads, let's fetch all users? or just rely on what we can get?
            // "event_registrations" *should* have snapshot of user data usually.
            // Let's assume standard registration object has keys. If missing, we might show defaults.
            // Actually, for "Level" and "Photo", we usually need the live user doc.
            // optimization: Fetch ALL users once? 
            // If event has 500 people, 500 reads is okay-ish for a manual refresh button.
            // But let's try to be smart. 

            const promises = registrations.map(async (reg: any) => {
                try {
                    // Fetch recent history
                    const historyRef = collection(db, "users", reg.userId, "xp_history");
                    const qHistory = query(historyRef, where("type", "==", "quiz"));
                    const historySnap = await getDocs(qHistory);

                    let userTotal = 0;
                    let playedCount = 0;

                    historySnap.forEach(h => {
                        const hData = h.data();
                        const match = quizzesTitles.some(title =>
                            (hData.taskTitle && hData.taskTitle.includes(title)) ||
                            (hData.reason && hData.reason.includes(title))
                        );
                        if (match) {
                            userTotal += (hData.amount || 0);
                            playedCount++;
                        }
                    });

                    // Fetch User Details for UI (Level, Photo, Classification)
                    // We can optimize by strictly reading what we need or cache. 
                    // For now, individual read.
                    let userPhoto = reg.userPhoto;
                    let level = 1;
                    let classification = reg.classification;
                    let districtId = reg.districtId;
                    let districtName = ""; // We can look this up from 'districts' hook later using ID

                    try {
                        const uDoc = await getDoc(doc(db, "users", reg.userId));
                        if (uDoc.exists()) {
                            const uData = uDoc.data();
                            userPhoto = uData.photoURL || userPhoto;
                            level = uData.stats?.level || 1;
                            classification = uData.classification || classification;
                            districtId = uData.districtId || districtId;
                        }
                    } catch (e) { }

                    if (userTotal > 0) {
                        leaderboard.push({
                            userId: reg.userId,
                            userName: reg.userDisplayName || "Usuário",
                            userPhoto,
                            baseName: reg.baseName || "Base",
                            baseId: reg.baseId,
                            districtId: districtId,
                            districtName: "", // Fill later
                            classification: classification,
                            level: level,
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

        if (filterClassification !== "all") {
            filtered = filtered.filter(u => (u.classification || 'pre-adolescente') === filterClassification);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(u => u.userName.toLowerCase().includes(lower));
        }

        return filtered;
    }, [ranking, filterDistrict, filterBase, filterClassification, searchTerm]);

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

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Navbar / Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.back()} className="rounded-full w-10 h-10 p-0 text-gray-500">
                            <ArrowLeft size={24} />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800 leading-tight">{eventTitle}</h1>
                            <p className="text-xs text-primary font-bold uppercase tracking-widest">Ranking Oficial do Evento</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-[10px] uppercase font-bold text-gray-400">Participantes</p>
                            <p className="font-mono text-sm font-bold text-gray-700">{ranking.length}</p>
                        </div>
                        <Button
                            onClick={fetchRanking}
                            disabled={loading}
                            className="bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg shadow-primary/20"
                        >
                            <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="py-8 px-4 md:px-8 max-w-7xl mx-auto space-y-8">

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center animate-fade-in">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            placeholder="Buscar adolescente..."
                            className="pl-10 w-full bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <select
                            className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-600 outline-none min-w-[140px]"
                            value={filterDistrict}
                            onChange={e => setFilterDistrict(e.target.value)}
                        >
                            <option value="all">Todos Distritos</option>
                            {districts?.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        <select
                            className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-600 outline-none min-w-[140px]"
                            value={filterBase}
                            onChange={e => setFilterBase(e.target.value)}
                        >
                            <option value="all">Todas Bases</option>
                            {bases?.filter(b => filterDistrict === 'all' || b.districtId === filterDistrict).map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>

                        <select
                            className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-600 outline-none min-w-[140px]"
                            value={filterClassification}
                            onChange={e => setFilterClassification(e.target.value)}
                        >
                            <option value="all">Classificações</option>
                            <option value="pre-adolescente">Pre-adolescente</option>
                            <option value="adolescente">Adolescente</option>
                        </select>
                    </div>
                </div>

                {/* Podium Top 3 */}
                {filteredRanking.length >= 3 && !searchTerm && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 transform md:scale-95">
                        {/* 2nd Place */}
                        <div className="order-2 md:order-1 bg-white rounded-2xl p-6 shadow-sm border-t-4 border-gray-300 flex flex-col items-center mt-8">
                            <div className="relative mb-4">
                                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 overflow-hidden border-4 border-gray-200">
                                    {filteredRanking[1].userPhoto ? (
                                        <img src={filteredRanking[1].userPhoto} className="w-full h-full object-cover" />
                                    ) : (filteredRanking[1].userName?.[0] || "U")}
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                    #2
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 text-center truncate w-full">{filteredRanking[1].userName}</h3>
                            <p className="text-xs text-gray-500 mb-2">{getBaseName(filteredRanking[1].baseId)}</p>
                            <div className="text-2xl font-black text-gray-400">{filteredRanking[1].totalScore} Pontos</div>
                        </div>

                        {/* 1st Place */}
                        <div className="order-1 md:order-2 bg-gradient-to-b from-yellow-50 to-white rounded-2xl p-8 shadow-md border-t-4 border-yellow-400 flex flex-col items-center transform scale-105 z-10">
                            <div className="relative mb-4">
                                <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 fill-yellow-500 animate-bounce" size={32} />
                                <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center text-2xl font-bold text-yellow-600 overflow-hidden border-4 border-yellow-300 shadow-lg">
                                    {filteredRanking[0].userPhoto ? (
                                        <img src={filteredRanking[0].userPhoto} className="w-full h-full object-cover" />
                                    ) : (filteredRanking[0].userName?.[0] || "U")}
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-sm font-bold px-4 py-1 rounded-full shadow-md">
                                    #1
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 text-center truncate w-full">{filteredRanking[0].userName}</h3>
                            <p className="text-sm text-gray-500 mb-2">{getBaseName(filteredRanking[0].baseId)}</p>
                            <div className="text-3xl font-black text-yellow-500">{filteredRanking[0].totalScore} Pontos</div>
                        </div>

                        {/* 3rd Place */}
                        <div className="order-3 bg-white rounded-2xl p-6 shadow-sm border-t-4 border-amber-600 flex flex-col items-center mt-12">
                            <div className="relative mb-4">
                                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center text-xl font-bold text-amber-700 overflow-hidden border-4 border-amber-200">
                                    {filteredRanking[2].userPhoto ? (
                                        <img src={filteredRanking[2].userPhoto} className="w-full h-full object-cover" />
                                    ) : (filteredRanking[2].userName?.[0] || "U")}
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                    #3
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 text-center truncate w-full">{filteredRanking[2].userName}</h3>
                            <p className="text-xs text-gray-500 mb-2">{getBaseName(filteredRanking[2].baseId)}</p>
                            <div className="text-2xl font-black text-amber-700">{filteredRanking[2].totalScore} Pontos</div>
                        </div>
                    </div>
                )}

                {/* List Remainder */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100 text-left">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase w-16 text-center">#</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase">Adolescente</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Base / Distrito</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-center">Nível</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Pontos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando ranking...</td></tr>
                            ) : filteredRanking.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum resultado encontrado.</td></tr>
                            ) : (
                                filteredRanking.map((user, index) => (
                                    <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-center">
                                            {index < 3 && !searchTerm ? (
                                                <Medal className={clsx("mx-auto", getMedalColor(index))} size={24} />
                                            ) : (
                                                <span className="font-bold text-gray-400 text-lg">{index + 1}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-primary font-bold overflow-hidden border border-gray-200">
                                                    {user.userPhoto ? (
                                                        <img src={user.userPhoto} alt={user.userName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (user.userName?.[0] || "U").toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{user.userName}</div>
                                                    <div className="text-xs text-gray-400 md:hidden">{getBaseName(user.baseId)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-700">{getBaseName(user.baseId)}</span>
                                                <span className="text-xs text-gray-400">{getDistrictName(user.districtId)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Lvl {user.level || 1}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-primary text-lg">
                                            {user.totalScore}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
