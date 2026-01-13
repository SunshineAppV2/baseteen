import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/services/googleDrive';
import { getAdminAuth } from '@/services/firebaseAdmin';

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request (Check for Authorization header)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        try {
            await getAdminAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        // 2. Parse Body
        const { filename, contentType, size } = await req.json();
        if (!filename || !contentType) {
            return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
        }

        // Capture client origin for CORS
        const clientOrigin = req.headers.get('origin') || '*';

        const { drive, folderId } = getDriveClient();

        // 3. Create Resumable Upload Session
        // We use the `drive.files.create` method but with `media` set to null and inspect the response? 
        // No, standard `googleapis` usage for resumable URI is tricky.
        // We will filter down to `drive.context._options.auth` to make a direct request.

        const metadata = {
            name: filename,
            parents: [folderId],
            mimeType: contentType
        };

        const authClient = (drive.context._options as any).auth;

        // Direct request to generate resumable session URI
        const response = await authClient.request({
            url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
            method: 'POST',
            headers: {
                'X-Upload-Content-Type': contentType,
                'X-Upload-Content-Length': size.toString(),
                'Content-Type': 'application/json; charset=UTF-8',
                'Origin': clientOrigin // REQUIRED for CORS on the PUT request
            },
            data: JSON.stringify(metadata)
        });

        console.log("Drive API Response Status:", response.status);

        // Robust header extraction
        let uploadUrl: string | null | undefined = response.headers['location'] || response.headers['Location'];

        // Try getting via get() method if it exists (Headers object)
        if (!uploadUrl && typeof (response.headers as any).get === 'function') {
            uploadUrl = (response.headers as any).get('location');
        }

        // Try case-insensitive key search
        if (!uploadUrl && response.headers) {
            const keys = Object.keys(response.headers);
            const locationKey = keys.find(k => k.toLowerCase() === 'location');
            if (locationKey) {
                uploadUrl = (response.headers as any)[locationKey];
            }
        }

        if (!uploadUrl) {
            console.error("Missing Location header in Drive response");
            console.error("Response Headers Keys:", Object.keys(response.headers));
            throw new Error("Failed to get upload URL from Google Drive - Check Server Logs");
        }

        return NextResponse.json({ uploadUrl });

    } catch (error: any) {
        console.error("Drive API Error (Full):", error);
        if (error.response) {
            console.error("Error Response Data:", error.response.data);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
