"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import BadgeIcon, { BadgeType, badgeConfig } from "@/components/BadgeIcon";
import { getAchievementProgress } from "@/services/achievementService";
import { Trophy, Lock } from "lucide-react";

export default function ConquistasPage() {
    const { user } = useAuth();
    const [progress, setProgress] = useState<Record<BadgeType, { unlocked: boolean, progress: number, target: number }> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.baseId) {
            loadProgress();
        }
    }, [user]);

    const loadProgress = async () => {
        if (!user?.baseId) return;

        setLoading(true);
        try {
            const data = await getAchievementProgress(user.baseId);
            setProgress(data);
        } catch (error) {
            console.error('Error loading achievements:', error);
        } finally {
            setLoading(false);
        }
    };

    const allBadges: BadgeType[] = [
        'first_task',
        'tasks_10',
        'tasks_50',
        'xp_1000',
        'xp_5000',
        'streak_7',
        'streak_30',
        'base_month'
    ];

    const unlockedCount = progress ? Object.values(progress).filter(p => p.unlocked).length : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Trophy className="text-primary" size={28} />
                        Conquistas
                    </h1>
                    <p className="text-text-secondary">
                        Desbloqueie badges completando desafios
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-primary">{unlockedCount}/{allBadges.length}</p>
                    <p className="text-sm text-text-secondary">Desbloqueadas</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="card-soft p-6">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full transition-all duration-500"
                                style={{ width: `${(unlockedCount / allBadges.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-text-secondary">
                        {Math.round((unlockedCount / allBadges.length) * 100)}%
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-text-secondary mt-4">Carregando conquistas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {allBadges.map(badgeType => {
                        const badgeProgress = progress?.[badgeType];
                        const config = badgeConfig[badgeType];
                        const isUnlocked = badgeProgress?.unlocked || false;
                        const progressPercent = badgeProgress
                            ? Math.round((badgeProgress.progress / badgeProgress.target) * 100)
                            : 0;

                        return (
                            <div
                                key={badgeType}
                                className={`card-soft p-6 text-center space-y-4 transition-all duration-300 ${isUnlocked ? 'hover:shadow-xl hover:scale-105' : 'opacity-60'
                                    }`}
                            >
                                {/* Badge Icon */}
                                <div className="flex justify-center">
                                    <BadgeIcon
                                        type={badgeType}
                                        unlocked={isUnlocked}
                                        size="lg"
                                        showGlow={isUnlocked}
                                    />
                                </div>

                                {/* Badge Info */}
                                <div>
                                    <h3 className="font-bold text-lg">{config.name}</h3>
                                    <p className="text-sm text-text-secondary mt-1">
                                        {config.description}
                                    </p>
                                </div>

                                {/* Progress */}
                                {!isUnlocked && badgeProgress && (
                                    <div className="space-y-2">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${config.color} rounded-full transition-all duration-300`}
                                                style={{ width: `${progressPercent}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs font-medium text-text-secondary">
                                            {badgeProgress.progress} / {badgeProgress.target}
                                        </p>
                                    </div>
                                )}

                                {/* Unlocked Status */}
                                {isUnlocked && (
                                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${config.bgColor} ${config.textColor}`}>
                                        <Trophy size={12} />
                                        Desbloqueado
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
