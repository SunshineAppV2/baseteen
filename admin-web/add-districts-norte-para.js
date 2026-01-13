const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function addDistricts() {
    console.log("--- ADICIONANDO DISTRITOS À ASSOCIAÇÃO NORTE DO PARÁ ---\n");

    // 1. Buscar a Associação Norte do Pará
    console.log("Procurando Associação Norte do Pará...");
    const assocSnap = await db.collection('associations').get();
    let targetAssoc = null;

    assocSnap.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('norte do pará')) {
            console.log(`✓ Encontrada: ${data.name} (ID: ${doc.id})`);
            console.log(`  UnionId: ${data.unionId}\n`);
            targetAssoc = { id: doc.id, ...data };
        }
    });

    if (!targetAssoc) {
        console.error("❌ Associação Norte do Pará NÃO encontrada!");
        return;
    }

    // 2. Lista de distritos a serem adicionados
    const districtNames = [
        "Guamá",
        "Vigia",
        "Aurora do Pará",
        "Bragança I",
        "Quatro Bocas",
        "Águas Lindas",
        "Bragança II",
        "Acara",
        "Abaetetuba II",
        "Imperador",
        "Decouville",
        "Salinópolis",
        "Cigana",
        "Abaetetuba",
        "A.b.a.",
        "Anpa",
        "Salles Jardins",
        "Cumatê",
        "Santa Izabel",
        "Julia Seffer",
        "Cohab Castanhal",
        "Moju",
        "Ipitinga",
        "Tauá",
        "Cachoeira do Piriá",
        "Concordia",
        "Curuçá I",
        "Igarapé-miri",
        "São Miguel do Guamá",
        "Central Belém",
        "Olho D'água",
        "Capanema",
        "Pedreira",
        "Jaderlandia",
        "Igarapé-açu",
        "Central Castanhal",
        "São Brás",
        "Capitão Poço",
        "Mãe do Rio",
        "Ipixuna do Pará",
        "Marco II",
        "Marco",
        "Jose Bonifacio",
        "Encontro Vida",
        "Umarizal"
    ];

    console.log(`Preparando para adicionar ${districtNames.length} distritos...\n`);

    // 3. Verificar quais já existem
    const existingDistricts = await db.collection('districts').get();
    const existingNames = new Set();

    existingDistricts.forEach(doc => {
        const data = doc.data();
        if (data.name) {
            existingNames.add(data.name.toLowerCase().trim());
        }
    });

    // 4. Adicionar distritos que não existem
    let addedCount = 0;
    let skippedCount = 0;

    for (const districtName of districtNames) {
        const normalizedName = districtName.toLowerCase().trim();

        if (existingNames.has(normalizedName)) {
            console.log(`⊘ PULADO: "${districtName}" (já existe)`);
            skippedCount++;
            continue;
        }

        try {
            const districtData = {
                name: districtName,
                associationId: targetAssoc.id,
                unionId: targetAssoc.unionId,
                createdAt: new Date()
            };

            const docRef = await db.collection('districts').add(districtData);
            console.log(`✓ ADICIONADO: "${districtName}" (ID: ${docRef.id})`);
            addedCount++;

            // Pequeno delay para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`❌ ERRO ao adicionar "${districtName}":`, error.message);
        }
    }

    console.log("\n--- RESUMO ---");
    console.log(`Total de distritos na lista: ${districtNames.length}`);
    console.log(`✓ Adicionados: ${addedCount}`);
    console.log(`⊘ Pulados (já existiam): ${skippedCount}`);
    console.log(`❌ Erros: ${districtNames.length - addedCount - skippedCount}`);
}

addDistricts()
    .then(() => {
        console.log("\n✅ Script finalizado com sucesso!");
        process.exit(0);
    })
    .catch(e => {
        console.error("\n❌ Erro fatal:", e);
        process.exit(1);
    });
