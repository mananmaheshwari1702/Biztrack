import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { logger } from '../utils/logger';
import { OrgLevel } from '../types';
import type { Task, Client, OrgNode, User } from '../types';
import { db } from '../lib/firebase';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    type FirestoreError
} from 'firebase/firestore';
import { buildOrgTree } from '../utils/treeUtils';

/**
 * DataContextType - Global state for user profile and organization data.
 * 
 * **MIGRATION NOTE (2026-02):**
 * `tasks` and `clients` are DEPRECATED and will throw errors if accessed.
 * Use the following hooks instead:
 * - For clients: useClients() from '../hooks/useClients'
 * - For tasks: useTasks() from '../hooks/useTasks'
 * - For dashboard: useDashboardData() from '../hooks/useDashboardData'
 * - For calendar: useCalendarData() from '../hooks/useCalendarData'
 */
interface DataContextType {
    /**
     * @deprecated Use useTasks() hook instead. This will throw an error if accessed.
     */
    tasks: Task[];
    /**
     * @deprecated Use useClients() hook instead. This will throw an error if accessed.
     */
    clients: Client[];
    orgTree: OrgNode | null;
    userProfile: User;
    loading: boolean;
    /** @deprecated Use useTasks().addTask() instead */
    addTask: (task: Task) => Promise<void>;
    /** @deprecated Use useTasks().updateTask() instead */
    updateTask: (task: Task) => Promise<void>;
    /** @deprecated Use useTasks().deleteTask() instead */
    deleteTask: (id: string) => Promise<void>;
    /** @deprecated Use useClients().addClient() instead */
    addClient: (client: Client) => Promise<void>;
    /** @deprecated Use useClients().updateClient() instead */
    updateClient: (client: Client) => Promise<void>;
    /** @deprecated Use useClients().deleteClient() instead */
    deleteClient: (id: string) => Promise<void>;
    /** @deprecated Use useClients().bulkDeleteClients() instead */
    bulkDeleteClients: (ids: string[]) => Promise<void>;
    /** @deprecated Use useClients().bulkUpdateClients() instead */
    bulkUpdateClients: (ids: string[], updates: Partial<Client>) => Promise<void>;
    /** @deprecated Use useClients().bulkAddClients() instead */
    bulkAddClients: (clients: Client[]) => Promise<void>;
    updateUserProfile: (user: User, skipSync?: boolean) => Promise<void>;
    // Org Node methods remain active
    addOrgNode: (node: OrgNode) => Promise<void>;
    updateOrgNode: (node: OrgNode, skipSync?: boolean) => Promise<void>;
    deleteOrgNode: (nodeId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const defaultUser: User = {
    name: '',
    email: '',

    level: OrgLevel.Supervisor,
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const toast = useToast();
    const toastRef = useRef(toast);
    const [loading, setLoading] = useState(true);

    // Keep toast ref current for use in subscription error callbacks
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    // Data States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
    const [userProfile, setUserProfile] = useState<User>(defaultUser);

    // Derived State
    const orgTree = useMemo(() => buildOrgTree(orgNodes), [orgNodes]);

    // Subscriptions
    useEffect(() => {
        if (!currentUser) {
            setTasks([]);
            setClients([]);
            setOrgNodes([]);
            setUserProfile(defaultUser);
            setLoading(false);
            return;
        }

        setLoading(true);
        const uid = currentUser.uid;

        // Helper for error callbacks
        const handleSubscriptionError = (collectionName: string) => (error: FirestoreError) => {
            logger.error(`${collectionName} subscription error:`, {
                collection: collectionName,
                userId: uid,
                code: error.code,
                message: error.message
            });
            toastRef.current.error('Sync Error', `Unable to sync ${collectionName.toLowerCase()}. Please refresh the page.`);
        };

        // References
        const userDocRef = doc(db, 'users', uid);
        // NOTE: clientsRef and tasksRef removed - subscriptions now handled by hooks
        const orgNodesRef = collection(db, 'users', uid, 'orgNodes');

        // 1. User Profile Listener
        const unsubProfile = onSnapshot(
            userDocRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    setUserProfile(docSnap.data() as User);
                } else {
                    // Profile doesn't exist (e.g. deleted or not yet created)
                    // Do NOT auto-create here as it interferes with account deletion
                    setUserProfile(defaultUser);
                }
            },
            handleSubscriptionError('Profile')
        );

        // 4. Org Nodes Listener  
        const unsubOrg = onSnapshot(
            query(orgNodesRef),
            (snapshot) => {
                const loadedNodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrgNode));
                setOrgNodes(loadedNodes);
                setLoading(false);
            },
            (error: FirestoreError) => {
                handleSubscriptionError('Organization')(error);
                setLoading(false); // Prevent infinite loading state on error
            }
        );

        // NOTE: Clients and Tasks listeners removed (2026-02 migration)
        // These are now handled by:
        // - useClients() hook for client data
        // - useTasks() hook for task data
        // - useCalendarData() hook for calendar views
        // - useDashboardData() hook for dashboard widgets

