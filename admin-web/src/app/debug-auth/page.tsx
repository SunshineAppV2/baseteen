'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/services/firebase';
import { getIdToken, getIdTokenResult } from 'firebase/auth';

export default function DebugAuthPage() {
    const { user: contextUser } = useAuth();
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [claims, setClaims] = useState<any>(null);

    const handleSync = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setStatus('Error: User not authenticated');
            return;
        }
        setLoading(true);
        setStatus('Syncing...');
        try {
            const token = await getIdToken(currentUser, true);
            const res = await fetch('/api/auth/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (res.ok) {
                setStatus('✅ Success! Permissions synced. Token refreshed.');
                setClaims(data.claims);
                await getIdToken(currentUser, true);
            } else {
                setStatus(`❌ Error: ${data.error}\n${data.details || ''}`);
            }
        } catch (err: any) {
            console.error('Sync error:', err);
            setStatus('❌ Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResync = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setStatus('Error: User not authenticated');
            return;
        }
        setLoading(true);
        setStatus('Resyncing from Firestore...');
        try {
            const token = await getIdToken(currentUser, true);
            const res = await fetch('/api/auth/resync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (res.ok) {
                setStatus('✅ Resynced! Claims updated from Firestore.');
                setClaims(data.newClaims);
                await getIdToken(currentUser, true);
            } else {
                setStatus(`❌ Error: ${data.error}`);
            }
        } catch (err: any) {
            console.error('Resync error:', err);
            setStatus('❌ Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintToken = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setStatus('Error: User not authenticated');
            return;
        }
        try {
            const tokenResult = await getIdTokenResult(currentUser);
            setClaims(tokenResult.claims);
            setStatus('Token loaded successfully');
        } catch (err: any) {
            setStatus('Error loading token: ' + err.message);
        }
    };

    if (!contextUser) return <div className="p-10">Please login first.</div>;

    return (
        <div className="p-10 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Debug Permissions (Custom Claims)</h1>

            <div className="p-4 border rounded bg-gray-50">
                <p><strong>User:</strong> {contextUser.displayName} ({contextUser.email})</p>
                <p><strong>UID:</strong> {contextUser.uid}</p>
            </div>

            <div className="flex gap-4 flex-wrap">
                <button
                    onClick={handleSync}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Syncing...' : 'Sync Permissions'}
                </button>

                <button
                    onClick={handleResync}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                    {loading ? 'Resyncing...' : 'Resync from Firestore'}
                </button>

                <button
                    onClick={handlePrintToken}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                    View Current Claims
                </button>
            </div>

            {status && (
                <div className={`p-4 rounded ${status.startsWith('Error') || status.startsWith('❌') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {status}
                </div>
            )}

            {claims && (
                <div className="space-y-2">
                    <h3 className="font-bold">Current Token Claims:</h3>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(claims, null, 2)}
                    </pre>
                </div>
            )}

            <div className="text-sm text-gray-500 mt-8">
                <p>Note: This feature requires FIREBASE_PRIVATE_KEY to be set in Vercel Environment Variables.</p>
            </div>
        </div>
    );
}
