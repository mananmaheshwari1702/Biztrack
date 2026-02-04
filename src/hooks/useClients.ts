import { useCallback, useMemo, useState, useEffect } from 'react';
import { orderBy, where, collection, query, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFirestoreQuery } from './useFirestoreQuery';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import type { Client } from '../types';
import { queryCache } from '../utils/cache';
import { useToast } from '../context/ToastContext';

export const useClients = (
    filterType: 'All' | 'Prospect' | 'User' | 'Associate' | 'Supervisor' = 'All',
    searchQuery: string = '',
    sortBy: 'clientName' | 'nextFollowUpDate' = 'nextFollowUpDate',
    page: number = 1,
    pageSize: number = 50
) => {
    const { currentUser } = useAuth();
    const { success, error: showError } = useToast();

    // Construct Query Constraints
    const constraints: import('firebase/firestore').QueryConstraint[] = [];

    // Filter Type
    if (filterType !== 'All') {
        constraints.push(where('clientType', '==', filterType));
    }

    // Search (Prefix)
    if (searchQuery) {
        constraints.push(where('clientName', '>=', searchQuery));
        constraints.push(where('clientName', '<=', searchQuery + '\uf8ff'));
    } else {
        // Sort
        if (sortBy === 'clientName') {
            constraints.push(orderBy('clientName', 'asc'));
        } else {
            constraints.push(orderBy('nextFollowUpDate', 'asc'));
        }
    }

    // Fetch enough data for current page (page * pageSize)
    // This allows client-side pagination within fetched data
    const fetchLimit = page * pageSize;

    const { data: allFetchedClients, loading, error, hasMore, refresh } = useFirestoreQuery<Client>(
        'clients',
        constraints,
        fetchLimit,
        [filterType, searchQuery, sortBy, page] // Include page in dependencies to re-fetch on page change
    );

    // Slice data for current page (client-side pagination within fetched data)
    const clients = useMemo(() => {
        const startIndex = (page - 1) * pageSize;
        return allFetchedClients.slice(startIndex, startIndex + pageSize);
    }, [allFetchedClients, page, pageSize]);

    // Calculate total pages based on fetched data
    const [totalCount, setTotalCount] = useState(0);

    // Effect: Fetch total count when filters change (Debounced optional, but query is cheap)
    useEffect(() => {
        if (!currentUser) return;

        const fetchCount = async () => {
            try {
                const collRef = collection(db, `users/${currentUser.uid}/clients`);
                const q = query(collRef, ...constraints); // Use same constraints as main query (minus limit/pagination)
                // Filter out limit/startAfter if they were in constraints (they are not - we build constraints above without them)

                // Note: The constraints variable above contains orderBy which is fine for count, 
                // but if we had limits we would need to remove them. 
                // Fortunately 'constraints' array defined above only has 'where' and 'orderBy'.

                const snapshot = await getCountFromServer(q);
                setTotalCount(snapshot.data().count);
            } catch (err) {
                console.error("Failed to fetch client count:", err);
            }
        };

        fetchCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, filterType, searchQuery]); // Re-run when filters change

    const addClient = useCallback(async (client: Client) => {
        if (!currentUser) return;

        try {
            await firebaseService.addClient(currentUser.uid, client);
            success("Client added successfully");
            refresh();
        } catch (err) {
            showError("Failed to add client");
            throw err;
        }
    }, [currentUser, refresh, success, showError]);

    const updateClient = useCallback(async (client: Client) => {
        if (!currentUser) return;

        // Optimistic Update
        const key = queryCache.generateKey('clients', currentUser.uid, { constraints: [filterType, searchQuery, sortBy], page: 'first' });
        const cached = await queryCache.get(key);
        const previousData = cached ? cached.data : [];

        // Update Cache Immediately
        if (cached) {
            const updatedData = cached.data.map((c: Client) => c.id === client.id ? client : c);
            await queryCache.set(key, updatedData, currentUser.uid);
            refresh(); // Trigger re-render from cache
        }

        try {
            await firebaseService.updateClient(currentUser.uid, client);
            success("Client updated");
        } catch (err) {
            // Rollback
            if (cached) {
                await queryCache.set(key, previousData, currentUser.uid);
                refresh();
            }
            showError("Failed to update client");
            throw err;
        }
    }, [currentUser, refresh, success, showError, filterType, searchQuery, sortBy]);

    const deleteClient = useCallback(async (clientId: string) => {
        if (!currentUser) return;

        // Optimistic Update
        const key = queryCache.generateKey('clients', currentUser.uid, { constraints: [filterType, searchQuery, sortBy], page: 'first' });
        const cached = await queryCache.get(key);
        const previousData = cached ? cached.data : [];

        if (cached) {
            const updatedData = cached.data.filter((c: Client) => c.id !== clientId);
            await queryCache.set(key, updatedData, currentUser.uid);
            refresh();
        }

        try {
            await firebaseService.deleteClient(currentUser.uid, clientId);
            success("Client deleted");
        } catch (err) {
            // Rollback
            if (cached) {
                await queryCache.set(key, previousData, currentUser.uid);
                refresh();
            }
            showError("Failed to delete client");
            throw err;
        }
    }, [currentUser, refresh, success, showError, filterType, searchQuery, sortBy]);

    const bulkDeleteClients = useCallback(async (ids: string[]) => {
        if (!currentUser) return;
        try {
            await firebaseService.bulkDeleteClients(currentUser.uid, ids);
            success("Clients deleted");
            refresh();
        } catch (err) {
            showError("Failed to bulk delete");
            throw err;
        }
    }, [currentUser, refresh, success, showError]);

    const bulkUpdateClients = useCallback(async (ids: string[], updates: Partial<Client>) => {
        if (!currentUser) return;
        try {
            await firebaseService.bulkUpdateClients(currentUser.uid, ids, updates);
            success("Clients updated");
            refresh();
        } catch (err) {
            showError("Failed to bulk update");
            throw err;
        }
    }, [currentUser, refresh, success, showError]);

    const bulkAddClients = useCallback(async (newClients: Client[]) => {
        if (!currentUser) return;
        try {
            await firebaseService.bulkAddClients(currentUser.uid, newClients);
            success("Clients imported");
            refresh();
        } catch (err) {
            showError("Failed to import clients");
            throw err;
        }
    }, [currentUser, refresh, success, showError]);

    return {
        clients,
        allClients: allFetchedClients, // Full fetched data for filtering
        totalFetched: totalCount, // Mapping totalCount to totalFetched for backward compatibility or updating UI to use totalCount
        loading,
        error,
        hasMore,
        refresh,
        addClient,
        updateClient,
        deleteClient,
        bulkDeleteClients,
        bulkUpdateClients,
        bulkAddClients
    };
};

