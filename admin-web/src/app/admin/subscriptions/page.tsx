'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { useCollection, firestoreService } from '@/hooks/useFirestore';
import { Building2, Users, DollarSign, Calendar, Check, X, Plus, Edit2, Eye, FileText, AlertCircle, Trash2, Search, RefreshCcw, UserPlus, CreditCard, Sparkles, Hash, Smartphone, Home } from 'lucide-react';
import { SUBSCRIPTION_CONFIG, type Subscription, type SubscriptionPlan, type Payment, type PaymentType } from '@/config/subscription';
import { getCurrentMemberCount, createPayment, confirmPayment, getAllPayments, getSubscription, updatePayment, deletePayment, canAddMember } from '@/lib/subscription';
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

function SubscriptionManagementContent() {
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
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [activeMainTab, setActiveMainTab] = useState<'finance' | 'users'>('finance');

    const handleApproveUser = async (userToApprove: any) => {
        try {
            // Check member limit only if joining an existing base
            if (!userToApprove.isNewLocation && userToApprove.baseId && userToApprove.role === 'membro') {
                const limitCheck = await canAddMember(userToApprove.baseId);
                if (!limitCheck.canAdd) {
                    alert(`Impossível aprovar: A base atingiu o limite de membros (${limitCheck.currentCount}/${limitCheck.memberLimit}).`);
                    return;
                }
            }

            let finalLocation = {
                unionId: userToApprove.unionId || "",
                associationId: userToApprove.associationId || "",
                regionId: userToApprove.regionId || "",
                districtId: userToApprove.districtId || "",
                baseId: userToApprove.baseId || ""
            };

            if (userToApprove.isNewLocation && userToApprove.customLocation) {
                const cl = userToApprove.customLocation;

                // 1. UNIÃO
                if (cl.union) {
                    const unionRef = await addDoc(collection(db, "unions"), {
                        name: cl.union,
                        createdAt: serverTimestamp()
                    });
                    finalLocation.unionId = unionRef.id;
                }

                // 2. ASSOCIAÇÃO
                if (cl.association) {
                    const assocRef = await addDoc(collection(db, "associations"), {
                        name: cl.association,
                        unionId: finalLocation.unionId,
                        createdAt: serverTimestamp()
                    });
                    finalLocation.associationId = assocRef.id;
                }

                // 3. REGIÃO
                if (cl.region) {
                    const regionRef = await addDoc(collection(db, "regions"), {
                        name: cl.region,
                        associationId: finalLocation.associationId,
                        createdAt: serverTimestamp()
                    });
                    finalLocation.regionId = regionRef.id;
                }

                // 4. DISTRITO
                if (cl.district) {
                    const districtRef = await addDoc(collection(db, "districts"), {
                        name: cl.district,
                        regionId: finalLocation.regionId,
                        createdAt: serverTimestamp()
                    });
                    finalLocation.districtId = districtRef.id;
                }

                // 5. BASE
                if (cl.base) {
                    const baseRef = await addDoc(collection(db, "bases"), {
                        name: cl.base,
                        districtId: finalLocation.districtId,
                        program: userToApprove.subscription?.program || "GA",
                        coordinatorName: userToApprove.displayName || null, // COPIAR NOME DE QUEM CADASTROU
                        whatsapp: userToApprove.whatsapp || null, // COPIAR WHATSAPP DE QUEM CADASTROU
                        createdAt: serverTimestamp()
                    });
                    finalLocation.baseId = baseRef.id;
                }
            }

            await updateDoc(doc(db, "users", userToApprove.id), {
                ...finalLocation,
                status: "approved",
                role: "coord_base", // SET ROLE TO COORDINATOR UPON APPROVAL
                approvedAt: serverTimestamp(),
                approvedBy: user?.uid
            });

            // GENERATE PAYMENT AND SUBSCRIPTION
            const subInfo = userToApprove.subscription;
            if (subInfo && finalLocation.baseId) {
                const planMapping: Record<string, { months: number, configId: SubscriptionPlan, name: string }> = {
                    'mensal': { months: 1, configId: 'monthly', name: 'Mensal' },
                    'trimestral': { months: 3, configId: 'quarterly', name: 'Trimestral' },
                    'anual': { months: 12, configId: 'annual', name: 'Anual' }
                };

                const planData = planMapping[subInfo.plan] || planMapping['mensal'];
                const memberLimit = subInfo.accesses || 10;
                const totalAmount = SUBSCRIPTION_CONFIG.PRICE_PER_USER_MONTHLY * memberLimit * planData.months;

                // 1. Create Initial Subscription (Pending Activation)
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + planData.months);

                await setDoc(doc(db, "subscriptions", finalLocation.baseId), {
                    baseId: finalLocation.baseId,
                    plan: planData.configId,
                    status: "pending",
                    memberLimit: memberLimit,
                    currentMemberCount: 0,
                    startDate: Timestamp.fromDate(startDate),
                    endDate: Timestamp.fromDate(endDate),
                    amount: totalAmount,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // 2. Create Pending Payment
                await addDoc(collection(db, "payments"), {
                    baseId: finalLocation.baseId,
                    type: "subscription",
                    amount: totalAmount,
                    status: "pending",
                    paymentMethod: "pix",
                    description: `Assinatura ${planData.name} - ${memberLimit} Acessos`,
                    metadata: {
                        memberCount: memberLimit,
                        months: planData.months,
                        startDate: Timestamp.fromDate(startDate)
                    },
                    createdAt: serverTimestamp()
                });
            }

            alert("Usuário aprovado, estruturas criadas e pagamento gerado com sucesso!");
            loadData(); // Refresh lists
        } catch (error) {
            console.error("Error approving user:", error);
            alert("Erro ao aprovar usuário e criar estruturas.");
        }
    };

    const handleRejectUser = async (userToReject: any) => {
        if (!window.confirm(`Tem certeza que deseja reprovar o cadastro de ${userToReject.displayName}?`)) return;
        try {
            await updateDoc(doc(db, "users", userToReject.id), {
                status: "rejected",
                rejectedAt: new Date(),
                rejectedBy: user?.uid
            });
            alert("Cadastro reprovado.");
        } catch (error) {
            console.error("Error rejecting user:", error);
            alert("Erro ao reprovar usuário.");
        }
    };

    function PendingUserList() {
        const { data: pendingUsers, loading: loadingUsers } = useCollection<any>("users", [where("status", "==", "pending")]);

        if (loadingUsers) {
            return (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse h-24" />
                    ))}
                </div>
            );
        }

        if (pendingUsers.length === 0) {
            return (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <UserPlus size={48} className="mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">Tudo em dia!</h3>
                    <p className="text-gray-500">Nenhum novo cadastro aguardando análise.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {pendingUsers.map((u) => (
                    <div key={u.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 w-full flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                                {u.displayName?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-gray-900">{u.displayName}</h3>
                                    {u.subscription?.program && (
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100">
                                            {u.subscription.program}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">{u.email}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                                    {u.whatsapp && (
                                        <a
                                            href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`}
                                            target="_blank"
                                            className="flex items-center gap-1 text-xs text-green-600 font-bold hover:underline"
                                        >
                                            <Smartphone size={12} />
                                            <span>WhatsApp: {u.whatsapp}</span>
                                        </a>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-bold">
                                        <Home size={12} />
                                        <span>
                                            Base: {u.isNewLocation && u.customLocation?.base
                                                ? <span className="text-orange-600">NEW: {u.customLocation.base}</span>
                                                : bases.find(b => b.id === u.baseId)?.name || u.baseId || 'Não selecionada'}
                                        </span>
                                    </div>
                                    {u.cpf && (
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <Hash size={12} />
                                            <span>CPF: <b className="text-gray-600 font-bold">{u.cpf}</b></span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <CreditCard size={12} />
                                        <span>Plano: <b className="text-gray-600 uppercase">{u.subscription?.plan || 'N/A'}</b></span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <Users size={12} />
                                        <span>Acessos: <b className="text-gray-600">{u.subscription?.accesses || 1}</b></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex shrink-0 gap-3 w-full md:w-auto">
                            <Button
                                variant="outline"
                                className="flex-1 md:flex-none border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectUser(u)}
                            >
                                <X size={18} className="mr-2" />
                                Reprovar
                            </Button>
                            <Button
                                className="flex-1 md:flex-none bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                onClick={() => handleApproveUser(u)}
                            >
                                <Check size={18} className="mr-2" />
                                Aprovar Cadastro
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

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

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100 pb-px">
                <button
                    onClick={() => setActiveMainTab('finance')}
                    className={clsx(
                        "pb-4 text-sm font-bold transition-all relative px-2",
                        activeMainTab === 'finance' ? "text-primary" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <DollarSign size={18} />
                        Assinaturas e Pagamentos
                    </div>
                    {activeMainTab === 'finance' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveMainTab('users')}
                    className={clsx(
                        "pb-4 text-sm font-bold transition-all relative px-2",
                        activeMainTab === 'users' ? "text-primary" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <UserPlus size={18} />
                        Novos Cadastros
                    </div>
                    {activeMainTab === 'users' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                    )}
                </button>
            </div>

            {activeMainTab === 'users' ? (
                <PendingUserList />
            ) : (
                <>
                    {/* Bases without valid subscription (Quick Actions) */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Plus size={20} className="text-blue-600" />
                            Nova Assinatura / Adicionar Membros
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {filteredBases.map(base => {
                                const sub = subscriptions[base.id];
                                const endDate = sub?.endDate ? convertToDate(sub.endDate) : new Date(0);
                                const isActive = sub && sub.status === 'active' && endDate > new Date();

                                return (
                                    <div key={base.id} className="flex flex-col gap-1 bg-gray-50 rounded-lg p-2 border border-gray-200 min-w-[200px]">
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
                                );
                            })}
                        </div>
                    </div>

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
                    )}

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
                </>
            )}

            {/* Edit Payment Modal */}
            {showEditPaymentModal && editingPayment && (
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
            )}

            {/* Create Subscription Modal */}
            {showCreateModal && selectedBase && (
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
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && selectedBase && (
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
            )}
        </div>
    );
}

export default function SubscriptionManagementPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-gray-400">Carregando sistema de cobrança...</div>}>
            <SubscriptionManagementContent />
        </Suspense>
    );
}
