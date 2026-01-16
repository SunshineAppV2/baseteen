# 📘 Documentação Completa: Sistema de Cadastro, Validação e Cobrança

**BaseTeen - Sistema de Gerenciamento de Bases**  
**Versão:** 1.0  
**Data:** 2026-01-11

---

## 📋 Índice

1. [Visão Geral do Fluxo](#1-visão-geral-do-fluxo)
2. [Estrutura de Dados (Firestore)](#2-estrutura-de-dados-firestore)
3. [Processo de Novo Cadastro](#3-processo-de-novo-cadastro)
4. [Validação pelo Master](#4-validação-pelo-master)
5. [Sistema de Assinaturas/Cobrança](#5-sistema-de-assinaturascobrança)
6. [Limite de Membros](#6-limite-de-membros)
7. [Regras de Segurança (Firestore Rules)](#7-regras-de-segurança-firestore-rules)
8. [Arquivos de Código Relacionados](#8-arquivos-de-código-relacionados)
9. [Fluxogramas](#9-fluxogramas)

---

## 1. Visão Geral do Fluxo

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FLUXO COMPLETO DO SISTEMA                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CADASTRO          2. VALIDAÇÃO           3. PAGAMENTO         4. ATIVO  │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌─────────────┐     ┌──────────────┐      ┌────────────────┐   ┌─────────┐ │
│  │   Usuário   │────▶│    Master    │─────▶│   Subscription │──▶│  Acesso │ │
│  │  Preenche   │     │   Aprova     │      │    Pendente    │   │  Total  │ │
│  │  Formulário │     │   Cadastro   │      │    ▼           │   │         │ │
│  └─────────────┘     └──────────────┘      │  Confirma PIX  │   └─────────┘ │
│        │                    │              └────────────────┘        │      │
│        ▼                    ▼                       │                ▼      │
│  status: "pending"   status: "approved"    status: "active"    Funcional   │
│                      + Subscription        + endDate definido              │
│                        criada                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Estrutura de Dados (Firestore)

### 2.1 Collection: `users`

Armazena todos os usuários do sistema (membros, coordenadores, master).

```typescript
interface User {
    // Identificação
    uid: string;                    // ID do Firebase Auth
    email: string;                  // Email do usuário
    displayName: string;            // Nome completo
    whatsapp?: string;              // Telefone WhatsApp
    cpf?: string;                   // CPF (opcional)
    
    // Perfil
    role: 'master' | 'coord_geral' | 'coord_uniao' | 'coord_associacao' | 
          'coord_regiao' | 'coord_distrital' | 'coord_base' | 'membro' | 'secretaria';
    
    // Status de Aprovação
    status: 'pending' | 'approved' | 'rejected';
    
    // Hierarquia (vinculação)
    unionId?: string;               // ID da União
    associationId?: string;         // ID da Associação
    regionId?: string;              // ID da Região
    districtId?: string;            // ID do Distrito
    baseId?: string;                // ID da Base
    
    // Para novos cadastros com estrutura customizada
    isNewLocation?: boolean;        // Se criou nova estrutura
    customLocation?: {
        union?: string;             // Nome da nova União
        association?: string;       // Nome da nova Associação
        region?: string;            // Nome da nova Região
        district?: string;          // Nome do novo Distrito
        base?: string;              // Nome da nova Base
    };
    
    // Informações da assinatura (no momento do cadastro)
    subscription?: {
        plan: 'mensal' | 'trimestral' | 'anual';
        accesses: number;           // Quantidade de acessos solicitados
        program: 'GA' | 'SOUL+';    // Tipo de programa
    };
    
    // Gamificação
    stats?: {
        currentXp: number;
        completedTasks: number;
        level?: number;
    };
    classification?: 'pre-adolescente' | 'adolescente';
    birthDate?: string;             // Data de nascimento (YYYY-MM-DD)
    participatesInRanking?: boolean;
    
    // Controle
    createdAt: Timestamp;
    approvedAt?: Timestamp;
    approvedBy?: string;            // UID do Master que aprovou
    rejectedAt?: Timestamp;
    rejectedBy?: string;
}
```

### 2.2 Collection: `subscriptions`

Controla as assinaturas de cada Base. **O ID do documento = baseId**.

```typescript
interface Subscription {
    id: string;                     // = baseId
    baseId: string;                 // ID da base vinculada
    
    // Plano
    plan: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'free';
    status: 'active' | 'expired' | 'pending';
    
    // Limites
    memberLimit: number;            // Limite de membros contratados
    currentMemberCount: number;     // Contagem atual (pode ser calculada dinamicamente)
    
    // Período
    startDate: Timestamp;           // Data de início
    endDate: Timestamp;             // Data de término
    
    // Financeiro
    amount: number;                 // Valor pago (R$)
    
    // Controle
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
```

### 2.3 Collection: `payments`

Registra todas as transações financeiras (assinaturas e adições de membros).

```typescript
interface Payment {
    id: string;                     // ID gerado pelo Firestore
    subscriptionId: string;         // ID da subscription relacionada (= baseId)
    baseId: string;                 // ID da base
    
    // Tipo
    type: 'subscription' | 'member_addition';
    
    // Valores
    amount: number;                 // Valor em R$
    status: 'pending' | 'confirmed' | 'expired' | 'refunded';
    paymentMethod: 'pix';           // Método de pagamento
    
    // Descrição
    description: string;            // Ex: "Assinatura Trimestral - 10 Acessos"
    
    // Metadados
    metadata?: {
        memberCount?: number;       // Quantidade de membros
        months?: number;            // Duração em meses
        newMemberLimit?: number;    // Novo limite após confirmação
        startDate?: Date;           // Data de início específica
    };
    
    // Confirmação
    confirmedAt?: Timestamp;
    confirmedBy?: string;           // UID do Master que confirmou
    
    // Controle
    createdAt: Timestamp;
}
```

### 2.4 Coleções de Hierarquia

```typescript
// unions
interface Union {
    id: string;
    name: string;
    createdAt: Timestamp;
}

// associations
interface Association {
    id: string;
    name: string;
    unionId: string;
    createdAt: Timestamp;
}

// regions
interface Region {
    id: string;
    name: string;
    associationId: string;
    createdAt: Timestamp;
}

// districts
interface District {
    id: string;
    name: string;
    regionId: string;
    createdAt: Timestamp;
}

// bases
interface Base {
    id: string;
    name: string;
    districtId: string;
    program?: 'GA' | 'SOUL+';
    totalXp?: number;               // XP total acumulado (gamificação)
    completedTasks?: number;        // Tarefas completadas
    earnedPoints?: number;
    createdAt: Timestamp;
}
```

---

## 3. Processo de Novo Cadastro

### 3.1 Tela de Login/Cadastro

**Arquivo:** `admin-web/src/app/login/page.tsx`

#### Fluxo em 2 Etapas:

**ETAPA 1 - Dados Pessoais:**
```
- Nome Completo (obrigatório)
- Email (obrigatório)
- WhatsApp (obrigatório)
- CPF (opcional)
- Senha (obrigatório, mín. 6 caracteres)
- Tipo de Base: GA ou SOUL+
- Quantidade de Acessos
- Forma de Pagamento: Mensal, Trimestral ou Anual
```

**ETAPA 2 - Hierarquia Institucional:**
```
1. União (selecionar existente ou criar nova)
2. Associação (filtrada pela União)
3. Região (filtrada pela Associação)
4. Distrito (filtrado pela Região)
5. Base (filtrada pelo Distrito)

* Cada nível permite "Não encontrei" para cadastrar manualmente
```

#### Lógica de Cadastro (código simplificado):

```typescript
// 1. Criar usuário no Firebase Auth
const userCredential = await createUserWithEmailAndPassword(auth, email, password);
const user = userCredential.user;

// 2. Atualizar perfil (displayName)
await updateProfile(user, { displayName });

// 3. Criar documento no Firestore com status PENDING
await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email,
    displayName,
    whatsapp,
    cpf,
    role: "membro",
    status: "pending",                    // ← STATUS INICIAL
    unionId,
    associationId,
    regionId,
    districtId,
    baseId,
    isNewLocation: isManualUnion || isManualAssociation || ...,
    customLocation: {
        union: isManualUnion ? customUnion : null,
        association: isManualAssociation ? customAssociation : null,
        region: isManualRegion ? customRegion : null,
        district: isManualDistrict ? customDistrict : null,
        base: isManualBase ? customBase : null
    },
    subscription: {
        plan: billingPlan,                // 'mensal' | 'trimestral' | 'anual'
        accesses: accessQuantity,
        program: programType              // 'GA' | 'SOUL+'
    },
    stats: { currentXp: 0, completedTasks: 0 },
    createdAt: serverTimestamp()
});
```

### 3.2 Validação de Limite de Membros

Antes de permitir o cadastro em uma base existente, o sistema verifica:

```typescript
// Arquivo: admin-web/src/lib/subscription.ts

export async function canAddMember(baseId: string): Promise<{
    canAdd: boolean;
    currentCount: number;
    memberLimit: number;
    reason?: string;
}> {
    const subscription = await getSubscription(baseId);
    const liveCount = await getCurrentMemberCount(baseId);

    // Sem assinatura = permite (período de graça)
    if (!subscription) {
        return { canAdd: true, currentCount: liveCount, memberLimit: 999 };
    }

    // Assinatura inativa
    if (subscription.status !== 'active') {
        return { canAdd: false, currentCount: liveCount, memberLimit: subscription.memberLimit,
                 reason: 'Subscription is not active' };
    }

    // Assinatura expirada
    if (subscription.endDate < new Date()) {
        return { canAdd: false, ..., reason: 'Subscription has expired' };
    }

    // Limite atingido
    if (liveCount >= subscription.memberLimit) {
        return { canAdd: false, ..., reason: 'Member limit reached' };
    }

    return { canAdd: true, currentCount: liveCount, memberLimit: subscription.memberLimit };
}
```

---

## 4. Validação pelo Master

### 4.1 Tela de Aprovação

**Arquivo:** `admin-web/src/app/admin/subscriptions/page.tsx`

#### Visualização de Cadastros Pendentes

O Master acessa a aba "Novos Cadastros" que lista usuários com `status: "pending"`:

```typescript
const { data: pendingUsers } = useCollection("users", [
    where("status", "==", "pending")
]);
```

#### Informações Exibidas

Para cada cadastro pendente:
- Nome do usuário
- Email
- WhatsApp (link para contato)
- CPF
- Tipo de programa (GA/SOUL+)
- Plano escolhido (mensal/trimestral/anual)
- Quantidade de acessos solicitados
- Base (existente ou "NEW: Nome da Nova Base")

### 4.2 Processo de Aprovação

**Função:** `handleApproveUser()`

```typescript
const handleApproveUser = async (userToApprove) => {
    // 1. VERIFICAR LIMITE (se base já existe)
    if (!userToApprove.isNewLocation && userToApprove.baseId) {
        const limitCheck = await canAddMember(userToApprove.baseId);
        if (!limitCheck.canAdd) {
            alert(`Impossível aprovar: limite de membros atingido (${limitCheck.currentCount}/${limitCheck.memberLimit})`);
            return;
        }
    }

    let finalLocation = {
        unionId, associationId, regionId, districtId, baseId
    };

    // 2. CRIAR ESTRUTURAS NOVAS (se necessário)
    if (userToApprove.isNewLocation && userToApprove.customLocation) {
        const cl = userToApprove.customLocation;

        // Criar União
        if (cl.union) {
            const unionRef = await addDoc(collection(db, "unions"), {
                name: cl.union,
                createdAt: serverTimestamp()
            });
            finalLocation.unionId = unionRef.id;
        }

        // Criar Associação
        if (cl.association) {
            const assocRef = await addDoc(collection(db, "associations"), {
                name: cl.association,
                unionId: finalLocation.unionId,
                createdAt: serverTimestamp()
            });
            finalLocation.associationId = assocRef.id;
        }

        // Criar Região
        if (cl.region) {
            const regionRef = await addDoc(collection(db, "regions"), {
                name: cl.region,
                associationId: finalLocation.associationId,
                createdAt: serverTimestamp()
            });
            finalLocation.regionId = regionRef.id;
        }

        // Criar Distrito
        if (cl.district) {
            const districtRef = await addDoc(collection(db, "districts"), {
                name: cl.district,
                regionId: finalLocation.regionId,
                createdAt: serverTimestamp()
            });
            finalLocation.districtId = districtRef.id;
        }

        // Criar Base
        if (cl.base) {
            const baseRef = await addDoc(collection(db, "bases"), {
                name: cl.base,
                districtId: finalLocation.districtId,
                program: userToApprove.subscription?.program || "GA",
                createdAt: serverTimestamp()
            });
            finalLocation.baseId = baseRef.id;
        }
    }

    // 3. ATUALIZAR USUÁRIO
    await updateDoc(doc(db, "users", userToApprove.id), {
        ...finalLocation,
        status: "approved",          // ← MUDA O STATUS
        approvedAt: serverTimestamp(),
        approvedBy: user?.uid
    });

    // 4. CRIAR SUBSCRIPTION E PAYMENT
    const subInfo = userToApprove.subscription;
    if (subInfo && finalLocation.baseId) {
        const planMapping = {
            'mensal': { months: 1, configId: 'monthly', name: 'Mensal' },
            'trimestral': { months: 3, configId: 'quarterly', name: 'Trimestral' },
            'anual': { months: 12, configId: 'annual', name: 'Anual' }
        };

        const planData = planMapping[subInfo.plan];
        const memberLimit = subInfo.accesses || 10;
        const totalAmount = PRICE_PER_USER_MONTHLY * memberLimit * planData.months;

        // 4a. Criar Subscription (PENDENTE)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + planData.months);

        await setDoc(doc(db, "subscriptions", finalLocation.baseId), {
            baseId: finalLocation.baseId,
            plan: planData.configId,
            status: "pending",       // ← SUBSCRIPTION PENDENTE
            memberLimit: memberLimit,
            currentMemberCount: 0,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            amount: totalAmount,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 4b. Criar Payment (PENDENTE)
        await addDoc(collection(db, "payments"), {
            baseId: finalLocation.baseId,
            type: "subscription",
            amount: totalAmount,
            status: "pending",       // ← PAYMENT PENDENTE
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
};
```

### 4.3 Processo de Rejeição

```typescript
const handleRejectUser = async (userToReject) => {
    if (!window.confirm(`Tem certeza que deseja reprovar ${userToReject.displayName}?`)) return;
    
    await updateDoc(doc(db, "users", userToReject.id), {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: user?.uid
    });
};
```

---

## 5. Sistema de Assinaturas/Cobrança

### 5.1 Configuração de Preços

**Arquivo:** `admin-web/src/config/subscription.ts`

```typescript
export const SUBSCRIPTION_CONFIG = {
    // WhatsApp para contato
    WHATSAPP_NUMBER: '5591983292005',
    WHATSAPP_MESSAGE: 'Olá! Gostaria de aumentar meu limite de membros.',

    // Preço Base
    PRICE_PER_USER_MONTHLY: 1.00,  // R$ 1,00 por usuário/mês

    // Planos disponíveis
    PLANS: {
        MONTHLY: { id: 'monthly', name: 'Mensal', months: 1 },
        QUARTERLY: { id: 'quarterly', name: 'Trimestral', months: 3 },
        SEMIANNUAL: { id: 'semiannual', name: 'Semestral', months: 6 },
        ANNUAL: { id: 'annual', name: 'Anual', months: 12 },
        FREE: { id: 'free', name: 'Livre (Sem Cobrança)', months: 12 },
    },

    // Alertas de expiração (dias antes)
    WARNING_DAYS: [7, 3, 1],
};
```

### 5.2 Cálculo de Valores

```typescript
// Fórmula: membros × preço_mensal × meses
const calculateSubscriptionAmount = (memberLimit: number, planType: SubscriptionPlan) => {
    if (planType === 'free') return 0;
    
    const months = SUBSCRIPTION_CONFIG.PLANS[planType.toUpperCase()].months;
    return memberLimit * SUBSCRIPTION_CONFIG.PRICE_PER_USER_MONTHLY * months;
};

// Exemplo: 10 membros, plano trimestral
// 10 × R$ 1,00 × 3 meses = R$ 30,00
```

### 5.3 Confirmar Pagamento

**Arquivo:** `admin-web/src/lib/subscription.ts` → `confirmPayment()`

```typescript
export async function confirmPayment(paymentId: string, confirmedBy: string): Promise<void> {
    const paymentDocRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentDocRef);
    
    if (!paymentSnap.exists()) throw new Error('Payment not found');
    
    const payment = paymentSnap.data();
    
    if (payment.status === 'confirmed') {
        throw new Error('Payment already confirmed');
    }

    // 1. Atualizar status do pagamento
    await updateDoc(paymentDocRef, {
        status: 'confirmed',
        confirmedAt: Timestamp.now(),
        confirmedBy,
    });

    // 2. Atualizar Subscription com base no tipo
    const subscriptionRef = doc(db, 'subscriptions', payment.baseId);
    const subscriptionSnap = await getDoc(subscriptionRef);

    if (payment.type === 'subscription') {
        // Para nova assinatura ou renovação
        let newStartDate = new Date();
        
        // Se existe e está ativa, estende a partir do endDate
        if (subscriptionSnap.exists()) {
            const subData = subscriptionSnap.data();
            if (subData.endDate?.toDate() > new Date()) {
                newStartDate = subData.endDate.toDate();
            }
        }

        // Usa startDate do metadata se especificado
        if (payment.metadata?.startDate) {
            const metaDate = payment.metadata.startDate.toDate 
                ? payment.metadata.startDate.toDate() 
                : new Date(payment.metadata.startDate);
            if (!isNaN(metaDate.getTime())) {
                newStartDate = metaDate;
            }
        }

        // Calcula novo endDate
        const months = payment.metadata?.months || 1;
        const newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + months);

        await updateDoc(subscriptionRef, {
            status: 'active',            // ← ATIVA A SUBSCRIPTION
            startDate: Timestamp.fromDate(newStartDate),
            endDate: Timestamp.fromDate(newEndDate),
            updatedAt: Timestamp.now(),
        });

    } else if (payment.type === 'member_addition') {
        // Adiciona membros ao limite
        const addedMembers = payment.metadata?.memberCount || 0;
        const currentLimit = subscriptionSnap.data().memberLimit || 0;

        await updateDoc(subscriptionRef, {
            memberLimit: currentLimit + addedMembers,
            updatedAt: Timestamp.now(),
        });
    }
}
```

### 5.4 Estorno / Exclusão de Pagamento

```typescript
export async function deletePayment(paymentId: string): Promise<void> {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) throw new Error('Payment not found');
    
    const payment = paymentSnap.data();

    // Se confirmado, reverter os efeitos
    if (payment.status === 'confirmed') {
        const subscriptionRef = doc(db, 'subscriptions', payment.baseId);
        const subscriptionSnap = await getDoc(subscriptionRef);

        if (subscriptionSnap.exists()) {
            const subData = subscriptionSnap.data();

            if (payment.type === 'subscription') {
                // Reverter datas
                if (payment.metadata?.months && subData.endDate) {
                    const currentEndDate = subData.endDate.toDate();
                    const newEndDate = new Date(currentEndDate);
                    newEndDate.setMonth(newEndDate.getMonth() - payment.metadata.months);

                    const newStatus = newEndDate < new Date() ? 'expired' : subData.status;

                    await updateDoc(subscriptionRef, {
                        endDate: Timestamp.fromDate(newEndDate),
                        status: newStatus,
                        updatedAt: Timestamp.now()
                    });
                }
            } else if (payment.type === 'member_addition') {
                // Reduzir limite
                const addedMembers = payment.metadata?.memberCount || 0;
                const currentLimit = subData.memberLimit || 0;

                await updateDoc(subscriptionRef, {
                    memberLimit: Math.max(0, currentLimit - addedMembers),
                    updatedAt: Timestamp.now()
                });
            }
        }
    }

    // Deletar o documento do pagamento
    await deleteDoc(paymentRef);
}
```

### 5.5 Geração de Recibo PDF

**Arquivo:** `admin-web/src/lib/pdf-generator.ts`

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateReceiptPDF = (payment, subscription, baseName) => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(22);
    doc.text('Recibo de Pagamento', 105, 20, { align: 'center' });

    // Cabeçalho
    doc.setFontSize(10);
    doc.text('BaseTeen - Sistema de Gerenciamento', 105, 30, { align: 'center' });
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 35, { align: 'center' });

    // Tabela de dados
    const paymentRows = [
        ['ID da Transação', payment.id],
        ['Base', baseName],
        ['Descrição', payment.description],
        ['Data do Pagamento', new Date(payment.createdAt).toLocaleDateString('pt-BR')],
        ['Método', payment.paymentMethod.toUpperCase()],
        ['Status', payment.status === 'confirmed' ? 'Confirmado' : 'Pendente'],
    ];

    autoTable(doc, {
        startY: 55,
        head: [['Campo', 'Valor']],
        body: paymentRows,
        theme: 'striped',
    });

    // Total
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Pago: R$ ${payment.amount.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 10);

    // Salvar
    doc.save(`recibo_${payment.id}.pdf`);
};
```

---

## 6. Limite de Membros

### 6.1 Modal de Limite Atingido

**Arquivo:** `admin-web/src/components/MemberLimitModal.tsx`

Exibido quando o limite de membros é atingido:
- Mostra contagem atual vs limite
- Oferece link direto para WhatsApp com mensagem pré-configurada

```typescript
const whatsappLink = `https://wa.me/${SUBSCRIPTION_CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${SUBSCRIPTION_CONFIG.WHATSAPP_MESSAGE}\n\nAtualmente tenho ${currentCount} membros e o limite é ${memberLimit}. Gostaria de aumentar para mais membros.`
)}`;
```

### 6.2 Verificação em Tempo Real

A verificação de limite acontece em:
1. **Cadastro de novo membro** (`/login` - página de registro)
2. **Criação de usuário pelo coordenador** (`/users` - tela de gestão)
3. **Aprovação de cadastro pendente** (`/admin/subscriptions`)

---

## 7. Regras de Segurança (Firestore Rules)

**Arquivo:** `firestore.rules`

### 7.1 Subscriptions

```javascript
match /subscriptions/{subscriptionId} {
    // Qualquer usuário logado pode ler (para verificar limites)
    allow read: if isSignedIn();
    
    // Apenas Master pode criar/editar/deletar
    allow create, update: if isOwnerOrAdmin();
    allow delete: if isOwnerOrAdmin();
}
```

### 7.2 Payments

```javascript
match /payments/{paymentId} {
    // Apenas Master pode ler e escrever
    allow read, write: if isOwnerOrAdmin();
}
```

### 7.3 Users

```javascript
match /users/{userId} {
    // Leitura: Admin, Secretaria, próprio usuário, ou gerentes da hierarquia
    allow read: if isOwnerOrAdmin() || isSecretary() || 
                request.auth.uid == userId ||
                canManageArea(resource.data);

    // Criação: Admin, Secretaria, gerentes, ou auto-registro
    allow create: if isOwnerOrAdmin() || isSecretary() || 
                  canManageArea(request.resource.data) ||
                  (request.auth.uid == userId && request.resource.data.role == 'membro');
    
    // Atualização: Similar, com regras específicas
    allow update: if isOwnerOrAdmin() || isSecretary() ||
                  canManageArea(resource.data) ||
                  (request.auth.uid == userId && ...);
    
    // Exclusão: Apenas Admin
    allow delete: if isOwnerOrAdmin();
}
```

### 7.4 Funções Auxiliares Principais

```javascript
// Verifica se usuário está logado
function isSignedIn() {
    return request.auth != null;
}

// Verifica se é Master/Admin
function isOwnerOrAdmin() {
    return (request.auth.token.email.lower() == 'master@baseteen.com') 
        || hasRole('master') 
        || hasRole('admin') 
        || hasRole('coord_geral');
}

// Verifica se pode gerenciar uma área específica
function canManageArea(docData) {
    return isOwnerOrAdmin() ||
        (isUnionCoord() && getUserUnionId() == docData.unionId) ||
        (isAssociationCoord() && getUserAssociationId() == docData.associationId) ||
        (isRegionCoord() && getUserRegionId() == docData.regionId) ||
        (isDistrictCoord() && getUserDistrictId() == docData.districtId) ||
        (isBaseCoord() && getUserBaseId() == docData.baseId);
}
```

---

## 8. Arquivos de Código Relacionados

### 8.1 Principais Arquivos

| Arquivo | Função |
|---------|--------|
| `admin-web/src/app/login/page.tsx` | Tela de Login e Cadastro |
| `admin-web/src/app/admin/subscriptions/page.tsx` | Gestão de Assinaturas e Aprovação de Cadastros |
| `admin-web/src/app/users/page.tsx` | Gestão de Usuários |
| `admin-web/src/app/approvals/page.tsx` | Aprovação de Tarefas |
| `admin-web/src/app/settings/page.tsx` | Configurações do Sistema |

### 8.2 Bibliotecas e Serviços

| Arquivo | Função |
|---------|--------|
| `admin-web/src/lib/subscription.ts` | Funções de gerenciamento de assinaturas |
| `admin-web/src/config/subscription.ts` | Configurações e tipos de assinatura |
| `admin-web/src/lib/pdf-generator.ts` | Geração de recibos PDF |
| `admin-web/src/context/AuthContext.tsx` | Contexto de autenticação |
| `admin-web/src/components/layout/AuthGuard.tsx` | Proteção de rotas |
| `admin-web/src/components/MemberLimitModal.tsx` | Modal de limite de membros |
| `firestore.rules` | Regras de segurança do Firestore |

### 8.3 Componentes de Layout

| Arquivo | Função |
|---------|--------|
| `admin-web/src/components/layout/Sidebar.tsx` | Menu lateral com controle de visibilidade por role |

---

## 9. Fluxogramas

### 9.1 Fluxo de Novo Cadastro

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE NOVO CADASTRO                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │     PÁGINA DE LOGIN     │
                    │   /login (Cadastrar)    │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   ETAPA 1: DADOS        │
                    │   Nome, Email, Senha    │
                    │   WhatsApp, Plano       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   ETAPA 2: HIERARQUIA   │
                    │   União → Associação    │
                    │   → Região → Distrito   │
                    │   → Base                │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
    ┌─────────▼─────────┐ ┌─────▼─────────┐ ┌─────▼─────────┐
    │  Base Existente?  │ │ Nova Base?    │ │  Limite OK?   │
    │  SIM              │ │ SIM           │ │  SIM          │
    └─────────┬─────────┘ └───────────────┘ └───────────────┘
              │                                    │
              └────────────────┬───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Firebase Auth      │
                    │  createUser()       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Firestore          │
                    │  users/{uid}        │
                    │  status: "pending"  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  AGUARDA APROVAÇÃO  │
                    │  DO MASTER          │
                    └─────────────────────┘
```

### 9.2 Fluxo de Aprovação e Cobrança

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE APROVAÇÃO E COBRANÇA                            │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                         PAINEL MASTER                            │
     │                  /admin/subscriptions (Aba: Novos Cadastros)     │
     └──────────────────────────────┬───────────────────────────────────┘
                                    │
                      ┌─────────────▼─────────────┐
                      │   Lista de Pendentes      │
                      │   status: "pending"       │
                      └─────────────┬─────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
    │    REPROVAR       │ │     APROVAR       │ │                   │
    │                   │ │                   │ │                   │
    │ status: rejected  │ │ status: approved  │ │                   │
    └───────────────────┘ └─────────┬─────────┘ └───────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │  Criar Estruturas     │
                        │  (se isNewLocation)   │
                        │  União, Associação,   │
                        │  Região, Distrito,    │
                        │  Base                 │
                        └───────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐           │
    │   Subscription    │ │     Payment       │           │
    │   status: pending │ │  status: pending  │           │
    │   memberLimit: N  │ │  amount: R$X      │           │
    │   endDate: +Xm    │ │  type: subscription│          │
    └───────────────────┘ └─────────┬─────────┘           │
                                    │                     │
                        ┌───────────▼───────────┐         │
                        │  AGUARDA PAGAMENTO    │         │
                        │  (PIX)                │         │
                        └───────────┬───────────┘         │
                                    │                     │
                        ┌───────────▼───────────┐         │
                        │  MASTER CONFIRMA      │         │
                        │  confirmPayment()     │         │
                        └───────────┬───────────┘         │
                                    │                     │
              ┌─────────────────────┼─────────────────────┘
              │                     │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐
    │   Subscription    │ │     Payment       │
    │   status: ACTIVE  │ │  status: confirmed│
    │   startDate: hoje │ │  confirmedAt: now │
    │   endDate: definido│ │  confirmedBy: uid │
    └───────────────────┘ └───────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   SISTEMA ATIVO!      │
                        │   Usuário pode acessar│
                        └───────────────────────┘
```

### 9.3 Diagrama de Estados - Usuário

```
                    ┌─────────────────────┐
                    │                     │
                    │      PENDING        │ ◀── Estado inicial após cadastro
                    │                     │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    │
┌─────────────────┐  ┌─────────────────┐           │
│                 │  │                 │           │
│    REJECTED     │  │    APPROVED     │           │
│                 │  │                 │           │
└─────────────────┘  └─────────────────┘           │
                                                    │
                    ┌───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │ Pode deletar e    │
        │ refazer cadastro  │
        └───────────────────┘
```

### 9.4 Diagrama de Estados - Subscription

```
                    ┌─────────────────────┐
                    │                     │
                    │      PENDING        │ ◀── Após aprovação do usuário
                    │                     │
                    └──────────┬──────────┘
                               │
                               │ confirmPayment()
                               │
                               ▼
                    ┌─────────────────────┐
                    │                     │
                    │       ACTIVE        │ ◀── Pagamento confirmado
                    │                     │
                    └──────────┬──────────┘
                               │
                               │ endDate < now
                               │
                               ▼
                    ┌─────────────────────┐
                    │                     │
                    │      EXPIRED        │ ◀── Assinatura vencida
                    │                     │
                    └──────────┬──────────┘
                               │
                               │ novo pagamento confirmado
                               │
                               ▼
                    ┌─────────────────────┐
                    │                     │
                    │       ACTIVE        │ ◀── Renovação
                    │                     │
                    └─────────────────────┘
```

---

## 📝 Notas para Replicação

1. **Firebase**: O sistema usa Firebase Auth para autenticação e Firestore para banco de dados.

2. **Preços**: O preço base é R$ 1,00 por usuário/mês. Ajuste em `SUBSCRIPTION_CONFIG.PRICE_PER_USER_MONTHLY`.

3. **WhatsApp**: Configure o número de contato em `SUBSCRIPTION_CONFIG.WHATSAPP_NUMBER`.

4. **Email Master**: O email `master@baseteen.com` tem acesso master hardcoded nas Firestore rules e no AuthContext.

5. **Hierarquia**: O sistema suporta 5 níveis: União → Associação → Região → Distrito → Base.

6. **Roles Disponíveis**: 
   - `master` - Acesso total
   - `coord_geral` - Coordenador geral
   - `coord_uniao` - Coordenador de união
   - `coord_associacao` - Coordenador de associação
   - `coord_regiao` - Coordenador de região
   - `coord_distrital` - Coordenador distrital
   - `coord_base` - Coordenador de base
   - `secretaria` - Secretária
   - `membro` - Membro comum

---

**Fim da Documentação**
