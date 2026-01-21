# Plano de Implementação: Módulo de Eventos e Inscrições

## 1. Visão Geral
Criação de um sistema robusto para gestão de eventos oficiais (ex: Camporis, Olimpíadas), onde o **Coordenador Geral** cria o evento e os **Coordenadores de Base** inscrevem seus respectivos alunos. Os eventos poderão ter Quizzes exclusivos vinculados.

## 2. Estrutura de Dados (Firestore)

### Coleção `events`
Armazena os dados do evento.
- `title`: string
- `description`: string
- `date`: timestamp
- `status`: 'draft' (Rascunho) | 'open' (Inscrições Abertas) | 'active' (Em andamento/Quizzes Liberados) | 'finished' (Encerrado)
- `linkedQuizzes`: array de strings (IDs dos quizzes que serão rodados neste evento)

### Coleção `event_registrations`
Controla quem vai participar.
- `eventId`: ID do evento
- `userId`: ID do aluno
- `baseId`: ID da base do aluno
- `registeredBy`: ID do coordenador que fez a inscrição
- `createdAt`: data da inscrição

## 3. Interfaces e Fluxos

### A. Painel do Coordenador Geral (Gestão)
1.  **Criar Evento:** Formulário com Título, Data, Descrição.
2.  **Gerenciar Quizzes do Evento:**
    - Ao ver os detalhes de um evento, o Coord. Geral pode "Adicionar Quiz" (escolhendo da lista de quizzes gerais).
    - Na tela de criação de Quiz "Master", haverá uma opção "Disponibilizar para Evento?".
3.  **Controle de Status:** Botões para "Abrir Inscrições", "Iniciar Evento" (libera quizzes para jogar), "Encerrar".

### B. Painel do Coordenador de Base (Inscrição)
1.  **Listar Eventos:** Vê eventos com status "open".
2.  **Inscrever Membros:**
    - Ao clicar num evento, abre uma lista com todos os membros da sua base.
    - Seleção múltipla (Checkbox) dos alunos que irão participar.
    - Botão "Salvar Inscrições".
3.  **Visualizar Inscritos:** Vê quem já está confirmado.

### C. Experiência do Participante (Quiz)
1.  Os quizzes vinculados a um evento **só aparecem** na lista de quizzes do aluno se:
    - O evento estiver com status `active`.
    - O aluno possuir um registro em `event_registrations` para aquele evento.
2.  Ao jogar, a pontuação segue a regra padrão (XP no perfil + Histórico).

## 4. Etapas de Desenvolvimento
1.  **Criar Página de Eventos (`/events`):**
    - Listagem de eventos.
    - Modal de criação (para Admin/Geral).
2.  **Criar Página de Gerenciamento (`/events/[id]`):**
    - Para Coord. Geral: Edição, Mudança de Status, Vinculação de Quizzes.
    - Para Coord. Base: Lista de Membros com Checkbox para inscrição.
3.  **Atualizar Models e Hooks:**
    - Garantir que `master_quizzes` suporte o vínculo.
4.  **Atualizar Player de Quiz:**
    - Filtrar visibilidade baseado na inscrição.
