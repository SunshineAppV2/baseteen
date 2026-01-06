"use client";

import { useState, useEffect } from "react";
import {
    collection,
    query,
    onSnapshot,
    QueryConstraint,
    DocumentData,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc
} from "firebase/firestore";
import { db } from "@/services/firebase";

export function useCollection<T = DocumentData>(collectionName: string, constraints: QueryConstraint[] = []) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const q = query(collection(db, collectionName), ...constraints);

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as T[];
                setData(items);
                setLoading(false);
            },
            (err) => {
                console.error(`Error fetching collection ${collectionName}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [collectionName, JSON.stringify(constraints)]);

    return { data, loading, error };
}

export const firestoreService = {
    add: (collectionName: string, data: any) => addDoc(collection(db, collectionName), { ...data, createdAt: new Date() }),
    set: (collectionName: string, id: string, data: any) => setDoc(doc(db, collectionName, id), { ...data, updatedAt: new Date() }, { merge: true }),
    update: (collectionName: string, id: string, data: any) => updateDoc(doc(db, collectionName, id), { ...data, updatedAt: new Date() }),
    delete: (collectionName: string, id: string) => deleteDoc(doc(db, collectionName, id))
};
