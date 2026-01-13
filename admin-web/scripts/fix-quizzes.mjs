import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config (use as variáveis de ambiente do projeto)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixQuizzes() {
    console.log('🔧 Iniciando correção de quizzes...\n');

    try {
        const quizzesRef = collection(db, 'master_quizzes');
        const snapshot = await getDocs(quizzesRef);

        console.log(`📊 Total de quizzes encontrados: ${snapshot.size}\n`);

        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const docSnap of snapshot.docs) {
            const quiz = docSnap.data();
            console.log(`\n📝 Processando: "${quiz.title}"`);

            if (!quiz.questions || quiz.questions.length === 0) {
                console.log('  ⚠️  Sem questões, pulando...');
                skippedCount++;
                continue;
            }

            let needsUpdate = false;
            const fixedQuestions = quiz.questions.map((question, qIndex) => {
                // Verificar se correctAnswer está undefined ou null
                if (question.correctAnswer === undefined || question.correctAnswer === null) {
                    console.log(`  🔧 Questão ${qIndex + 1}: corrigindo correctAnswer`);

                    let correctIdx = -1;

                    if (question.alternatives && Array.isArray(question.alternatives)) {
                        const firstAlt = question.alternatives[0];

                        // Verificar se alternatives são objetos com isCorrect
                        if (typeof firstAlt === 'object' && firstAlt !== null && 'isCorrect' in firstAlt) {
                            correctIdx = question.alternatives.findIndex(alt => alt.isCorrect === true);
                            if (correctIdx >= 0) {
                                console.log(`     ✓ Resposta correta encontrada no índice ${correctIdx}`);
                            } else {
                                console.warn(`     ⚠️  Nenhuma alternativa marcada como correta, usando 0`);
                                correctIdx = 0;
                            }
                        } else {
                            // Alternatives são strings, assumir primeira como correta
                            console.warn(`     ⚠️  Alternatives em formato string, usando 0 como padrão`);
                            correctIdx = 0;
                        }
                    }

                    needsUpdate = true;
                    return {
                        ...question,
                        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                        id: question.id || crypto.randomUUID(),
                        xpValue: question.xpValue || 100,
                        timeLimit: question.timeLimit || 30
                    };
                }

                // Questão já tem correctAnswer, apenas garantir outros campos
                return {
                    ...question,
                    id: question.id || crypto.randomUUID(),
                    xpValue: question.xpValue || 100,
                    timeLimit: question.timeLimit || 30
                };
            });

            if (needsUpdate) {
                try {
                    const quizRef = doc(db, 'master_quizzes', docSnap.id);
                    await updateDoc(quizRef, {
                        questions: fixedQuestions,
                        updatedAt: new Date()
                    });

                    console.log(`  ✅ Quiz "${quiz.title}" corrigido com sucesso!`);
                    fixedCount++;
                } catch (error) {
                    console.error(`  ❌ Erro ao atualizar quiz "${quiz.title}":`, error);
                    errorCount++;
                }
            } else {
                console.log(`  ✓ Quiz "${quiz.title}" já está correto`);
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📋 RESUMO DA CORREÇÃO');
        console.log('='.repeat(60));
        console.log(`Total processados: ${snapshot.size}`);
        console.log(`✅ Corrigidos: ${fixedCount}`);
        console.log(`✓ Já corretos: ${skippedCount}`);
        console.log(`❌ Erros: ${errorCount}`);

        if (errorCount === 0 && fixedCount > 0) {
            console.log('\n✅ CORREÇÃO CONCLUÍDA COM SUCESSO!');
            console.log('\nPróximos passos:');
            console.log('  1. Teste um quiz novamente');
            console.log('  2. Verifique se a pontuação está sendo atribuída');
        }

    } catch (error) {
        console.error('❌ Erro ao executar correção:', error);
        process.exit(1);
    }
}

fixQuizzes()
    .then(() => {
        console.log('\n✓ Script finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
