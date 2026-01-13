import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
    try {
        const quizzesRef = collection(db, 'master_quizzes');
        const snapshot = await getDocs(quizzesRef);

        let fixedCount = 0;
        let skippedCount = 0;
        const results = [];

        for (const docSnap of snapshot.docs) {
            const quiz = docSnap.data();

            if (!quiz.questions || quiz.questions.length === 0) {
                skippedCount++;
                continue;
            }

            let needsUpdate = false;
            const fixedQuestions = quiz.questions.map((q: any, idx: number) => {
                if (q.correctAnswer === undefined || q.correctAnswer === null) {
                    let correctIdx = -1;

                    if (q.alternatives && Array.isArray(q.alternatives)) {
                        const firstAlt = q.alternatives[0];
                        if (typeof firstAlt === 'object' && 'isCorrect' in firstAlt) {
                            correctIdx = q.alternatives.findIndex((alt: any) => alt.isCorrect === true);
                        } else {
                            correctIdx = 0;
                        }
                    }

                    needsUpdate = true;
                    return {
                        ...q,
                        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                        id: q.id || crypto.randomUUID(),
                        xpValue: q.xpValue || 100,
                        timeLimit: q.timeLimit || 30
                    };
                }
                return {
                    ...q,
                    id: q.id || crypto.randomUUID(),
                    xpValue: q.xpValue || 100,
                    timeLimit: q.timeLimit || 30
                };
            });

            if (needsUpdate) {
                await updateDoc(doc(db, 'master_quizzes', docSnap.id), {
                    questions: fixedQuestions,
                    updatedAt: new Date()
                });

                results.push({
                    id: docSnap.id,
                    title: quiz.title,
                    status: 'fixed'
                });
                fixedCount++;
            } else {
                skippedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            total: snapshot.size,
            fixed: fixedCount,
            skipped: skippedCount,
            results
        });

    } catch (error: any) {
        console.error('Error fixing quizzes:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
