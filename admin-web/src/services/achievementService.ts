import { db } from './firebase';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    Timestamp
} from 'firebase/firestore';
import { BadgeType } from '@/components/BadgeIcon';

export interface Achievement {
    id?: string;
    baseId: string; // MUDANÇA: baseId ao invés de userId
    badgeType: BadgeType;
    unlockedAt: Date;
    notified: boolean;
}

export interface BaseStats {
    totalTasks: number;
    totalXp: number;
    currentStreak: number;
}

/**
 * Check if base has unlocked a specific badge
 */
export async function hasAchievement(baseId: string, badgeType: BadgeType): Promise<boolean> {
    const q = query(
        collection(db, 'achievements'),
        where('baseId', '==', baseId),
        where('badgeType', '==', badgeType)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

/**
 * Get all achievements for a base
 */
export async function getBaseAchievements(baseId: string): Promise<Achievement[]> {
    const q = query(
        collection(db, 'achievements'),
        where('baseId', '==', baseId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        unlockedAt: doc.data().unlockedAt?.toDate()
    })) as Achievement[];
}

/**
 * Unlock a new achievement for a base
 */
export async function unlockAchievement(baseId: string, badgeType: BadgeType): Promise<void> {
    // Check if already unlocked
    const alreadyHas = await hasAchievement(baseId, badgeType);
    if (alreadyHas) return;

    // Create achievement
    await addDoc(collection(db, 'achievements'), {
        baseId,
        badgeType,
        unlockedAt: Timestamp.now(),
        notified: false
    });
}

/**
 * Get base statistics from Firestore
 */
export async function getBaseStats(baseId: string): Promise<BaseStats> {
    const baseDoc = await getDoc(doc(db, 'bases', baseId));
    const baseData = baseDoc.data();

    return {
        totalTasks: baseData?.completedTasks || 0,
        totalXp: baseData?.totalXp || 0,
        currentStreak: baseData?.currentStreak || 0
    };
}

/**
 * Check and unlock all eligible achievements for a base
 */
export async function checkAchievements(baseId: string): Promise<BadgeType[]> {
    // Check if achievements are globally enabled
    const { areAchievementsEnabled } = await import('@/services/configService');
    const enabled = await areAchievementsEnabled();
    if (!enabled) {
        return []; // Achievements disabled, return empty array
    }

    const stats = await getBaseStats(baseId);
    const newAchievements: BadgeType[] = [];

    // Check task-based achievements
    if (stats.totalTasks >= 1 && !(await hasAchievement(baseId, 'first_task'))) {
        await unlockAchievement(baseId, 'first_task');
        newAchievements.push('first_task');
    }

    if (stats.totalTasks >= 10 && !(await hasAchievement(baseId, 'tasks_10'))) {
        await unlockAchievement(baseId, 'tasks_10');
        newAchievements.push('tasks_10');
    }

    if (stats.totalTasks >= 50 && !(await hasAchievement(baseId, 'tasks_50'))) {
        await unlockAchievement(baseId, 'tasks_50');
        newAchievements.push('tasks_50');
    }

    // Check XP-based achievements
    if (stats.totalXp >= 1000 && !(await hasAchievement(baseId, 'xp_1000'))) {
        await unlockAchievement(baseId, 'xp_1000');
        newAchievements.push('xp_1000');
    }

    if (stats.totalXp >= 5000 && !(await hasAchievement(baseId, 'xp_5000'))) {
        await unlockAchievement(baseId, 'xp_5000');
        newAchievements.push('xp_5000');
    }

    // Check streak-based achievements
    if (stats.currentStreak >= 7 && !(await hasAchievement(baseId, 'streak_7'))) {
        await unlockAchievement(baseId, 'streak_7');
        newAchievements.push('streak_7');
    }

    if (stats.currentStreak >= 30 && !(await hasAchievement(baseId, 'streak_30'))) {
        await unlockAchievement(baseId, 'streak_30');
        newAchievements.push('streak_30');
    }

    return newAchievements;
}

/**
 * Get achievement progress for a base
 */
export async function getAchievementProgress(baseId: string): Promise<Record<BadgeType, { unlocked: boolean, progress: number, target: number }>> {
    const stats = await getBaseStats(baseId);
    const achievements = await getBaseAchievements(baseId);
    const unlockedBadges = new Set(achievements.map(a => a.badgeType));

    return {
        first_task: {
            unlocked: unlockedBadges.has('first_task'),
            progress: Math.min(stats.totalTasks, 1),
            target: 1
        },
        tasks_10: {
            unlocked: unlockedBadges.has('tasks_10'),
            progress: Math.min(stats.totalTasks, 10),
            target: 10
        },
        tasks_50: {
            unlocked: unlockedBadges.has('tasks_50'),
            progress: Math.min(stats.totalTasks, 50),
            target: 50
        },
        xp_1000: {
            unlocked: unlockedBadges.has('xp_1000'),
            progress: Math.min(stats.totalXp, 1000),
            target: 1000
        },
        xp_5000: {
            unlocked: unlockedBadges.has('xp_5000'),
            progress: Math.min(stats.totalXp, 5000),
            target: 5000
        },
        streak_7: {
            unlocked: unlockedBadges.has('streak_7'),
            progress: Math.min(stats.currentStreak, 7),
            target: 7
        },
        streak_30: {
            unlocked: unlockedBadges.has('streak_30'),
            progress: Math.min(stats.currentStreak, 30),
            target: 30
        },
        base_month: {
            unlocked: unlockedBadges.has('base_month'),
            progress: 0,
            target: 1
        }
    };
}
