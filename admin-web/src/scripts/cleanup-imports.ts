import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    Timestamp
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD0dbtZXKTdQGFw5A5AJ7b6aNeiww4W6l8",
    authDomain: "baseteen-14dd5.firebaseapp.com",
    projectId: "baseteen-14dd5",
    storageBucket: "baseteen-14dd5.firebasestorage.app",
    messagingSenderId: "555602992770",
    appId: "1:555602992770:web:5b9427374fefe211059e9b",
    measurementId: "G-0V6L5KKJPT",
    databaseURL: "https://baseteen-14dd5-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = ["unions", "associations", "regions", "districts", "bases"];

async function cleanupRecent(dryRun = true) {
    // Look for docs created in the last 30 minutes
    const threshold = new Date(Date.now() - 30 * 60 * 1000);
    console.log(`Buscando documentos criados após: ${threshold.toLocaleString()}`);

    for (const colName of collections) {
        const q = query(collection(db, colName), where("createdAt", ">", Timestamp.fromDate(threshold)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log(`[-] Ninguém encontrado em: ${colName}`);
            continue;
        }

        console.log(`[!] Encontrados ${snapshot.size} itens em: ${colName}`);

        for (const fdoc of snapshot.docs) {
            const data = fdoc.data();
            console.log(`    - [${colName}] ID: ${fdoc.id} | Nome: ${data.name}`);

            if (!dryRun) {
                await deleteDoc(doc(db, colName, fdoc.id));
                console.log(`      Excluído.`);
            }
        }
    }
}

const isDryRun = process.argv.includes("--confirm") ? false : true;

if (isDryRun) {
    console.log("MODO: DRY RUN (Apenas listagem). Adicione '--confirm' para excluir de verdade.");
} else {
    console.log("MODO: EXCLUSÃO REAL.");
}

cleanupRecent(isDryRun).then(() => {
    console.log("Concluído.");
    process.exit(0);
}).catch(err => {
    console.error("Erro:", err);
    process.exit(1);
});
