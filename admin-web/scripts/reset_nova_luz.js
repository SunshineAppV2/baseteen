
const admin = require('firebase-admin');
const fs = require('fs');

// Load Service Account
// HARDCODED PATH because we know where it is from previous context
const serviceAccountPath = 'g:\\Users\\USUARIO\\Downloads\\baseteen-14dd5-firebase-adminsdk-fbsvc-d7520121c2.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Service account not found at: ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetNovaLuz() {
    console.log('Searching for "NOVA LUZ"...');

    // 1. Find Base ID
    const basesQuery = await db.collection('bases').where('name', '==', 'NOVA LUZ').get();

    if (basesQuery.empty) {
        console.error('Base "NOVA LUZ" not found!');
        process.exit(1);
    }

    const baseDoc = basesQuery.docs[0];
    const baseId = baseDoc.id;
    console.log(`Found Base: ${baseDoc.data().name} (ID: ${baseId})`);

    // 2. Delete Subscription
    console.log(`Deleting subscription for ${baseId}...`);
    const subDoc = await db.collection('subscriptions').doc(baseId).get();
    if (subDoc.exists) {
        await db.collection('subscriptions').doc(baseId).delete();
        console.log('Subscription deleted.');
    } else {
        console.log('No subscription document found.');
    }

    // 3. Delete Payments
    console.log(`Searching for payments for ${baseId}...`);
    const paymentsQuery = await db.collection('payments').where('baseId', '==', baseId).get();

    if (paymentsQuery.empty) {
        console.log('No payments found.');
    } else {
        console.log(`Found ${paymentsQuery.size} payments. Deleting...`);
        const batch = db.batch();
        paymentsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('Payments deleted.');
    }

    console.log('DONE! "NOVA LUZ" subscription reset.');
}

resetNovaLuz().catch(console.error);
