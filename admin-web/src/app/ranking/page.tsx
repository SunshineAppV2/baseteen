"use client";

import { useState, useMemo, useEffect } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { where } from "firebase/firestore";
import {
    Trophy,
    Medal,
    Crown,
    Search,
    Filter,
    MapPin,
    User
} from "lucide-react";
import { clsx } from "clsx";
import PointHistoryModal from "./PointHistoryModal";

// ... interfaces ...

interface District {
    id: string;
    name: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
}

interface UserData {
    id: string;
    displayName: string;
    photoURL?: string;
    email: string;
    role: string;
    baseId?: string;
    districtId?: string;
    classification?: 'pre-adolescente' | 'adolescente';
    participatesInRanking?: boolean;
    stats?: { // Gamification Stats
        level: number;
        currentXp: number;
    };
}

export default function RankingPage() {
    const { user: currentUser } = useAuth();

    // Constraints for Firestore Queries (avoid permission errors)
    const userConstraints = useMemo(() => {
        if (currentUser?.role === 'coord_base' && currentUser.baseId) {
            return [where('baseId', '==', currentUser.baseId)];
        } else if (currentUser?.role === 'coord_distrital' && currentUser.districtId) {
            return [where('districtId', '==', currentUser.districtId)];
        }
        return [];
    }, [currentUser]);

    // Using useCollection with constraints implies dependencies on constraints
    // Assuming useCollection handles array dependencies or we need memo
    const { data: users, loading: loadingUsers } = useCollection<UserData>("users", userConstraints);
    const { data: districts } = useCollection<District>("districts");
    const { data: bases } = useCollection<Base>("bases");

    const [filterDistrict, setFilterDistrict] = useState("all");
    const [filterBase, setFilterBase] = useState("all");
    const [filterClassification, setFilterClassification] = useState("all");

    // Effect to enforce scope
    useEffect(() => {
        if (currentUser?.role === 'coord_distrital' && currentUser.districtId) {
            setFilterDistrict(currentUser.districtId);
        }
        if (currentUser?.role === 'coord_base' && currentUser.baseId) {
            // Find district of this base to set district filter too, or just set base
            // Setting base is enough if the logic handles it.
            setFilterBase(currentUser.baseId);
        }
    }, [currentUser]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUserForHistory, setSelectedUserForHistory] = useState<UserData | null>(null);

    const canSeeHistory = (targetUserId: string) => {
        if (!currentUser) return false;
        if (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'coord_distrital' || currentUser.role === 'coord_base') {
            return true;
        }
        return currentUser.uid === targetUserId;
    };

    // Process Ranking
    const rankedUsers = useMemo(() => {
        if (!users) return [];

        let filtered = users.filter(u => {
            // 1. Explicit Opt-out
            if (u.participatesInRanking === false) return false;

            // 2. Explicit Opt-in (e.g. Coordinators who want to participate)
            if (u.participatesInRanking === true) return true;

            // 3. Default (Backwards Compatibility)
            // Members default to TRUE, others default to FALSE
            return u.role === 'membro';
        });

        // Filters
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
            filtered = filtered.filter(u =>
                u.displayName?.toLowerCase().includes(lower) ||
                u.email?.toLowerCase().includes(lower)
            );
        }

        // Sort by XP
        return filtered.sort((a, b) => {
            const xpA = a.stats?.currentXp || 0;
            const xpB = b.stats?.currentXp || 0;
            return xpB - xpA; // Descending
        });
    }, [users, filterDistrict, filterBase, searchTerm]);

    const getDistrictName = (id?: string) => districts?.find(d => d.id === id)?.name || "-";
    const getBaseName = (id?: string) => bases?.find(b => b.id === id)?.name || "-";

    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return "text-yellow-500";
            case 1: return "text-gray-400";
            case 2: return "text-amber-700";
            default: return "text-gray-400";
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-3">
                        <Trophy className="text-yellow-500" /> Ranking
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Acompanhe o desempenho e XP dos adolescentes. Clique em um card para ver detalhes.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        placeholder="Buscar adolescente..."
                        className="pl-10 w-full bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500/20 text-sm font-medium text-gray-600"
                        value={filterDistrict}
                        onChange={e => setFilterDistrict(e.target.value)}
                    >
                        <option value="all">Todos Distritos</option>
                        {districts?.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>

                    <select
                        className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500/20 text-sm font-medium text-gray-600"
                        value={filterBase}
                        onChange={e => setFilterBase(e.target.value)}
                    >
                        <option value="all">Todas Bases</option>
                        {bases?.filter(b => filterDistrict === 'all' || b.districtId === filterDistrict).map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <select
                        className="bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500/20 text-sm font-medium text-gray-600"
                        value={filterClassification}
                        onChange={e => setFilterClassification(e.target.value)}
                    >
                        <option value="all">Classificações</option>
                        <option value="pre-adolescente">Pre-adolescente</option>
                        <option value="adolescente">Adolescente</option>
                    </select>
                </div>
            </div>

            {/* Top 3 Podium (Visible only if filtered/searched returns enough data) */}
            {rankedUsers.length >= 3 && !searchTerm && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 transform md:scale-95">
                    {/* 2nd Place */}
                    <div
                        onClick={() => canSeeHistory(rankedUsers[1].id) && setSelectedUserForHistory(rankedUsers[1])}
                        className={clsx(
                            "order-2 md:order-1 bg-white rounded-2xl p-6 shadow-sm border-t-4 border-gray-300 flex flex-col items-center mt-8 transition-all active:scale-95",
                            canSeeHistory(rankedUsers[1].id) ? "cursor-pointer hover:shadow-lg" : "cursor-default"
                        )}
                    >
                        <div className="relative mb-4">
                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 overflow-hidden border-4 border-gray-200">
                                {rankedUsers[1].photoURL ? (
                                    <img src={rankedUsers[1].photoURL} className="w-full h-full object-cover" />
                                ) : (rankedUsers[1].displayName?.[0] || "U")}
                            </div>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                #2
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-800 text-center truncate w-full">{rankedUsers[1].displayName}</h3>
                        <p className="text-xs text-gray-500 mb-2">{getBaseName(rankedUsers[1].baseId)}</p>
                        <div className="text-2xl font-black text-gray-400">{rankedUsers[1].stats?.currentXp || 0} XP</div>
                    </div>

                    {/* 1st Place */}
                    <div
                        onClick={() => canSeeHistory(rankedUsers[0].id) && setSelectedUserForHistory(rankedUsers[0])}
                        className={clsx(
                            "order-1 md:order-2 bg-gradient-to-b from-yellow-50 to-white rounded-2xl p-8 shadow-md border-t-4 border-yellow-400 flex flex-col items-center transform scale-105 z-10 transition-all active:scale-100",
                            canSeeHistory(rankedUsers[0].id) ? "cursor-pointer hover:shadow-xl" : "cursor-default"
                        )}
                    >
                        <div className="relative mb-4">
                            <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 fill-yellow-500 animate-bounce" size={32} />
                            <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center text-2xl font-bold text-yellow-600 overflow-hidden border-4 border-yellow-300 shadow-lg">
                                {rankedUsers[0].photoURL ? (
                                    <img src={rankedUsers[0].photoURL} className="w-full h-full object-cover" />
                                ) : (rankedUsers[0].displayName?.[0] || "U")}
                            </div>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-sm font-bold px-4 py-1 rounded-full shadow-md">
                                #1
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 text-center truncate w-full">{rankedUsers[0].displayName}</h3>
                        <p className="text-sm text-gray-500 mb-2">{getBaseName(rankedUsers[0].baseId)}</p>
                        <div className="text-3xl font-black text-yellow-500">{rankedUsers[0].stats?.currentXp || 0} XP</div>
                    </div>

                    {/* 3rd Place */}
                    <div
                        onClick={() => canSeeHistory(rankedUsers[2].id) && setSelectedUserForHistory(rankedUsers[2])}
                        className={clsx(
                            "order-3 bg-white rounded-2xl p-6 shadow-sm border-t-4 border-amber-600 flex flex-col items-center mt-12 transition-all active:scale-95",
                            canSeeHistory(rankedUsers[2].id) ? "cursor-pointer hover:shadow-lg" : "cursor-default"
                        )}
                    >
                        <div className="relative mb-4">
                            <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center text-xl font-bold text-amber-700 overflow-hidden border-4 border-amber-200">
                                {rankedUsers[2].photoURL ? (
                                    <img src={rankedUsers[2].photoURL} className="w-full h-full object-cover" />
                                ) : (rankedUsers[2].displayName?.[0] || "U")}
                            </div>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                #3
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-800 text-center truncate w-full">{rankedUsers[2].displayName}</h3>
                        <p className="text-xs text-gray-500 mb-2">{getBaseName(rankedUsers[2].baseId)}</p>
                        <div className="text-2xl font-black text-amber-700">{rankedUsers[2].stats?.currentXp || 0} XP</div>
                    </div>
                </div>
            )}

            {/* Full List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100 text-left">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase w-16 text-center">#</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase">Adolescente</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Base / Distrito</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-center">Nível</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">XP Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loadingUsers ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400">Carregando ranking...</td>
                            </tr>
                        ) : rankedUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400">Nenhum membro encontrado com XP.</td>
                            </tr>
                        ) : (
                            rankedUsers.map((user, index) => (
                                <tr
                                    key={user.id}
                                    className={clsx(
                                        "transition-colors",
                                        canSeeHistory(user.id) ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                                    )}
                                    onClick={() => canSeeHistory(user.id) && setSelectedUserForHistory(user)}
                                >
                                    <td className="p-4 text-center">
                                        {index < 3 ? (
                                            <Medal className={clsx("mx-auto", getMedalColor(index))} size={24} />
                                        ) : (
                                            <span className="font-bold text-gray-400 text-lg">{index + 1}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-primary font-bold overflow-hidden border border-gray-200">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    (user.displayName?.[0] || "U").toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800">{user.displayName}</div>
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
                                            Lvl {user.stats?.level || 1}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-primary text-lg">
                                        {user.stats?.currentXp || 0}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedUserForHistory && (
                <PointHistoryModal
                    userId={selectedUserForHistory.id}
                    userName={selectedUserForHistory.displayName}
                    onClose={() => setSelectedUserForHistory(null)}
                />
            )}
        </div>
    );
}
