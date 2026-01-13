const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkBases() {
    const snapshot = await db.collection('bases').limit(10).get();
    snapshot.forEach(doc => {
        console.log(`Base: ${doc.data().name}`);
        console.log(`Fields: ${Object.keys(doc.data()).join(', ')}`);
        if (doc.data().whatsapp) console.log(`  whatsapp: ${doc.data().whatsapp}`);
        if (doc.data().phone) console.log(`  phone: ${doc.data().phone}`);
        if (doc.data().celular) console.log(`  celular: ${doc.data().celular}`);
        if (doc.data().telefone) console.log(`  telefone: ${doc.data().telefone}`);
    });
}

checkBases().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