        return () => {
            unsubProfile();
            // unsubClients removed - handled by useClients hook
            // unsubTasks removed - handled by useTasks hook
            unsubOrg();
        };
    }, [currentUser]);

    // ========================================
    // DEPRECATED CRUD METHODS (2026-02 Migration)
    // ========================================
    // These methods are replaced by hook-based data access.
    // They throw errors to catch any remaining usages during migration.
    // See: useClients(), useTasks() hooks

    // Tasks - DEPRECATED
    const addTask = useCallback(async (_task: Task): Promise<void> => {
        throw new Error('DEPRECATED: useData().addTask() is no longer supported. Use useTasks().addTask() instead.');
    }, []);

    const updateTask = useCallback(async (_task: Task): Promise<void> => {
        throw new Error('DEPRECATED: useData().updateTask() is no longer supported. Use useTasks().updateTask() instead.');
    }, []);

    const deleteTask = useCallback(async (_id: string): Promise<void> => {
        throw new Error('DEPRECATED: useData().deleteTask() is no longer supported. Use useTasks().deleteTask() instead.');
    }, []);

    // Clients - DEPRECATED
    const addClient = useCallback(async (_client: Client): Promise<void> => {
        throw new Error('DEPRECATED: useData().addClient() is no longer supported. Use useClients().addClient() instead.');
    }, []);

    const updateClient = useCallback(async (_client: Client): Promise<void> => {
        throw new Error('DEPRECATED: useData().updateClient() is no longer supported. Use useClients().updateClient() instead.');
    }, []);

    const deleteClient = useCallback(async (_id: string): Promise<void> => {
        throw new Error('DEPRECATED: useData().deleteClient() is no longer supported. Use useClients().deleteClient() instead.');
    }, []);

    const bulkDeleteClients = useCallback(async (_ids: string[]): Promise<void> => {
        throw new Error('DEPRECATED: useData().bulkDeleteClients() is no longer supported. Use useClients().bulkDeleteClients() instead.');
    }, []);

    const bulkAddClients = useCallback(async (_newClients: Client[]): Promise<void> => {
        throw new Error('DEPRECATED: useData().bulkAddClients() is no longer supported. Use useClients().bulkAddClients() instead.');
    }, []);

    const bulkUpdateClients = useCallback(async (_ids: string[], _updates: Partial<Client>): Promise<void> => {
        throw new Error('DEPRECATED: useData().bulkUpdateClients() is no longer supported. Use useClients().bulkUpdateClients() instead.');
    }, []);

    // Profile
    const updateUserProfile = useCallback(async (user: User, skipSync: boolean = false) => {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        try {
            await setDoc(doc(db, 'users', currentUser.uid), user, { merge: true });

            // Also update the root node of the org tree if it exists and matches
            if (!skipSync) {
                const rootNode = orgNodes.find(n => n.id === 'root' || n.level === OrgLevel.Root);
                if (rootNode && (rootNode.name !== user.name || rootNode.level !== user.level)) {
                    // Strip children before saving
                    const { children, ...flatNode } = rootNode;
                    const updatedFlatNode = { ...flatNode, name: user.name, level: user.level };
                    await setDoc(doc(db, 'users', currentUser.uid, 'orgNodes', rootNode.id), updatedFlatNode, { merge: true });
                }
            }
        } catch (error) {
            logger.error("Error updating user profile:", error);
            throw error;
        }
    }, [currentUser, orgNodes]);

    // Org Tree - granular updates
    const addOrgNode = useCallback(async (node: OrgNode) => {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        try {
            await setDoc(doc(db, 'users', currentUser.uid, 'orgNodes', node.id), node);
        } catch (error) {
            logger.error("Error adding org node:", error);
            throw error;
        }
    }, [currentUser]);

    const updateOrgNode = useCallback(async (node: OrgNode, skipSync: boolean = false) => {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        try {
            // Strip children before saving to flat store to avoid redundancy/recursion issues if the object has them populated
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { children, ...flatNode } = node;
            await setDoc(doc(db, 'users', currentUser.uid, 'orgNodes', node.id), flatNode, { merge: true });

            // Sync to User Profile if Root Node (direct setDoc to avoid circular dependency)
            if (!skipSync && node.id === 'root') {
                const hasChanged = node.name !== userProfile.name || node.level !== userProfile.level;
                if (hasChanged) {
                    const updatedProfile: User = {
                        ...userProfile,
                        name: node.name,
                        level: node.level
                    };
                    await setDoc(doc(db, 'users', currentUser.uid), updatedProfile, { merge: true });
                }
            }
        } catch (error) {
            logger.error("Error updating org node:", error);
            throw error;
        }
    }, [currentUser, userProfile]);

    const deleteOrgNode = useCallback(async (nodeId: string) => {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'orgNodes', nodeId));
        } catch (error) {
            logger.error("Error deleting org node:", error);
            throw error;
        }
    }, [currentUser]);


    return (
        <DataContext.Provider
            value={{
                tasks,
                clients,
                orgTree,
                userProfile,
                loading,
                addTask,
                updateTask,
                deleteTask,
                addClient,
                updateClient,
                deleteClient,
                bulkDeleteClients,
                bulkUpdateClients,
                bulkAddClients,
                updateUserProfile,
                addOrgNode,
                updateOrgNode,
                deleteOrgNode
            }}
        >
            {loading ? <LoadingScreen /> : children}
        </DataContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
