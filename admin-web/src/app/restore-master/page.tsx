"use client";
import { useEffect, useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";

export default function RestoreMaster() {
    const { user } = useAuth();
    const [status, setStatus] = useState("Aguardando...");

    useEffect(() => {
        const restore = async () => {
            if (user?.email?.toLowerCase() !== 'master@baseteen.com') {
                setStatus("Faça login como Master para executar.");
                return;
            }

            if (!user.uid) return;

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    setStatus("Documento Master já existe.");
                } else {
                    await setDoc(ref, {
                        uid: user.uid,
                        email: user.email,
                        displayName: "Master Admin",
                        role: "master",
                        createdAt: new Date().toISOString()
                    });
                    setStatus("SUCESSO: Documento Master recriado!");
                }
            } catch (e: any) {
                setStatus("ERRO: " + e.message);
            }
        };
        restore();
    }, [user]);

    return <div className="p-10 text-xl font-bold">{status}</div>;
}
