"use client";

import { useState, useEffect, useMemo } from "react";
import { useCollection, firestoreService } from "@/hooks/useFirestore";
import { Button } from "@/components/ui/Button";
import {
    Search,
    UserPlus,
    Filter,
    MoreVertical,
    Mail,
    Shield,
    MapPin,
    RefreshCw,
    Share2,
    CheckCircle,
    SearchX,
    X,
    Save,
    Trash2,
    Pencil,
    KeyRound,
    Send,
    LayoutGrid,
    List,
    TrendingUp
} from "lucide-react";
import { initializeApp, deleteApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary, sendPasswordResetEmail } from "firebase/auth";
import { firebaseConfig } from "@/services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { clsx } from "clsx";
import { canAddMember } from "@/lib/subscription";
import MemberLimitModal from "@/components/MemberLimitModal";

interface District {
    id: string;
    name: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
}

interface Base {
    id: string;
    name: string;
    districtId: string;
}

interface Union { id: string; name: string; }
interface Association { id: string; name: string; unionId: string; }
interface Region { id: string; name: string; associationId?: string; }

export type UserClassification = 'pre-adolescente' | 'adolescente';

export interface User {
    id: string;
    displayName: string;
    email: string;
    role: string;
    baseId?: string;
    districtId?: string;
    quarterClassification?: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
    birthDate?: string;
    classification?: UserClassification;
    participatesInRanking?: boolean;
    stats?: {
        level: number;
        currentXp: number;
    };
}

function calculateAge(dateString?: string) {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString + 'T12:00:00'); // Append time to avoid timezone offset issues
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

export function getTheoreticalClassification(birthDate?: string): UserClassification {
    const age = calculateAge(birthDate);
    if (age === null) return 'pre-adolescente';
    // 13 to 16 inclusive for Adolescente
    if (age >= 13 && age <= 16) return 'adolescente';
    // 10 to 12 (or effectively anything else currently) for Pre-adolescente
    return 'pre-adolescente';
}

const roleColors: Record<string, string> = {
    master: "bg-purple-100 text-purple-700",
    coord_geral: "bg-blue-100 text-blue-700",
    coord_uniao: "bg-indigo-100 text-indigo-700",
    coord_associacao: "bg-sky-100 text-sky-700",
    coord_regiao: "bg-teal-100 text-teal-700",
    secretaria: "bg-green-100 text-green-700",
    coord_distrital: "bg-orange-100 text-orange-700",
    coord_base: "bg-cyan-100 text-cyan-700",
    membro: "bg-gray-100 text-gray-700",
};

const roleNames: Record<string, string> = {
    master: "Master",
    coord_geral: "Coord. Geral",
    coord_uniao: "Coord. União",
    coord_associacao: "Coord. Associação",
    coord_regiao: "Coord. Região",
    secretaria: "Secretária",
    coord_distrital: "Coord. Distrital",
    coord_base: "Coord. Base",
    membro: "Membro",
};

import { useAuth } from "@/context/AuthContext";

