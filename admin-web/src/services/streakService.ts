import { db } from './firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakFreezeUsed: boolean;
}

/**
 * Get streak data for a base
 */
export async function getBaseStreak(baseId: string): Promise<StreakData> {
    const baseDoc = await getDoc(doc(db, 'bases', baseId));
    const data = baseDoc.data();

    return {
        currentStreak: data?.currentStreak || 0,
        longestStreak: data?.longestStreak || 0,
        lastActivityDate: data?.lastActivityDate?.toDate() || null,
        streakFreezeUsed: data?.streakFreezeUsed || false
    };
}

/**
 * Update streak when base completes a task
 */
export async function updateStreak(baseId: string): Promise<StreakData> {
    const baseRef = doc(db, 'bases', baseId);
    const baseDoc = await getDoc(baseRef);
    const data = baseDoc.data();

    const now = new Date();
    const lastActivity = data?.lastActivityDate?.toDate();
    let currentStreak = data?.currentStreak || 0;
    let longestStreak = data?.longestStreak || 0;

    if (lastActivity) {
        const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastActivity === 0) {
            // Same day - no change to streak
            return {
                currentStreak,
                longestStreak,
                lastActivityDate: lastActivity,
                streakFreezeUsed: data?.streakFreezeUsed || false
            };
        } else if (daysSinceLastActivity === 1) {
            // Next day - increment streak
            currentStreak += 1;
        } else {
            // Missed days - reset streak
            currentStreak = 1;
        }
    } else {
        // First activity ever
        currentStreak = 1;
    }

    // Update longest streak if current is higher
    if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
    }

    // Update in Firestore
    await updateDoc(baseRef, {
        currentStreak,
        longestStreak,
        lastActivityDate: Timestamp.fromDate(now)
    });

    return {
        currentStreak,
        longestStreak,
        lastActivityDate: now,
        streakFreezeUsed: data?.streakFreezeUsed || false
    };
}

/**
 * Use streak freeze to protect from losing streak
 */
export async function useStreakFreeze(baseId: string): Promise<boolean> {
    const baseRef = doc(db, 'bases', baseId);
    const baseDoc = await getDoc(baseRef);
    const data = baseDoc.data();

    // Check if already used this month
    if (data?.streakFreezeUsed) {
        return false;
    }

    // Use freeze
    await updateDoc(baseRef, {
        streakFreezeUsed: true,
        lastActivityDate: Timestamp.fromDate(new Date()) // Update to today
    });

    return true;
}

/**
 * Reset streak freeze on the 1st of each month (call via Cloud Function)
 */
export async function resetMonthlyStreakFreezes(): Promise<void> {
    // This should be called by a Cloud Function scheduled for the 1st of each month
    // For now, it's just a placeholder
    console.log('Resetting monthly streak freezes...');
}

/**
 * Calculate XP bonus based on streak
 */
export function calculateStreakBonus(streak: number): number {
    if (streak >= 60) return 0.30; // 30% bonus
    if (streak >= 30) return 0.20; // 20% bonus
    if (streak >= 14) return 0.10; // 10% bonus
    if (streak >= 7) return 0.05;  // 5% bonus
    return 0; // No bonus
}

/**
 * Get streak color based on days
 */
export function getStreakColor(streak: number): string {
    if (streak >= 30) return 'from-amber-400 to-yellow-600'; // Gold
    if (streak >= 14) return 'from-orange-400 to-red-500';   // Fire
    if (streak >= 7) return 'from-green-400 to-emerald-600'; // Green
    return 'from-gray-400 to-gray-600'; // Gray
}
