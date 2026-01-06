"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    CheckSquare,
    BarChart3,
    Trophy,
    Settings,
    Building2,
    LogOut,
    Menu,
    X,
    ClipboardList,
    HelpCircle,
    Calendar,
    CalendarCheck,
    DollarSign,
    BookOpen,
    MonitorPlay
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { clsx } from "clsx";
import { useState, useEffect } from "react";

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false); // Mobile state

    // Auto-close on resize (desktop)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const menuItems = [
        {
            icon: LayoutDashboard,
            label: "Início",
            href: "/dashboard",
            visible: true
        },
        {
            icon: Users,
            label: "Usuários",
            href: "/users",
            visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital', 'coord_base'].includes(user?.role || '')
        },
        {
            icon: CheckSquare,
            label: "Tarefas",
            href: "/tasks", // Generalized tasks page
            visible: true
        },
        // {
        //     icon: BookOpen,
        //     label: "Quiz da Base",
        //     href: "/base-quiz",
        //     visible: false // Hiding as requested to unify in AREA QUIZ
        // },
        {
            icon: MonitorPlay,
            label: "ÁREA QUIZ",
            href: "/quiz",
            visible: true
        },
        {
            icon: ClipboardList,
            label: "Correções",
            href: "/approvals",
            visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital', 'coord_base'].includes(user?.role || '')
        },
        {
            icon: CalendarCheck,
            label: "Chamada",
            href: "/attendance",
            visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital', 'coord_base'].includes(user?.role || '')
        },
        {
            icon: Calendar,
            label: "Trimestres",
            href: "/admin/quarters",
            visible: ['master', 'admin', 'coord_geral'].includes(user?.role || '')
        },
        {
            icon: Trophy,
            label: "Ranking",
            href: "/ranking",
            visible: true
        },
        {
            icon: BarChart3,
            label: "Relatórios",
            href: "/reports",
            visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital', 'coord_base'].includes(user?.role || '')
        },
        {
            icon: Building2,
            label: "Base/Distrito",
            href: "/organization",
            visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital'].includes(user?.role || '')
        },
        {
            icon: DollarSign,
            label: "Assinaturas",
            href: "/admin/subscriptions",
            visible: user?.role === 'master'
        },
        {
            icon: Settings,
            label: "Configurações",
            href: "/settings",
            visible: ['master', 'admin', 'coord_geral'].includes(user?.role || '')
        }
    ];

    const toggleSidebar = () => setIsOpen(!isOpen);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex justify-between items-center shadow-sm">
                <span className="font-bold text-lg text-primary">Base Teen</span>
                <button onClick={toggleSidebar} className="p-2 text-text-primary">
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in" onClick={toggleSidebar} />
            )}

            <aside className={clsx(
                "fixed left-0 top-0 bottom-0 bg-white border-r border-gray-100 z-50 transition-transform duration-300 w-64 md:translate-x-0 md:static",
                isOpen ? "translate-x-0" : "-translate-x-full",
                "md:block" // Force block on desktop
            )}>
                <div className="p-6 h-full flex flex-col">
                    <div className="mb-8 hidden md:block">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Base Teen
                        </h1>
                        <p className="text-xs text-text-secondary mt-1 tracking-wider uppercase font-medium">
                            Admin Console
                        </p>
                    </div>

                    <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pt-14 md:pt-0">
                        {menuItems.filter(item => item.visible).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleLinkClick}
                                className={clsx(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                    pathname === item.href
                                        ? "bg-primary text-white shadow-lg shadow-primary/30 font-semibold"
                                        : "text-text-secondary hover:bg-gray-50 hover:text-primary"
                                )}
                            >
                                <item.icon size={20} className={clsx(
                                    pathname === item.href ? "animate-pulse-subtle" : "group-hover:scale-110 transition-transform"
                                )} />
                                <span>{item.label}</span>
                                {pathname === item.href && (
                                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/50" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
                        {/* Help Button - Generic */}
                        <div className="px-4 py-3 pb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Ajuda</h3>
                            <button
                                onClick={() => window.open('https://wa.me/5561999999999', '_blank')} // Placeholder
                                className="flex items-center gap-2 text-sm text-text-secondary hover:text-green-600 transition-colors w-full"
                            >
                                <HelpCircle size={16} />
                                Suporte
                            </button>
                        </div>

                        <div className="px-4 py-3 bg-gray-50 rounded-xl mb-2">
                            <p className="text-xs font-medium text-text-primary truncate">
                                {user?.displayName || "Usuário"}
                            </p>
                            <p className="text-[10px] text-text-secondary uppercase truncate">
                                {user?.role?.replace('_', ' ')}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors w-full"
                        >
                            <LogOut size={20} />
                            <span>Sair</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
