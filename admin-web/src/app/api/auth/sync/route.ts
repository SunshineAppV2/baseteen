import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering - don't try to build this at compile time
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Lazy import Firebase Admin - only load when actually called
        const admin = await import('firebase-admin');

        // Initialize if needed
        if (!admin.apps.length) {
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            if (!projectId || !clientEmail || !privateKey) {
                return NextResponse.json({
                    error: "Missing Firebase Admin credentials",
                    details: "Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel env vars."
                }, { status: 500 });
            }

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        }

        const adminAuth = admin.auth();
        const adminDb = admin.firestore();

        // 1. Verify Authentication Header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing Auth Token" }, { status: 401 });
        }
        const idToken = authHeader.split("Bearer ")[1];

        // 2. Verify Token & Get UID
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 3. Fetch User Data from Firestore
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }
        const userData = userDoc.data();

        // 4. Prepare Claims
        const claims = {
            role: userData?.role || 'membro',
            baseId: userData?.baseId || userData?.userBaseId || null,
            districtId: userData?.districtId || userData?.userDistrictId || null,
            // Add Timestamp to force token refresh on client if needed
            syncedAt: Date.now()
        };

        // 5. Set Custom User Claims
        await adminAuth.setCustomUserClaims(uid, claims);

        return NextResponse.json({
            success: true,
            message: `Permissions synced for ${userData?.displayName || uid}`,
            claims
        });

    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({
            error: error.message || "Internal Server Error",
            details: "Check server logs. Ensure FIREBASE_PRIVATE_KEY is set."
        }, { status: 500 });
    }
}
