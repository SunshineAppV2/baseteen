# Erro de Cota no Google Drive (403 Service Account)

O erro encontrado (`Service Accounts do not have storage quota`) ocorre porque a "conta de serviço" do Firebase/Google Cloud (que age como um robô enviando os arquivos) possui **0 GB de armazenamento** padrão em contas pessoais ou projetos sem faturamento ativado.

O Google impede que Service Accounts sejam "donas" de arquivos que ocupem espaço, a menos que:

1.  **Opção A (Recomendada): Use um Shared Drive (Drive Compartilhado)**
    *   Se sua organização usa **Google Workspace** (GSuite), crie um "Drive Compartilhado" (não apenas uma pasta compartilhada).
    *   Mova a pasta de destino para dentro desse Drive Compartilhado.
    *   O armazenamento contará contra a cota da organização, não da Service Account.
    *   *Nenhuma alteração de código necessária.*

2.  **Opção B: Ativar Faturamento (Billing)**
    *   No console do Google Cloud (GCP), ative o faturamento para o projeto. Isso *pode* conceder uma cota básica à Service Account, mas nem sempre garante armazenamento pessoal para ela.

3.  **Opção C: Delegar autoridade (Avançado)**
    *   Requer configuração complexa de "Domain-Wide Delegation" no Google Admin Console para que a Service Account "finja" ser um usuário real com espaço.

4.  **Opção D: Mudar para Firebase Storage (Alternativa)**
    *   Podemos alterar o sistema para salvar os arquivos no **Firebase Storage** (que já está configurado no projeto).
    *   **Vantagens:** Funciona imediatamente, gratuito até 5GB, sem problemas de permissão.
    *   **Desvantagens:** Os arquivos não aparecem magicamente na interface do Google Drive (ficam no console do Firebase ou acessíveis via link).

**Ação Recomendada:**
Se vocês possuem Google Workspace, movam a pasta para um **Shared Drive**.
Se não, a **Opção D (Firebase Storage)** é a mais robusta para resolver agora.
