"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";
import { where } from "firebase/firestore";
import { Trophy, Medal, Award, Search, Star } from "lucide-react";

interface Base {
    id: string;
    name: string;
    districtId: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
    totalXp?: number;
    completedTasks?: number;
}

interface District {
    id: string;
    name: string;
}

interface Task {
    id: string;
    points: number;
    isBaseCollective?: boolean;
}

interface BaseSubmission {
    id: string;
    baseId: string;
    xpReward: number;
    status: string;
}

export default function BaseRankingPage() {
    const { user: currentUser } = useAuth();

    // 1. Define Constraints based on Role
    const baseConstraints = useMemo(() => {
        if (!currentUser) return [];

        const { role, districtId, regionId, associationId, unionId, baseId } = currentUser;

        if (role === 'coord_base' && baseId) {
            return [where('id', '==', baseId)];
        }
        if (role === 'coord_distrital' && districtId) {
            return [where('districtId', '==', districtId)];
        }
        if (role === 'coord_regiao' && regionId) {
            return [where('regionId', '==', regionId)];
        }
        if (role === 'coord_associacao' && associationId) {
            return [where('associationId', '==', associationId)];
        }
        if (role === 'coord_uniao' && unionId) {
            return [where('unionId', '==', unionId)];
        }

        // Master/Admin/Geral sees everything
        return [];
    }, [currentUser]);

    const { data: bases, loading } = useCollection<Base>("bases", baseConstraints);
    const { data: districts } = useCollection<District>("districts");
    const { data: tasks } = useCollection<Task>("tasks");
    const { data: submissions } = useCollection<BaseSubmission>("base_submissions");

    const [searchTerm, setSearchTerm] = useState("");

    // Calculate total available points from all collective tasks
    const totalAvailablePoints = useMemo(() => {
        return tasks
            .filter(task => task.isBaseCollective)
            .reduce((sum, task) => sum + (task.points || 0), 0);
    }, [tasks]);

    // Helper functions
    const getDistrictName = (districtId: string) => {
        return districts.find(d => d.id === districtId)?.name || "-";
    };

    const getEarnedPoints = (baseId: string) => {
        return submissions
            .filter(sub => sub.baseId === baseId && sub.status === 'approved')
            .reduce((sum, sub) => sum + (sub.xpReward || 0), 0);
    };

    const getPercentage = (earnedPoints: number) => {
        if (totalAvailablePoints === 0) return 0;
        const p = (earnedPoints / totalAvailablePoints) * 100;
        return Number(p.toFixed(1));
    };

    const getStarRating = (percentage: number) => {
        if (percentage >= 90) return 5;
        if (percentage >= 72.5) return 4;
        if (percentage >= 55) return 3;
        if (percentage >= 37.5) return 2;
        if (percentage >= 20) return 1;
        return 0;
    };

    const renderStars = (stars: number) => {
        if (stars === 0) return <span className="text-xs text-gray-400">Sem estrelas</span>;
        return (
            <div className="flex gap-0.5">
                {[...Array(stars)].map((_, i) => (
                    <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
            </div>
        );
    };

    const getMedalIcon = (rank: number) => {
        if (rank === 1) return <Trophy className="text-yellow-500" size={24} />;
        if (rank === 2) return <Medal className="text-gray-400" size={24} />;
        if (rank === 3) return <Award className="text-orange-500" size={24} />;
        return null;
    };

    // Filter and rank bases by percentage
    const rankedBases = useMemo(() => {
        let filtered = bases.filter(base => {
            if (searchTerm && !base.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            return true;
        });

        // Calculate percentage for each base and sort
        return filtered
            .map(base => {
                const earnedPoints = getEarnedPoints(base.id);
                const percentage = getPercentage(earnedPoints);
                return {
                    ...base,
                    earnedPoints,
                    percentage,
                    stars: getStarRating(percentage)
                };
            })
            .sort((a, b) => ((b as any).totalXp || 0) - ((a as any).totalXp || 0) || b.percentage - a.percentage);
    }, [bases, submissions, searchTerm, totalAvailablePoints]);

    const top3 = rankedBases.slice(0, 3);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Trophy className="text-primary" />
                    Ranking de Bases
                </h1>
                <p className="text-text-secondary">
                    Acompanhe o desempenho das bases nos requisitos coletivos ({totalAvailablePoints} PTS disponíveis).
                </p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar base..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Top 3 Podium */}
            {top3.length > 0 && (
                <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-3xl p-8 border border-primary/10">
                    <h2 className="text-xl font-bold mb-6 text-center">🏆 Pódio</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {top3.map((base, index) => {
                            return (
                                <div
                                    key={base.id}
                                    className={`bg-white rounded-2xl p-6 border-2 ${index === 0 ? 'border-yellow-400 shadow-lg' :
                                        index === 1 ? 'border-gray-300' :
                                            'border-orange-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            {getMedalIcon(index + 1)}
                                            <span className="text-2xl font-bold">#{index + 1}</span>
                                        </div>
                                        {renderStars(base.stars)}
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{base.name}</h3>
                                    <p className="text-sm text-text-secondary mb-1">Distrito: {getDistrictName(base.districtId)}</p>
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-text-secondary">PTS</span>
                                            <span className="text-xl font-bold text-primary">
                                                {base.earnedPoints}/{totalAvailablePoints}
                                            </span>
                                        </div>
                                        <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                                                style={{ width: `${base.percentage}%` }}
                                            />
                                        </div>
                                        <div className="text-center mt-2">
                                            <span className="text-2xl font-bold text-primary">{base.percentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Full Ranking Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-surface border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-bold text-text-secondary">#</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-text-secondary">Base</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-text-secondary">Distrito</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-text-secondary">Progresso GA</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-text-secondary">Total XP</th>
                                <th className="px-6 py-4 text-center text-sm font-bold text-text-secondary">Estrelas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : rankedBases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                                        Nenhuma base encontrada.
                                    </td>
                                </tr>
                            ) : (
                                rankedBases.map((base, index) => {
                                    return (
                                        <tr key={base.id} className="hover:bg-surface/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getMedalIcon(index + 1)}
                                                    <span className="font-semibold">{index + 1}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{base.name}</td>
                                            <td className="px-6 py-4 text-text-secondary">{getDistrictName(base.districtId)}</td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className="font-bold text-primary">
                                                        {base.earnedPoints}/{totalAvailablePoints} ({base.percentage}%)
                                                    </div>
                                                    <div className="mt-1 w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-primary to-accent"
                                                            style={{ width: `${base.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-primary">
                                                {base.totalXp || 0} XP
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    {renderStars(base.stars)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
