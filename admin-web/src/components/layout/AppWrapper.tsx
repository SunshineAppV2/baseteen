"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AlertProvider } from "@/context/AlertContext";
import AuthGuard from "@/components/layout/AuthGuard";

function ContentWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, loading } = useAuth();

    // Pages that don't need sidebar (login, splash, setup)
    const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/setup-master";

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (isPublicPage) {
        return <>{children}</>;
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
