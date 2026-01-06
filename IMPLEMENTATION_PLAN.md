# Baseteen - Sistema de Ranking e Gamificação do Ministério do Adolescente - Implementation Plan

## 1. Estrutura de Dados (Firestore Schema)

Esta estrutura foi desenhada para suportar as regras de acesso (ACL) e a performance solicitada.

### Coleção: `users`
Armazena todos os usuários do sistema.
*   `uid` (string): ID do Auth.
*   `email` (string): Email do usuário.
*   `displayName` (string): Nome completo.
*   `role` (string): 'master', 'coord_geral', 'secretaria', 'coord_distrital', 'coord_base', 'membro'.
*   `baseId` (string, opcional): ID da base (para membros e coord_base).
*   `districtId` (string, opcional): ID do distrito (para membros, coord_base e coord_distrital).
*   `photoUrl` (string): Avatar.
*   `stats`: { (Dados de Gamificação)
    *   `currentXp` (number): XP total acumulado.
    *   `level` (number): Nível atual.
    *   `rankingGlobal` (number): Posição calculada.
    }
*   `createdAt` (timestamp)
*   `isActive` (boolean)

### Coleção: `tasks`
Requisitos cadastrados pelos administradores.
*   `taskId` (string): Auto-generated.
*   `title` (string): Título da prova.
*   `description` (string): Detalhes do que fazer.
*   `xpReward` (number): XP ganho ao completar.
*   `type` (enum): 'text', 'photo', 'link'.
*   `validFrom` (timestamp): Início da vigência.
*   `validUntil` (timestamp): Prazo final.
*   `isActive` (boolean): Se está visível.
*   `createdBy` (uid): Quem criou.

### Coleção: `submissions`
Provas enviadas pelos membros.
*   `submissionId` (string): Auto-generated.
*   `taskId` (string): Ref para tasks.
*   `userId` (string): Quem enviou.
*   `userBaseId` (string): Para facilitar queries de ranking por base.
*   `userDistrictId` (string): Para facilitar queries de ranking por distrito.
*   `status` (enum): 'pending', 'approved', 'rejected'.
*   `proof` (map): {
    *   `content` (string): Texto ou URL da imagem/storage.
    *   `submittedAt` (timestamp)
    }
*   `review` (map, opcional): {
    *   `reviewedBy` (uid)
    *   `reviewedAt` (timestamp)
    *   `feedback` (string): Motivo da rejeição ou elogio.
    }

### Coleção: `quiz_questions`
Banco de questões para o Quiz (Sincronizado via Realtime DB para o jogo em si, mas mantido aqui para gestão).
*   `questionId` (string)
*   `statement` (string): Enunciado.
*   `alternatives` (array of objects): [
    *   { `text`: "Opção A", `isCorrect`: false },
    *   { `text`: "Opção B", `isCorrect`: true },
    ...
    ]
*   `timeLimit` (number): Segundos para responder.
*   `xpValue` (number): Pontos máximos.
*   `tags` (array): Categorias.

### Coleção: `districts` & `bases` (Auxiliares)
Para estrutura organizacional.
*   `districts/{districtId}`: { `name`, `coordUid` }
*   `bases/{baseId}`: { `name`, `districtId`, `coordUid` }

### Realtime Database (Quiz Engine)
Focado em baixa latência para o "Arena Quiz".
*   `active_quizzes/{quizId}`:
    *   `status`: 'waiting' | 'in_progress' | 'finished'
    *   `currentQuestionId`: string
    *   `questionStartTime`: timestamp (para sincronizar clientes)
    *   `participants`: {
        *   `{userId}`: { `score`: 0, `streak`: 0, `avatar`: url }
        }
    *   `answers`: {
        *   `{questionId}`: {
            *   `{userId}`: { `selectedOption`: index, `timestamp`: ms }
            }
        }

---

## 2. Scaffolding (Estrutura de Pastas)

### A. Mobile (Flutter - Clean Architecture)
Foco em separação de responsabilidades para facilitar testes e manutenção.

