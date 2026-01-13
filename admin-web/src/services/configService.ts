import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Check if achievements system is enabled globally
 */
export async function areAchievementsEnabled(): Promise<boolean> {
    try {
        const configDoc = await getDoc(doc(db, 'settings', 'gamification'));
        if (configDoc.exists()) {
            const data = configDoc.data();
            return data.achievementsEnabled !== false; // Default to true if not set
        }
        return true; // Default to enabled
    } catch (error) {
        console.error('Error checking achievements config:', error);
        return true; // Default to enabled on error
    }
}

/**
 * Check if achievements menu should be visible to bases (non-master users)
 */
export async function areAchievementsVisibleToBases(): Promise<boolean> {
    try {
        const configDoc = await getDoc(doc(db, 'settings', 'gamification'));
        if (configDoc.exists()) {
            const data = configDoc.data();
            return data.achievementsVisibleToBases !== false; // Default to true if not set
        }
        return true; // Default to visible
    } catch (error) {
        console.error('Error checking achievements visibility config:', error);
        return true; // Default to visible on error
    }
}
