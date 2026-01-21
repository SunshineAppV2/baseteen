import { NextRequest, NextResponse } from "next/server";
import { getAdminApps } from "firebase-admin/app";
import { getAdminDb, getAdminAuth } from "@/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const { userId, score, quizTitle, idToken } = await req.json();

        if (!userId || !idToken) {
            return NextResponse.json({ error: "Missing userId, or idToken" }, { status: 400 });
        }

        // 1. Verify Authentication (Assertive Security)
        const auth = getAdminAuth();
        const decodedToken = await auth.verifyIdToken(idToken);
        
        if (decodedToken.uid !== userId) {
            return NextResponse.json({ error: "Unauthorized: User ID mismatch" }, { status: 403 });
        }

        if (score <= 0) {
             return NextResponse.json({ message: "Score is 0, skipping save" }, { status: 200 });
        }

        // 2. Perform Database Operations with Admin Privileges
        const db = getAdminDb();
        const userRef = db.collection("users").doc(userId);

        // Run as a transaction to ensure consistency
        await db.runTransaction(async (transaction) => {
            // Update User XP
            transaction.update(userRef, {
                xp: FieldValue.increment(score),
                "stats.currentXp": FieldValue.increment(score)
            });

            // Add History Entry
            const historyRef = userRef.collection("xp_history").doc();
            transaction.set(historyRef, {
                amount: score,
                type: 'quiz',
                taskTitle: `Quiz: ${quizTitle}`,
                createdAt: FieldValue.serverTimestamp(),
                reason: `Participação Individual no Quiz: ${quizTitle}`
            });
        });

        return NextResponse.json({ success: true, message: "Score saved successfully via Secure API" });

    } catch (error: any) {
        console.error("Error in /api/quiz/submit_result:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
