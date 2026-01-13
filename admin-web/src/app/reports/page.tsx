"use client";

import { useState } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    FileText,
    Download,
    FileSpreadsheet,
    Printer,
    Filter,
    CheckCircle2,
    Search
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface User {
    id: string;
    displayName: string;
    email: string;
    stats?: {
        level: number;
        currentXp: number;
    };
    baseId: string;
    districtId: string;
    role: string;
}

interface District {
    id: string;
    name: string;
}

interface Base {
    id: string;
    name: string;
}

import { where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export default function ReportsPage() {
    const { user: currentUser } = useAuth();

    // Constraints to filter at source
    const userConstraints = currentUser?.role === 'coord_base' && currentUser.baseId
        ? [where('baseId', '==', currentUser.baseId)]
        : currentUser?.role === 'coord_distrital' && currentUser.districtId
            ? [where('districtId', '==', currentUser.districtId)]
            : [];

    const { data: users } = useCollection<User>("users", userConstraints);
    const { data: districts } = useCollection<District>("districts");
    const { data: bases } = useCollection<Base>("bases");

    const [selectedDistrict, setSelectedDistrict] = useState("all");
    const [isGenerating, setIsGenerating] = useState(false);

    // Redundant client-side filter just in case, but source is already filtered
    const reportUsers = users.filter(u => {
        if (currentUser?.role === 'coord_distrital' && u.districtId !== currentUser.districtId) return false;
        if (currentUser?.role === 'coord_base' && u.baseId !== currentUser.baseId) return false;
        return true;
    });

    const getDistrictName = (id: string) => districts.find(d => d.id === id)?.name || "N/A";
    const getBaseName = (id: string) => bases.find(b => b.id === id)?.name || "N/A";

    const handleExportExcel = () => {
        setIsGenerating(true);
        try {
            const filteredUsers = selectedDistrict === "all"
                ? reportUsers
                : reportUsers.filter(u => u.districtId === selectedDistrict);

            const data = filteredUsers.map((u, index) => ({
                "Posição": index + 1,
                "Nome": u.displayName || "Sem Nome",
                "Email": u.email,
                "XP Total": u.stats?.currentXp || 0,
                "Base": getBaseName(u.baseId),
                "Distrito": getDistrictName(u.districtId),
                "Cargo": u.role
            })).sort((a, b) => b["XP Total"] - a["XP Total"]);

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ranking");

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const finalData = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const fileName = `Ranking_${selectedDistrict === "all" ? "Global" : getDistrictName(selectedDistrict)}_${new Date().toLocaleDateString()}.xlsx`;
            saveAs(finalData, fileName);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar Excel.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportPDF = () => {
        setIsGenerating(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = new jsPDF() as any;
            const filteredUsers = (selectedDistrict === "all"
                ? reportUsers
                : reportUsers.filter(u => u.districtId === selectedDistrict))
                .sort((a, b) => (b.stats?.currentXp || 0) - (a.stats?.currentXp || 0));

            const districtName = selectedDistrict === "all" ? "Global" : getDistrictName(selectedDistrict);

            // Header
            doc.setFontSize(20);
            doc.setTextColor(27, 106, 156);
            doc.text("Relatório de Ranking - Ministério do Adolescente", 14, 22);

            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text(`Distrito: ${districtName}`, 14, 32);
            doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 38);

            const tableData = filteredUsers.map((u, index) => [
                index + 1,
                u.displayName || "Sem Nome",
                getBaseName(u.baseId),
                u.stats?.currentXp || 0
            ]);

            doc.autoTable({
                startY: 45,
                head: [['Pos', 'Nome', 'Base', 'XP Total']],
                body: tableData,
                headStyles: { fillColor: [27, 106, 156], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { top: 40 },
            });

            doc.save(`Relatorio_Ranking_${districtName.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Exportação de Relatórios</h1>
                    <p className="text-text-secondary">Gere planilhas e documentos oficiais do ministério.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="card-soft p-6 space-y-6">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <Filter size={20} />
                        <h2>Parâmetros do Relatório</h2>
                    </div>

                    <div className="space-y-4">
                        {(currentUser?.role === 'master' || currentUser?.role === 'coord_geral') && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-secondary">Selecionar Distrito</label>
                                <select
                                    className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={selectedDistrict}
                                    onChange={(e) => setSelectedDistrict(e.target.value)}
                                >
                                    <option value="all">Ranking Global (Todos)</option>
                                    {districts.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="pt-4 space-y-3">
                            <Button
                                className="w-full gap-2 py-6 text-lg"
                                onClick={handleExportExcel}
                                disabled={isGenerating || reportUsers.length === 0}
                            >
                                <FileSpreadsheet size={24} />
                                Gerar Excel (.xlsx)
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full gap-2 py-6 text-lg border-primary text-primary"
                                onClick={handleExportPDF}
                                disabled={isGenerating || users.length === 0}
                            >
                                <Printer size={24} />
                                Gerar PDF Oficial
                            </Button>
                        </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-primary shrink-0" size={20} />
                            <p className="text-base text-text-primary">
                                <strong>Dica:</strong> O relatório em Excel é ideal para auditoria, enquanto o PDF é formatado para impressão e apresentações.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Preview / Status */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card-soft p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Resumo dos Dados</h2>
                            <div className="bg-surface px-3 py-1 rounded-full text-xs font-bold text-text-secondary">
                                {reportUsers.length} Registros Encontrados
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-surface rounded-2xl border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                    <Download size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Total de Membros</p>
                                    <p className="text-2xl font-bold text-text-primary">
                                        {selectedDistrict === "all"
                                            ? reportUsers.length
                                            : reportUsers.filter(u => u.districtId === selectedDistrict).length}
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 bg-surface rounded-2xl border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">XP Total Acumulado</p>
                                    <p className="text-2xl font-bold text-text-primary">
                                        {(selectedDistrict === "all"
                                            ? reportUsers
                                            : reportUsers.filter(u => u.districtId === selectedDistrict))
                                            .reduce((acc, curr) => acc + (curr.stats?.currentXp || 0), 0)
                                            .toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-widest">Amostra do Ranking (Top 5)</h3>
                            <div className="space-y-2">
                                {(selectedDistrict === "all"
                                    ? reportUsers
                                    : reportUsers.filter(u => u.districtId === selectedDistrict))
                                    .sort((a, b) => (b.stats?.currentXp || 0) - (a.stats?.currentXp || 0))
                                    .slice(0, 5)
                                    .map((u, i) => (
                                        <div key={u.id} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-50 shadow-sm">
                                            <span className="w-6 text-center font-bold text-primary">{i + 1}º</span>
                                            <span className="flex-1 font-medium">{u.displayName}</span>
                                            <span className="text-sm text-text-secondary italic">{getBaseName(u.baseId)}</span>
                                            <span className="font-bold text-primary">{u.stats?.currentXp || 0} XP</span>
                                        </div>
                                    ))}
                                {reportUsers.length === 0 && (
                                    <div className="text-center py-8">
                                        <Search size={40} className="mx-auto text-gray-200 mb-2" />
                                        <p className="text-text-secondary text-sm">Carregando dados...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
