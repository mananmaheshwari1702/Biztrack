import { useFirestoreQuery } from './useFirestoreQuery';
import { where, orderBy } from 'firebase/firestore';
import type { Task, Client } from '../types';

export const useCalendarData = (currentDate: Date) => {
    // Calculate start and end of the current month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Start of Month: YYYY-MM-01T00:00:00
    const startOfMonth = new Date(year, month, 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startIso = startOfMonth.toISOString();

    // End of Month: Last day at 23:59:59
    const endOfMonth = new Date(year, month + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const endIso = endOfMonth.toISOString();

    // Tasks Query
    // Refactored to avoid composite index (Status != Completed + Date Range)
    // Query: Date Range Only (Single Field Index)
    const {
        data: fetchedTasks,
        loading: loadingTasks,
        refresh: refreshTasks
    } = useFirestoreQuery<Task>(
        'tasks',
        [
            where('dueDate', '>=', startIso),
            where('dueDate', '<=', endIso),
            orderBy('dueDate', 'asc')
        ],
        1000, // Fetch all for month
        ['calendar-tasks', year, month]
    );

    const tasks = fetchedTasks.filter(t => t.status !== 'Completed');

    // Clients/Calls Query
    // Refactored to avoid composite index (Status == Active + Date Range)
    // Query: Date Range Only (Single Field Index)
    const {
        data: fetchedClients,
        loading: loadingClients,
        refresh: refreshClients
    } = useFirestoreQuery<Client>(
        'clients',
        [
            where('nextFollowUpDate', '>=', startIso),
            where('nextFollowUpDate', '<=', endIso),
            orderBy('nextFollowUpDate', 'asc')
        ],
        1000,
        ['calendar-clients', year, month]
    );

    const clients = fetchedClients.filter(c => c.status === 'Active');

    const refresh = async () => {
        await Promise.all([refreshTasks(), refreshClients()]);
    };

    return {
        tasks,
        clients,
        loading: loadingTasks || loadingClients,
        refresh
    };
};
