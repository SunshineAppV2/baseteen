import { NextRequest, NextResponse } from "next/server";

import { getAdminDb, getAdminAuth } from "@/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const { userId, score, quizId, quizTitle, idToken } = await req.json();

        if (!userId || !idToken) {
            return NextResponse.json({ error: "Missing userId, or idToken" }, { status: 400 });
        }

        // 1. Verify Authentication (Assertive Security)
        const auth = getAdminAuth();
        const decodedToken = await auth.verifyIdToken(idToken);

        if (decodedToken.uid !== userId) {
            // Check if requester is a manager/coordinator
            const db = getAdminDb();
            const requesterDoc = await db.collection("users").doc(decodedToken.uid).get();
            const requesterData = requesterDoc.data();

            const allowedRoles = ['master', 'admin', 'coord_geral', 'coord_regional', 'coord_distrital', 'coord_base', 'secretaria', 'coord_associacao', 'coord_uniao'];
            const hasPermission = requesterData && allowedRoles.includes(requesterData.role);

            if (!hasPermission) {
                return NextResponse.json({ error: "Unauthorized: User ID mismatch and no manager privileges" }, { status: 403 });
            }
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
                quizId: quizId || null,
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
