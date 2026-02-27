import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    getDocs,
    limit,
    query
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

async function check() {
    try {
        console.log("Checando coleção 'bases'...");
        const snapshot = await getDocs(query(collection(db, "bases"), limit(5)));
        console.log(`Sucesso! Encontrados ${snapshot.size} documentos iniciais.`);
        snapshot.forEach(doc => console.log(` - ${doc.id}: ${doc.data().name}`));
    } catch (err) {
        console.error("Erro na conexão:", err);
    }
}

check().then(() => process.exit(0));
