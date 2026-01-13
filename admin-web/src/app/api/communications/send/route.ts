import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/services/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, message, targetType, targetId, priority = 'normal' } = body;

        // Validation
        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
        }

        const db = getAdminDb();
        const messaging = getAdminMessaging();

        // 1. Create In-App Notification(s)
        // If target is 'all', we might not want to create 1000 docs here synchronously.
        // For now, let's treat "Push" and "In-App" slightly differently.
        // If it's a broadcast, maybe we rely on the app to fetch "system_notifications" + "user_notifications".
        // But the current mobile app ONLY fetches 'notifications' where userId == current.

        // Strategy:
        // A. If target is specific user -> Create 1 doc, Send 1 push.
        // B. If target is 'all' -> Send Push to topic 'all'. Creating docs for ALL users is expensive. 
        //    WE SHOULD CREATE A 'system_announcements' collection for broadcasts, and update Mobile App to read it.
        //    But since I am not touching mobile app yet, I will focusing on the Push part.

        let fcmMessage: any = {
            notification: {
                title,
                body: message,
            },
            data: {
                type: 'info',
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            android: {
                priority: priority === 'high' ? 'high' : 'normal',
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                    },
                },
            },
        };

        if (targetType === 'all') {
            fcmMessage.topic = 'all';
        } else if (targetType === 'user' && targetId) {
            // Need user's FCM token. 
            // Since we don't have it in the request, we'd look it up in Firestore if saved.
            // Assuming for now we can't send individual PUSH without token.
            // But we CAN create the in-app notification.

            await db.collection('notifications').add({
                userId: targetId,
                title,
                message,
                type: 'info',
                read: false,
                createdAt: Timestamp.now()
            });

            // Try to find token (hypothetical)
            const userDoc = await db.collection('users').doc(targetId).get();
            const fcmToken = userDoc.data()?.fcmToken;

            if (fcmToken) {
                fcmMessage.token = fcmToken;
            } else {
                // Return success for In-App only
                return NextResponse.json({ success: true, method: 'in-app-only' });
            }
        }

        // Send FCM if we have a target (Topic or Token)
        if (fcmMessage.topic || fcmMessage.token) {
            await messaging.send(fcmMessage);
            return NextResponse.json({ success: true, method: 'push' });
        }

        return NextResponse.json({ success: true, method: 'saved' });

    } catch (error: any) {
        console.error('Error sending notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
