
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client } from '../types';
import { logger } from '../utils/logger';

const MIGRATION_KEY = 'biztrack_migration_v1_clientNameLower';

export const runDataMigration = async (userId: string) => {
    // Check if migration already ran
    if (localStorage.getItem(MIGRATION_KEY)) {
        return;
    }

    try {
        console.log('Starting client name normalization migration...');
        const clientsRef = collection(db, 'users', userId, 'clients');
        const snapshot = await getDocs(clientsRef);

        const batch = writeBatch(db);
        let count = 0;
        let batchCount = 0;

        snapshot.docs.forEach(docSnap => {
            const client = docSnap.data() as Client;

            // Check if needs update (clientNameLower OR mobile fields)
            let needsUpdate = false;
            const updates: any = {};

            // Name Normalization
            if (!client.clientNameLower && client.clientName) {
                updates.clientNameLower = client.clientName.toLowerCase();
                needsUpdate = true;
            }

            // Phone Normalization
            if ((!client.mobileDigits || !client.mobileReverse) && client.mobile) {
                const digits = client.mobile.replace(/\D/g, '');
                updates.mobileDigits = digits;
                updates.mobileReverse = digits.split('').reverse().join('');
                needsUpdate = true;
            }

            if (needsUpdate) {
                const ref = doc(db, 'users', userId, 'clients', docSnap.id);
                batch.update(ref, updates);
                count++;
                batchCount++;
            }
        });

        if (count > 0) {
            await batch.commit();
            logger.info(`Migration complete: Updated ${count} clients with normalized search fields.`);
        } else {
            console.log('Migration complete: No clients needed update.');
        }

        // Mark as done
        localStorage.setItem('biztrack_migration_v2_search_indexes', 'true');

    } catch (error) {
        logger.error('Migration failed:', error);
    }
};
