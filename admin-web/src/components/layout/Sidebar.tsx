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
    MonitorPlay,
    Globe,
    Shield,
    Target,
    Upload,
    Megaphone,
    ChevronDown,
    ChevronRight
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { clsx } from "clsx";
import { useState, useEffect, useMemo } from "react";

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false); // Mobile state
    const [locationInfo, setLocationInfo] = useState<string>("");
    const [config, setConfig] = useState({
        rotaGAEnabled: true,
        achievementsVisibleToBases: true
    });
    const [expandedGroup, setExpandedGroup] = useState<string | null>("GERAL");

    // Fetch Base & District info for Base Coordinators
    useEffect(() => {
        const fetchLocation = async () => {
            if (user?.role === 'coord_base' && user.baseId) {
                try {
                    const baseRef = doc(db, "bases", user.baseId);
                    const baseSnap = await getDoc(baseRef);
                    if (baseSnap.exists()) {
                        const baseData = baseSnap.data();
                        let districtName = "";

                        if (baseData.districtId) {
                            const distRef = doc(db, "districts", baseData.districtId);
                            const distSnap = await getDoc(distRef);
                            if (distSnap.exists()) {
                                districtName = distSnap.data().name;
                            }
                        }
                        setLocationInfo(`${baseData.name} - ${districtName}`);
                    }
                } catch (error) {
                    console.error("Error fetching location info:", error);
                }
            } else {
                setLocationInfo("");
            }
        };

        if (user) fetchLocation();
    }, [user]);

    // Load config settings
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'settings', 'gamification'));
                if (configDoc.exists()) {
                    const data = configDoc.data();
                    setConfig({
                        rotaGAEnabled: data.rotaGAEnabled !== false,
                        achievementsVisibleToBases: data.achievementsVisibleToBases !== false
                    });
                }
            } catch (error) {
                console.error('Error loading config:', error);
            }
        };
        loadConfig();
    }, []);

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

    const menuGroups = useMemo(() => [
        {
            title: "GERAL",
            items: [
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
            ]
        },
        {
            title: "ESTRUTURA",
            items: [
                {
                    icon: Globe,
                    label: "Estrutura",
                    href: "/structure",
                    visible: ['master', 'admin', 'coord_geral'].includes(user?.role || '')
                },
                {
                    icon: Upload,
                    label: "Importações",
                    href: "/imports",
                    visible: user?.role === 'master'
                },
                {
                    icon: Building2,
                    label: "Base/Distrito",
                    href: "/organization",
                    visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital'].includes(user?.role || '')
                },
            ]
        },
        {
            title: "OPERAÇÃO",
            items: [
                {
                    icon: CheckSquare,
                    label: "Tarefas",
                    href: "/tasks",
                    visible: true
                },
                {
                    icon: Calendar,
                    label: "Eventos",
                    href: "/events",
                    visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_base', 'coord_distrital', 'coord_regiao', 'coord_associacao', 'coord_uniao'].includes(user?.role || '')
                },
                {
                    icon: CalendarCheck,
                    label: "Chamada",
                    href: "/attendance",
                    visible: true
                },
                {
                    icon: MonitorPlay,
                    label: "ÁREA QUIZ",
                    href: "/quiz",
                    visible: true
                },
                {
                    icon: Trophy,
                    label: "Ranking",
                    href: "/ranking",
                    visible: ['master', 'admin', 'coord_geral', 'coord_uniao', 'coord_associacao', 'secretaria', 'coord_base'].includes(user?.role || '')
                },
                {
                    icon: Trophy,
                    label: "Ranking Bases",
                    href: "/ranking-bases",
                    visible: false
                },
                {
                    icon: Trophy,
                    label: "Conquistas",
                    href: "/conquistas",
                    visible: user?.role === 'master' || user?.role === 'admin' || config.achievementsVisibleToBases
                },
                {
                    icon: ClipboardList,
                    label: "Aprovar Membros",
                    href: "/approvals",
                    visible: ['coord_base', 'coord_distrital', 'coord_regiao', 'coord_associacao', 'coord_uniao', 'coord_geral', 'master', 'admin', 'secretaria'].includes(user?.role || '')
                },

                {
                    icon: BarChart3,
                    label: "Relatórios",
                    href: "/relatorios",
                    visible: ['master', 'admin', 'secretaria', 'coord_geral', 'coord_distrital', 'coord_uniao', 'coord_associacao', 'coord_regiao'].includes(user?.role || '')
                },
                {
                    icon: Megaphone,
                    label: "Comunicação",
                    href: "/communications",
                    visible: ['master', 'admin', 'secretaria', 'coord_geral'].includes(user?.role || '')
                },
            ]
        },
        {
            title: "SISTEMA",
            items: [
                {
                    icon: DollarSign,
                    label: "Assinaturas/Cadastros",
                    href: "/admin/subscriptions",
                    visible: user?.role === 'master'
                },
                {
                    icon: Settings,
                    label: "Configurações",
                    href: "/settings",
                    visible: ['master', 'admin', 'coord_geral'].includes(user?.role || '')
                },
                {
                    icon: Settings,
                    label: "Config. Chamada",
                    href: "/attendance/config",
                    visible: true
                }
            ]
        }
    ], [user, config]);

    // Auto-expand group of current path on navigation
    useEffect(() => {
        for (const group of menuGroups) {
            if (group.items.some(item => item.href === pathname)) {
                setExpandedGroup(group.title);
                break;
            }
        }
    }, [pathname, menuGroups]);

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
                "md:block h-screen overflow-hidden flex flex-col"
            )}>
                <div className="p-6 h-full flex flex-col">
                    <div className="mb-6 hidden md:block">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Base Teen
                        </h1>
                        <p className="text-[10px] text-text-secondary mt-1 tracking-widest uppercase font-bold opacity-60">
                            Admin Console
                        </p>
                    </div>

                    <nav className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pt-14 md:pt-0 pr-2">
                        {menuGroups.map((group) => {
                            const visibleItems = group.items.filter(i => i.visible);
                            if (visibleItems.length === 0) return null;

                            const isExpanded = expandedGroup === group.title;

                            return (
                                <div key={group.title} className="space-y-1">
                                    <button
                                        onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors rounded-lg hover:bg-gray-50",
                                            isExpanded ? "text-primary" : "text-gray-400"
                                        )}
                                    >
                                        <span>{group.title}</span>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>

                                    <div className={clsx(
                                        "space-y-1 overflow-hidden transition-all duration-300",
                                        isExpanded ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 pointer-events-none"
                                    )}>
                                        {visibleItems.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={handleLinkClick}
                                                className={clsx(
                                                    "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative text-sm ml-2",
                                                    pathname === item.href
                                                        ? "bg-primary text-white shadow-md shadow-primary/20 font-semibold"
                                                        : "text-text-secondary hover:bg-gray-50 hover:text-primary"
                                                )}
                                            >
                                                <item.icon size={18} className={clsx(
                                                    pathname === item.href ? "" : "group-hover:scale-110 transition-transform opacity-70 group-hover:opacity-100"
                                                )} />
                                                <span>{item.label}</span>
                                                {pathname === item.href && (
                                                    <div className="absolute right-3 w-1 h-1 rounded-full bg-white/50" />
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>

                    <div className="pt-4 mt-auto border-t border-gray-100 space-y-4">
                        {/* Support Section */}
                        <div className="px-4">
                            <button
                                onClick={() => window.open('https://wa.me/5591983292005', '_blank')}
                                className="flex items-center gap-2 text-[11px] font-bold text-text-secondary hover:text-green-600 transition-colors uppercase tracking-wider"
                            >
                                <HelpCircle size={14} />
                                <span>Suporte Técnico</span>
                            </button>
                        </div>

                        {/* User Profile Hook */}
                        <div className="px-4 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-text-primary truncate">
                                    {user?.displayName || "Usuário"}
                                </p>
                                <p className="text-[10px] text-text-secondary uppercase truncate font-bold opacity-70">
                                    {locationInfo || user?.role?.replace('_', ' ')}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                                title="Sair"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
