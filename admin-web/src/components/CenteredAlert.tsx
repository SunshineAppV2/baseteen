'use client';

import { useEffect } from 'react';

interface CenteredAlertProps {
    message: string;
    onClose: () => void;
}

export default function CenteredAlert({ message, onClose }: CenteredAlertProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-gray-800 text-center mb-6 whitespace-pre-line">
                    {message}
                </p>
                <button
                    onClick={onClose}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                    OK
                </button>
            </div>
        </div>
    );
}
