// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT DE DIAGNÓSTICO - Quiz BaseTeen
// ═══════════════════════════════════════════════════════════════════════════
// 
// INSTRUÇÕES:
// 1. Abra a página /quiz no navegador
// 2. Abra o Console do Desenvolvedor (F12)
// 3. Cole TODO este código e pressione Enter
// 4. Analise os logs para identificar problemas
//
// ═══════════════════════════════════════════════════════════════════════════

(async function diagnoseQuizzes() {
    console.clear();
    console.log('%c🔍 DIAGNÓSTICO DE QUIZZES - BaseTeen', 'font-size: 20px; font-weight: bold; color: #4F46E5;');
    console.log('%c═══════════════════════════════════════════════════════════════', 'color: #4F46E5;');
    console.log('\n');

    try {
        // Importar Firebase
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Pegar db do window (assumindo que está disponível globalmente)
        const db = window.db || (await import('/src/services/firebase.ts')).db;

        if (!db) {
            console.error('❌ Firestore não encontrado! Certifique-se de estar na página correta.');
            return;
        }

        const quizzesRef = collection(db, 'master_quizzes');
        const snapshot = await getDocs(quizzesRef);

        console.log(`%c📊 Total de quizzes: ${snapshot.size}`, 'font-size: 14px; font-weight: bold;');
        console.log('\n');

        let problemsFound = 0;
        let quizzesWithProblems = [];

        snapshot.forEach((doc, index) => {
            const quiz = doc.data();
            const quizProblems = [];

            console.group(`%c📝 Quiz ${index + 1}: ${quiz.title}`, 'font-weight: bold; color: #2563EB;');
            console.log(`ID: ${doc.id}`);

            if (!quiz.questions || quiz.questions.length === 0) {
                console.warn('⚠️ Quiz sem questões!');
                quizProblems.push('Sem questões');
                problemsFound++;
            } else {
                console.log(`Total de questões: ${quiz.questions.length}`);

                quiz.questions.forEach((q, qIdx) => {
                    console.group(`  Questão ${qIdx + 1}`);
                    console.log(`  Enunciado: "${q.statement?.substring(0, 60)}..."`);

                    // Verificar correctAnswer
                    console.log(`  %ccorrectAnswer: ${q.correctAnswer} (tipo: ${typeof q.correctAnswer})`,
                        typeof q.correctAnswer === 'number' ? 'color: green;' : 'color: red; font-weight: bold;');

                    if (q.correctAnswer === undefined || q.correctAnswer === null) {
                        console.error('  ❌ correctAnswer não definido!');
                        quizProblems.push(`Q${qIdx + 1}: correctAnswer não definido`);
                        problemsFound++;
                    } else if (typeof q.correctAnswer !== 'number') {
                        console.error('  ❌ correctAnswer não é número!');
                        quizProblems.push(`Q${qIdx + 1}: correctAnswer não é número`);
                        problemsFound++;
                    }

                    // Verificar alternatives
                    if (!q.alternatives || q.alternatives.length === 0) {
                        console.error('  ❌ Sem alternativas!');
                        quizProblems.push(`Q${qIdx + 1}: Sem alternativas`);
                        problemsFound++;
                    } else {
                        const firstAlt = q.alternatives[0];
                        const isObject = typeof firstAlt === 'object';
                        const formatType = isObject ? 'OBJETO {text, isCorrect}' : 'STRING';

                        console.log(`  Formato das alternativas: %c${formatType}`,
                            isObject ? 'color: orange; font-weight: bold;' : 'color: green;');

                        q.alternatives.forEach((alt, altIdx) => {
                            if (typeof alt === 'object') {
                                const marker = altIdx === q.correctAnswer ? '✓' : ' ';
                                console.log(`    [${altIdx}] ${marker} "${alt.text?.substring(0, 40)}..." (isCorrect: ${alt.isCorrect})`);
                            } else {
                                const marker = altIdx === q.correctAnswer ? '✓' : ' ';
                                console.log(`    [${altIdx}] ${marker} "${alt?.substring(0, 40)}..."`);
                            }
                        });

                        // Verificar range
                        if (q.correctAnswer >= q.alternatives.length) {
                            console.error(`  ❌ correctAnswer (${q.correctAnswer}) fora do range (0-${q.alternatives.length - 1})`);
                            quizProblems.push(`Q${qIdx + 1}: correctAnswer fora do range`);
                            problemsFound++;
                        }
                    }

                    console.log(`  XP: ${q.xpValue || 100}`);
                    console.log(`  Tempo: ${q.timeLimit || 30}s`);

                    console.groupEnd();
                });
            }

            if (quizProblems.length > 0) {
                quizzesWithProblems.push({ id: doc.id, title: quiz.title, problems: quizProblems });
            }

            console.groupEnd();
            console.log('\n');
        });

        // Resumo
        console.log('%c═══════════════════════════════════════════════════════════════', 'color: #4F46E5;');
        console.log('%c📋 RESUMO DO DIAGNÓSTICO', 'font-size: 16px; font-weight: bold; color: #4F46E5;');
        console.log('%c═══════════════════════════════════════════════════════════════', 'color: #4F46E5;');
        console.log(`\nTotal de quizzes: ${snapshot.size}`);
        console.log(`Problemas encontrados: ${problemsFound}`);
        console.log(`Quizzes com problemas: ${quizzesWithProblems.length}`);

        if (quizzesWithProblems.length > 0) {
            console.log('\n%c⚠️ QUIZZES COM PROBLEMAS:', 'font-weight: bold; color: #DC2626;');
            quizzesWithProblems.forEach(q => {
                console.log(`\n  • ${q.title} (${q.id})`);
                q.problems.forEach(p => console.log(`    - ${p}`));
            });
        }

        if (problemsFound === 0) {
            console.log('\n%c✅ NENHUM PROBLEMA ENCONTRADO!', 'font-size: 14px; font-weight: bold; color: #16A34A;');
            console.log('\nOs dados estão corretos. Se o quiz não funciona, verifique:');
            console.log('  1. Console do navegador para erros JavaScript');
            console.log('  2. Network tab para erros de API');
            console.log('  3. Limpe o cache e recarregue a página');
        } else {
            console.log('\n%c❌ PROBLEMAS ENCONTRADOS!', 'font-size: 14px; font-weight: bold; color: #DC2626;');
            console.log('\n%cPróximo passo: Execute o script de CORREÇÃO', 'font-weight: bold;');
        }

    } catch (error) {
        console.error('❌ Erro ao executar diagnóstico:', error);
        console.log('\n%cDica: Certifique-se de estar na página /quiz', 'color: orange;');
    }
})();
