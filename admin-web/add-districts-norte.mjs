// Script para adicionar distritos à Associação Norte do Pará
// Execute com: node add-districts-norte.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyD0dbtZXKTdQGFw5A5AJ7b6aNeiww4W6l8",
    authDomain: "baseteen-14dd5.firebaseapp.com",
    projectId: "baseteen-14dd5",
    storageBucket: "baseteen-14dd5.firebasestorage.app",
    messagingSenderId: "555602992770",
    appId: "1:555602992770:web:5b9427374fefe211059e9b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const districtNames = [
    "Guamá", "Vigia", "Aurora do Pará", "Bragança I", "Quatro Bocas",
    "Águas Lindas", "Bragança II", "Acara", "Abaetetuba II", "Imperador",
    "Decouville", "Salinópolis", "Cigana", "Abaetetuba", "A.b.a.",
    "Anpa", "Salles Jardins", "Cumatê", "Santa Izabel", "Julia Seffer",
    "Cohab Castanhal", "Moju", "Ipitinga", "Tauá", "Cachoeira do Piriá",
    "Concordia", "Curuçá I", "Igarapé-miri", "São Miguel do Guamá",
    "Central Belém", "Olho D'água", "Capanema", "Pedreira", "Jaderlandia",
    "Igarapé-açu", "Central Castanhal", "São Brás", "Capitão Poço",
    "Mãe do Rio", "Ipixuna do Pará", "Marco II", "Marco", "Jose Bonifacio",
    "Encontro Vida", "Umarizal"
];

async function addDistricts() {
    console.log("🔍 Procurando Associação Norte do Pará...\n");

    try {
        // 1. Buscar Associação Norte do Pará
        const assocSnap = await getDocs(collection(db, 'associations'));
        let targetAssoc = null;

        assocSnap.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toLowerCase().includes('norte do pará')) {
                console.log(`✓ Encontrada: ${data.name}`);
                console.log(`  ID: ${doc.id}`);
                console.log(`  UnionId: ${data.unionId}\n`);
                targetAssoc = { id: doc.id, ...data };
            }
        });

        if (!targetAssoc) {
            console.error("❌ Associação Norte do Pará não encontrada!");
            process.exit(1);
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

        console.log(`📝 Adicionando ${districtNames.length} distritos...\n`);

        // 3. Adicionar distritos
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

        process.exit(0);
    } catch (error) {
        console.error("❌ Erro fatal:", error);
        process.exit(1);
    }
}

addDistricts();
