import { collection, doc, getDoc, getDocs, query, where, Timestamp, addDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { SUBSCRIPTION_CONFIG, type Subscription, type SubscriptionStatus, type Payment, type PaymentType } from '@/config/subscription';

/**
 * Get subscription for a base
 */
export async function getSubscription(baseId: string): Promise<Subscription | null> {
    try {
        const subscriptionDoc = await getDoc(doc(db, 'subscriptions', baseId));

        if (!subscriptionDoc.exists()) {
            return null;
        }

        const data = subscriptionDoc.data();
        return {
            id: subscriptionDoc.id,
            baseId: data.baseId,
            plan: data.plan,
            status: data.status,
            memberLimit: data.memberLimit,
            currentMemberCount: data.currentMemberCount,
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
            amount: data.amount,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
        };
    } catch (error) {
        console.error('Error getting subscription:', error);
        return null;
    }
}

/**
 * Check if base can add more members
 */
export async function canAddMember(baseId: string): Promise<{
    canAdd: boolean;
    currentCount: number;
    memberLimit: number;
    reason?: string;
}> {
    const subscription = await getSubscription(baseId);
    const liveCount = await getCurrentMemberCount(baseId);

    if (!subscription) {
        // No subscription found - allow for now (grace period or initial setup)
        return {
            canAdd: true,
            currentCount: liveCount,
            memberLimit: 999, // Unlimited until subscription is created
            reason: 'No subscription found'
        };
    }

    // Check if subscription is active
    if (subscription.status !== 'active') {
        return {
            canAdd: false,
            currentCount: liveCount,
            memberLimit: subscription.memberLimit,
            reason: 'Subscription is not active'
        };
    }

    // Check if subscription is expired
    if (subscription.endDate < new Date()) {
        return {
            canAdd: false,
            currentCount: liveCount,
            memberLimit: subscription.memberLimit,
            reason: 'Subscription has expired'
        };
    }

    // Check member limit
    if (liveCount >= subscription.memberLimit) {
        return {
            canAdd: false,
            currentCount: liveCount,
            memberLimit: subscription.memberLimit,
            reason: 'Member limit reached'
        };
    }

    return {
        canAdd: true,
        currentCount: liveCount,
        memberLimit: subscription.memberLimit
    };
}

/**
 * Get current member count for a base
 */
export async function getCurrentMemberCount(baseId: string): Promise<number> {
    try {
        const usersQuery = query(
            collection(db, 'users'),
            where('baseId', '==', baseId),
            where('status', '==', 'approved')
        );

        const snapshot = await getDocs(usersQuery);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting member count:', error);
        return 0;
    }
}

/**
 * Create a new pending payment
 */
export async function createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
        const paymentData = {
            ...data,
            status: 'pending',
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, 'payments'), paymentData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating payment:', error);
        throw error;
    }
}

/**
 * Confirm a payment and update subscription
 */
export async function confirmPayment(paymentId: string, confirmedBy: string): Promise<void> {
    try {
        const paymentDocRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentDocRef);

        if (!paymentSnap.exists()) {
            throw new Error('Payment not found');
        }

        const payment = paymentSnap.data() as Payment;

        if (payment.status === 'confirmed') {
            throw new Error('Payment already confirmed');
        }

        // Update payment status
        await updateDoc(paymentDocRef, {
            status: 'confirmed',
            confirmedAt: Timestamp.now(),
            confirmedBy,
        });

        // Update Subscription based on payment type
        const subscriptionRef = doc(db, 'subscriptions', payment.baseId);
        const subscriptionSnap = await getDoc(subscriptionRef);

        if (payment.type === 'subscription') {
            if (subscriptionSnap.exists()) {
                // For renewals/extensions or pending activation
                const subData = subscriptionSnap.data();
                let newStartDate = new Date();
                // If active and not expired, extend from end date?
                // Simple logic for now: Start from NOW or extend existing end date.
                if (subData.endDate?.toDate() > new Date()) {
                    newStartDate = subData.endDate.toDate();
                }

                // Check for explicit start date in metadata (e.g. set by user during creation)
                if (payment.metadata?.startDate) {
                    // Handle Firestore Timestamp or Date object
                    const metaDate = (payment.metadata.startDate as any).toDate
                        ? (payment.metadata.startDate as any).toDate()
                        : new Date(payment.metadata.startDate);

                    if (!isNaN(metaDate.getTime())) {
                        newStartDate = metaDate;
                    }
                }

                // Calculate new End Date based on months in metadata
                const months = payment.metadata?.months || 1;
                const newEndDate = new Date(newStartDate);
                newEndDate.setMonth(newEndDate.getMonth() + months);

                await updateDoc(subscriptionRef, {
                    status: 'active',
                    startDate: Timestamp.fromDate(newStartDate),
                    endDate: Timestamp.fromDate(newEndDate),
                    updatedAt: Timestamp.now(),
                });
            } else {
                await setDoc(subscriptionRef, {
                    status: 'active',
                    updatedAt: Timestamp.now(),
                }, { merge: true });
            }

        } else if (payment.type === 'member_addition') {
            // Add members logic
            if (!subscriptionSnap.exists()) {
                throw new Error('Cannot add members: Subscription not found');
            }

            const addedMembers = payment.metadata?.memberCount || 0;
            const currentLimit = subscriptionSnap.data().memberLimit || 0;

            await updateDoc(subscriptionRef, {
                memberLimit: currentLimit + addedMembers,
                updatedAt: Timestamp.now(),
            });
        }

    } catch (error) {
        console.error('Error confirming payment:', error);
        throw error;
    }
}

