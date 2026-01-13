"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";

interface AuthUser extends User {
    role?: string;
    baseId?: string;
    districtId?: string;
    regionId?: string;
    associationId?: string;
    unionId?: string;
    classification?: string;
    status?: 'pending' | 'approved' | 'rejected';
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
                    if (!userData && firebaseUser.email && firebaseUser.email !== "master@baseteen.com") {
                        try {
                            const q = query(collection(db, "users"), where("email", "==", firebaseUser.email.toLowerCase()));
                            const emailQuery = await getDocs(q);

                            if (!emailQuery.empty) {
                                const foundDoc = emailQuery.docs[0];
                                const foundData = foundDoc.data();
                                userData = foundData;

                                // Auto-link UID if missing or different
                                try {
                                    if (foundData.uid !== firebaseUser.uid) {
                                        await updateDoc(doc(db, "users", foundDoc.id), {
                                            uid: firebaseUser.uid,
                                            updatedAt: new Date()
                                        });
                                    }
                                } catch (linkErr) {
                                    console.warn("UID auto-link failed:", linkErr);
                                }
                            }
                        } catch (queryErr) {
                            console.warn("Email query failed (likely permission):", queryErr);
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
                            regionId: userData.regionId,
                            associationId: userData.associationId,
                            unionId: userData.unionId,
                            classification: userData.classification,
                            status: userData.status || 'approved', // Default to approved for existing users
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
