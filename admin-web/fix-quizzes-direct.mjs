// Script para corrigir quizzes diretamente no Firestore
// Execute com: node fix-quizzes-direct.mjs

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(
    readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixQuizzes() {
    console.log('🔧 Iniciando correção de quizzes...\n');

    try {
        const snapshot = await db.collection('master_quizzes').get();

        console.log(`📊 Total de quizzes: ${snapshot.size}\n`);

        let fixedCount = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const quiz = doc.data();
            console.log(`\n📝 Processando: "${quiz.title}"`);

            if (!quiz.questions || quiz.questions.length === 0) {
                console.log('  ⚠️ Sem questões, pulando...');
                return;
            }

            let needsUpdate = false;
            const fixedQuestions = quiz.questions.map((q, idx) => {
                if (q.correctAnswer === undefined || q.correctAnswer === null) {
                    console.log(`  🔧 Questão ${idx + 1}: correctAnswer está ${q.correctAnswer === undefined ? 'undefined' : 'null'}`);

                    let correctIdx = -1;
                    if (q.alternatives && Array.isArray(q.alternatives)) {
                        const firstAlt = q.alternatives[0];
                        if (typeof firstAlt === 'object' && 'isCorrect' in firstAlt) {
                            correctIdx = q.alternatives.findIndex(alt => alt.isCorrect === true);
                            console.log(`     ✓ Resposta correta no índice ${correctIdx}`);
                        } else {
                            correctIdx = 0;
                            console.warn(`     ⚠️ Usando 0 como padrão`);
                        }
                    }

                    needsUpdate = true;
                    return {
                        ...q,
                        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                        id: q.id || admin.firestore.FieldValue.serverTimestamp().toString(),
                        xpValue: q.xpValue || 100,
                        timeLimit: q.timeLimit || 30
                    };
                }
                return q;
            });

            if (needsUpdate) {
                batch.update(doc.ref, {
                    questions: fixedQuestions,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`  ✅ Marcado para correção`);
                fixedCount++;
            } else {
                console.log(`  ✓ Já está correto`);
            }
        });

        if (fixedCount > 0) {
            await batch.commit();
            console.log(`\n✅ ${fixedCount} quizzes corrigidos com sucesso!`);
        } else {
            console.log('\n✓ Nenhuma correção necessária');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }

    process.exit(0);
}

fixQuizzes();
