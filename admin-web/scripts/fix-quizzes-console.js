/**
 * Script de Correção - Normalizar Quizzes
 * 
 * Este script corrige quizzes que foram salvos sem o campo correctAnswer,
 * extraindo a resposta correta do array de alternatives.
 * 
 * COMO USAR:
 * 1. Copie todo este código
 * 2. Abra o console do navegador em https://baseteen.vercel.app/quiz
 * 3. Cole e execute
 */

(async function fixQuizzes() {
    console.clear();
    console.log('%c🔧 CORREÇÃO DE QUIZZES - BaseTeen', 'font-size: 20px; font-weight: bold; color: #DC2626;');
    console.log('%c═══════════════════════════════════════════════════════════════', 'color: #DC2626;');
    console.log('\n');

    try {
        // Importar Firestore
        const { collection, getDocs, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Pegar db do window
        const db = window.db || (await import('/src/services/firebase.ts')).db;

        if (!db) {
            console.error('❌ Firestore não encontrado!');
            return;
        }

        const quizzesRef = collection(db, 'master_quizzes');
        const snapshot = await getDocs(quizzesRef);

        console.log(`%c📊 Total de quizzes: ${snapshot.size}`, 'font-size: 14px; font-weight: bold;');
        console.log('\n');

        let fixedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const docSnap of snapshot.docs) {
            const quiz = docSnap.data();
            console.group(`%c📝 Processando: ${quiz.title}`, 'font-weight: bold; color: #2563EB;');

            if (!quiz.questions || quiz.questions.length === 0) {
                console.warn('⚠️ Quiz sem questões, pulando...');
                skippedCount++;
                console.groupEnd();
                continue;
            }

            let needsUpdate = false;
            const fixedQuestions = quiz.questions.map((question, qIndex) => {
                // Verificar se correctAnswer está undefined
                if (question.correctAnswer === undefined || question.correctAnswer === null) {
                    console.log(`  ⚠️ Questão ${qIndex + 1}: correctAnswer está ${question.correctAnswer === undefined ? 'undefined' : 'null'}`);

                    // Tentar encontrar a resposta correta nas alternatives
                    if (question.alternatives && Array.isArray(question.alternatives)) {
                        let correctIdx = -1;

                        // Verificar se alternatives são objetos com isCorrect
                        const firstAlt = question.alternatives[0];
                        if (typeof firstAlt === 'object' && firstAlt !== null && 'isCorrect' in firstAlt) {
                            correctIdx = question.alternatives.findIndex(alt => alt.isCorrect === true);
                            console.log(`    → Encontrado em alternatives[${correctIdx}] (formato objeto)`);
                        } else {
                            // Se não tem isCorrect, assumir primeira alternativa (fallback)
                            correctIdx = 0;
                            console.warn(`    → Não foi possível determinar resposta correta, usando 0 como padrão`);
                        }

                        needsUpdate = true;
                        return {
                            ...question,
                            correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                            id: question.id || crypto.randomUUID(),
                            xpValue: question.xpValue || 100,
                            timeLimit: question.timeLimit || 30
                        };
                    } else {
                        console.error(`    ❌ Alternatives inválidas ou ausentes`);
                        return question;
                    }
                } else {
                    // correctAnswer já existe, apenas garantir outros campos
                    return {
                        ...question,
                        id: question.id || crypto.randomUUID(),
                        xpValue: question.xpValue || 100,
                        timeLimit: question.timeLimit || 30
                    };
                }
            });

            if (needsUpdate) {
                try {
                    const quizRef = doc(db, 'master_quizzes', docSnap.id);
                    await updateDoc(quizRef, {
                        questions: fixedQuestions,
                        updatedAt: new Date()
                    });

                    console.log(`%c✅ Quiz "${quiz.title}" corrigido com sucesso!`, 'color: #16A34A; font-weight: bold;');
                    fixedCount++;
                } catch (error) {
                    console.error(`❌ Erro ao atualizar quiz "${quiz.title}":`, error);
                    errorCount++;
                }
            } else {
                console.log(`✓ Quiz "${quiz.title}" já está correto`);
                skippedCount++;
            }

            console.groupEnd();
            console.log('\n');
        }

        // Resumo
        console.log('%c═══════════════════════════════════════════════════════════════', 'color: #DC2626;');
        console.log('%c📋 RESUMO DA CORREÇÃO', 'font-size: 16px; font-weight: bold; color: #DC2626;');
        console.log('%c═══════════════════════════════════════════════════════════════', 'color: #DC2626;');
        console.log(`\n%cTotal de quizzes processados: ${snapshot.size}`, 'font-weight: bold;');
        console.log(`%cQuizzes corrigidos: ${fixedCount}`, 'color: #16A34A; font-weight: bold;');
        console.log(`%cQuizzes já corretos: ${skippedCount}`, 'color: #3B82F6; font-weight: bold;');
        console.log(`%cErros: ${errorCount}`, 'color: #DC2626; font-weight: bold;');

        if (errorCount === 0 && fixedCount > 0) {
            console.log('\n%c✅ CORREÇÃO CONCLUÍDA COM SUCESSO!', 'font-size: 14px; font-weight: bold; color: #16A34A;');
            console.log('\n%cPróximos passos:', 'font-weight: bold;');
            console.log('  1. Recarregue a página');
            console.log('  2. Teste um quiz novamente');
            console.log('  3. Verifique se a pontuação está sendo atribuída corretamente');
        } else if (errorCount > 0) {
            console.log('\n%c⚠️ ALGUNS QUIZZES NÃO PUDERAM SER CORRIGIDOS', 'font-size: 14px; font-weight: bold; color: #DC2626;');
            console.log('Verifique os erros acima e tente novamente.');
        } else {
            console.log('\n%c✓ NENHUMA CORREÇÃO NECESSÁRIA', 'font-size: 14px; font-weight: bold; color: #3B82F6;');
        }

    } catch (error) {
        console.error('❌ Erro ao executar correção:', error);
        console.log('\n%cDica: Certifique-se de estar na página /quiz', 'color: orange;');
    }
})();
