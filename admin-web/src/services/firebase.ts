import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics, Analytics } from "firebase/analytics";

export const firebaseConfig = {
    apiKey: "AIzaSyD0dbtZXKTdQGFw5A5AJ7b6aNeiww4W6l8",
    authDomain: "baseteen-14dd5.firebaseapp.com",
    projectId: "baseteen-14dd5",
    storageBucket: "baseteen-14dd5.appspot.com",
    messagingSenderId: "555602992770",
    appId: "1:555602992770:web:5b9427374fefe211059e9b",
    measurementId: "G-0V6L5KKJPT",
    databaseURL: "https://baseteen-14dd5-default-rtdb.firebaseio.com/"
};

import { initializeFirestore } from "firebase/firestore";

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const auth = getAuth(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

let analytics: Analytics | undefined;

if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

export { app, db, auth, rtdb, storage, analytics };
