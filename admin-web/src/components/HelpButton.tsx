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
                    content: "O Dashboard é sua central de informações. Aqui você visualiza estatísticas importantes, atalhos rápidos e um resumo do que está acontecendo na sua base."
                },
                {
                    icon: Zap,
                    title: "Ações Rápidas",
                    content: "Use os cards de atalho para acessar rapidamente as funcionalidades mais usadas como Tarefas, Presença e Quiz."
                }
            ],
            quickTips: [
                "Verifique o dashboard diariamente para acompanhar o progresso",
                "Os números mostram estatísticas em tempo real",
                "Clique nos cards para ir direto para a funcionalidade"
            ]
        },
        coord_base: {
            title: "Dashboard - Coordenador",
            description: "Gerencie sua base de forma eficiente",
            sections: [
                {
                    icon: BookOpen,
                    title: "Suas Responsabilidades",
                    content: "Como coordenador, você pode gerenciar membros, criar tarefas, registrar presença e organizar quizzes para sua base."
                },
                {
                    icon: Zap,
                    title: "Primeiros Passos",
                    content: "1. Cadastre os membros da sua base\n2. Crie tarefas semanais\n3. Registre a presença nas reuniões\n4. Organize quizzes para engajar os jovens"
                }
            ],
            quickTips: [
                "Mantenha os dados dos membros sempre atualizados",
                "Registre a presença logo após cada reunião",
                "Use o sistema de XP para motivar os jovens"
            ]
        },
        master: {
            title: "Dashboard - Master",
            description: "Controle total do sistema",
            sections: [
                {
                    icon: BookOpen,
                    title: "Acesso Master",
                    content: "Você tem acesso completo a todas as funcionalidades, incluindo gerenciamento de bases, aprovações e configurações avançadas."
                },
                {
                    icon: Zap,
                    title: "Recursos Exclusivos",
                    content: "• Criar e gerenciar múltiplas bases\n• Aprovar solicitações\n• Acessar relatórios globais\n• Configurar permissões\n• Gerenciar coordenadores"
                }
            ],
            quickTips: [
                "Revise as aprovações pendentes regularmente",
                "Monitore o desempenho de todas as bases",
                "Configure permissões com cuidado"
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
                    content: "Tarefas são missões que você pode completar para ganhar XP. Cada tarefa tem uma descrição, prazo e recompensa em XP."
                },
                {
                    icon: Zap,
                    title: "Completando Tarefas",
                    content: "1. Escolha uma tarefa disponível\n2. Leia a descrição e requisitos\n3. Complete a missão\n4. Marque como concluída\n5. Ganhe XP!"
                }
            ],
            quickTips: [
                "Priorize tarefas com prazo mais próximo",
                "Tarefas com mais XP geralmente são mais desafiadoras",
                "Complete tarefas regularmente para subir de nível"
            ]
        },
        coord_base: {
            title: "Tarefas - Gestão de Missões",
            description: "Crie e gerencie tarefas para sua base",
            sections: [
                {
                    icon: BookOpen,
                    title: "Criando Tarefas",
                    content: "Você pode criar tarefas personalizadas para sua base. Defina título, descrição, prazo, classificação (pré-adolescente/adolescente) e valor em XP."
                },
                {
                    icon: FileText,
                    title: "Importação em Massa",
                    content: "Use a importação por Excel para criar várias tarefas de uma vez. Baixe o modelo, preencha e importe!"
                },
                {
                    icon: Zap,
                    title: "Dicas de Criação",
                    content: "• Seja claro na descrição\n• Defina prazos realistas\n• Ajuste o XP à dificuldade\n• Use classificações corretas"
                }
            ],
            quickTips: [
                "Crie tarefas semanais para manter engajamento",
                "Varie os tipos de tarefas (leitura, prática, reflexão)",
                "Monitore quais tarefas são mais completadas"
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
                    title: "Importância da Presença",
                    content: "Sua presença é registrada em cada reunião. Manter uma boa frequência mostra seu comprometimento e pode gerar XP bônus!"
                }
            ],
            quickTips: [
                "Chegue no horário para não perder pontos",
                "Presença regular pode gerar bônus de XP",
                "Avise seu coordenador se não puder comparecer"
            ]
        },
        coord_base: {
            title: "Presença - Registro e Controle",
            description: "Registre a presença dos membros da sua base",
            sections: [
                {
                    icon: BookOpen,
                    title: "Como Registrar",
                    content: "1. Selecione a data da reunião\n2. Marque quem está presente\n3. Adicione observações se necessário\n4. Salve o registro"
                },
                {
                    icon: Zap,
                    title: "Recursos Avançados",
                    content: "• Registre atrasos\n• Adicione justificativas de faltas\n• Visualize histórico de presença\n• Exporte relatórios"
                }
            ],
            quickTips: [
                "Registre a presença logo após a reunião",
                "Use observações para registrar eventos especiais",
                "Acompanhe padrões de ausência para intervir cedo"
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
                "Pratique com quizzes individuais antes das arenas"
            ]
        },
        coord_base: {
            title: "Área Quiz - Criação e Gestão",
            description: "Crie quizzes e organize arenas ao vivo",
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
        },
        master: {
            title: "Área Quiz - Gestão Avançada",
            description: "Controle total sobre quizzes e arenas",
            sections: [
                {
                    icon: BookOpen,
                    title: "Recursos Master",
                    content: "• Copiar quizzes entre bases\n• Reparar dados duplicados\n• Acessar histórico completo\n• Gerenciar quizzes de todas as bases"
                },
                {
                    icon: Zap,
                    title: "Modo Sem Login",
                    content: "Para bases específicas (ex: Missionários de Cristo), você pode ativar o modo sem login para permitir participação de visitantes."
                }
            ],
            quickTips: [
                "Use 'Copiar Quiz' para replicar bons conteúdos",
                "Monitore o histórico para ver engajamento",
                "Configure modo sem login apenas quando necessário"
            ]
        }
    },
    // Membros
    "/members": {
        coord_base: {
            title: "Membros - Gestão de Pessoas",
            description: "Gerencie os membros da sua base",
            sections: [
                {
                    icon: BookOpen,
                    title: "Cadastrando Membros",
                    content: "1. Clique em 'Novo Membro'\n2. Preencha os dados pessoais\n3. Defina a classificação (pré-adolescente/adolescente)\n4. Configure permissões se necessário\n5. Salve"
                },
                {
                    icon: Zap,
                    title: "Gerenciamento",
                    content: "• Edite informações\n• Acompanhe XP e nível\n• Visualize histórico de atividades\n• Redefina senhas se necessário"
                }
            ],
            quickTips: [
                "Mantenha dados de contato atualizados",
                "Use a busca para encontrar membros rapidamente",
                "Revise periodicamente membros inativos"
            ]
        },
        master: {
            title: "Membros - Gestão Global",
            description: "Gerencie membros de todas as bases",
            sections: [
                {
                    icon: BookOpen,
                    title: "Visão Global",
                    content: "Você pode visualizar e gerenciar membros de todas as bases. Use os filtros para encontrar pessoas específicas."
                },
                {
                    icon: Zap,
                    title: "Ações Master",
                    content: "• Transferir membros entre bases\n• Alterar permissões globalmente\n• Resetar senhas de qualquer usuário\n• Visualizar estatísticas completas"
                }
            ],
            quickTips: [
                "Use filtros para análises específicas",
                "Monitore coordenadores de cada base",
                "Revise permissões regularmente"
            ]
        }
    },
    // Aprovações
    "/approvals": {
        master: {
            title: "Aprovações - Centro de Controle",
            description: "Revise e aprove solicitações do sistema",
            sections: [
                {
                    icon: BookOpen,
                    title: "Tipos de Aprovação",
                    content: "• Novos cadastros de usuários\n• Solicitações de mudança de base\n• Requisições especiais\n• Alterações de permissões"
                },
                {
                    icon: Zap,
                    title: "Como Aprovar",
                    content: "1. Revise os detalhes da solicitação\n2. Verifique a legitimidade\n3. Aprove ou rejeite\n4. Adicione observações se necessário"
                }
            ],
            quickTips: [
                "Revise aprovações diariamente",
                "Verifique dados antes de aprovar",
                "Use observações para documentar decisões"
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
                                        href="https://wa.me/5511999999999"
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
