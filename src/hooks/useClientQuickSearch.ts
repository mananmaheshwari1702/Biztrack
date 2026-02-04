import { useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../context/ToastContext';
import type { Client } from '../types';

/**
 * useClientQuickSearch - Lightweight hook for quick client lookup.
 * 
 * This hook does NOT subscribe to real-time updates.
 * It performs on-demand queries with limited results.
 * Use this for search features like dashboard quick search.
 * 
 * For full client list management, use useClients() instead.
 */
export const useClientQuickSearch = () => {
    const { currentUser } = useAuth();
    const { success, error: showError } = useToast();
    const [results, setResults] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (searchTerm: string): Promise<Client[]> => {
        if (!currentUser || !searchTerm.trim()) {
            setResults([]);
            return [];
        }

        setLoading(true);
        try {
            const clientsRef = collection(db, 'users', currentUser.uid, 'clients');

            // Prefix search on clientName
            const q = query(
                clientsRef,
                where('clientName', '>=', searchTerm),
                where('clientName', '<=', searchTerm + '\uf8ff'),
                orderBy('clientName', 'asc'),
                limit(10) // Quick search returns max 10 results
            );

            const snapshot = await getDocs(q);
            const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

            setResults(clients);
            return clients;
        } catch (err) {
            console.error('Quick search failed:', err);
            setResults([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const updateClient = useCallback(async (client: Client) => {
        if (!currentUser) return;

        try {
            await firebaseService.updateClient(currentUser.uid, client);
            success("Client updated");

            // Update local results if client was in search results
            setResults(prev =>
                prev.map(c => c.id === client.id ? client : c)
            );
        } catch (err) {
            showError("Failed to update client");
            throw err;
        }
    }, [currentUser, success, showError]);

    const clearResults = useCallback(() => {
        setResults([]);
    }, []);

    return {
        results,
        loading,
        search,
        updateClient,
        clearResults
    };
};
