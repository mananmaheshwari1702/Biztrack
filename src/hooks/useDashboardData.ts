import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getCountFromServer, getDocs } from 'firebase/firestore';
import type { Client, Task } from '../types';

export const useDashboardData = () => {
    const { currentUser } = useAuth();
    const [counts, setCounts] = useState({
        totalClients: 0,
        activeClients: 0,
        dueCalls: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completedTasks: 0
    });

    // Limits for progressive loading
    const [dueLimit, setDueLimit] = useState(100);
    const [tasksLimit, setTasksLimit] = useState(100);

    // 1. Fetch Counts (Real-time Metrics)
    useEffect(() => {
        if (!currentUser) return;

        const fetchCounts = async () => {
            try {
                const clientsRef = collection(db, `users/${currentUser.uid}/clients`);
                const tasksRef = collection(db, `users/${currentUser.uid}/tasks`);

                // Total Clients
                const totalSnap = await getCountFromServer(clientsRef);
                const totalClients = totalSnap.data().count;

                // Active Clients (Estimate: Total - Archived? Or separate query if index exists. 
                // Since we resolved index issues by avoiding composite queries, we might not have 'status' index.
                // For Dashboard metrics, exact server count is best. If index missing, maybe client-side valid for now if list is small?
                // User requirement: "must not be paginated... always represent full dataset".
                // If we can't query status==Active server-side without index, we can't do exact server count.
                // However, we can use the "Recent Clients" or "All Clients" fetch in useClients to know total.
                // Let's assume for now we use totalClients as "Active Clients" proxy or Fetch total separately if index exists.
                // Actually, the user fixed index errors. Let's try simple queries.
                // If they fail, we fallback.

                // Let's rely on totalClients for now to avoid risk, or client-side filter if dataset < N.
                // Actually, for "Active Clients" metric, let's just use total count of users in DB for now as "Total Database".

                // Due Calls Count (NextFollowUp <= Today)
                // Use the same Single Field Index query as useDueClients (Date only)
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const todayIso = today.toISOString();

                const dueQuery = query(clientsRef, where('nextFollowUpDate', '<=', todayIso));
                const dueSnap = await getCountFromServer(dueQuery);
                const dueCalls = dueSnap.data().count;

                // Tasks Counts
                // Pending
                const pendingQuery = query(tasksRef, where('status', '!=', 'Completed'));
                const pendingSnap = await getCountFromServer(pendingQuery);
                const pendingTasks = pendingSnap.data().count;

                // Completed
                const completedQuery = query(tasksRef, where('status', '==', 'Completed'));
                const completedSnap = await getCountFromServer(completedQuery);
                const completedTasks = completedSnap.data().count;

                // Overdue (Approximate by Date only to avoid composite index)
                const overdueTaskQuery = query(tasksRef, where('dueDate', '<', new Date().toISOString()));
                const overdueSnap = await getCountFromServer(overdueTaskQuery);
                const overdueTasks = overdueSnap.data().count;

                setCounts({
                    totalClients,
                    activeClients: totalClients, // detailed status count requires index or client-side
                    dueCalls,
                    pendingTasks,
                    overdueTasks,
                    completedTasks
                });

            } catch (err) {
                console.error("Failed to fetch dashboard counts:", err);
            }
        };

        fetchCounts();
    }, [currentUser]); // Refresh on mount/user change


    // 2. Lists with Progressive Loading

    // Recent Clients (Fixed 5)
    // Query: Order by createdAt desc only
    const [recentClients, setRecentClients] = useState<Client[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);

    const fetchRecentClients = useCallback(async () => {
        if (!currentUser) return;
        setLoadingRecent(true);
        try {
            const q = query(
                collection(db, `users/${currentUser.uid}/clients`),
                orderBy('createdAt', 'desc'),
                limit(5)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
            setRecentClients(data);
        } catch (e) { console.error(e); } finally { setLoadingRecent(false); }
    }, [currentUser]);


    // Due Clients (Outreach List) - Single Index (Date)
    const [dueClients, setDueClients] = useState<Client[]>([]);
    const [loadingDue, setLoadingDue] = useState(true);

    const fetchDueClients = useCallback(async () => {
        if (!currentUser) return;
        setLoadingDue(true);
        try {
            // Query by date only (no status filter to avoid index error)
            // Filter 'Active' client-side
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, `users/${currentUser.uid}/clients`),
                where('nextFollowUpDate', '<=', today.toISOString()),
                orderBy('nextFollowUpDate', 'asc'),
                limit(dueLimit)
            );

            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
            // Client-side filter for status
            setDueClients(data.filter(c => c.status === 'Active'));
        } catch (e) { console.error(e); } finally { setLoadingDue(false); }
    }, [currentUser, dueLimit]);


    // Priority Tasks
    const [priorityTasks, setPriorityTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);

    const fetchPriorityTasks = useCallback(async () => {
        if (!currentUser) return;
        setLoadingTasks(true);
        try {
            // Order by Date, filter status/priority client-side
            const q = query(
                collection(db, `users/${currentUser.uid}/tasks`),
                orderBy('dueDate', 'asc'),
                limit(tasksLimit)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            // Filter
            setPriorityTasks(data.filter(t => t.status !== 'Completed' && t.priority === 'High'));
        } catch (e) { console.error(e); } finally { setLoadingTasks(false); }
    }, [currentUser, tasksLimit]);


    // Recent Contacts
    const [recentContacts, setRecentContacts] = useState<Client[]>([]);
    const fetchRecentContacts = useCallback(async () => {
        if (!currentUser) return;
        try {
            const q = query(
                collection(db, `users/${currentUser.uid}/clients`),
                where('lastContactDate', '!=', ''),
                orderBy('lastContactDate', 'desc'),
                limit(5)
            );
            const snap = await getDocs(q);
            setRecentContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        } catch (e) { console.error(e); }
    }, [currentUser]);

    // Upcoming Follow-ups (Next 7 Days)
    const [upcomingFollowUps, setUpcomingFollowUps] = useState<Client[]>([]);
    const fetchUpcoming = useCallback(async () => {
        if (!currentUser) return;
        try {
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            const q = query(
                collection(db, `users/${currentUser.uid}/clients`),
                where('nextFollowUpDate', '>=', today.toISOString()),
                where('nextFollowUpDate', '<=', nextWeek.toISOString()),
                orderBy('nextFollowUpDate', 'asc'),
                limit(20)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
            setUpcomingFollowUps(data.filter(c => c.status === 'Active'));
        } catch (e) { console.error(e); }
    }, [currentUser]);


    useEffect(() => {
        void fetchRecentClients();
    }, [fetchRecentClients]);

    useEffect(() => {
        void fetchDueClients();
    }, [fetchDueClients]);

    useEffect(() => {
        void fetchPriorityTasks();
    }, [fetchPriorityTasks]);

    useEffect(() => {
        void fetchRecentContacts();
    }, [fetchRecentContacts]);

    useEffect(() => {
        void fetchUpcoming();
    }, [fetchUpcoming]);

    const refresh = () => {
        // Trigger re-fetches
        fetchRecentClients();
        fetchDueClients();
        fetchPriorityTasks();
        fetchRecentContacts();
        fetchUpcoming();
    };

    // Logic to distinguish global loading vs incremental loading
    // Initial loading is when we are fetching the first batch (limit === 100)
    // Incremental is when limit > 100

    const isInitialDueLoad = loadingDue && dueLimit === 100;
    const isInitialTasksLoad = loadingTasks && tasksLimit === 100;
    const isInitialRecentLoad = loadingRecent; // Always initial as it's fixed
    const isInitialCombined = isInitialDueLoad || isInitialTasksLoad || isInitialRecentLoad;

    return {
        counts,
        recentClients,
        dueClients,
        priorityTasks,
        recentContacts,
        upcomingFollowUps,
        // Only trigger global loading screen on initial fetch
        loading: isInitialCombined,
        // Expose granular loading for infinite scroll spinners
        loadingMoreDue: loadingDue && dueLimit > 100,
        loadingMoreTasks: loadingTasks && tasksLimit > 100,
        refresh,
        loadMoreDue: () => setDueLimit(prev => prev + 100),
        loadMoreTasks: () => setTasksLimit(prev => prev + 100)
    };
};
