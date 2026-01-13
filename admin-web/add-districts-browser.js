// Script para adicionar distritos via Firebase Client SDK
// Execute este código no console do navegador enquanto estiver logado no admin

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

async function addDistrictsToNorteDoPara() {
    console.log("🔍 Procurando Associação Norte do Pará...");

    // Importar Firebase do contexto global (assumindo que já está carregado)
    const { collection, getDocs, addDoc, query, where } = window.firebase.firestore;
    const db = window.firebase.db || window.db;

    if (!db) {
        console.error("❌ Firebase não encontrado! Certifique-se de estar logado no sistema.");
        return;
    }

    try {
        // 1. Buscar Associação Norte do Pará
        const assocSnap = await getDocs(collection(db, 'associations'));
        let targetAssoc = null;

        assocSnap.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toLowerCase().includes('norte do pará')) {
                console.log(`✓ Encontrada: ${data.name} (ID: ${doc.id})`);
                targetAssoc = { id: doc.id, ...data };
            }
        });

        if (!targetAssoc) {
            console.error("❌ Associação Norte do Pará não encontrada!");
            return;
        }

        // 2. Verificar distritos existentes
        const existingSnap = await getDocs(collection(db, 'districts'));
        const existingNames = new Set();

        existingSnap.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                existingNames.add(data.name.toLowerCase().trim());
            }
        });

        // 3. Adicionar distritos
        let addedCount = 0;
        let skippedCount = 0;

        console.log(`\n📝 Adicionando ${districtNames.length} distritos...\n`);

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

                const docRef = await addDoc(collection(db, 'districts'), districtData);
                console.log(`✓ ADICIONADO: "${districtName}" (ID: ${docRef.id})`);
                addedCount++;

                // Delay para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`❌ ERRO ao adicionar "${districtName}":`, error.message);
            }
        }

        console.log("\n--- RESUMO ---");
        console.log(`Total: ${districtNames.length}`);
        console.log(`✓ Adicionados: ${addedCount}`);
        console.log(`⊘ Pulados: ${skippedCount}`);
        console.log(`❌ Erros: ${districtNames.length - addedCount - skippedCount}`);

    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

// Executar
addDistrictsToNorteDoPara();
