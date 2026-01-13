import { Sparkles, Rocket } from "lucide-react";
import { clsx } from "clsx";

interface BaseTypeBadgeProps {
    type: 'soul+' | 'teen';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export default function BaseTypeBadge({ type, size = 'md', showLabel = true }: BaseTypeBadgeProps) {
    const isSoulPlus = type === 'soul+';

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base'
    };

    const iconSizes = {
        sm: 12,
        md: 14,
        lg: 16
    };

    return (
        <span className={clsx(
            "inline-flex items-center gap-1.5 rounded-full font-bold",
            sizeClasses[size],
            isSoulPlus
                ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900"
                : "bg-gradient-to-r from-blue-500 to-blue-700 text-white"
        )}>
            {isSoulPlus ? (
                <Sparkles size={iconSizes[size]} />
            ) : (
                <Rocket size={iconSizes[size]} />
            )}
            {showLabel && (
                <span>{isSoulPlus ? 'Soul+' : 'Teen'}</span>
            )}
        </span>
    );
}
