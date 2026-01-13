"use client";

import { useState, useEffect } from "react";

export default function SplashScreen() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Animate progress bar over 7 seconds
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) {
                    clearInterval(interval);
                    return 95; // Stop at 95% to show it's still loading
                }
                return prev + 1.36; // Increment to reach 95% in ~7 seconds
            });
        }, 100); // Update every 100ms

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex flex-col items-center justify-center z-50">
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-8 animate-fade-in">
                    {/* Logo Circle */}
                    <div className="relative">
                        <div className="w-40 h-40 mx-auto bg-white rounded-full flex items-center justify-center shadow-2xl animate-pulse-slow">
                            <div className="text-7xl font-black bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                BT
                            </div>
                        </div>

                        {/* Animated Ring */}
                        <div className="absolute inset-0 w-40 h-40 mx-auto">
                            <div className="absolute inset-0 border-4 border-white/30 rounded-full animate-ping-slow"></div>
                        </div>
                    </div>

                    {/* Brand Name */}
                    <div className="space-y-3">
                        <h1 className="text-5xl font-black text-white tracking-tight">
                            Base Teen
                        </h1>
                        <p className="text-3xl font-bold text-blue-100 tracking-wide">
                            Base Soul+
                        </p>
                        <p className="text-blue-200 text-sm font-medium tracking-wide">
                            Ministério do Adolescente
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-72 mx-auto space-y-3">
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-300 ease-out shadow-lg"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-blue-200 text-sm font-medium">
                            Carregando sistema...
                        </p>
                    </div>

                    {/* Loading Indicator */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="pb-8">
                <p className="text-blue-300 text-sm font-medium">
                    © 2026 - 7SETI TECNOLOGIA
                </p>
            </div>
        </div>
    );
}
