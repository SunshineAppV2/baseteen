"use client";

import { useState } from "react";
import { HelpCircle, X, BookOpen, Video, FileText, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

interface HelpContent {
    title: string;
    description: string;
    sections: {
        icon: any;
        title: string;
        content: string;
        videoUrl?: string;
    }[];
    quickTips: string[];
}

const helpContentMap: Record<string, Record<string, HelpContent>> = {
    // Dashboard
    "/": {
        default: {
            title: "Dashboard - Visão Geral",
            description: "Seu painel central de controle e acompanhamento",
            sections: [
                {
                    icon: BookOpen,
                    title: "O que é o Dashboard?",
                    content: "O Dashboard é sua central de informações. Aqui você visualiza:\n\n• Seu nível atual e XP acumulado\n• Estatísticas de tarefas completadas\n• Sua posição no ranking\n• Atalhos para funcionalidades principais\n• Notificações importantes"
                },
                {
                    icon: Zap,
                    title: "Navegando pelo Dashboard",
                    content: "PASSO A PASSO:\n\n1. No topo, veja seu perfil com foto, nome e nível\n2. Logo abaixo, encontre seus números: XP total, tarefas completadas, posição no ranking\n3. Role para baixo para ver os cards de atalho\n4. Clique em qualquer card para ir direto para aquela funcionalidade\n5. Use o menu lateral esquerdo para navegar entre páginas"
                }
            ],
            quickTips: [
                "Acesse o dashboard diariamente para ver seu progresso",
                "Os números são atualizados em tempo real",
                "Clique no seu nome no topo para editar seu perfil",
                "Use os atalhos dos cards para economizar tempo"
            ]
        },
        coord_base: {
            title: "Dashboard - Coordenador",
            description: "Gerencie sua base de forma eficiente",
            sections: [
                {
                    icon: BookOpen,
                    title: "Visão Geral do Coordenador",
                    content: "Como coordenador, seu dashboard mostra:\n\n• Total de membros ativos na sua base\n• Tarefas criadas e em andamento\n• Taxa de presença média\n• Quizzes disponíveis\n• Ações rápidas para gestão"
                },
                {
                    icon: Zap,
                    title: "Primeiros Passos como Coordenador",
                    content: "GUIA COMPLETO DE INÍCIO:\n\n1. CADASTRE OS MEMBROS\n   • Vá em 'Membros' no menu lateral\n   • Clique em 'Novo Membro'\n   • Preencha nome, email, classificação\n   • Salve e repita para cada membro\n\n2. CRIE TAREFAS SEMANAIS\n   • Acesse 'Tarefas'\n   • Clique em 'Nova Tarefa'\n   • Defina título, descrição, prazo e XP\n   • Marque se é para pré-adolescentes ou adolescentes\n\n3. REGISTRE PRESENÇA\n   • Entre em 'Presença'\n   • Selecione a data da reunião\n   • Marque quem compareceu\n   • Salve o registro\n\n4. ORGANIZE QUIZZES\n   • Vá em 'Quiz'\n   • Crie um novo quiz ou use um existente\n   • Inicie a Área ao Vivo durante a reunião"
                },
                {
                    icon: FileText,
                    title: "Rotina Semanal Recomendada",
                    content: "SEGUNDA-FEIRA:\n• Crie tarefas da semana\n• Revise pendências\n\nQUARTA-FEIRA:\n• Acompanhe progresso das tarefas\n• Envie lembretes se necessário\n\nSÁBADO (DIA DA REUNIÃO):\n• Registre presença\n• Realize quiz ao vivo\n• Anote observações importantes\n\nDOMINGO:\n• Revise estatísticas da semana\n• Planeje próxima semana"
                }
            ],
            quickTips: [
                "Mantenha os dados dos membros sempre atualizados",
                "Crie tarefas variadas para manter o engajamento",
                "Registre a presença logo após cada reunião",
                "Use o sistema de XP para motivar os jovens",
                "Revise o dashboard semanalmente para identificar padrões"
            ]
        },
        master: {
            title: "Dashboard - Master",
            description: "Controle total do sistema",
            sections: [
                {
                    icon: BookOpen,
                    title: "Visão Master do Sistema",
                    content: "Como Master, você vê:\n\n• Estatísticas globais de todas as bases\n• Total de usuários no sistema\n• Aprovações pendentes (destaque vermelho)\n• Atividade recente de todas as bases\n• Acesso a configurações avançadas"
                },
                {
                    icon: Zap,
                    title: "Responsabilidades do Master",
                    content: "SUAS ATRIBUIÇÕES PRINCIPAIS:\n\n1. GERENCIAR BASES\n   • Criar novas bases quando necessário\n   • Atribuir coordenadores\n   • Monitorar desempenho de cada base\n\n2. APROVAR CADASTROS\n   • Revisar solicitações em 'Aprovações'\n   • Verificar dados antes de aprovar\n   • Rejeitar cadastros suspeitos\n\n3. CONFIGURAR PERMISSÕES\n   • Definir quem pode criar tarefas\n   • Controlar acesso a funcionalidades\n   • Gerenciar roles de usuários\n\n4. MONITORAR SISTEMA\n   • Acompanhar uso geral\n   • Identificar problemas\n   • Gerar relatórios globais"
                },
                {
                    icon: FileText,
                    title: "Checklist Diário do Master",
                    content: "TODOS OS DIAS:\n☐ Verificar aprovações pendentes\n☐ Revisar atividade suspeita\n☐ Responder dúvidas de coordenadores\n\nTODA SEMANA:\n☐ Analisar estatísticas globais\n☐ Revisar bases com baixo engajamento\n☐ Atualizar conteúdos compartilhados\n\nTODO MÊS:\n☐ Gerar relatório mensal\n☐ Reunião com coordenadores\n☐ Planejar melhorias no sistema"
                }
            ],
            quickTips: [
                "Revise as aprovações pendentes diariamente",
                "Monitore o desempenho de todas as bases semanalmente",
                "Configure permissões com cuidado - não dê acesso desnecessário",
                "Mantenha comunicação ativa com coordenadores",
                "Use relatórios para tomar decisões baseadas em dados"
            ]
        }
    },
    // Tarefas
    "/tasks": {
        default: {
            title: "Tarefas - Sistema de Missões",
            description: "Gerencie e complete missões para ganhar XP",
            sections: [
                {
                    icon: BookOpen,
                    title: "Como Funcionam as Tarefas?",
                    content: "Tarefas são missões que você completa para ganhar XP e subir de nível.\n\nCADA TAREFA TEM:\n• Título e descrição clara\n• Prazo de conclusão\n• Valor em XP (quanto mais difícil, mais XP)\n• Classificação (pré-adolescente ou adolescente)\n• Status (pendente, em andamento, concluída)"
                },
                {
                    icon: Zap,
                    title: "Como Completar uma Tarefa",
                    content: "PASSO A PASSO DETALHADO:\n\n1. ENCONTRE A TAREFA\n   • Vá em 'Tarefas' no menu\n   • Veja a lista de tarefas disponíveis\n   • Tarefas com prazo próximo aparecem primeiro\n\n2. LEIA COM ATENÇÃO\n   • Clique na tarefa para ver detalhes\n   • Leia toda a descrição\n   • Verifique o prazo\n   • Veja quantos XP você ganhará\n\n3. REALIZE A TAREFA\n   • Faça o que está sendo pedido\n   • Pode ser: ler um texto, fazer uma reflexão, praticar algo, etc.\n   • Não tenha pressa - qualidade é importante\n\n4. MARQUE COMO CONCLUÍDA\n   • Volte para a lista de tarefas\n   • Clique no botão 'Concluir' ou checkbox\n   • Confirme a conclusão\n   • Veja seu XP aumentar!\n\n5. ACOMPANHE SEU PROGRESSO\n   • No dashboard, veja quantas tarefas completou\n   • Observe seu XP subindo\n   • Comemore quando subir de nível!"
                }
            ],
            quickTips: [
                "Priorize tarefas com prazo mais próximo",
                "Tarefas com mais XP geralmente são mais desafiadoras",
                "Complete tarefas regularmente para subir de nível mais rápido",
                "Leia a descrição completa antes de começar",
                "Não deixe para a última hora - organize seu tempo"
            ]
        },
        coord_base: {
            title: "Tarefas - Gestão de Missões",
            description: "Crie e gerencie tarefas para sua base",
            sections: [
                {
                    icon: BookOpen,
                    title: "Criando Tarefas Eficazes",
                    content: "GUIA COMPLETO DE CRIAÇÃO:\n\n1. ACESSE A CRIAÇÃO\n   • Vá em 'Tarefas'\n   • Clique em 'Nova Tarefa' (botão azul)\n   • Abrirá um formulário\n\n2. PREENCHA O TÍTULO\n   • Seja claro e direto\n   • Exemplo BOM: 'Ler Marcos 1-3'\n   • Exemplo RUIM: 'Leitura'\n\n3. ESCREVA A DESCRIÇÃO\n   • Explique EXATAMENTE o que fazer\n   • Seja específico sobre requisitos\n   • Exemplo: 'Leia os capítulos 1 a 3 de Marcos e anote 3 lições que você aprendeu'\n\n4. DEFINA O PRAZO\n   • Clique no calendário\n   • Escolha uma data realista\n   • Dê tempo suficiente (mínimo 3-5 dias)\n\n5. CONFIGURE A CLASSIFICAÇÃO\n   • Pré-adolescente: 10-13 anos\n   • Adolescente: 14-17 anos\n   • Todos: qualquer idade\n\n6. DEFINA O XP\n   • Tarefa simples (5-15 min): 50-100 XP\n   • Tarefa média (30-60 min): 150-300 XP\n   • Tarefa complexa (2+ horas): 400-600 XP\n\n7. DISPONIBILIZE\n   • Marque 'Disponível para alunos' se quiser que vejam\n   • Clique em 'Salvar'\n   • Pronto! Tarefa criada"
                },
                {
                    icon: FileText,
                    title: "Importação em Massa por Excel",
                    content: "COMO IMPORTAR VÁRIAS TAREFAS DE UMA VEZ:\n\n1. BAIXE O MODELO\n   • Na página de Tarefas\n   • Clique no ícone de planilha\n   • Baixe o arquivo modelo.xlsx\n\n2. PREENCHA A PLANILHA\n   • Abra no Excel ou Google Sheets\n   • Cada linha = uma tarefa\n   • Colunas: Título, Descrição, Prazo, Classificação, XP\n   • Siga o exemplo da primeira linha\n\n3. IMPORTE\n   • Volte para Tarefas\n   • Clique em 'Importar Excel'\n   • Selecione seu arquivo\n   • Aguarde o processamento\n   • Todas as tarefas serão criadas!\n\nDICA: Use isso para criar tarefas mensais de uma vez"
                },
                {
                    icon: Zap,
                    title: "Gerenciando Tarefas Existentes",
                    content: "AÇÕES DISPONÍVEIS:\n\n1. EDITAR TAREFA\n   • Clique no ícone de lápis\n   • Modifique o que precisar\n   • Salve as alterações\n\n2. DUPLICAR TAREFA\n   • Útil para tarefas recorrentes\n   • Clique em 'Duplicar'\n   • Ajuste a data e salve\n\n3. EXCLUIR TAREFA\n   • Clique no ícone de lixeira\n   • Confirme a exclusão\n   • ATENÇÃO: Não pode desfazer!\n\n4. VISUALIZAR CONCLUSÕES\n   • Veja quem completou cada tarefa\n   • Acompanhe o progresso\n   • Identifique quem está atrasado"
                }
            ],
            quickTips: [
                "Crie tarefas semanais para manter engajamento constante",
                "Varie os tipos: leitura, prática, reflexão, criatividade",
                "Monitore quais tarefas são mais completadas e crie similares",
                "Use descrições claras - evite ambiguidade",
                "Ajuste o XP à dificuldade real da tarefa",
                "Crie tarefas com antecedência - não de última hora"
            ]
        }
    },
    // Presença
    "/attendance": {
        default: {
            title: "Presença - Registro de Participação",
            description: "Acompanhe sua frequência nas reuniões",
            sections: [
                {
                    icon: BookOpen,
                    title: "Por que a Presença é Importante?",
                    content: "Sua presença nas reuniões:\n\n• Mostra seu comprometimento\n• Pode gerar XP bônus\n• É acompanhada pelo coordenador\n• Ajuda a medir engajamento da base\n• Influencia em atividades especiais\n\nManter boa frequência demonstra dedicação e pode abrir oportunidades para liderança!"
                },
                {
                    icon: Zap,
                    title: "Como Funciona o Registro",
                    content: "O QUE ACONTECE:\n\n1. Você chega na reunião\n2. O coordenador marca sua presença no sistema\n3. Seu registro fica salvo com data e hora\n4. Você pode ver seu histórico de presença\n5. Ao final do mês, veja sua taxa de frequência"
                }
            ],
            quickTips: [
                "Chegue no horário para não perder pontos",
                "Presença regular pode gerar bônus de XP",
                "Avise seu coordenador se não puder comparecer",
                "Verifique seu histórico mensalmente",
                "Mantenha pelo menos 75% de presença"
            ]
        },
        coord_base: {
            title: "Presença - Registro e Controle",
            description: "Registre a presença dos membros da sua base",
            sections: [
                {
                    icon: BookOpen,
                    title: "Como Registrar Presença",
                    content: "PASSO A PASSO COMPLETO:\n\n1. ACESSE A PÁGINA DE PRESENÇA\n   • Clique em 'Presença' no menu lateral\n   • Você verá um calendário e lista de membros\n\n2. SELECIONE A DATA\n   • Clique no calendário no topo\n   • Escolha a data da reunião (geralmente hoje)\n   • A lista de membros aparecerá\n\n3. MARQUE OS PRESENTES\n   MÉTODO 1 - Individual:\n   • Clique no checkbox ao lado de cada nome\n   • Verde = presente\n   • Cinza = ausente\n   \n   MÉTODO 2 - Todos de uma vez:\n   • Use o botão 'Marcar Todos'\n   • Depois desmarque quem faltou\n\n4. REGISTRE ATRASOS (Opcional)\n   • Clique no ícone de relógio\n   • Marque se chegou atrasado\n   • Adicione observação se necessário\n\n5. ADICIONE OBSERVAÇÕES\n   • Campo de texto para notas\n   • Exemplo: 'Reunião especial com convidado'\n   • Útil para contexto futuro\n\n6. SALVE O REGISTRO\n   • Clique em 'Salvar Presença'\n   • Aguarde confirmação\n   • Pronto! Registro salvo"
                },
                {
                    icon: FileText,
                    title: "Gerenciando Registros",
                    content: "AÇÕES DISPONÍVEIS:\n\n1. EDITAR REGISTRO ANTERIOR\n   • Selecione a data no calendário\n   • Modifique as marcações\n   • Salve novamente\n\n2. VISUALIZAR HISTÓRICO\n   • Veja todos os registros passados\n   • Filtre por membro específico\n   • Exporte para Excel se necessário\n\n3. ESTATÍSTICAS\n   • Taxa de presença por membro\n   • Média geral da base\n   • Identificar padrões de ausência\n\n4. JUSTIFICATIVAS DE FALTA\n   • Adicione motivo da ausência\n   • Útil para acompanhamento\n   • Exemplo: 'Viagem em família'"
                },
                {
                    icon: Zap,
                    title: "Melhores Práticas",
                    content: "DICAS IMPORTANTES:\n\n• Registre LOGO APÓS a reunião (não deixe para depois)\n• Seja consistente - registre TODAS as reuniões\n• Use observações para eventos especiais\n• Acompanhe membros com muitas faltas\n• Entre em contato com quem está ausente frequentemente\n• Revise estatísticas mensalmente\n• Comemore melhorias na frequência"
                }
            ],
            quickTips: [
                "Registre a presença logo após cada reunião - não espere",
                "Use observações para registrar eventos especiais",
                "Acompanhe padrões de ausência para intervir cedo",
                "Comemore quando a base atingir boa frequência",
                "Mantenha contato com membros ausentes",
                "Use estatísticas para planejar ações"
            ]
        }
    },
    // Quiz
    "/quiz": {
        default: {
            title: "Área Quiz - Desafios de Conhecimento",
            description: "Teste seus conhecimentos e ganhe XP",
            sections: [
                {
                    icon: BookOpen,
                    title: "Como Jogar",
                    content: "Escolha um quiz disponível e responda as questões. Cada resposta correta gera XP. Quanto mais rápido responder, mais pontos!"
                },
                {
                    icon: Zap,
                    title: "Área ao Vivo",
                    content: "Participe de quizzes ao vivo com outros membros. Use o PIN fornecido pelo coordenador para entrar na sala."
                }
            ],
            quickTips: [
                "Leia as perguntas com atenção",
                "Responda rápido para ganhar mais pontos",
                "Pratique com quizzes individuais antes das áreas"
            ]
        },
        coord_base: {
            title: "Área Quiz - Criação e Gestão",
            description: "Crie quizzes e organize áreas ao vivo",
            sections: [
                {
                    icon: BookOpen,
                    title: "Criando Quizzes",
                    content: "1. Clique em 'Novo Desafio'\n2. Defina título e descrição\n3. Adicione questões (mínimo 4 alternativas)\n4. Configure tempo e XP por questão\n5. Salve e disponibilize"
                },
                {
                    icon: FileText,
                    title: "Importação Rápida",
                    content: "Use 'Importar TXT' para criar quizzes rapidamente:\nFormato: Pergunta; A; B; C; D; Resposta; Tempo; XP"
                },
                {
                    icon: Video,
                    title: "Área ao Vivo",
                    content: "1. Selecione um quiz\n2. Clique em 'Iniciar Área'\n3. Compartilhe o PIN com os participantes\n4. Use tela cheia para projetar\n5. O sistema avança automaticamente!"
                }
            ],
            quickTips: [
                "Teste o quiz antes de usar ao vivo",
                "Use a tela cheia para projetar em reuniões",
                "O sistema revela respostas automaticamente",
                "Varie a dificuldade das questões"
            ]
        }
    }
};

export default function HelpButton() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const pathname = usePathname();

    // Determina o conteúdo de ajuda baseado na rota e role
    const getHelpContent = (): HelpContent => {
        const routeContent = helpContentMap[pathname] || helpContentMap["/"];
        const roleContent = routeContent[user?.role || "default"] || routeContent["default"];
        return roleContent || {
            title: "Ajuda",
            description: "Sistema de ajuda contextual",
            sections: [],
            quickTips: []
        };
    };

    const content = getHelpContent();

    return (
        <>
            {/* Botão Flutuante */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 group"
                title="Ajuda e Suporte"
            >
                <HelpCircle size={28} className="group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </button>

            {/* Modal de Ajuda */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl scale-in-center">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6 shrink-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <HelpCircle size={32} />
                                        <h2 className="text-2xl font-black">{content.title}</h2>
                                    </div>
                                    <p className="text-white/90 text-sm">{content.description}</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Sections */}
                            {content.sections.map((section, idx) => {
                                const Icon = section.icon;
                                return (
                                    <div key={idx} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                                                <Icon className="text-primary" size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg mb-2">{section.title}</h3>
                                                <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                                                    {section.content}
                                                </p>
                                                {section.videoUrl && (
                                                    <a
                                                        href={section.videoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 mt-3 text-primary hover:text-primary/80 font-bold text-sm"
                                                    >
                                                        <Video size={16} />
                                                        Assistir vídeo tutorial
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Quick Tips */}
                            {content.quickTips.length > 0 && (
                                <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap className="text-yellow-600" size={24} />
                                        <h3 className="font-black text-lg">Dicas Rápidas</h3>
                                    </div>
                                    <ul className="space-y-2">
                                        {content.quickTips.map((tip, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="text-yellow-600 font-bold shrink-0">•</span>
                                                <span className="text-gray-700">{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Suporte Adicional */}
                            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
                                <h3 className="font-bold text-lg mb-3">Precisa de mais ajuda?</h3>
                                <p className="text-gray-700 mb-4">
                                    Entre em contato com o suporte ou seu coordenador para assistência personalizada.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <a
                                        href="mailto:suporte@baseteen.com"
                                        className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
                                    >
                                        📧 Enviar Email
                                    </a>
                                    <a
                                        href="https://wa.me/5591983292005"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                                    >
                                        💬 WhatsApp
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
