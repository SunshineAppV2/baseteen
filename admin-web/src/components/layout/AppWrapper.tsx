"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AlertProvider } from "@/context/AlertContext";
import AuthGuard from "@/components/layout/AuthGuard";
import SplashScreen from "@/components/SplashScreen";
import { useState, useEffect } from "react";
import { Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { auth } from "@/services/firebase";

function ContentWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, loading } = useAuth();
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Check if splash has been shown in this session
    useEffect(() => {
        const splashShown = sessionStorage.getItem('splashShown');
        if (splashShown === 'true') {
            setMinTimeElapsed(true);
            setIsInitialLoad(false);
        } else {
            // First time loading - show splash for 7 seconds
            const timer = setTimeout(() => {
                setMinTimeElapsed(true);
                sessionStorage.setItem('splashShown', 'true');
            }, 2500); // 2.5 seconds

            return () => clearTimeout(timer);
        }
    }, []);

    // Pages that don't need sidebar (login, splash, setup, play)
    const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/setup-master" || pathname === "/play";

    // Show splash only if it's initial load and time hasn't elapsed, OR if auth is loading
    if ((isInitialLoad && !minTimeElapsed) || (loading && !minTimeElapsed)) {
        return <SplashScreen />;
    }

    if (isPublicPage) {
        return <>{children}</>;
    }

    // Check for pending status
    if (user?.status === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface p-4">
                <div className="max-w-md w-full text-center space-y-6 card-soft p-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <Clock size={40} className="text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-text-primary">Acesso em Análise</h1>
                        <p className="text-text-secondary">
                            Olá, <span className="font-bold text-primary">{user.displayName}</span>! Seu cadastro foi recebido e está aguardando a validação de um Master.
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 text-left">
                        <p><strong>O que acontece agora?</strong></p>
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                            <li>O Master revisará suas informações.</li>
                            <li>Assim que aprovado, você terá acesso total ao painel.</li>
                            <li>Tente fazer login novamente em instantes.</li>
                        </ul>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => auth.signOut()}
                        className="w-full"
                    >
                        Sair e voltar depois
                    </Button>
                </div>
            </div>
        );
    }

    if (user?.status === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface p-4">
                <div className="max-w-md w-full text-center space-y-6 card-soft p-8">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <XCircle size={40} className="text-red-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-text-primary">Acesso Não Autorizado</h1>
                        <p className="text-text-secondary">
                            Infelizmente seu cadastro não foi aprovado pelos administradores.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => auth.signOut()}
                        className="w-full"
                    >
                        Voltar para o Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <AuthGuard>
            <div className="flex bg-surface min-h-screen">
                <Sidebar />
                <main className="flex-1 overflow-y-auto px-8 py-8 h-screen">
                    {children}
                </main>
            </div>
        </AuthGuard>
    );
}

export default function AppWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AlertProvider>
            <AuthProvider>
                <ContentWrapper>{children}</ContentWrapper>
            </AuthProvider>
        </AlertProvider>
    );
}
