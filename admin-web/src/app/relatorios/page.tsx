"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useFirestore";
import { FileBarChart, Filter, Download, Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Task {
    id: string;
    title: string;
    points: number;
    description: string;
    isBaseCollective?: boolean;
}

interface BaseSubmission {
    id: string;
    taskId: string;
    baseId: string;
    baseName: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any; // Firestore Timestamp
    proof: {
        submittedAt: any;
    };
}

interface Base {
    id: string;
    name: string;
    districtId: string;
    regionId?: string;
    associationId?: string;
}

interface District {
    id: string;
    name: string;
    regionId?: string;
}

interface Region {
    id: string;
    name: string;
}

export default function ReportsPage() {
    const { user: currentUser } = useAuth();

    // 1. Data Fetching
    const { data: tasks } = useCollection<Task>("tasks");
    const { data: submissions } = useCollection<BaseSubmission>("base_submissions");
    const { data: basesRaw } = useCollection<Base>("bases");
    const { data: districtsRaw } = useCollection<District>("districts");
    const { data: regionsRaw } = useCollection<Region>("regions");

    // Sort alphabetically
    const bases = useMemo(() => [...basesRaw].sort((a, b) => a.name.localeCompare(b.name)), [basesRaw]);
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);
    const regions = useMemo(() => [...regionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [regionsRaw]);

    // 2. Filters State
    const [viewMode, setViewMode] = useState<'base' | 'requirement'>('base');
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
    const [selectedRegion, setSelectedRegion] = useState<string>("all");

    // 3. Access Control & Hierarchy Logic
    const isHierarchicalCoordinator = ['coord_distrital', 'coord_regiao', 'coord_associacao', 'coord_uniao', 'coord_geral', 'master', 'admin', 'secretaria'].includes(currentUser?.role || '');

    if (!currentUser || !isHierarchicalCoordinator) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <p className="text-text-secondary">Acesso restrito a Coordenadores.</p>
                </div>
            </div>
        );
    }

    // 4. Filtering Logic
    const filteredBases = useMemo(() => {
        return bases.filter(base => {
            // Role-based restrictions
            if (currentUser?.role === 'coord_distrital' && base.districtId !== currentUser.districtId) return false;
            if (currentUser?.role === 'coord_regiao' && base.regionId !== currentUser.regionId) return false;
            if (currentUser?.role === 'coord_associacao' && base.associationId !== currentUser.associationId) return false;

            // UI Filters
            if (selectedRegion !== 'all' && base.regionId !== selectedRegion) return false;
            if (selectedDistrict !== 'all' && base.districtId !== selectedDistrict) return false;

            return true;
        });
    }, [bases, currentUser, selectedRegion, selectedDistrict]);

    const filteredSubmissions = useMemo(() => {
        return submissions.filter(sub => {
            // Date Filter
            if (startDate) {
                const subDate = sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt);
                if (subDate < new Date(`${startDate}T00:00:00`)) return false;
            }
            if (endDate) {
                const subDate = sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt);
                if (subDate > new Date(`${endDate}T23:59:59`)) return false;
            }

            // Base Filter (Indirectly via filteredBases to respect hierarchy)
            return filteredBases.some(b => b.id === sub.baseId);
        });
    }, [submissions, startDate, endDate, filteredBases]);

    const availableDistricts = useMemo(() => {
        if (currentUser?.role === 'coord_distrital') return districts.filter(d => d.id === currentUser.districtId);
        if (selectedRegion !== 'all') return districts.filter(d => d.regionId === selectedRegion);
        return districts; // Consider filtering by association/union for higher roles if needed
    }, [districts, currentUser, selectedRegion]);


    // 5. PDF Export
    const exportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Relatório ROTA GA", 14, 20);

        doc.setFontSize(10);
        doc.text(`Gerado por: ${currentUser.displayName || currentUser.email}`, 14, 30);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);
        if (startDate || endDate) {
            doc.text(`Período: ${startDate || 'Início'} até ${endDate || 'Hoje'}`, 14, 40);
        }

        if (viewMode === 'base') {
            const tableData = filteredBases.map(base => {
                const baseSubs = filteredSubmissions.filter(s => s.baseId === base.id);
                const approved = baseSubs.filter(s => s.status === 'approved').length;
                const pending = baseSubs.filter(s => s.status === 'pending').length;
                const totalPoints = baseSubs.filter(s => s.status === 'approved').reduce((acc, curr) => {
                    const task = tasks.find(t => t.id === curr.taskId);
                    return acc + (task?.points || 0);
                }, 0);

                return [base.name, approved, pending, `${totalPoints} PTS`];
            });

            autoTable(doc, {
                startY: 50,
                head: [['Base', 'Aprovados', 'Pendentes', 'Pontos']],
                body: tableData,
            });
        } else {
            // Requirement View PDF
            const tableData = tasks.filter(t => t.isBaseCollective).map(task => {
                const taskSubs = filteredSubmissions.filter(s => s.taskId === task.id);
                const answeredCount = taskSubs.length;
                const completionRate = Math.round((answeredCount / filteredBases.length) * 100) || 0;
                return [task.title, `${answeredCount}/${filteredBases.length}`, `${completionRate}%`];
            });

            autoTable(doc, {
                startY: 50,
                head: [['Requisito', 'Respostas', '% Conclusão']],
                body: tableData,
            });
        }

        doc.save("relatorio-rota-ga.pdf");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileBarChart className="text-primary" />
                        Relatórios
                    </h1>
                    <p className="text-text-secondary">Monitore o desempenho dos requisitos ROTA GA.</p>
                </div>
                <Button onClick={exportPDF} className="gap-2">
                    <Download size={18} />
                    Exportar PDF
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Período</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="p-2 border rounded-lg text-sm w-full"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-gray-400">até</span>
                        <input
                            type="date"
                            className="p-2 border rounded-lg text-sm w-full"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {['admin', 'master', 'coord_geral', 'coord_uniao', 'coord_associacao'].includes(currentUser?.role || '') && (
                    <div className="w-48">
                        <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Região</label>
                        <select
                            className="w-full p-2 border rounded-lg text-sm"
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                        >
                            <option value="all">Todas as Regiões</option>
                            {regions.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="w-48">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Distrito</label>
                    <select
                        className="w-full p-2 border rounded-lg text-sm"
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                    >
                        <option value="all">Todos os Distritos</option>
                        {availableDistricts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex border rounded-lg overflow-hidden translate-y-[-1px]">
                    <button
                        onClick={() => setViewMode('base')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'base' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                        Por Base
                    </button>
                    <button
                        onClick={() => setViewMode('requirement')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'requirement' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                        Por Requisito
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {viewMode === 'base' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left py-4 px-6 text-xs font-bold text-text-secondary uppercase">Base</th>
                                    <th className="text-center py-4 px-6 text-xs font-bold text-text-secondary uppercase">Conclusão</th>
                                    <th className="text-center py-4 px-6 text-xs font-bold text-text-secondary uppercase">Aprovados</th>
                                    <th className="text-center py-4 px-6 text-xs font-bold text-text-secondary uppercase">Pendentes</th>
                                    <th className="text-center py-4 px-6 text-xs font-bold text-text-secondary uppercase">Pontos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredBases.map(base => {
                                    const baseSubs = filteredSubmissions.filter(s => s.baseId === base.id);
                                    const collectiveTasks = tasks.filter(t => t.isBaseCollective);
                                    const approvedCount = baseSubs.filter(s => s.status === 'approved').length;
                                    const pendingCount = baseSubs.filter(s => s.status === 'pending').length;
                                    const completionPercent = collectiveTasks.length > 0
                                        ? Math.round((approvedCount / collectiveTasks.length) * 100)
                                        : 0;

                                    const totalPoints = baseSubs
                                        .filter(s => s.status === 'approved')
                                        .reduce((acc, curr) => {
                                            const task = tasks.find(t => t.id === curr.taskId);
                                            return acc + (task?.points || 0);
                                        }, 0);

                                    return (
                                        <tr key={base.id} className="hover:bg-gray-50/50">
                                            <td className="py-4 px-6 font-medium text-text-primary">{base.name}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full"
                                                            style={{ width: `${completionPercent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-text-secondary w-8">{completionPercent}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center text-green-600 font-bold">{approvedCount}</td>
                                            <td className="py-4 px-6 text-center text-yellow-600 font-bold">{pendingCount}</td>
                                            <td className="py-4 px-6 text-center font-bold text-primary">{totalPoints}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {tasks.filter(t => t.isBaseCollective).map(task => {
                            const taskSubs = filteredSubmissions.filter(s => s.taskId === task.id);
                            const answeredBases = taskSubs.map(s => s.baseId);
                            const unansweredBases = filteredBases.filter(b => !answeredBases.includes(b.id));

                            const completionRate = filteredBases.length > 0
                                ? Math.round((answeredBases.length / filteredBases.length) * 100)
                                : 0;

                            return (
                                <details key={task.id} className="group p-6">
                                    <summary className="flex items-center justify-between cursor-pointer list-none">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-text-primary group-hover:text-primary transition-colors">
                                                {task.title}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full"
                                                            style={{ width: `${completionRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-text-secondary">{completionRate}% Respondido</span>
                                                </div>
                                                <span className="text-xs text-text-secondary bg-gray-100 px-2 py-1 rounded-full">
                                                    {answeredBases.length} / {filteredBases.length} bases
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                            Ver detalhes ▼
                                        </div>
                                    </summary>

                                    <div className="mt-6 pl-4 border-l-2 border-gray-100 grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-sm font-bold text-red-500 uppercase mb-3 flex items-center gap-2">
                                                <XCircle size={16} />
                                                Pendentes ({unansweredBases.length})
                                            </h4>
                                            <ul className="text-sm space-y-1 text-text-secondary max-h-60 overflow-y-auto">
                                                {unansweredBases.map(b => (
                                                    <li key={b.id}>{b.name}</li>
                                                ))}
                                                {unansweredBases.length === 0 && <li className="italic text-gray-400">Nenhuma pendência.</li>}
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold text-green-600 uppercase mb-3 flex items-center gap-2">
                                                <CheckCircle size={16} />
                                                Respondidos ({answeredBases.length})
                                            </h4>
                                            <ul className="text-sm space-y-1 text-text-secondary max-h-60 overflow-y-auto">
                                                {taskSubs.map(s => {
                                                    const base = bases.find(b => b.id === s.baseId);
                                                    return (
                                                        <li key={s.id} className="flex justify-between">
                                                            <span>{base?.name}</span>
                                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${s.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                    'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {s.status === 'approved' ? 'Aprovado' : s.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                                {answeredBases.length === 0 && <li className="italic text-gray-400">Nenhuma resposta ainda.</li>}
                                            </ul>
                                        </div>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