/**
 * Update payment details
 */
export async function updatePayment(paymentId: string, updates: Partial<Pick<Payment, 'amount' | 'description'>>): Promise<void> {
    try {
        const paymentRef = doc(db, 'payments', paymentId);
        await updateDoc(paymentRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating payment:', error);
        throw error;
    }
}

/**
 * Delete payment and reverse effects if confirmed
 */
export async function deletePayment(paymentId: string): Promise<void> {
    try {
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentRef);

        if (!paymentSnap.exists()) {
            throw new Error('Payment not found');
        }

        const payment = paymentSnap.data() as Payment;

        // If confirmed, reverse effects (Refund Logic)
        if (payment.status === 'confirmed') {
            const subscriptionRef = doc(db, 'subscriptions', payment.baseId);
            const subscriptionSnap = await getDoc(subscriptionRef);

            if (subscriptionSnap.exists()) {
                const subData = subscriptionSnap.data();

                if (payment.type === 'subscription') {
                    // Reversal Logic:
                    if (payment.metadata?.months && subData.endDate) {
                        try {
                            // Safely convert Firestore Timestamp to Date
                            const currentEndDate = subData.endDate.toDate ? subData.endDate.toDate() : new Date(subData.endDate);
                            const monthsToRevert = payment.metadata.months;

                            // Rough approximation: reverse the date extension
                            const newEndDate = new Date(currentEndDate);
                            newEndDate.setMonth(newEndDate.getMonth() - monthsToRevert);

                            // If new end date is in past, set status to expired?
                            const newStatus = newEndDate < new Date() ? 'expired' : subData.status;

                            await updateDoc(subscriptionRef, {
                                endDate: Timestamp.fromDate(newEndDate),
                                status: newStatus,
                                updatedAt: Timestamp.now()
                            });
                        } catch (e) {
                            console.error('Error reverting dates:', e);
                        }
                    }
                } else if (payment.type === 'member_addition') {
                    // Reduce member limit
                    const addedMembers = payment.metadata?.memberCount || 0;
                    const currentLimit = subData.memberLimit || 0;

                    await updateDoc(subscriptionRef, {
                        memberLimit: Math.max(0, currentLimit - addedMembers),
                        updatedAt: Timestamp.now()
                    });
                }
            }
        }

        // Finally delete the payment document
        await deleteDoc(paymentRef);

    } catch (error) {
        console.error('Error deleting payment:', error);
        throw error;
    }
}

/**
 * Get pending payments
 */
export async function getPendingPayments(): Promise<(Payment & { id: string })[]> {
    try {
        const q = query(
            collection(db, 'payments'),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data, // This spreads Timestamp objects
                createdAt: data.createdAt?.toDate(), // Overwrite with Date
                confirmedAt: data.confirmedAt?.toDate(),
            } as Payment;
        });
    } catch (error) {
        console.error('Error getting pending payments:', error);
        return [];
    }
}

/**
 * Get all payments (transactions)
 */
export async function getAllPayments(): Promise<(Payment & { id: string, baseName?: string })[]> {
    try {
        const q = query(collection(db, 'payments'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                confirmedAt: data.confirmedAt?.toDate(),
            } as Payment;
        });
    } catch (error) {
        console.error('Error getting payments:', error);
        return [];
    }
}
