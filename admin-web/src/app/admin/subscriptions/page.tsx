'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, doc, setDoc, updateDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Button } from '@/components/ui/Button';
import { Building2, Users, DollarSign, Calendar, Check, X, Plus, Edit2, Eye, FileText, AlertCircle, Trash2, Search, RefreshCcw } from 'lucide-react';
import { SUBSCRIPTION_CONFIG, type Subscription, type SubscriptionPlan, type Payment, type PaymentType } from '@/config/subscription';
import { getCurrentMemberCount, createPayment, confirmPayment, getAllPayments, getSubscription, updatePayment, deletePayment } from '@/lib/subscription';
import { generateReceiptPDF } from '@/lib/pdf-generator';

interface Base {
    id: string;
    name: string;
    districtId: string;
    districtName?: string;
}

interface PaymentWithBase extends Payment {
    baseName: string;
    districtName?: string;
}

const convertToDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    if (date.seconds) return new Date(date.seconds * 1000); // Timestamp-like
    return new Date(date);
};

export default function SubscriptionManagementPage() {
    const { user } = useAuth();
    const [bases, setBases] = useState<Base[]>([]);
    const [payments, setPayments] = useState<PaymentWithBase[]>([]);
    const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);

    const [selectedBase, setSelectedBase] = useState<Base | null>(null);
    const [editingPayment, setEditingPayment] = useState<PaymentWithBase | null>(null);

    // Form state - Subscription
    const [memberLimit, setMemberLimit] = useState(10);
    const [plan, setPlan] = useState<SubscriptionPlan>('monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Form state - Add Member
    const [membersToAdd, setMembersToAdd] = useState(1);
    const [monthsToAdd, setMonthsToAdd] = useState(1);
    const [addMemberAmount, setAddMemberAmount] = useState(0);

    // Form state - Edit Payment
    const [editAmount, setEditAmount] = useState(0);
    const [editDescription, setEditDescription] = useState('');

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk selection state
    const [selectedBases, setSelectedBases] = useState<Set<string>>(new Set());
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [bulkNewEndDate, setBulkNewEndDate] = useState('');

    useEffect(() => {
        if (user?.role === 'master') {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load bases
            const basesSnapshot = await getDocs(collection(db, 'bases'));
            const basesData = basesSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                districtId: doc.data().districtId
            }));
            setBases(basesData);

            // Load payments/transactions
            const paymentsData = await getAllPayments();
            const sortedPayments = paymentsData
                .map(p => ({
                    ...p,
                    baseName: basesData.find(b => b.id === p.baseId)?.name || 'Base não encontrada',
                    createdAt: convertToDate(p.createdAt),
                    confirmedAt: p.confirmedAt ? convertToDate(p.confirmedAt) : undefined
                }))
                .filter(p => p.status !== 'refunded') // Show refunded? Maybe in a seprate list or greyed out? User asked to "Update balance" and "Reverse", implying remove from visible/active balance.
                // Request said "Delete". Our deletePayment deletes the doc if it wasn't confirmed, but if confirmed it reverts effects and deletes doc.
                // So reloading data will naturally exclude deleted docs. 
                // Only if we decided to *keep* refunded docs would we filter.
                // But my deletePayment logic *deletes* the doc at the end. 
                // Wait, if I delete the doc, I can't show it as "Estornado".
                // User said "Update balance... and make reversal... to be correct".

                // Let's stick to DELETING the document as requested ("Excluir").
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first

            setPayments(sortedPayments);

            // Load active subscriptions for reference (e.g. current limits)
            const subs: Record<string, Subscription> = {};
            for (const base of basesData) {
                const sub = await getSubscription(base.id);
                if (sub) {
                    subs[base.id] = sub;
                }
            }
            setSubscriptions(subs);

        } catch (error) {
            console.error('Error loading data:', error);
            alert('Erro ao carregar dados');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateSubscriptionAmount = (limit: number, planType: SubscriptionPlan) => {
        if (planType === 'free') return 0;
        const months = SUBSCRIPTION_CONFIG.PLANS[planType.toUpperCase() as keyof typeof SUBSCRIPTION_CONFIG.PLANS].months;
        return limit * SUBSCRIPTION_CONFIG.PRICE_PER_USER_MONTHLY * months;
    };

    // Calculate add member amount
    const calculateAddMemberAmount = (count: number, months: number) => {
        return count * SUBSCRIPTION_CONFIG.PRICE_PER_USER_MONTHLY * months;
    };

    const handleCreateSubscription = async () => {
        if (!selectedBase) return;

        try {
            const planConfig = SUBSCRIPTION_CONFIG.PLANS[plan.toUpperCase() as keyof typeof SUBSCRIPTION_CONFIG.PLANS];
            const months = planConfig.months;
            const amount = calculateSubscriptionAmount(memberLimit, plan);

            // Handle start date - ensure noon to avoid timezone issues shifting day
            const selectedDate = new Date(startDate + 'T12:00:00');

            await createPayment({
                subscriptionId: selectedBase.id,
                baseId: selectedBase.id,
                type: 'subscription',
                amount,
                paymentMethod: 'pix',
                description: `${planConfig.name} (${memberLimit} membros)`,
                metadata: {
                    memberCount: memberLimit,
                    months,
                    newMemberLimit: memberLimit,
                    startDate: selectedDate
                }
            });

            alert('Solicitação de assinatura criada! Confirme o pagamento para ativar.');
            setShowCreateModal(false);
            setSelectedBase(null);
            loadData();
        } catch (error: any) {
            console.error('Error creating subscription:', error);
            alert(`Erro ao criar assinatura: ${error.message}`);
        }
    };

    const handleAddMember = async () => {
        if (!selectedBase) return;

        try {
            await createPayment({
                subscriptionId: selectedBase.id,
                baseId: selectedBase.id,
                type: 'member_addition',
                amount: addMemberAmount,
                paymentMethod: 'pix',
                description: `Adiciona ${membersToAdd} Usuários por ${monthsToAdd} meses`,
                metadata: {
                    memberCount: membersToAdd,
                    months: monthsToAdd
                }
            });

            alert('Solicitação de adição criada! Confirme o pagamento para efetivar.');
            setShowAddMemberModal(false);
            setSelectedBase(null);
            loadData();
        } catch (error: any) {
            console.error('Error adding members:', error);
            alert(`Erro: ${error.message}`);
        }
    };

    const handleConfirmPayment = async (payment: PaymentWithBase) => {
        if (!confirm('Confirmar este pagamento e efetivar a alteração?')) return;

        try {
            await confirmPayment(payment.id, user!.uid);
            alert('Pagamento confirmado com sucesso!');
            loadData();
        } catch (error: any) {
            console.error('Error confirming payment:', error);
            alert(`Erro ao confirmar: ${error.message}`);
        }
    };

    const handleUpdatePayment = async () => {
        if (!editingPayment) return;

        try {
            await updatePayment(editingPayment.id, {
                amount: editAmount,
                description: editDescription
            });
            setShowEditPaymentModal(false);
            setEditingPayment(null);
            loadData();
        } catch (error: any) {
            console.error('Error updating payment:', error);
            alert('Erro ao atualizar pagamento');
        }
    };

    const handleDeletePayment = async (payment: PaymentWithBase) => {
        const isConfirmed = payment.status === 'confirmed';
        const msg = isConfirmed
            ? 'ATENÇÃO: Este pagamento já foi confirmado. Excluí-lo irá reverter as alterações na assinatura (reduzir prazo ou limite de membros). Tem certeza que deseja fazer o estorno?'
            : 'Tem certeza que deseja excluir este pagamento pendente?';

        if (!confirm(msg)) return;

        try {
            await deletePayment(payment.id);
            alert('Pagamento excluído/estornado com sucesso.');
            loadData();
        } catch (error: any) {
            console.error('Error deleting payment:', error);
            alert(`Erro ao excluir: ${error.message}`);
        }
    };

    const handleGenerateReceipt = (payment: PaymentWithBase) => {
        const sub = subscriptions[payment.baseId];
        if (!sub && payment.type === 'member_addition') {
            alert('Assinatura não encontrada para gerar recibo detalhado.');
            return;
        }

        generateReceiptPDF(payment, sub || {} as any, payment.baseName);
    };

    const openCreateModal = (base: Base) => {
        setSelectedBase(base);
        setMemberLimit(10);
        setPlan('monthly');
        setStartDate(new Date().toISOString().split('T')[0]);
        setShowCreateModal(true);
    };

    const openAddMemberModal = (base: Base) => {
        setSelectedBase(base);
        setMembersToAdd(1);

        // Default Cost/Months Calculation
        const sub = subscriptions[base.id];
        let defaultMonths = 1;

        if (sub && sub.status === 'active' && sub.endDate) {
            const now = new Date();
            const end = convertToDate(sub.endDate);
            if (end > now) {
                // Calculate remaining months
                defaultMonths = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
            }
        }

        setMonthsToAdd(defaultMonths);
        setAddMemberAmount(calculateAddMemberAmount(1, defaultMonths));
        setShowAddMemberModal(true);
    };

    const openEditModal = (payment: PaymentWithBase) => {
        setEditingPayment(payment);
        setEditAmount(payment.amount);
        setEditDescription(payment.description);
        setShowEditPaymentModal(true);
    };

    const toggleSelectBase = (baseId: string) => {
        const newSelected = new Set(selectedBases);
        if (newSelected.has(baseId)) {
            newSelected.delete(baseId);
        } else {
            newSelected.add(baseId);
        }
        setSelectedBases(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedBases.size === filteredBases.length && filteredBases.length > 0) {
            setSelectedBases(new Set());
        } else {
            setSelectedBases(new Set(filteredBases.map(b => b.id)));
        }
    };

    const handleBulkUpdateEndDate = async () => {
        if (!bulkNewEndDate) {
            alert('Selecione uma data de vencimento');
            return;
        }

        if (selectedBases.size === 0) {
            alert('Selecione pelo menos um clube');
            return;
        }

        if (!confirm(`Deseja alterar a data de vencimento de ${selectedBases.size} clube(s) para ${new Date(bulkNewEndDate).toLocaleDateString('pt-BR')}?`)) {
            return;
        }

        try {
            const newEndDate = new Date(bulkNewEndDate + 'T23:59:59');
            let updatedCount = 0;

            for (const baseId of selectedBases) {
                const sub = subscriptions[baseId];
                if (sub) {
                    await updateDoc(doc(db, 'subscriptions', baseId), {
                        endDate: Timestamp.fromDate(newEndDate),
                        updatedAt: Timestamp.now()
                    });
                    updatedCount++;
                }
            }

            alert(`${updatedCount} clube(s) atualizado(s) com sucesso!`);
            setShowBulkEditModal(false);
            setSelectedBases(new Set());
            setBulkNewEndDate('');
            loadData();
        } catch (error: any) {
            console.error('Error updating subscriptions:', error);
            alert(`Erro ao atualizar: ${error.message}`);
        }
    };

    if (user?.role !== 'master') {
        return (
            <div className="p-6">
                <p className="text-red-600">Acesso negado. Apenas Master pode acessar esta página.</p>
            </div>
        );
    }

    // Filter logic
    const filteredPayments = payments.filter(p => {
        const searchLower = searchTerm.toLowerCase();
        return (
            p.baseName.toLowerCase().includes(searchLower) ||
            (p.districtName || '').toLowerCase().includes(searchLower) ||
            p.description.toLowerCase().includes(searchLower)
        );
    });

    const pendingPayments = filteredPayments.filter(p => p.status === 'pending');
    const paymentHistory = filteredPayments.filter(p => p.status !== 'pending');

    const filteredBases = bases.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.districtName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Building2 size={32} className="text-primary" />
                        Gerenciamento de Assinaturas
                    </h1>
                    <p className="text-gray-600 mt-1">Confirmar pagamentos e gerenciar planos</p>
                </div>

                <div className="flex gap-4">
                    <Button
                        variant="ghost"
                        onClick={loadData}
                        disabled={isLoading}
                        className="h-auto px-4 text-gray-500 hover:text-primary"
                        title="Recarregar Dados"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </Button>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col items-end min-w-[180px]">
                        <span className="text-sm text-gray-500 font-medium">Pendente</span>
                        <span className="text-2xl font-bold text-orange-600">
                            R$ {pendingPayments.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                        </span>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100 flex flex-col items-end min-w-[180px]">
                        <span className="text-sm text-gray-500 font-medium">Total Recebido</span>
                        <span className="text-2xl font-bold text-green-600">
                            R$ {paymentHistory.filter(p => p.status === 'confirmed').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bases without valid subscription (Quick Actions) */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Plus size={20} className="text-blue-600" />
                        Nova Assinatura / Adicionar Membros
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedBases.size === filteredBases.length && filteredBases.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">Marcar Todos</span>
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    {filteredBases.map(base => {
                        const sub = subscriptions[base.id];
                        const endDate = sub?.endDate ? convertToDate(sub.endDate) : new Date(0);
                        const isActive = sub && sub.status === 'active' && endDate > new Date();

                        return (
                            <div key={base.id} className="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedBases.has(base.id)}
                                    onChange={() => toggleSelectBase(base.id)}
                                    className="mt-2 w-4 h-4 rounded border-gray-300"
                                />
                                <div className="flex flex-col gap-1 bg-gray-50 rounded-lg p-2 border border-gray-200 min-w-[200px] flex-1">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-bold ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                                                {base.name}
                                            </span>
                                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                                                {base.districtName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex justify-end">
                                        {!isActive ? (
                                            <Button
                                                size="sm"
                                                onClick={() => openCreateModal(base)}
                                                className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2"
                                            >
                                                Criar Plano
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => openAddMemberModal(base)}
                                                className="h-7 bg-green-600 hover:bg-green-700 text-white text-xs px-2 w-full"
                                                title="Adicionar Membros"
                                            >
                                                +Membros
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedBases.size > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                            {selectedBases.size}
                        </div>
                        <span className="font-bold text-blue-900">
                            {selectedBases.size} clube(s) selecionado(s)
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setSelectedBases(new Set())}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                        >
                            Limpar Seleção
                        </Button>
                        <Button
                            onClick={() => {
                                setBulkNewEndDate(new Date().toISOString().split('T')[0]);
                                setShowBulkEditModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-none flex items-center gap-2"
                        >
                            <Calendar size={16} />
                            Alterar Data de Vencimento
                        </Button>
                    </div>
                </div>
            )}

            {/* Pending Payments Section */}
            {pendingPayments.length > 0 && (
                <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                    <div className="p-4 bg-orange-100/50 border-b border-orange-200 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                            <AlertCircle size={20} />
                            Pagamentos Pendentes
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <tbody className="divide-y divide-orange-100">
                                {pendingPayments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-orange-100/30">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{payment.baseName}</div>
                                            <div className="text-xs text-gray-500 uppercase">{payment.districtName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{payment.description}</div>
                                            <div className="text-xs text-gray-500">
                                                {convertToDate(payment.createdAt).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-green-600">
                                                R$ {payment.amount.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <Button
                                                onClick={() => openEditModal(payment)}
                                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 border-none h-8 w-8 p-0 flex items-center justify-center rounded-full"
                                                title="Editar Valor/Descrição"
                                            >
                                                <Edit2 size={14} />
                                            </Button>
                                            <Button
                                                onClick={() => handleDeletePayment(payment)}
                                                className="bg-red-100 hover:bg-red-200 text-red-700 border-none h-8 w-8 p-0 flex items-center justify-center rounded-full"
                                                title="Excluir"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                            <Button
                                                onClick={() => handleConfirmPayment(payment)}
                                                className="bg-green-600 hover:bg-green-700 text-white border-none text-sm h-8"
                                            >
                                                <Check size={16} className="mr-1" />
                                                Confirmar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }

            {/* Payment History / Active Subscriptions View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Histórico de Transações</h2>
                </div>

                {paymentHistory.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">Nenhuma transação encontrada</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Base</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Descrição</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Data</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Valor</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paymentHistory.map(payment => {
                                    const sub = subscriptions[payment.baseId];
                                    const currentCount = sub?.currentMemberCount || 0;
                                    const limit = sub?.memberLimit || 0;

                                    return (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{payment.baseName}</div>
                                                <div className="text-xs text-gray-500 uppercase">{payment.districtName}</div>
                                                {sub && (
                                                    <div className="text-xs text-blue-600 mt-1 font-medium">
                                                        Ativos: {currentCount} / {limit}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 font-medium">
                                                    {payment.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${payment.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {payment.status === 'confirmed' ? 'Confirmado' : payment.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">
                                                    {convertToDate(payment.createdAt).toLocaleDateString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">
                                                    R$ {payment.amount.toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <Button
                                                    onClick={() => handleDeletePayment(payment)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-600 border-none h-7 w-7 p-0 flex items-center justify-center rounded-full"
                                                    title="Excluir / Estornar"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                                {payment.status === 'confirmed' && (
                                                    <Button
                                                        onClick={() => handleGenerateReceipt(payment)}
                                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-none h-7 text-xs px-2"
                                                        title="Baixar Recibo"
                                                    >
                                                        <FileText size={14} className="mr-1" />
                                                        PDF
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Payment Modal */}
            {
                showEditPaymentModal && editingPayment && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                Editar Pagamento
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Valor (R$)
                                    </label>
                                    <input
                                        type="number"
                                        value={editAmount}
                                        onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        step="0.01"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Descrição
                                    </label>
                                    <input
                                        type="text"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    onClick={() => setShowEditPaymentModal(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleUpdatePayment}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none"
                                >
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Subscription Modal */}
            {
                showCreateModal && selectedBase && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                Criar Assinatura - {selectedBase.name}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Limite de Membros
                                    </label>
                                    <input
                                        type="number"
                                        value={memberLimit}
                                        onChange={(e) => setMemberLimit(parseInt(e.target.value) || 0)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Plano
                                    </label>
                                    <select
                                        value={plan}
                                        onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="monthly">Mensal (1 mês)</option>
                                        <option value="quarterly">Trimestral (3 meses)</option>
                                        <option value="semiannual">Semestral (6 meses)</option>
                                        <option value="annual">Anual (12 meses)</option>
                                        <option value="free">Livre (12 meses)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Data Inicial
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-600">Valor Total:</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            R$ {calculateSubscriptionAmount(memberLimit, plan).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Uma cobrança pendente será criada para este valor. A assinatura será ativada após a confirmação do pagamento.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCreateSubscription}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none"
                                >
                                    Criar (Pendente)
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Member Modal */}
            {
                showAddMemberModal && selectedBase && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                Adicionar Membros - {selectedBase.name}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Quantidade de Membros
                                    </label>
                                    <input
                                        type="number"
                                        value={membersToAdd}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setMembersToAdd(val);
                                            setAddMemberAmount(calculateAddMemberAmount(val, monthsToAdd));
                                        }}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Meses
                                    </label>
                                    <input
                                        type="number"
                                        value={monthsToAdd}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setMonthsToAdd(val);
                                            setAddMemberAmount(calculateAddMemberAmount(membersToAdd, val));
                                        }}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        min="1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Multiplicador para cálculo do valor (R$ 1,00/membro/mês).
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Valor a Cobrar (R$)
                                    </label>
                                    <input
                                        type="number"
                                        value={addMemberAmount}
                                        onChange={(e) => setAddMemberAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        step="0.01"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Pode ser ajustado manualmente.
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Total:</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            R$ {addMemberAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    onClick={() => setShowAddMemberModal(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAddMember}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white border-none"
                                >
                                    Gerar Cobrança
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bulk Edit End Date Modal */}
            {showBulkEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Alterar Data de Vencimento em Massa
                        </h2>

                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-blue-900">
                                <strong>{selectedBases.size} clube(s)</strong> selecionado(s)
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Nova Data de Vencimento
                                </label>
                                <input
                                    type="date"
                                    value={bulkNewEndDate}
                                    onChange={(e) => setBulkNewEndDate(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Esta data será aplicada a todos os clubes selecionados
                                </p>
                            </div>

                            {bulkNewEndDate && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Nova data:</span>
                                        <span className="text-lg font-bold text-blue-600">
                                            {new Date(bulkNewEndDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                onClick={() => {
                                    setShowBulkEditModal(false);
                                    setBulkNewEndDate('');
                                }}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleBulkUpdateEndDate}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none"
                            >
                                Confirmar Alteração
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
