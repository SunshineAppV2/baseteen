import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const admin = await import('firebase-admin');

        if (!admin.apps.length) {
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            if (!projectId || !clientEmail || !privateKey) {
                return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
            }

            admin.initializeApp({
                credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
            });
        }

        const adminAuth = admin.auth();
        const adminDb = admin.firestore();

        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing Auth Token" }, { status: 401 });
        }
        const idToken = authHeader.split("Bearer ")[1];

        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Get user doc from Firestore
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userData = userDoc.data();

        // Force resync with current Firestore data
        const claims = {
            role: userData?.role || 'membro',
            baseId: userData?.baseId || null,
            districtId: userData?.districtId || null,
            syncedAt: Date.now()
        };

        await adminAuth.setCustomUserClaims(uid, claims);

        return NextResponse.json({
            success: true,
            message: "Claims resynced from Firestore",
            firestoreData: {
                role: userData?.role,
                baseId: userData?.baseId,
                districtId: userData?.districtId
            },
            newClaims: claims
        });

    } catch (error: any) {
        console.error("Resync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
