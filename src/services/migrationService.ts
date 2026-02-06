
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client } from '../types';
import { logger } from '../utils/logger';

// V3: Force recalculate mobileDigits using phoneNumber (local number without country code)
const MIGRATION_KEY = 'biztrack_migration_v3_phone_local';

export const runDataMigration = async (userId: string) => {
    // Check if migration already ran
    if (localStorage.getItem(MIGRATION_KEY)) {
        return;
    }

    try {
        console.log('Starting client search index migration (v3)...');
        const clientsRef = collection(db, 'users', userId, 'clients');
        const snapshot = await getDocs(clientsRef);

        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach(docSnap => {
            const client = docSnap.data() as Client;
            const updates: Record<string, string> = {};
            let needsUpdate = false;

            // Name Normalization
            if (!client.clientNameLower && client.clientName) {
                updates.clientNameLower = client.clientName.toLowerCase();
                needsUpdate = true;
            }

            // Phone Normalization - ALWAYS recalculate using phoneNumber (local part)
            const phoneSource = client.phoneNumber || client.mobile;
            if (phoneSource) {
                const correctDigits = phoneSource.replace(/\D/g, '');
                // Update if missing OR if current value doesn't match (was using wrong source)
                if (!client.mobileDigits || client.mobileDigits !== correctDigits) {
                    updates.mobileDigits = correctDigits;
                    updates.mobileReverse = correctDigits.split('').reverse().join('');
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                const ref = doc(db, 'users', userId, 'clients', docSnap.id);
                batch.update(ref, updates);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            logger.info(`Migration complete: Updated ${count} clients with normalized search fields.`);
        } else {
            console.log('Migration complete: No clients needed update.');
        }

        // Mark as done
        localStorage.setItem(MIGRATION_KEY, 'true');

    } catch (error) {
        logger.error('Migration failed:', error);
    }
};
