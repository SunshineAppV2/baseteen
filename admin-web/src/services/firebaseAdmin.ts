import * as admin from 'firebase-admin';

// Lazy initialization - only runs when actually called
function getAdminApp() {
    if (!admin.apps.length) {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Missing Firebase Admin credentials. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel env vars.');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
    return admin.app();
}

export function getAdminAuth() {
    return getAdminApp().auth();
}

export function getAdminDb() {
    return getAdminApp().firestore();
}

export function getAdminMessaging() {
    return getAdminApp().messaging();
}
