# Plano de Implementação: Ranking ao Vivo do Evento

## Objetivo
Criar uma tela exclusiva para projeção (em telões ou TVs) durante o evento, mostrando a classificação em tempo real dos participantes baseada **apenas** nos quizzes vinculados àquele evento.

## 1. Nova Rota: `/events/[id]/ranking`
- **Acesso**: Público (para facilitar projeção) ou Restrito a Gestores (depende da segurança, vamos fazer restrito a gestores inicialmente).
- **Layout**: "Full Screen", com fontes grandes, cores vibrantes, pouco texto, foco nos Avatares/Nomes e Pontuação.

## 2. Lógica de Cálculo
1. **Entrada**: ID do Evento.
2. **Dados Necessários**:
   - `events/{id}` -> para pegar `linkedQuizzes` (IDs dos quizzes).
   - `users/{uid}/xp_history` -> precisamos somar o XP ganho **apenas** nas entradas de histórico que correspondem aos quizzes do evento.
   
   *Otimização*: Ler o histórico de *todos* os usuários inscritos pode ser pesado.
   *Alternativa*: Ler `quiz_history` (que já temos) para os quizzes do evento.
   - `quiz_history` tem campos: `quizTitle`, `leaderboard` (array de {name, score}), `date`.
   
   *Problema*: `quiz_history` é guardado por "sessão de jogo" (live). Se o aluno jogou sozinho (Individual), não gera `quiz_history` global da mesma forma (gera no user history).
   
   *Melhor Abordagem (Robustez)*:
   - Os registros de XP são a fonte da verdade.
   - Vamos filtrar `users` que estão em `event_registrations`.
   - Para esses users, buscar o XP total SOMENTE nos quizzes linkados.
   
   *Refinamento*: Como `linkedQuizzes` são IDs de `master_quizzes`, e o histórico grava `quizTitle` ou `reason`, precisamos garantir o match.
   - O ideal é que o histórico gravasse o `quizId`.
   - Vamos verificar como o XP é salvo hoje.

## 3. Interface (UI)
- **Fundo**: Animado/Vibrante (Gradients).
- **Podium**: Top 3 com destaque maior.
- **Lista**: Do 4º ao 10º (ou 20º) em lista rolável automática.
- **Atualização**: `useEffect` com `setInterval` a cada 30s ou botão de "Atualizar".

## 4. Passos
1.  Criar página `src/app/events/[id]/ranking/page.tsx`.
2.  Adicionar botão "Ranking ao Vivo" na tela de detalhes do evento (`/events/[id]`).
3.  Implementar lógica de agregação de pontos.
