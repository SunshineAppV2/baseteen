import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    subtitle?: string;
}

export function Card({ children, className, title, subtitle }: CardProps) {
    return (
        <div className={cn("card-soft p-6", className)}>
            {(title || subtitle) && (
                <div className="mb-4">
                    {title && <h3 className="text-lg font-semibold text-text-primary">{title}</h3>}
                    {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    );
}