```
lib/
├── main.dart
├── core/
│   ├── config/ (Firebase config, enviroments)
│   ├── theme/ (AppTheme, Colors, Typography)
│   ├── utils/ (Validators, Formatters)
│   ├── errors/ (Failures, Exceptions)
│   └── constants/
├── features/
│   ├── auth/
│   │   ├── data/ (Repositories, Datasources)
│   │   ├── domain/ (Entities, Usecases)
│   │   └── presentation/ (Bloc/Cubit, Pages, Widgets)
│   ├── mobile_dashboard/ (Home do Membro)
│   ├── tasks/ (Listagem e Envio de Provas)
│   ├── gamification/ (Ranking, Perfil, Badges)
│   └── quiz/ (Motor do jogo)
└── shared/
    ├── widgets/ (Botões, Inputs, Cards customizados)
    └── models/ (Modelos compartilhados, ex: User)
```

### B. Web Admin (React/Next.js + Tailwind)
Foco em produtividade e componentes de UI administrativa.

```
/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/ (Botões, Cards, Inputs, Modais)
│   │   ├── layout/ (Sidebar, Navbar, AuthGuard)
│   │   └── datatables/ (Tabelas reutilizáveis com filtro/sort)
│   ├── hooks/ (useAuth, useFirestore, useTasks)
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── index.tsx (Login)
│   │   ├── dashboard/ (Visão Geral)
│   │   ├── tasks/
│   │   │   ├── index.tsx (Lista)
│   │   │   ├── create.tsx
│   │   │   └── [id].tsx (Detalhes/Edição)
│   │   ├── approvals/ (Fluxo de Aprovação da Secretaria)
│   │   ├── ranking/ (Visualização Global)
│   │   └── users/ (Gestão de Acessos)
│   ├── services/
│   │   ├── firebase.ts
│   │   └── api.ts
│   ├── styles/
│   │   └── globals.css (Tailwind imports)
│   └── utils/
├── tailwind.config.js
└── next.config.js
```

---

## 3. Regras de Segurança (firestore.rules)

Rascunho focado na hierarquia estrita.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Funções Auxiliares
    function isSignedIn() {
      return request.auth != null;
    }
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function hasRole(role) {
      return isSignedIn() && getUserData().role == role;
    }
    function isOwnerOrAdmin() {
      return hasRole('master') || hasRole('coord_geral');
    }
    function isSecretary() {
      return hasRole('secretaria') || isOwnerOrAdmin();
    }

    // --- Regras por Coleção ---

    // USERS: 
    // - Qualquer um autenticado pode ler (para ranking).
    // - Apenas Master/Admin altera roles.
    // - Próprio usuário pode editar avatar/dados básicos.
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isOwnerOrAdmin(); // Cadastro feito por admins
      allow update: if isOwnerOrAdmin() || request.auth.uid == userId;
    }

    // TASKS:
    // - Todos leem.
    // - Admin cria/edita.
    match /tasks/{taskId} {
      allow read: if isSignedIn();
      allow write: if isOwnerOrAdmin();
    }

    // SUBMISSIONS:
    // - Membro cria (create) e lê (read) suas próprias.
    // - Secretaria/Admin lê todas e atualiza (aprovação).
    // - Imutabilidade: Membro não edita após enviar (apenas cria).
    match /submissions/{submissionId} {
      allow read: if isOwnerOrAdmin() || isSecretary() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow create: if isSignedIn() 
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == 'pending';
      allow update: if isOwnerOrAdmin() || isSecretary(); // Aprovação
    }
    
    // QUIZ:
    // - Apenas Admin gerencia.
    // - Leitura segura (pode requerer functions para evitar ler respostas no client).
    match /quiz_questions/{questionId} {
      allow read: if isSignedIn(); // Cuidado: Em produção, usar Cloud Functions para entregar quiz sem resposta correta.
      allow write: if isOwnerOrAdmin();
    }
  }
}
```