export const useDueClients = (page: number = 1, pageSize: number = 20) => {
    const { currentUser } = useAuth();
    // Specialized hook for "Due Today & Overdue" widget
    // Query: status == 'Active' && nextFollowUpDate <= endOfToday
    // Sort client-side to avoid composite index requirement

    // Use end of today in UTC for comparison
    // This ensures we catch all clients with dates <= today regardless of timezone
    const now = new Date();
    const endOfTodayUtc = new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23, 59, 59, 999
    )).toISOString();

    // IMPORTANT: Only use single field query to avoid composite index requirement
    // Query only by date, filter status client-side
    const constraints: import('firebase/firestore').QueryConstraint[] = [
        where('nextFollowUpDate', '<=', endOfTodayUtc)
    ];

    // Fetch Total Count (server-side, approximation based on Date only to avoid index error)
    // Note: This count assumes all due items are relevant. Since we can't filter Status=Active server-side
    // without an index, this is the best approximation for "Total Candidates".
    // Alternatively, for small datasets, fetching all IDs might be better, but count is cheaper.
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        if (!currentUser) return;
        const fetchCount = async () => {
            try {
                const collRef = collection(db, `users/${currentUser.uid}/clients`);
                const q = query(collRef, ...constraints);
                const snapshot = await getCountFromServer(q);
                setTotalCount(snapshot.data().count);
            } catch (err) {
                console.error("Failed to fetch due count:", err);
            }
        };
        fetchCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, endOfTodayUtc]); // Re-run daily

    // Fetch Data
    const fetchLimit = page * pageSize; // Fetch accumulated pages

    const result = useFirestoreQuery<Client>(
        'clients',
        constraints,
        fetchLimit, // Dynamic limit based on page
        ['due-clients', endOfTodayUtc.substring(0, 10), page] // Include page in key
    );

    // Filter for Active status AND sort client-side by nextFollowUpDate
    const filteredAndSortedData = useMemo(() => {
        return result.data
            .filter(client => client.status === 'Active')
            .sort((a, b) => {
                const dateA = new Date(a.nextFollowUpDate || 0).getTime();
                const dateB = new Date(b.nextFollowUpDate || 0).getTime();
                return dateA - dateB;
            });
    }, [result.data]);

    // Slice for current page (client-side pagination)
    const paginatedData = useMemo(() => {
        // Since we fetch accumulated (0 to page*size), we just take the last pageSize items
        // Wait, regular pagination should be slice((p-1)*size, p*size)
        // Check if fetched data covers the range.
        const startIndex = (page - 1) * pageSize;
        return filteredAndSortedData.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedData, page, pageSize]);

    return {
        ...result,
        data: paginatedData, // Return only current page
        allDueClients: filteredAndSortedData, // Return all fetched for reference if needed
        totalFetched: totalCount // Total matching Date query (approx)
    };
};
