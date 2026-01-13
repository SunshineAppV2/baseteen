const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function diagnose() {
    console.log("--- DIAGNOSTICO DE BASES ---");

    // 1. Buscar a Associação Norte do Pará para pegar o ID
    console.log("Procurando Associação Norte do Pará...");
    const assocSnap = await db.collection('associations').get();
    let targetAssoc = null;
    assocSnap.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('norte do pará')) {
            console.log(`Encontrada: ${data.name} (ID: ${doc.id}) - UnionId: ${data.unionId}`);
            targetAssoc = { id: doc.id, ...data };
        }
    });

    if (!targetAssoc) {
        console.error("Associação Norte do Pará NÃO encontrada!");
        return;
    }

    // 2. Buscar bases ZION e MISSIONARIOS DE CRISTO
    console.log("Verificando Bases Específicas:");
    const basesToCheck = ['ZION', 'MISSIONARIOS DE CRISTO'];

    for (const baseName of basesToCheck) {
        console.log(`Buscando base: ${baseName}...`);
        const baseSnap = await db.collection('bases').get();
        let found = false;

        baseSnap.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toUpperCase().includes(baseName)) {
                found = true;
                console.log(`>>> BASE ENCONTRADA: ${data.name} (ID: ${doc.id})`);
                console.log(`    DistrictId: ${data.districtId}`);
                console.log(`    RegionId:   ${data.regionId}`);
                console.log(`    AssocId:    ${data.associationId}`);
                console.log(`    UnionId:    ${data.unionId}`);

                if (data.associationId === targetAssoc.id) {
                    console.log("    STATUS: VÍNCULO CORRETO com a associação.");
                } else {
                    console.log(`    STATUS: VÍNCULO INCORRETO! Esperado: ${targetAssoc.id}, Encontrado: ${data.associationId}`);
                }
            }
        });

        if (!found) console.log(`    Base ${baseName} NÃO encontrada no banco de dados.`);
    }
}

diagnose().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
