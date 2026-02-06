import {
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
    type UpdateData
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, Client, OrgNode } from '../types';
import { logger } from '../utils/logger';

export const firebaseService = {
    // --- Tasks ---
    async addTask(userId: string, task: Task): Promise<void> {
        try {
            const taskRef = doc(db, 'users', userId, 'tasks', task.id);
            await setDoc(taskRef, task);
        } catch (error) {
            logger.error('Error adding task:', error);
            throw error;
        }
    },

    async updateTask(userId: string, task: Task): Promise<void> {
        try {
            const taskRef = doc(db, 'users', userId, 'tasks', task.id);
            await setDoc(taskRef, task, { merge: true });
        } catch (error) {
            logger.error('Error updating task:', error);
            throw error;
        }
    },

    async deleteTask(userId: string, taskId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'users', userId, 'tasks', taskId));
        } catch (error) {
            logger.error('Error deleting task:', error);
            throw error;
        }
    },

    // --- Clients ---
    async addClient(userId: string, client: Client): Promise<void> {
        try {
            const clientRef = doc(db, 'users', userId, 'clients', client.id);

            // Prepare Search Fields
            const clientNameLower = client.clientName.toLowerCase();
            const mobileDigits = client.mobile ? client.mobile.replace(/\D/g, '') : '';
            const mobileReverse = mobileDigits.split('').reverse().join('');

            const clientWithSearch = {
                ...client,
                clientNameLower,
                mobileDigits,
                mobileReverse
            };
            await setDoc(clientRef, clientWithSearch);
        } catch (error) {
            logger.error('Error adding client:', error);
            throw error;
        }
    },

    async updateClient(userId: string, client: Client): Promise<void> {
        try {
            const clientRef = doc(db, 'users', userId, 'clients', client.id);
            const updates = { ...client };

            // Update Search Fields
            if (client.clientName) {
                updates.clientNameLower = client.clientName.toLowerCase();
            }
            if (client.mobile) {
                const digits = client.mobile.replace(/\D/g, '');
                updates.mobileDigits = digits;
                updates.mobileReverse = digits.split('').reverse().join('');
            }

            await setDoc(clientRef, updates, { merge: true });
        } catch (error) {
            logger.error('Error updating client:', error);
            throw error;
        }
    },

    async deleteClient(userId: string, clientId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'users', userId, 'clients', clientId));
        } catch (error) {
            logger.error('Error deleting client:', error);
            throw error;
        }
    },

    async bulkDeleteClients(userId: string, clientIds: string[]): Promise<void> {
        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < clientIds.length; i += CHUNK_SIZE) {
            chunks.push(clientIds.slice(i, i + CHUNK_SIZE));
        }

        try {
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(id => {
                    const ref = doc(db, 'users', userId, 'clients', id);
                    batch.delete(ref);
                });
                await batch.commit();
            }
        } catch (error) {
            logger.error('Error executing bulk delete clients:', error);
            throw error;
        }
    },

    async bulkAddClients(userId: string, clients: Client[]): Promise<void> {
        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
            chunks.push(clients.slice(i, i + CHUNK_SIZE));
        }

        try {
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(client => {
                    const clientId = client.id || crypto.randomUUID();
                    const ref = doc(db, 'users', userId, 'clients', clientId);

                    const clientNameLower = client.clientName ? client.clientName.toLowerCase() : '';
                    const mobileDigits = client.mobile ? client.mobile.replace(/\D/g, '') : '';
                    const mobileReverse = mobileDigits.split('').reverse().join('');

                    const clientWithSearch = {
                        ...client,
                        id: clientId,
                        clientNameLower,
                        mobileDigits,
                        mobileReverse
                    };
                    batch.set(ref, clientWithSearch, { merge: true });
                });
                await batch.commit();
            }
        } catch (error) {
            logger.error('Error executing bulk add clients:', error);
            throw error;
        }
    },

    async bulkUpdateClients(userId: string, ids: string[], updates: Partial<Client>): Promise<void> {
        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            chunks.push(ids.slice(i, i + CHUNK_SIZE));
        }

        try {
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(id => {
                    const ref = doc(db, 'users', userId, 'clients', id);
                    batch.update(ref, updates as UpdateData<Client>);
                });
                await batch.commit();
            }
        } catch (error) {
            logger.error("Error executing bulk update clients:", error);
            throw error;
        }
    },

    // --- Org Nodes ---
    // Moving OrgNode logic here too for consistency, even if DataContext still consumes the tree
    async addOrgNode(userId: string, node: OrgNode): Promise<void> {
        try {
            await setDoc(doc(db, 'users', userId, 'orgNodes', node.id), node);
        } catch (error) {
            logger.error('Error adding org node:', error);
            throw error;
        }
    },

    async updateOrgNode(userId: string, node: OrgNode): Promise<void> {
        try {
            // Strip children if present to avoid recursion issues
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { children, ...flatNode } = node;
            await setDoc(doc(db, 'users', userId, 'orgNodes', node.id), flatNode, { merge: true });
        } catch (error) {
            logger.error('Error updating org node:', error);
            throw error;
        }
    },

    async deleteOrgNode(userId: string, nodeId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'users', userId, 'orgNodes', nodeId));
        } catch (error) {
            logger.error('Error deleting org node:', error);
            throw error;
        }
    }
};
