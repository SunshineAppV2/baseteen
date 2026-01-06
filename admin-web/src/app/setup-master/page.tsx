'use client';

import { useState } from 'react';
import { auth, db } from '@/services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function SetupMasterPage() {
    const [status, setStatus] = useState('Idle');
    const [error, setError] = useState('');

    const createMaster = async () => {
        setStatus('Processing Master...');
        setError('');
        await createAdminUser('master@baseteen.com', '123456', 'Master User');
    };

    const createBackup = async () => {
        setStatus('Processing Backup...');
        setError('');
        await createAdminUser('suporte@baseteen.com', '123456', 'Suporte Admin');
    };

    const createAdminUser = async (email: string, pass: string, name: string) => {
        try {
            let user;
            try {
                // 1. Try to create
                const credential = await createUserWithEmailAndPassword(auth, email, pass);
                user = credential.user;
                setStatus(`Created ${email} in Auth...`);
            } catch (e: any) {
                if (e.code === 'auth/email-already-in-use') {
                    setStatus(`${email} exists, trying to sign in to update role...`);
                    try {
                        const credential = await signInWithEmailAndPassword(auth, email, pass);
                        user = credential.user;
                    } catch (loginErr: any) {
                        throw new Error(`User ${email} exists but password '${pass}' is incorrect. Cannot update role. Try the Backup Admin.`);
                    }
                } else {
                    throw e;
                }
            }

            if (!user) throw new Error('No user found');

            // 2. Set Firestore Data
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: name,
                role: 'master',
                createdAt: new Date(),
                districtId: 'global',
                baseId: 'global'
            }, { merge: true });

            setStatus(`Success! configured ${email} as master.`);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setStatus('Failed');
        }
    };

    const promoteCurrentUser = async () => {
        setStatus('Promoting current user (NUCLEAR MODE)...');
        setError('');

        const user = auth.currentUser;
        if (!user) {
            setError('You must be logged in to use this option.');
            return;
        }

        try {
            // NUCLEAR OPTION: Create a fresh, isolated app instance to bypass main app connection issues
            // This is copied from the OrganizationPage attempt, but isolated here.
            const { initializeApp, deleteApp } = await import("firebase/app");
            const { getFirestore, doc, setDoc } = await import("firebase/firestore");
            const { firebaseConfig } = await import("@/services/firebase");

            const tempAppName = "promoteMasterApp_" + Date.now();
            const tempApp = initializeApp(firebaseConfig, tempAppName);
            const tempDb = getFirestore(tempApp);

            setStatus('Instance created. Sending write command...');

            await setDoc(doc(tempDb, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Admin Promovido',
                role: 'master',
                updatedAt: new Date(),
                districtId: 'global',
                baseId: 'global',
                promotedVia: 'setup-master-nuclear'
            }, { merge: true });

            setStatus('Write success! Cleaning up...');
            await deleteApp(tempApp);

            setStatus(`SUCCESS! User ${user.email} is now MASTER. Go back to Organization page.`);
        } catch (e: any) {
            console.error(e);
            setError("FATAL ERROR: " + e.message);
            setStatus('Failed to promote.');
        }
    };

    return (
        <div className="p-10 flex flex-col items-center justify-center min-h-screen space-y-6">
            <h1 className="text-2xl font-bold">Setup Admin Users</h1>

            <div className="p-4 border rounded bg-gray-50 flex flex-col items-center gap-2 w-96">
                <h2 className="font-semibold">Option A: Master User</h2>
                <p className="text-sm text-gray-600">master@baseteen.com / 123456</p>
                <button
                    onClick={createMaster}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold w-full"
                >
                    CREATE / FIX MASTER
                </button>
            </div>

            <div className="p-4 border rounded bg-gray-50 flex flex-col items-center gap-2 w-96">
                <h2 className="font-semibold">Option B: Backup User</h2>
                <p className="text-sm text-gray-600">suporte@baseteen.com / 123456</p>
                <button
                    onClick={createBackup}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold w-full"
                >
                    CREATE BACKUP ADMIN
                </button>
            </div>

            <div className="p-4 border rounded bg-yellow-50 flex flex-col items-center gap-2 w-96 border-yellow-200">
                <h2 className="font-semibold text-yellow-800">Option C: Promote Me</h2>
                <p className="text-sm text-yellow-700">Use se já estiver logado (mas sem acesso)</p>
                <button
                    onClick={promoteCurrentUser}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-bold w-full"
                >
                    PROMOTE MY ACCOUNT
                </button>
            </div>

            <div className="p-4 border rounded bg-purple-50 flex flex-col items-center gap-2 w-96 border-purple-200">
                <h2 className="font-semibold text-purple-800">Option D: FORÇAR HTTP (Último Recurso)</h2>
                <p className="text-sm text-purple-700">Usa HTTP puro se o Firebase estiver bloqueado.</p>
                <button
                    onClick={async () => {
                        const user = auth.currentUser;
                        if (!user) {
                            setError('Você precisa estar logado.');
                            return;
                        }
                        setStatus('Obtendo Token...');
                        try {
                            const token = await user.getIdToken();
                            setStatus('Token OK. Enviando HTTP REST Request...');

                            // Raw REST API call to Firestore
                            const projectId = "baseteen-14dd5";
                            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}?updateMask.fieldPaths=role&updateMask.fieldPaths=email&updateMask.fieldPaths=uid`;

                            const response = await fetch(url, {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    name: `projects/${projectId}/databases/(default)/documents/users/${user.uid}`,
                                    fields: {
                                        role: { stringValue: "master" },
                                        email: { stringValue: user.email },
                                        uid: { stringValue: user.uid },
                                        promotedVia: { stringValue: "http-rest-force" }
                                    }
                                })
                            });

                            if (!response.ok) {
                                const errText = await response.text();
                                throw new Error(`HTTP Error ${response.status}: ${errText}`);
                            }

                            setStatus('SUCESSO TOTAL! HTTP Request funcionou. Recarregue seu painel de organização.');
                            alert("SUCESSO! A conexão HTTP funcionou. Seu usuário agora é Master.");
                        } catch (e: any) {
                            console.error(e);
                            setError("HTTP API FALHOU: " + e.message);
                            setStatus('Failed');
                        }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-bold w-full"
                >
                    FORÇAR VIA HTTP (REST)
                </button>
            </div>

            {status && <div className="p-4 bg-gray-100 rounded w-full max-w-lg text-center font-mono break-words text-xs">{status}</div>}
            {error && <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded w-full max-w-lg text-center font-bold break-words text-xs">{error}</div>}
        </div>
    );
}
