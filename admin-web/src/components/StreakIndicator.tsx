import { Flame, Zap } from "lucide-react";
import { clsx } from "clsx";
import { getStreakColor, calculateStreakBonus } from "@/services/streakService";

interface StreakIndicatorProps {
    streak: number;
    size?: 'sm' | 'md' | 'lg';
    showBonus?: boolean;
}

const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
};

const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20
};

export default function StreakIndicator({ streak, size = 'md', showBonus = true }: StreakIndicatorProps) {
    const bonus = calculateStreakBonus(streak);
    const colorGradient = getStreakColor(streak);

    if (streak === 0) return null;

    return (
        <div className="inline-flex items-center gap-2">
            {/* Streak Badge */}
            <div className={clsx(
                "inline-flex items-center gap-1.5 rounded-full font-bold text-white",
                `bg-gradient-to-r ${colorGradient}`,
                sizeClasses[size],
                streak >= 7 && "animate-pulse-slow"
            )}>
                <Flame size={iconSizes[size]} className={streak >= 7 ? "animate-bounce" : ""} />
                <span>{streak} dias</span>
            </div>

            {/* Bonus Indicator */}
            {showBonus && bonus > 0 && (
                <div className={clsx(
                    "inline-flex items-center gap-1 rounded-full font-bold",
                    "bg-yellow-100 text-yellow-700",
                    sizeClasses[size]
                )}>
                    <Zap size={iconSizes[size]} />
                    <span>+{Math.round(bonus * 100)}% XP</span>
                </div>
            )}
        </div>
    );
}