import MemberDetailModal from "./MemberDetailModal";

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    // Constraints
    const userConstraints = currentUser?.role === 'coord_base' && currentUser.baseId
        ? [where('baseId', '==', currentUser.baseId)]
        : currentUser?.role === 'coord_distrital' && currentUser.districtId
            ? [where('districtId', '==', currentUser.districtId)]
            : [];

    const { data: users, loading } = useCollection<User>("users", userConstraints);
    const { data: districtsRaw } = useCollection<District>("districts");
    const { data: basesRaw } = useCollection<Base>("bases");
    const { data: regionsRaw } = useCollection<Region>("regions");
    const { data: associationsRaw } = useCollection<Association>("associations");
    const { data: unionsRaw } = useCollection<Union>("unions");

    // Sort all lists alphabetically
    const districts = useMemo(() => [...districtsRaw].sort((a, b) => a.name.localeCompare(b.name)), [districtsRaw]);
    const bases = useMemo(() => [...basesRaw].sort((a, b) => a.name.localeCompare(b.name)), [basesRaw]);
    const regions = useMemo(() => [...regionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [regionsRaw]);
    const associations = useMemo(() => [...associationsRaw].sort((a, b) => a.name.localeCompare(b.name)), [associationsRaw]);
    const unions = useMemo(() => [...unionsRaw].sort((a, b) => a.name.localeCompare(b.name)), [unionsRaw]);

    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [districtFilter, setDistrictFilter] = useState("all");

    const [baseFilter, setBaseFilter] = useState("all");
    const [classificationFilter, setClassificationFilter] = useState("all");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitInfo, setLimitInfo] = useState({ currentCount: 0, memberLimit: 0 });

    // Modal State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editRole, setEditRole] = useState("");
    const [editUnion, setEditUnion] = useState("");
    const [editAssociation, setEditAssociation] = useState("");
    const [editRegion, setEditRegion] = useState("");
    const [editDistrict, setEditDistrict] = useState("");
    const [editBase, setEditBase] = useState("");
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editBirthDate, setEditBirthDate] = useState("");
    const [editQuarterClassification, setEditQuarterClassification] = useState("");
    const [editParticipatesInRanking, setEditParticipatesInRanking] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [copiedInviteRole, setCopiedInviteRole] = useState<string | null>(null);
    const [inviteAssociationId, setInviteAssociationId] = useState("");

    const handleCopyInvite = (role?: string, sponsored?: boolean) => {
        if (!currentUser) return;

        const baseUrl = window.location.origin + "/login";
        const params = new URLSearchParams({
            unionId: currentUser.unionId || "",
            associationId: inviteAssociationId || currentUser.associationId || "",
            regionId: currentUser.regionId || "",
            districtId: currentUser.districtId || "",
            baseId: currentUser.baseId || ""
        });

        if (role) {
            params.set('role', role);
            if (role === 'coord_regiao') {
                params.delete('districtId');
                params.delete('baseId');
            } else if (role === 'coord_distrital') {
                params.delete('baseId');
            }
        }

        if (sponsored) {
            params.set('sponsored', 'true');
        }

        const currentBase = bases.find(b => b.id === currentUser.baseId);
        if (!role && currentBase && (currentBase as any).program) {
            params.append('program', (currentBase as any).program);
        }

        const link = `${baseUrl}?${params.toString()}`;
        navigator.clipboard.writeText(link);
        setCopiedInviteRole(sponsored ? `${role}_sponsored` : (role || "membro"));
        setTimeout(() => setCopiedInviteRole(null), 2000);
    };

    // New User State
    const [newUser, setNewUser] = useState({
        displayName: "",
        email: "",
        password: "",
        role: ['coord_base', 'coord_distrital'].includes(currentUser?.role || '') ? 'membro' : 'membro',
        unionId: "",
        associationId: "",
        regionId: "",
        districtId: "",
        baseId: "",
        birthDate: "",
        quarterClassification: "",
        participatesInRanking: true
    });

    // Effect to enforce role 'membro' and pre-fill location when modal opens/user role is loaded for Coords
    useEffect(() => {
        if (currentUser?.role === 'coord_base') {
            setNewUser(prev => ({
                ...prev,
                role: 'membro',
                districtId: currentUser.districtId || '',
                baseId: currentUser.baseId || ''
            }));
        } else if (currentUser?.role === 'coord_distrital') {
            setNewUser(prev => ({
                ...prev,
                role: 'membro',
                districtId: currentUser.districtId || '',
                baseId: '' // Let them choose base
            }));
        }
    }, [currentUser, isCreateModalOpen]);

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setEditRole(user.role);
        setEditUnion(user.unionId || "");
        setEditAssociation(user.associationId || "");
        setEditRegion(user.regionId || "");
        setEditDistrict(user.districtId || "");
        setEditBase(user.baseId || "");
        setEditDisplayName(user.displayName || "");
        setEditBirthDate(user.birthDate || "");
        setEditQuarterClassification(user.quarterClassification || "");
        setEditParticipatesInRanking(user.participatesInRanking !== false);
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.displayName || !newUser.password) {
            return alert("Preencha nome, email e senha!");
        }
        if (newUser.password.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");

        // Check member limit if creating a member
        if (newUser.role === 'membro' && newUser.baseId) {
            const limitCheck = await canAddMember(newUser.baseId);
            if (!limitCheck.canAdd) {
                setLimitInfo({
                    currentCount: limitCheck.currentCount,
                    memberLimit: limitCheck.memberLimit
                });
                setShowLimitModal(true);
                return;
            }
        }

        setIsSaving(true);
        // Workaround: Create a secondary app to create user without logging out the admin
        const secondaryAppName = "secondaryApp";
        let secondaryApp;

        try {
            // Check if exists or create
            const existingApps = getApps();
            const existingSecondary = existingApps.find(app => app.name === secondaryAppName);
            secondaryApp = existingSecondary || initializeApp(firebaseConfig, secondaryAppName);

            const secondaryAuth = getAuth(secondaryApp);

            // Create User in Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
            const uid = userCredential.user.uid;

            // Helper to resolve hierarchy
            let finalUnionId = newUser.unionId || null;
            let finalAssocId = newUser.associationId || null;
            let finalRegionId = newUser.regionId || null;

            // If base/district selected, infer parents
            if (newUser.districtId) {
                const d = districts.find(d => d.id === newUser.districtId);
                if (d?.regionId) {
                    finalRegionId = d.regionId;
                    const r = regions.find(r => r.id === finalRegionId);
                    if (r?.associationId) {
                        finalAssocId = r.associationId;
                        const a = associations.find(a => a.id === finalAssocId);
                        if (a?.unionId) finalUnionId = a.unionId;
                    }
                }
            } else if (newUser.regionId) {
                const r = regions.find(r => r.id === newUser.regionId);
                if (r?.associationId) {
                    finalAssocId = r.associationId;
                    const a = associations.find(a => a.id === finalAssocId);
                    if (a?.unionId) finalUnionId = a.unionId;
                }
            } else if (newUser.associationId) {
                const a = associations.find(a => a.id === newUser.associationId);
                if (a?.unionId) finalUnionId = a.unionId;
            }

            // Save to Firestore with specific UID
            await firestoreService.set("users", uid, {
                displayName: newUser.displayName,
                email: newUser.email,
                role: newUser.role,
                unionId: finalUnionId,
                associationId: finalAssocId,
                regionId: finalRegionId,
                districtId: newUser.districtId || null,
                baseId: newUser.baseId || null,
                birthDate: newUser.birthDate || null,
                quarterClassification: newUser.quarterClassification || null,
                classification: getTheoreticalClassification(newUser.birthDate),
                participatesInRanking: newUser.participatesInRanking,
                stats: { level: 1, currentXp: 0 },
                createdAt: new Date()
            });

            // Cleanup
            await signOutSecondary(secondaryAuth);

            setIsCreateModalOpen(false);
            setNewUser({ displayName: "", email: "", role: "membro", unionId: "", associationId: "", regionId: "", districtId: "", baseId: "", password: "", birthDate: "", quarterClassification: "", participatesInRanking: true });
            alert("Usuário criado com sucesso! O login já está ativo.");
        } catch (error: any) {
            console.error("Error creating user:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("Erro: Este email já está cadastrado.");
            } else {
                alert("Erro ao criar usuário: " + error.message);
            }
        } finally {
            // Ensure secondary app is deleted to free resources, but handle if it fails
            if (secondaryApp) {
                try {
                    // Note: deleteApp is async. We don't strictly wait for it to block UI unlock
                    deleteApp(secondaryApp).catch(console.error);
                } catch (e) { console.error(e); }
            }
            setIsSaving(false);
        }
    };

    const handleEmailBlur = async () => {
        if (!newUser.email) return;

        const q = query(collection(db, "users"), where("email", "==", newUser.email));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                setNewUser(prev => ({
                    ...prev,
                    displayName: userData.displayName || prev.displayName,
                    role: userData.role || prev.role,
                    unionId: userData.unionId || prev.unionId,
                    associationId: userData.associationId || prev.associationId,
                    regionId: userData.regionId || prev.regionId,
                    districtId: userData.districtId || prev.districtId,
                    baseId: userData.baseId || prev.baseId,
                    birthDate: userData.birthDate || prev.birthDate,
                    participatesInRanking: userData.participatesInRanking !== undefined ? userData.participatesInRanking : prev.participatesInRanking,
                }));
                alert("Dados do usuário encontrados e carregados para este email.");
            }
        } catch (error) {
            console.error("Error auto-filling user:", error);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser?.email) return;
        if (!confirm(`Enviar email de redefinição de senha para ${selectedUser.email}?`)) return;

        setIsSaving(true);
        try {
            const auth = getAuth(); // Use main auth instance to send reset email
            await sendPasswordResetEmail(auth, selectedUser.email);
            alert("Email de redefinição enviado!");
        } catch (error: any) {
            console.error("Error sending reset email:", error);
            alert("Erro ao enviar email: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        try {
            // Helper to resolve hierarchy for edit
            let finalUnionId = editUnion || null;
            let finalAssocId = editAssociation || null;
            let finalRegionId = editRegion || null;

            // If base/district selected, infer parents (Priority: Base > District > Region > Assoc > Union)
            if (editDistrict) {
                const d = districts.find(d => d.id === editDistrict);
                if (d?.regionId) {
                    finalRegionId = d.regionId;
                    const r = regions.find(r => r.id === finalRegionId);
                    if (r?.associationId) {
                        finalAssocId = r.associationId;
                        const a = associations.find(a => a.id === finalAssocId);
                        if (a?.unionId) finalUnionId = a.unionId;
                    }
                }
            } else if (editRegion) {
                const r = regions.find(r => r.id === editRegion);
                if (r?.associationId) {
                    finalAssocId = r.associationId;
                    const a = associations.find(a => a.id === finalAssocId);
                    if (a?.unionId) finalUnionId = a.unionId;
                }
            } else if (editAssociation) {
                const a = associations.find(a => a.id === editAssociation);
                if (a?.unionId) finalUnionId = a.unionId;
            }

            await firestoreService.update("users", selectedUser.id, {
                displayName: editDisplayName,
                role: editRole,
                unionId: finalUnionId,
                associationId: finalAssocId,
                regionId: finalRegionId,
                districtId: editDistrict || null,
                baseId: editBase || null,
                birthDate: editBirthDate || null,
                quarterClassification: editQuarterClassification || null,
                // Use the correct classification function
                classification: getTheoreticalClassification(editBirthDate),
                participatesInRanking: editParticipatesInRanking
            });
            setSelectedUser(null);
            alert("Usuário atualizado com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar usuário.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Tem certeza que deseja excluir o usuário ${user.displayName}? Esta ação não pode ser desfeita.`)) return;

        try {
            await firestoreService.delete("users", user.id);
            alert("Usuário excluído com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir usuário.");
        }
    };

    const handlePromoteMembers = async () => {
        const eligibleUsers = users.filter(u =>
            u.role === 'membro' &&
            u.classification !== 'adolescente' &&
            calculateAge(u.birthDate)! >= 13
        );

        if (eligibleUsers.length === 0) {
            return alert("Nenhum membro elegível para promoção no momento.");
        }

        if (!confirm(`Deseja promover ${eligibleUsers.length} membros para 'Adolescente'?`)) return;

        setIsSaving(true);
        try {
            let promotedCount = 0;
            for (const member of eligibleUsers) {
                await firestoreService.update("users", member.id, {
                    classification: 'adolescente'
                });
                promotedCount++;
            }
            alert(`${promotedCount} membros promovidos com sucesso!`);
        } catch (error) {
            console.error(error);
            alert("Erro ao promover membros.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRecalculateClassifications = async () => {
        // Recalculate ALL users' classifications based on current age
        const usersToUpdate = users.filter(u => u.birthDate); // Only users with birthDate

        if (usersToUpdate.length === 0) {
            return alert("Nenhum usuário com data de nascimento cadastrada.");
        }

        if (!confirm(`Deseja recalcular a classificação de ${usersToUpdate.length} usuários baseado na idade atual?\n\nIsso irá:\n- Marcar como ADOLESCENTE: usuários de 13-16 anos\n- Marcar como PRÉ-ADOLESCENTE: usuários de 10-12 anos`)) return;

        setIsSaving(true);
        try {
            let updatedCount = 0;
            for (const user of usersToUpdate) {
                const correctClassification = getTheoreticalClassification(user.birthDate);
                if (user.classification !== correctClassification) {
                    await firestoreService.update("users", user.id, {
                        classification: correctClassification
                    });
                    updatedCount++;
                }
            }
            alert(`${updatedCount} classificações atualizadas com sucesso!`);
        } catch (error) {
            console.error(error);
            alert("Erro ao recalcular classificações.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = users.filter(user => {
        // Area isolation based on current user role
        if (currentUser?.role === 'coord_distrital' && user.districtId !== currentUser.districtId) return false;
        if (currentUser?.role === 'coord_base' && user.baseId !== currentUser.baseId) return false;

        const matchesSearch =
            user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesDistrict = districtFilter === "all" || user.districtId === districtFilter;
        const matchesBase = baseFilter === "all" || user.baseId === baseFilter;
        const matchesClassification = classificationFilter === "all" || user.classification === classificationFilter;
        return matchesSearch && matchesRole && matchesDistrict && matchesBase && matchesClassification;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
                    <p className="text-text-secondary">Gerencie membros, coordenadores e permissões.</p>
                </div>
                <div className="flex gap-2">
                    {['master', 'admin', 'coord_geral'].includes(currentUser?.role || '') && (
                        <>
                            <Button variant="outline" onClick={handleRecalculateClassifications} className="flex items-center gap-2 text-blue-600 border-blue-600" disabled={isSaving}>
                                <RefreshCw size={20} />
                                Recalcular Classificações
                            </Button>
                            <Button variant="outline" onClick={handlePromoteMembers} className="flex items-center gap-2 text-primary border-primary" disabled={isSaving}>
                                <TrendingUp size={20} />
                                Promover p/ Adolescentes
                            </Button>
                        </>
                    )}
                    {/* Invite Links */}
                    <div className="flex flex-col md:flex-row items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        {/* Association Selector for Links */}
                        {['master', 'coord_geral', 'coord_uniao'].includes(currentUser?.role || '') && (
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-gray-400" />
                                <select
                                    className={clsx(
                                        "text-xs border-none bg-transparent font-bold focus:ring-0 cursor-pointer",
                                        inviteAssociationId ? "text-primary" : "text-gray-400"
                                    )}
                                    value={inviteAssociationId}
                                    onChange={(e) => setInviteAssociationId(e.target.value)}
                                >
                                    <option value="">+ Selecionar Associação</option>
                                    {associations.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                                <div className="h-4 w-px bg-gray-200 mx-1" />
                            </div>
                        )}

                        <div className="flex gap-2">
                            {/* Member/Base Invite */}
                            {((currentUser?.role === 'coord_base' && currentUser.baseId) || currentUser?.role === 'master' || currentUser?.role === 'coord_distrital') && (
                                <Button
                                    onClick={() => handleCopyInvite()}
                                    variant="outline"
                                    className={clsx(
                                        "flex items-center gap-2 border-primary transition-all",
                                        copiedInviteRole === "membro" ? "bg-green-50 text-green-600 border-green-600" : "text-primary hover:bg-primary/5"
                                    )}
                                >
                                    {copiedInviteRole === "membro" ? <CheckCircle size={20} /> : <Share2 size={20} />}
                                    {copiedInviteRole === "membro" ? "Copiado!" : "Convidar Membro"}
                                </Button>
                            )}

                            {/* Regional/Distrital Invite (Master, Geral, União, Assoc, Região) */}
                            {['master', 'coord_geral', 'coord_uniao', 'coord_associacao', 'coord_regiao'].includes(currentUser?.role || '') && (
                                <>
                                    <Button
                                        onClick={() => handleCopyInvite('coord_distrital')}
                                        variant="outline"
                                        className={clsx(
                                            "flex items-center gap-2 border-orange-500 transition-all",
                                            copiedInviteRole === "coord_distrital" ? "bg-green-50 text-green-600 border-green-600" : "text-orange-600 hover:bg-orange-50"
                                        )}
                                    >
                                        {copiedInviteRole === "coord_distrital" ? <CheckCircle size={20} /> : <Share2 size={20} />}
                                        {copiedInviteRole === "coord_distrital" ? "Copiado!" : "Link Distrital"}
                                    </Button>
                                    {['master', 'coord_geral', 'coord_uniao', 'coord_associacao'].includes(currentUser?.role || '') && (
                                        <>
                                            <Button
                                                onClick={() => handleCopyInvite('coord_regiao')}
                                                variant="outline"
                                                className={clsx(
                                                    "flex items-center gap-2 border-teal-500 transition-all",
                                                    copiedInviteRole === "coord_regiao" ? "bg-teal-50 text-teal-600 border-teal-600" : "text-teal-600 hover:bg-teal-50"
                                                )}
                                            >
                                                {copiedInviteRole === "coord_regiao" ? <CheckCircle size={20} /> : <Share2 size={20} />}
                                                {copiedInviteRole === "coord_regiao" ? "Copiado!" : "Link Regional"}
                                            </Button>

                                            <Button
                                                onClick={() => handleCopyInvite('coord_base', true)}
                                                variant="outline"
                                                className={clsx(
                                                    "flex items-center gap-2 border-primary transition-all",
                                                    copiedInviteRole === "coord_base_sponsored" ? "bg-green-50 text-green-600 border-green-600" : "text-primary hover:bg-primary/5"
                                                )}
                                            >
                                                {copiedInviteRole === "coord_base_sponsored" ? <CheckCircle size={20} /> : <Share2 size={20} />}
                                                {copiedInviteRole === "coord_base_sponsored" ? "Copiado!" : "Link Coord. Base (Patrocinado)"}
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
                            <UserPlus size={20} />
                            Novo Usuário
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="w-full bg-surface border-none rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <Filter className="text-text-secondary" size={20} />
                        <select
                            className="bg-surface border-none rounded-xl py-2 px-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text-primary"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="all">Cargos</option>
                            <option value="master">Master</option>
                            <option value="coord_geral">Coord. Geral</option>
                            <option value="secretaria">Secretária</option>
                            <option value="coord_distrital">Coord. Distrital</option>
                            <option value="coord_base">Coord. Base</option>
                            <option value="membro">Membro</option>
                        </select>
                    </div>

                    {(currentUser?.role === "master" || currentUser?.role === "coord_geral") && (
                        <select
                            className="bg-surface border-none rounded-xl py-2 px-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text-primary"
                            value={districtFilter}
                            onChange={(e) => setDistrictFilter(e.target.value)}
                        >
                            <option value="all">Todos Distritos</option>
                            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}

                    {(currentUser?.role === "master" || currentUser?.role === "coord_geral" || currentUser?.role === "coord_distrital") && (
                        <select
                            className="bg-surface border-none rounded-xl py-2 px-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text-primary"
                            value={baseFilter}
                            onChange={(e) => setBaseFilter(e.target.value)}
                        >
                            <option value="all">Todas Bases</option>
                            {bases
                                .filter(b => {
                                    if (currentUser?.role === 'coord_distrital') return b.districtId === currentUser.districtId;
                                    return districtFilter === 'all' || b.districtId === districtFilter;
                                })
                                .map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))
                            }
                        </select>
                    )}

                    <select
                        className="bg-surface border-none rounded-xl py-2 px-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text-primary"
                        value={classificationFilter}
                        onChange={(e) => setClassificationFilter(e.target.value)}
                    >
                        <option value="all">Classificação</option>
                        <option value="pre-adolescente">Pre-adolescente</option>
                        <option value="adolescente">Adolescente</option>
                    </select>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                        )}
                        title="Visualização em Grade"
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={clsx(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                        )}
                        title="Visualização em Lista"
                    >
                        <List size={20} />
                    </button>
                </div>
            </div>

            {
                loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card-soft p-6 animate-pulse space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                                    <div className="w-20 h-6 bg-gray-200 rounded-full" />
                                </div>
                                <div className="space-y-2">
                                    <div className="w-3/4 h-5 bg-gray-200 rounded" />
                                    <div className="w-1/2 h-4 bg-gray-200 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredUsers.length > 0 ? (

                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredUsers.map((user) => (
                                <div key={user.id} className="card-soft p-6 hover:shadow-md transition-shadow group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                            {(user.displayName?.[0] || user.email?.[0] || "U").toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-col">
                                            <h3
                                                className="font-bold text-lg truncate cursor-pointer hover:text-primary transition-colors hover:underline decoration-dashed decoration-2 underline-offset-4"
                                                title="Clique para ver detalhes e lançar pontos"
                                                onClick={() => setViewingUser(user)}
                                            >
                                                {user.displayName || "Sem Nome"}
                                            </h3>
                                            <span className={clsx("w-fit px-3 py-1 mt-1 rounded-full text-xs font-bold", roleColors[user.role] || "bg-gray-100")}>
                                                {roleNames[user.role] || user.role}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm text-text-secondary">
                                            <div className="flex items-center gap-2">
                                                <Mail size={16} className="shrink-0" />
                                                <span className="truncate">{user.email}</span>
                                            </div>
                                            {(user.baseId || user.districtId) && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={16} className="shrink-0" />
                                                    <span>{user.baseId || user.districtId}</span>
                                                </div>
                                            )}
                                            <span>Nível {user.stats?.level || 1} • {user.stats?.currentXp || 0} XP</span>
                                        </div>
                                        {user.birthDate && (
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    🎉 {calculateAge(user.birthDate)} anos
                                                </span>
                                                <span className={clsx(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                                    user.classification === 'adolescente' ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
                                                )}>
                                                    {user.classification || 'pre-adolescente'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute top-6 right-6 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="p-2 hover:bg-surface rounded-lg text-text-secondary hover:text-primary transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500 transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-text-secondary font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="p-4 pl-6">Usuário</th>
                                        <th className="p-4">Cargo</th>
                                        <th className="p-4">Localização</th>
                                        <th className="p-4 text-center">Nível / XP</th>
                                        <th className="p-4 text-right pr-6">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {(user.displayName?.[0] || user.email?.[0] || "U").toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div
                                                            className="font-bold text-text-primary cursor-pointer hover:underline decoration-dashed underline-offset-4"
                                                            onClick={() => setViewingUser(user)}
                                                        >
                                                            {user.displayName || "Sem Nome"}
                                                        </div>
                                                        <div className="text-xs text-text-secondary">{user.email}</div>
                                                        {user.birthDate && (
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <div className="text-[10px] text-pink-500 font-bold flex items-center gap-1">
                                                                    🎉 {calculateAge(user.birthDate)} anos
                                                                </div>
                                                                <div className={clsx(
                                                                    "text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit",
                                                                    user.classification === 'adolescente' ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
                                                                )}>
                                                                    {user.classification || 'pre-adolescente'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={clsx("px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap", roleColors[user.role] || "bg-gray-100")}>
                                                    {roleNames[user.role] || user.role}
                                                </span>
                                            </td>
                                            <td className="p-4 text-text-secondary">
                                                <div className="flex flex-col">
                                                    {user.districtId && <span className="flex items-center gap-1"><MapPin size={12} /> {districts.find(d => d.id === user.districtId)?.name || user.districtId}</span>}
                                                    {user.baseId && <span className="text-xs opacity-75 pl-4">{bases.find(b => b.id === user.baseId)?.name || user.baseId}</span>}
                                                    {!user.districtId && !user.baseId && <span className="opacity-50">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-primary">Lv. {user.stats?.level || 1}</span>
                                                    <span className="text-xs text-text-secondary">{user.stats?.currentXp || 0} XP</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditClick(user)}
                                                        className="p-2 hover:bg-surface rounded-lg text-text-secondary hover:text-primary transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-text-secondary hover:text-red-500 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <SearchX size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-text-primary">Nenhum usuário encontrado</h3>
                        <p className="text-text-secondary">Tente mudar os filtros ou o termo de busca.</p>
                    </div>
                )
            }

            {
                viewingUser && (
                    <MemberDetailModal
                        user={viewingUser}
                        onClose={() => setViewingUser(null)}
                        onUpdate={() => {
                            setViewingUser(null);
                        }}
                    />
                )
            }

            {/* Create User Modal */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-in-center">
                            <div className="p-6 bg-primary text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {['coord_base', 'coord_distrital'].includes(currentUser?.role || '') ? 'Novo Membro' : 'Novo Coordenador'}
                                    </h2>
                                    <p className="text-white/70 text-sm">O usuário será vinculado pelo email.</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Nome Completo</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={newUser.displayName}
                                        onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                        placeholder="Ex: João da Silva"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Email de Login</label>
                                    <input
                                        type="email"
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        onBlur={handleEmailBlur}
                                        placeholder="email@gmail.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Senha Inicial</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Cargo / Permissão</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        disabled={['coord_base', 'coord_distrital'].includes(currentUser?.role || '')}
                                    >
                                        {Object.entries(roleNames)
                                            .filter(([id]) => {
                                                if (currentUser?.role === 'coord_base') {
                                                    return id === 'membro';
                                                }
                                                if (currentUser?.role === 'coord_distrital') {
                                                    return id === 'membro' || id === 'coord_base';
                                                }
                                                return true;
                                            })
                                            .map(([id, name]) => (
                                                <option key={id} value={id}>{name}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                {/* Hierarchy Selection - Cascading Dropdowns */}
                                {['coord_uniao', 'coord_associacao', 'coord_regiao', 'coord_distrital', 'coord_base', 'membro'].includes(newUser.role) && (
                                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin size={14} className="text-primary" />
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Localização / Vínculo</p>
                                        </div>

                                        {/* Union */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-text-secondary">União</label>
                                            <select
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                                                value={newUser.unionId}
                                                onChange={(e) => setNewUser({ ...newUser, unionId: e.target.value, associationId: "", regionId: "", districtId: "", baseId: "" })}
                                                disabled={!!currentUser?.unionId} // Locked if creator is restricted
                                            >
                                                <option value="">Selecione...</option>
                                                {unions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>

                                        {/* Association */}
                                        {['coord_associacao', 'coord_regiao', 'coord_distrital', 'coord_base', 'membro'].includes(newUser.role) && (
                                            <div className="space-y-1 animate-fade-in">
                                                <label className="text-xs font-bold text-text-secondary">Associação</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                                                    value={newUser.associationId}
                                                    onChange={(e) => setNewUser({ ...newUser, associationId: e.target.value, regionId: "", districtId: "", baseId: "" })}
                                                    disabled={!!currentUser?.associationId || (!newUser.unionId && currentUser?.role === 'master')}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {associations
                                                        .filter(a => !newUser.unionId || a.unionId === newUser.unionId)
                                                        .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        {/* Region */}
                                        {['coord_regiao', 'coord_distrital', 'coord_base', 'membro'].includes(newUser.role) && (
                                            <div className="space-y-1 animate-fade-in">
                                                <label className="text-xs font-bold text-text-secondary">Região</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                                                    value={newUser.regionId}
                                                    onChange={(e) => setNewUser({ ...newUser, regionId: e.target.value, districtId: "", baseId: "" })}
                                                    disabled={!!currentUser?.regionId || (!newUser.associationId && currentUser?.role === 'master')}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {regions
                                                        .filter(r => !newUser.associationId || r.associationId === newUser.associationId)
                                                        .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        {/* District */}
                                        {['coord_distrital', 'coord_base', 'membro'].includes(newUser.role) && (
                                            <div className="space-y-1 animate-fade-in">
                                                <label className="text-xs font-bold text-text-secondary">Distrito</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                                                    value={newUser.districtId}
                                                    onChange={(e) => setNewUser({ ...newUser, districtId: e.target.value, baseId: "" })}
                                                    disabled={!!currentUser?.districtId}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {districts
                                                        .filter(d => {
                                                            if (currentUser?.districtId) return d.id === currentUser.districtId;
                                                            if (newUser.regionId) return d.regionId === newUser.regionId;
                                                            return true;
                                                        })
                                                        .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        {/* Base */}
                                        {['coord_base', 'membro'].includes(newUser.role) && (
                                            <div className="space-y-1 animate-fade-in">
                                                <label className="text-xs font-bold text-text-secondary">Base</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                                                    value={newUser.baseId}
                                                    onChange={(e) => setNewUser({ ...newUser, baseId: e.target.value })}
                                                    disabled={currentUser?.role === 'coord_base' || !newUser.districtId}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {bases
                                                        .filter(b => !newUser.districtId || b.districtId === newUser.districtId)
                                                        .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {['coord_uniao', 'coord_associacao', 'coord_regiao', 'coord_distrital'].includes(newUser.role) && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Classificação de Trimestres</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={newUser.quarterClassification}
                                            onChange={(e) => setNewUser({ ...newUser, quarterClassification: e.target.value })}
                                        >
                                            <option value="">Selecione o Trimestre</option>
                                            <option value="1º Trimestre">1º Trimestre</option>
                                            <option value="2º Trimestre">2º Trimestre</option>
                                            <option value="3º Trimestre">3º Trimestre</option>
                                            <option value="4º Trimestre">4º Trimestre</option>
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Data de Nascimento</label>
                                        <input
                                            type="date"
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={newUser.birthDate}
                                            onChange={(e) => setNewUser({ ...newUser, birthDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={newUser.participatesInRanking}
                                                onChange={(e) => setNewUser({ ...newUser, participatesInRanking: e.target.checked })}
                                            />
                                            <span className="text-sm font-bold text-text-primary">Participa do Ranking</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={handleCreateUser}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Criando..." : <><UserPlus size={18} /> Criar Usuário</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            {
                selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-in-center">
                            <div className="p-6 bg-primary text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">Editar Usuário</h2>
                                    <p className="text-white/70 text-sm">{selectedUser.email}</p>
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Nome Completo</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                        value={editDisplayName}
                                        onChange={(e) => setEditDisplayName(e.target.value)}
                                        placeholder="Nome do Usuário"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-text-secondary">Cargo / Permissão</label>
                                    <select
                                        className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        disabled={!['master', 'admin', 'secretaria', 'coord_geral'].includes(currentUser?.role || '')}
                                    >
                                        {Object.entries(roleNames).map(([id, name]) => (
                                            <option key={id} value={id}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                {editRole === 'coord_uniao' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">União</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={editUnion}
                                            onChange={(e) => setEditUnion(e.target.value)}
                                        >
                                            <option value="">Selecione a União</option>
                                            {unions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {editRole === 'coord_associacao' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Associação</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={editAssociation}
                                            onChange={(e) => setEditAssociation(e.target.value)}
                                        >
                                            <option value="">Selecione a Associação</option>
                                            {associations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {editRole === 'coord_regiao' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Região</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={editRegion}
                                            onChange={(e) => setEditRegion(e.target.value)}
                                        >
                                            <option value="">Selecione a Região</option>
                                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {['coord_uniao', 'coord_associacao', 'coord_regiao', 'coord_distrital'].includes(editRole) && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Classificação de Trimestres</label>
                                        <select
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={editQuarterClassification}
                                            onChange={(e) => setEditQuarterClassification(e.target.value)}
                                        >
                                            <option value="">Selecione o Trimestre</option>
                                            <option value="1º Trimestre">1º Trimestre</option>
                                            <option value="2º Trimestre">2º Trimestre</option>
                                            <option value="3º Trimestre">3º Trimestre</option>
                                            <option value="4º Trimestre">4º Trimestre</option>
                                        </select>
                                    </div>
                                )}

                                {(editRole === 'coord_distrital' || editRole === 'coord_base' || editRole === 'membro') && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-text-secondary">Distrito</label>
                                            <select
                                                className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                value={editDistrict}
                                                onChange={(e) => {
                                                    setEditDistrict(e.target.value);
                                                    setEditBase(""); // Reset base when district changes
                                                }}
                                                disabled={!['master', 'admin', 'secretaria', 'coord_geral'].includes(currentUser?.role || '')}
                                            >
                                                <option value="">Nenhum Distrito</option>
                                                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-text-secondary">Base</label>
                                            <select
                                                className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                value={editBase}
                                                onChange={(e) => setEditBase(e.target.value)}
                                                disabled={!editDistrict || !['master', 'admin', 'secretaria', 'coord_geral'].includes(currentUser?.role || '')}
                                            >
                                                <option value="">Nenhuma Base</option>
                                                {bases
                                                    .filter(b => b.districtId === editDistrict)
                                                    .map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-text-secondary">Data de Nascimento</label>
                                        <input
                                            type="date"
                                            className="w-full bg-surface border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20"
                                            value={editBirthDate}
                                            onChange={(e) => setEditBirthDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2 flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={editParticipatesInRanking}
                                                onChange={(e) => setEditParticipatesInRanking(e.target.checked)}
                                            />
                                            <span className="text-sm font-bold text-text-primary">Participa do Ranking</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                                        <KeyRound size={16} /> Recuperação
                                    </h3>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-text-secondary border-dashed"
                                        onClick={handleResetPassword}
                                        disabled={isSaving}
                                    >
                                        <Send size={16} className="mr-2" /> Enviar Email de Redefinição
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={handleSaveEdit}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Salvando..." : <><Save size={18} /> Salvar Alterações</>}
                                </Button>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Member Limit Modal */}
            <MemberLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                currentCount={limitInfo.currentCount}
                memberLimit={limitInfo.memberLimit}
            />
        </div >
    );
}
