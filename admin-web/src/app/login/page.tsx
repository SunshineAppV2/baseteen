"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getCurrentMemberCount, createPayment, confirmPayment, getAllPayments, getSubscription, updatePayment, deletePayment, canAddMember } from '@/lib/subscription';
import { auth, db } from "@/services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCollection } from "@/hooks/useFirestore";
import {
    ArrowRight,
    Lock,
    Mail,
    User,
    UserPlus,
    LogIn,
    CreditCard,
    Hash,
    Sparkles,
    Smartphone,
    Globe,
    Building2,
    MapPin,
    Users,
    ChevronLeft,
    Home
} from "lucide-react";

interface Union { id: string; name: string; }
interface Association { id: string; name: string; unionId: string; }
interface Region { id: string; name: string; associationId?: string; }
interface District { id: string; name: string; regionId?: string; }
interface Base { id: string; name: string; districtId: string; }

function LoginContent() {
    const searchParams = useSearchParams();
    const isInvited = !!searchParams.get('baseId');
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [cpf, setCpf] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // New registration fields
    const [billingPlan, setBillingPlan] = useState<"mensal" | "trimestral" | "anual">("mensal");
    const [accessQuantity, setAccessQuantity] = useState(1);
    const [programType, setProgramType] = useState<"SOUL+" | "GA">("GA");

    // Hierarchy Selection
    const [unionId, setUnionId] = useState("");
    const [associationId, setAssociationId] = useState("");
    const [regionId, setRegionId] = useState("");
    const [districtId, setDistrictId] = useState("");
    const [baseId, setBaseId] = useState("");
    const [targetRole, setTargetRole] = useState("membro");

    // Custom names for new entities
    const [customUnion, setCustomUnion] = useState("");
    const [customAssociation, setCustomAssociation] = useState("");
    const [customRegion, setCustomRegion] = useState("");
    const [customDistrict, setCustomDistrict] = useState("");
    const [customBase, setCustomBase] = useState("");

    // Toggles for manual entry
    const [isManualUnion, setIsManualUnion] = useState(false);
    const [isManualAssociation, setIsManualAssociation] = useState(false);
    const [isManualRegion, setIsManualRegion] = useState(false);
    const [isManualDistrict, setIsManualDistrict] = useState(false);
    const [isManualBase, setIsManualBase] = useState(false);

    // Fetch lists
    const { data: unions } = useCollection<Union>("unions");
    const { data: associations } = useCollection<Association>("associations");
    const { data: regions } = useCollection<Region>("regions");
    const { data: districts } = useCollection<District>("districts");
    const { data: bases } = useCollection<Base>("bases");

    const router = useRouter();

    // Filtered Lists
    const filteredAssociations = useMemo(() =>
        associations.filter(a => a.unionId === unionId), [associations, unionId]);

    const filteredRegions = useMemo(() =>
        regions.filter(r => r.associationId === associationId), [regions, associationId]);

    const filteredDistricts = useMemo(() =>
        districts.filter(d => d.regionId === regionId), [districts, regionId]);

    const filteredBases = useMemo(() =>
        bases.filter(b => b.districtId === districtId), [bases, districtId]);

    const invitedBaseName = useMemo(() => {
        const bId = searchParams.get('baseId');
        return bases.find(b => b.id === bId)?.name;
    }, [bases, searchParams]);

    // Handle Invite Link
    useEffect(() => {
        const bId = searchParams.get('baseId');
        if (bId) {
            setIsLogin(false); // Force Register
            setBaseId(bId);

            // Auto fill the rest if provided
            const dId = searchParams.get('districtId');
            const rId = searchParams.get('regionId');
            const aId = searchParams.get('associationId');
            const uId = searchParams.get('unionId');
            const prog = searchParams.get('program');

            if (uId) setUnionId(uId);
            if (aId) setAssociationId(aId);
            if (rId) setRegionId(rId);
            if (dId) setDistrictId(dId);
            if (prog === 'GA' || prog === 'SOUL+') setProgramType(prog as "GA" | "SOUL+");
        }

        const roleParam = searchParams.get('role');
        if (roleParam === 'coord_regiao' || roleParam === 'coord_distrital') {
            setTargetRole(roleParam);
            setIsLogin(false); // Force register for these links
        }
    }, [searchParams]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isLogin && step === 1) {
            // Basic validation for Step 1
            if (!displayName || !email || !password || !whatsapp) {
                return setError("Preencha todos os campos obrigatórios.");
            }

            if (isInvited) {
                // Check member limit before registering (Proceeding to registration logic below)
                if (baseId) {
                    setLoading(true);
                    const limitCheck = await canAddMember(baseId);
                    setLoading(false);
                    if (!limitCheck.canAdd) {
                        return setError(`Esta base já atingiu o limite de membros (${limitCheck.currentCount}/${limitCheck.memberLimit}).`);
                    }
                }
            } else {
                setStep(2);
                return;
            }
        }

        if (!isLogin && step === 2) {
            let hasLocation = false;

            if (targetRole === 'coord_regiao') {
                // Regional only needs Region
                hasLocation = !!(regionId || customRegion);
                if (!hasLocation) return setError("Por favor, selecione ou cadastre sua Região.");
            } else if (targetRole === 'coord_distrital') {
                // Distrital needs Region and District
                hasLocation = !!(regionId || customRegion) && !!(districtId || customDistrict);
                if (!hasLocation) return setError("Por favor, selecione ou cadastre sua Região e Distrito.");
            } else {
                // Default (Membro/Coord Base)
                hasLocation = !!(unionId || customUnion) &&
                    !!(associationId || customAssociation) &&
                    !!(regionId || customRegion) &&
                    !!(districtId || customDistrict) &&
                    !!(baseId || customBase);

                if (!hasLocation) {
                    return setError("Por favor, selecione ou cadastre sua localização completa.");
                }
            }

            // Check member limit if joining an existing base
            if (!isManualBase && baseId && targetRole === 'membro') {
                setLoading(true);
                const limitCheck = await canAddMember(baseId);
                setLoading(false);
                if (!limitCheck.canAdd) {
                    return setError(`Esta base já atingiu o limite de membros (${limitCheck.currentCount}/${limitCheck.memberLimit}). Entre em contato com seu coordenador.`);
                }
            }
        }

        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                router.push("/dashboard");
            } else {
                // Register
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update Profile
                await updateProfile(user, { displayName });

                // Create user document with pending status
                const isGuaranteedAccess = targetRole === 'coord_regiao' || targetRole === 'coord_distrital';

                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email,
                    displayName,
                    whatsapp,
                    cpf,
                    role: targetRole,
                    status: (isInvited || isGuaranteedAccess) ? "approved" : "pending",
                    unionId,
                    associationId,
                    regionId,
                    districtId,
                    baseId,
                    // Store names if they are new, so admin can create them
                    isNewLocation: isManualUnion || isManualAssociation || isManualRegion || isManualDistrict || isManualBase,
                    customLocation: {
                        union: isManualUnion ? customUnion : null,
                        association: isManualAssociation ? customAssociation : null,
                        region: isManualRegion ? customRegion : null,
                        district: isManualDistrict ? customDistrict : null,
                        base: isManualBase ? customBase : null
                    },
                    createdAt: serverTimestamp(),
                    subscription: {
                        plan: billingPlan,
                        accesses: accessQuantity,
                        program: programType
                    },
                    stats: {
                        currentXp: 0,
                        completedTasks: 0
                    }
                });

                router.push("/dashboard");
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError("Este email já está em uso.");
            } else if (err.code === 'auth/weak-password') {
                setError("A senha deve ter pelo menos 6 caracteres.");
            } else {
                setError(isLogin ? "Email ou senha inválidos." : "Erro ao criar conta.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md space-y-8 card-soft p-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-extrabold text-primary">Baseteen</h1>
                    <p className="text-text-secondary">
                        {isLogin ? "Acesso Administrativo" : "Crie sua conta"}
                    </p>
                    {isInvited && !isLogin && step === 1 && (
                        <div className="bg-green-50 border border-green-100 p-3 rounded-xl flex items-center gap-3 animate-fade-in mt-4 shadow-sm">
                            <Sparkles size={20} className="text-green-600 shrink-0" />
                            <p className="text-xs font-bold text-green-800 text-left">
                                Você foi convidado {invitedBaseName ? (
                                    <>para a Base <span className="underline italic text-primary">{invitedBaseName}</span></>
                                ) : "para se juntar a uma Base"}.
                                Preencha seus dados para solicitar seu acesso.
                            </p>
                        </div>
                    )}
                    {!isLogin && (
                        <div className="flex justify-center gap-2 mt-2">
                            <div className={`h-1 w-8 rounded-full ${step === 1 ? 'bg-primary' : 'bg-gray-200'}`} />
                            <div className={`h-1 w-8 rounded-full ${step === 2 ? 'bg-primary' : 'bg-gray-200'}`} />
                        </div>
                    )}
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    <div className="space-y-4">
                        {isLogin ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : step === 1 ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">Nome Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="text"
                                            required
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="Seu nome"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">WhatsApp</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="tel"
                                            required
                                            value={whatsapp}
                                            onChange={(e) => setWhatsapp(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>

                                {!isInvited && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-secondary ml-1">CPF (Opcional)</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                            <input
                                                type="text"
                                                value={cpf}
                                                onChange={(e) => setCpf(e.target.value)}
                                                className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                                placeholder="000.000.000-00"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-secondary ml-1">Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                {!isInvited && (
                                    <div className="pt-4 mt-4 border-t border-gray-100 space-y-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Informações da Base</p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-text-secondary ml-1">Base</label>
                                                <div className="relative">
                                                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                                    <select
                                                        value={programType}
                                                        onChange={(e) => setProgramType(e.target.value as any)}
                                                        className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                                                    >
                                                        <option value="GA">GA (13-16 anos)</option>
                                                        <option value="SOUL+">SOUL+ (10-12 anos)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-text-secondary ml-1">Acessos</label>
                                                <div className="relative">
                                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        required
                                                        value={accessQuantity}
                                                        onChange={(e) => setAccessQuantity(parseInt(e.target.value))}
                                                        className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-text-secondary ml-1">Forma de Pagamento</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                                <select
                                                    value={billingPlan}
                                                    onChange={(e) => setBillingPlan(e.target.value as any)}
                                                    className="w-full bg-surface border border-gray-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                                                >
                                                    <option value="mensal">Mensal</option>
                                                    <option value="trimestral">Trimestral</option>
                                                    <option value="anual">Anual</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Step 2: Hierarchy */}
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft size={20} className="text-gray-400" />
                                    </button>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {isInvited ? "Confirmar Localização" : targetRole !== 'membro' ? `Cadastro de ${targetRole === 'coord_regiao' ? 'Regional' : 'Distrital'}` : "Vínculo Institucional"}
                                    </p>
                                </div>

                                {isInvited ? (
                                    <div className="bg-primary/5 border border-primary/10 p-5 rounded-3xl text-left mb-6 shadow-inner">
                                        <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] mb-3">Vínculo Automático</p>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Globe size={12} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-text-secondary uppercase">União e Associação</p>
                                                    <p className="text-sm font-bold text-text-primary">
                                                        {unions.find(u => u.id === unionId)?.name || '...'}
                                                        <span className="mx-1.5 opacity-30">/</span>
                                                        {associations.find(a => a.id === associationId)?.name || '...'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Home size={12} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-text-secondary uppercase">Sua Base</p>
                                                    <p className="text-lg font-black text-primary leading-tight">{invitedBaseName}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-5 pt-4 border-t border-primary/10 text-center">
                                            <p className="text-[11px] text-text-secondary font-medium italic">
                                                * Os dados da base são fixos para convites.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-left">
                                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-4 animate-fade-in text-left">
                                            <div className="flex gap-3 text-left">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                    <Sparkles size={16} className="text-blue-600" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-blue-900">Dica Importante</p>
                                                    <p className="text-xs leading-relaxed text-blue-800 font-medium">
                                                        Cuidado ao preencher sua localização! Se sua Base ou Distrito não estiverem na lista, você pode clicar em <b>"Não encontrei..."</b> para cadastrar um novo. Seu coordenador usará essas informações para aprovar seu acesso.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 1. UNIÃO */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-medium text-text-secondary italic">1. Selecione sua União</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsManualUnion(!isManualUnion);
                                                        setUnionId("");
                                                        setCustomUnion("");
                                                    }}
                                                    className="text-[10px] font-bold text-primary hover:underline"
                                                >
                                                    {isManualUnion ? "Voltar para lista" : "Não encontrei"}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                                                {isManualUnion ? (
                                                    <input
                                                        type="text"
                                                        required
                                                        value={customUnion}
                                                        onChange={(e) => setCustomUnion(e.target.value)}
                                                        className="w-full bg-surface border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                                                        placeholder="Digite o nome da sua União"
                                                    />
                                                ) : (
                                                    <select
                                                        required
                                                        value={unionId}
                                                        onChange={(e) => {
                                                            setUnionId(e.target.value);
                                                            setAssociationId("");
                                                            setRegionId("");
                                                            setDistrictId("");
                                                            setBaseId("");
                                                        }}
                                                        className="w-full bg-surface border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium appearance-none"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {unions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. ASSOCIAÇÃO */}
                                        {(unionId || isManualUnion) && (
                                            <div className="space-y-1 animate-fade-in shadow-sm p-3 rounded-2xl bg-gray-50/50 border border-gray-100/50">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-medium text-text-secondary italic">2. Selecione sua Associação</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsManualAssociation(!isManualAssociation);
                                                            setAssociationId("");
                                                            setCustomAssociation("");
                                                        }}
                                                        className="text-[10px] font-bold text-primary hover:underline"
                                                    >
                                                        {isManualAssociation ? "Voltar para lista" : "Não encontrei"}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                                                    {isManualAssociation ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={customAssociation}
                                                            onChange={(e) => setCustomAssociation(e.target.value)}
                                                            className="w-full bg-surface border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                                                            placeholder="Digite o nome da Associação"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={associationId}
                                                            onChange={(e) => {
                                                                setAssociationId(e.target.value);
                                                                setRegionId("");
                                                                setDistrictId("");
                                                                setBaseId("");
                                                            }}
                                                            className="w-full bg-surface border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium appearance-none"
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {filteredAssociations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. REGIÃO */}
                                        {(associationId || isManualAssociation) && (
                                            <div className="space-y-1 animate-fade-in">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-medium text-text-secondary italic">3. Selecione sua Região</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsManualRegion(!isManualRegion);
                                                            setRegionId("");
                                                            setCustomRegion("");
                                                        }}
                                                        className="text-[10px] font-bold text-primary hover:underline"
                                                    >
                                                        {isManualRegion ? "Voltar para lista" : "Não encontrei"}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                                                    {isManualRegion ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={customRegion}
                                                            onChange={(e) => setCustomRegion(e.target.value)}
                                                            className="w-full bg-surface border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                                                            placeholder="Digite o nome da Região"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={regionId}
                                                            onChange={(e) => {
                                                                setRegionId(e.target.value);
                                                                setDistrictId("");
                                                                setBaseId("");
                                                            }}
                                                            className="w-full bg-surface border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium appearance-none"
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {filteredRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. DISTRITO */}
                                        {((regionId || isManualRegion) && targetRole !== 'coord_regiao') && (
                                            <div className="space-y-1 animate-fade-in">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-medium text-text-secondary italic">4. Selecione seu Distrito</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsManualDistrict(!isManualDistrict);
                                                            setDistrictId("");
                                                            setCustomDistrict("");
                                                        }}
                                                        className="text-[10px] font-bold text-primary hover:underline"
                                                    >
                                                        {isManualDistrict ? "Voltar para lista" : "Não encontrei"}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                                                    {isManualDistrict ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={customDistrict}
                                                            onChange={(e) => setCustomDistrict(e.target.value)}
                                                            className="w-full bg-surface border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                                                            placeholder="Digite o nome do Distrito"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={districtId}
                                                            onChange={(e) => {
                                                                setDistrictId(e.target.value);
                                                                setBaseId("");
                                                            }}
                                                            className="w-full bg-surface border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium appearance-none"
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {filteredDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 5. BASE */}
                                        {((districtId || isManualDistrict) && targetRole === 'membro') && (
                                            <div className="space-y-1 animate-fade-in">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-medium text-text-secondary italic font-bold text-primary">5. Sua Localidade (Base)</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsManualBase(!isManualBase);
                                                            setBaseId("");
                                                            setCustomBase("");
                                                        }}
                                                        className="text-[10px] font-bold text-primary hover:underline"
                                                    >
                                                        {isManualBase ? "Voltar para lista" : "Não encontrei"}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
                                                    {isManualBase ? (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={customBase}
                                                            onChange={(e) => setCustomBase(e.target.value)}
                                                            className="w-full bg-white border border-primary/30 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-gray-900"
                                                            placeholder="Digite o nome da sua BASE"
                                                        />
                                                    ) : (
                                                        <select
                                                            required
                                                            value={baseId}
                                                            onChange={(e) => setBaseId(e.target.value)}
                                                            className="w-full bg-white border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-gray-900 appearance-none shadow-sm"
                                                        >
                                                            <option value="">Selecione sua Base...</option>
                                                            {filteredBases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg border border-red-100 animate-shake">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full py-6 text-lg font-bold"
                        disabled={loading}
                    >
                        {loading ? (isLogin ? "Entrando..." : "Processando...") : (
                            <>
                                {isLogin ? (
                                    <>
                                        Entrar <ArrowRight size={20} className="ml-2" />
                                    </>
                                ) : (isInvited || step === 2) ? (
                                    <>
                                        Concluir Cadastro <UserPlus size={20} className="ml-2" />
                                    </>
                                ) : (
                                    <>
                                        Avançar <ArrowRight size={20} className="ml-2" />
                                    </>
                                )}
                            </>
                        )}
                    </Button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setStep(1);
                            }}
                            className="text-primary font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                        >
                            {isLogin ? (
                                <>
                                    <UserPlus size={18} /> Não tem conta? Cadastre-se
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} /> Já tem conta? Entre aqui
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Carregando...</div>}>
            <LoginContent />
        </Suspense>
    );
}
