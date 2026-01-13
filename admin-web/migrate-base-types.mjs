/**
 * Migration Script: Add baseType to existing bases
 * 
 * This script adds the baseType field to all existing bases in Firestore.
 * Default: 'teen' (can be manually adjusted later by coordinators)
 * 
 * Run: node migrate-base-types.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDUmVVDKlLGjHlQXPQOyQWlxRQfKqPtWPo",
    authDomain: "baseteen-admin.firebaseapp.com",
    projectId: "baseteen-admin",
    storageBucket: "baseteen-admin.firebasestorage.app",
    messagingSenderId: "1074088682697",
    appId: "1:1074088682697:web:0d6d9f1f0c3e6b8f0c3e6b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateBasesTool() {
    console.log('🚀 Starting migration: Adding baseType to bases...\n');

    try {
        const basesRef = collection(db, 'bases');
        const snapshot = await getDocs(basesRef);

        console.log(`📊 Found ${snapshot.size} bases to migrate\n`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const baseDoc of snapshot.docs) {
            const baseData = baseDoc.data();

            // Skip if baseType already exists
            if (baseData.baseType) {
                console.log(`⊘ Skipped: ${baseData.name} (already has baseType: ${baseData.baseType})`);
                skipped++;
                continue;
            }

            try {
                // Default to 'teen' - can be manually adjusted later
                await updateDoc(doc(db, 'bases', baseDoc.id), {
                    baseType: 'teen'
                });

                console.log(`✓ Updated: ${baseData.name} → baseType: teen`);
                updated++;
            } catch (error) {
                console.error(`✗ Error updating ${baseData.name}:`, error.message);
                errors++;
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   ✓ Updated: ${updated}`);
        console.log(`   ⊘ Skipped: ${skipped}`);
        console.log(`   ✗ Errors: ${errors}`);
        console.log(`   📊 Total: ${snapshot.size}\n`);

        if (errors === 0) {
            console.log('✅ Migration completed successfully!');
        } else {
            console.log('⚠️  Migration completed with errors. Please review.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateBasesTool();
