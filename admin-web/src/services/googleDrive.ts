import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export function getDriveClient() {
    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientEmail || !privateKey || !folderId) {
        throw new Error("Google Drive credentials missing in environment variables.");
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: SCOPES,
    });

    return {
        drive: google.drive({ version: 'v3', auth }),
        folderId
    };
}
