"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";

interface AuthUser extends User {
    role?: string;
    baseId?: string;
    districtId?: string;
    classification?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // 1. Try fetching by UID
                    let userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                    let userData = userDoc.exists() ? userDoc.data() : null;

                    // 2. If not found by UID, try claiming by Email (for pre-created coordinators)
                    if (!userData && firebaseUser.email) {
                        const q = query(collection(db, "users"), where("email", "==", firebaseUser.email));
                        const emailQuery = await getDocs(q);

                        if (!emailQuery.empty) {
                            const foundDoc = emailQuery.docs[0];
                            const foundData = foundDoc.data();

                            // Transform the old "email-only" doc into a UID doc or update it
                            // For simplicity, we'll update the found doc with the UID if it doesn't have it
                            // or just use its data.
                            userData = foundData;
                            await updateDoc(doc(db, "users", foundDoc.id), {
                                uid: firebaseUser.uid,
                                displayName: firebaseUser.displayName || foundData.displayName,
                                updatedAt: new Date()
                            });
                        }
                    }

                    if (firebaseUser.email?.toLowerCase() === "master@baseteen.com") {
                        // FORCE MASTER ROLE regardless of DB state
                        userData = { ...(userData || {}), role: "master" };
                    }

                    if (userData) {
                        setUser({
                            ...firebaseUser,
                            displayName: userData.displayName || firebaseUser.displayName, // Prioritize Firestore name
                            role: userData.role,
                            baseId: userData.baseId,
                            districtId: userData.districtId,
                            classification: userData.classification,
                        } as AuthUser);
                    } else {
                        setUser(firebaseUser as AuthUser);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUser(firebaseUser as AuthUser);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const isAdmin = user?.role === "master" || user?.role === "coord_geral";

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
