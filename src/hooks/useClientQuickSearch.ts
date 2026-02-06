import { useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
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

            // Parallel Queries to support Name OR Phone
            const searchLower = searchTerm.toLowerCase();
            const searchDigits = searchTerm.replace(/\D/g, ''); // Extract digits
            const searchReverse = searchDigits.split('').reverse().join('');

            const queries = [];

            // 1. Name Query (Prefix)
            const nameQuery = query(
                clientsRef,
                where('clientNameLower', '>=', searchLower),
                where('clientNameLower', '<=', searchLower + '\uf8ff'),
                orderBy('clientNameLower', 'asc'),
                limit(5)
            );
            queries.push(getDocs(nameQuery));

            // 2. Phone Query (Prefix & Suffix/Reverse) - Only if we have digits
            if (searchDigits.length > 2) { // Minimum 3 digits to search phone
                // Prefix Search (e.g. "9876")
                const phonePrefixQuery = query(
                    clientsRef,
                    where('mobileDigits', '>=', searchDigits),
                    where('mobileDigits', '<=', searchDigits + '\uf8ff'),
                    limit(5)
                );
                queries.push(getDocs(phonePrefixQuery));

                // Suffix Search (e.g. "4321" -> matches reverse "1234...")
                const phoneSuffixQuery = query(
                    clientsRef,
                    where('mobileReverse', '>=', searchReverse),
                    where('mobileReverse', '<=', searchReverse + '\uf8ff'),
                    limit(5)
                );
                queries.push(getDocs(phoneSuffixQuery));
            }

            // Execute all queries
            const snapshots = await Promise.all(queries);

            // Merge & Deduplicate
            const clientMap = new Map<string, Client>();

            snapshots.forEach(snap => {
                snap.docs.forEach(doc => {
                    if (!clientMap.has(doc.id)) {
                        clientMap.set(doc.id, { id: doc.id, ...doc.data() } as Client);
                    }
                });
            });

            // Convert to array and take top 10
            const results = Array.from(clientMap.values()).slice(0, 10);

            setResults(results); // Changed from setSearchResults to setResults
            return results; // Added return statement
        } catch (err) {
            console.error('Quick search error:', err);
            showError('Search failed'); // Changed from setError to showError
            setResults([]); // Added to clear results on error
            return []; // Added return statement
        } finally {
            setLoading(false);
        }
    }, [currentUser, showError]); // Added showError to dependency array

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
