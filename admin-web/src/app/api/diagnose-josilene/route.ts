import { NextResponse } from 'next/server';
import { getAdminDb } from '@/services/firebaseAdmin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
        }

        const adminDb = getAdminDb();
        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Fetch hierarchy details
        const details: any = {
            user: {
                id: userDoc.id,
                ...userData
            },
            hierarchy: {}
        };

        // Fetch related documents if IDs exist
        if (userData.unionId) {
            const union = await adminDb.collection('unions').doc(userData.unionId).get();
            details.hierarchy.union = union.exists ? union.data() : 'NOT_FOUND';
        }

        if (userData.associationId) {
            const assoc = await adminDb.collection('associations').doc(userData.associationId).get();
            details.hierarchy.association = assoc.exists ? assoc.data() : 'NOT_FOUND';
        }

        if (userData.regionId) {
            const region = await adminDb.collection('regions').doc(userData.regionId).get();
            details.hierarchy.region = region.exists ? region.data() : 'NOT_FOUND';
        }

        if (userData.districtId) {
            const district = await adminDb.collection('districts').doc(userData.districtId).get();
            details.hierarchy.district = district.exists ? district.data() : 'NOT_FOUND';
        }

        if (userData.baseId) {
            const base = await adminDb.collection('bases').doc(userData.baseId).get();
            details.hierarchy.base = base.exists ? base.data() : 'NOT_FOUND';
        }

        return NextResponse.json(details);

    } catch (error: any) {
        console.error('Diagnostic error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
