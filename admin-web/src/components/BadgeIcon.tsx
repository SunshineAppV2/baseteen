import {
    Star,
    Flame,
    Gem,
    Calendar,
    Trophy,
    Crown,
    Target,
    Rocket
} from "lucide-react";
import { clsx } from "clsx";

export type BadgeType =
    | 'first_task'
    | 'tasks_10'
    | 'tasks_50'
    | 'streak_7'
    | 'streak_30'
    | 'base_month'
    | 'xp_1000'
    | 'xp_5000';

interface BadgeIconProps {
    type: BadgeType;
    unlocked?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showGlow?: boolean;
}

const badgeConfig = {
    first_task: {
        icon: Star,
        color: 'from-yellow-400 to-yellow-600',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        name: 'Primeira Tarefa',
        description: 'Complete sua primeira tarefa'
    },
    tasks_10: {
        icon: Flame,
        color: 'from-orange-400 to-red-500',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        name: '10 Tarefas',
        description: 'Complete 10 tarefas'
    },
    tasks_50: {
        icon: Gem,
        color: 'from-cyan-400 to-blue-500',
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-700',
        name: '50 Tarefas',
        description: 'Complete 50 tarefas'
    },
    streak_7: {
        icon: Calendar,
        color: 'from-green-400 to-emerald-600',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        name: 'Streak de 7 dias',
        description: '7 dias consecutivos de atividade'
    },
    streak_30: {
        icon: Trophy,
        color: 'from-amber-400 to-yellow-600',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        name: 'Streak de 30 dias',
        description: '30 dias consecutivos de atividade'
    },
    base_month: {
        icon: Crown,
        color: 'from-purple-400 to-pink-600',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-700',
        name: 'Base do Mês',
        description: 'Base #1 no ranking mensal'
    },
    xp_1000: {
        icon: Target,
        color: 'from-blue-400 to-indigo-600',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        name: '1000 XP',
        description: 'Acumule 1000 XP total'
    },
    xp_5000: {
        icon: Rocket,
        color: 'from-red-400 to-rose-600',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        name: '5000 XP',
        description: 'Acumule 5000 XP total'
    }
};

const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
};

const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40
};

export default function BadgeIcon({ type, unlocked = false, size = 'md', showGlow = true }: BadgeIconProps) {
    const config = badgeConfig[type];
    const Icon = config.icon;

    return (
        <div className="relative inline-block">
            {/* Glow effect for unlocked badges */}
            {unlocked && showGlow && (
                <div className={clsx(
                    "absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse-slow",
                    `bg-gradient-to-br ${config.color}`
                )}></div>
            )}

            {/* Badge circle */}
            <div className={clsx(
                "relative rounded-full flex items-center justify-center transition-all duration-300",
                sizeClasses[size],
                unlocked
                    ? `bg-gradient-to-br ${config.color} shadow-lg hover:scale-110`
                    : "bg-gray-200 opacity-40 grayscale"
            )}>
                <Icon
                    size={iconSizes[size]}
                    className={unlocked ? "text-white" : "text-gray-400"}
                    strokeWidth={2.5}
                />
            </div>

            {/* Lock overlay for locked badges */}
            {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
}

// Export badge config for use in other components
export { badgeConfig };
