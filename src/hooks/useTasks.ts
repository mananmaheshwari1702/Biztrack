import { useCallback } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { useFirestoreQuery } from './useFirestoreQuery';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types';
import { queryCache } from '../utils/cache';
import { useToast } from '../context/ToastContext';

export const useTasks = (
    status: 'All' | 'Pending' | 'Completed' | 'Overdue',
    priority: 'All' | 'High' | 'Medium' | 'Low',
    sortBy: 'date' | 'priority',
    pageSize: number = 20
) => {
    const { currentUser } = useAuth();
    const { success, error: showError } = useToast();

    // Construct Query Constraints
    const constraints = [];

    // Status Filter
    if (status !== 'All' && status !== 'Overdue') {
        constraints.push(where('status', '==', status));
    }
    // 'Overdue' Handling
    if (status === 'Overdue') {
        const now = new Date().toISOString();
        constraints.push(where('status', '!=', 'Completed'));
        constraints.push(where('dueDate', '<', now));
    }

    // Priority Filter
    if (priority !== 'All') {
        constraints.push(where('priority', '==', priority));
    }

    // Sort
    if (sortBy === 'priority') {
        constraints.push(orderBy('priority', 'desc'));
        constraints.push(orderBy('dueDate', 'asc'));
    } else {
        constraints.push(orderBy('dueDate', 'asc'));
    }

    const { data: tasks, loading, error, hasMore, loadMore, refresh } = useFirestoreQuery<Task>(
        'tasks',
        constraints,
        pageSize,
        [status, priority, sortBy]
    );

    const addTask = useCallback(async (task: Task) => {
        if (!currentUser) return;
        try {
            await firebaseService.addTask(currentUser.uid, task);
            success("Task added", "The task has been successfully created.");
            refresh();
        } catch (err) {
            showError("Failed to add task", "An error occurred while creating the task.");
            throw err;
        }
    }, [currentUser, refresh, success, showError]);

    const updateTask = useCallback(async (task: Task) => {
        if (!currentUser) return;

        // Optimistic Key using current filters
        const key = queryCache.generateKey('tasks', currentUser.uid, { constraints: [status, priority, sortBy], page: 'first' });
        const cached = await queryCache.get(key);
        const previousData = cached ? cached.data : [];

        if (cached) {
            const updatedData = cached.data.map((t: Task) => t.id === task.id ? task : t);
            await queryCache.set(key, updatedData, currentUser.uid);
            refresh();
        }

        try {
            await firebaseService.updateTask(currentUser.uid, task);
            success("Task updated");
        } catch (err) {
            if (cached) {
                await queryCache.set(key, previousData, currentUser.uid);
                refresh();
            }
            showError("Failed to update task");
            throw err;
        }
    }, [currentUser, refresh, success, showError, status, priority, sortBy]);

    const deleteTask = useCallback(async (taskId: string) => {
        if (!currentUser) return;

        const key = queryCache.generateKey('tasks', currentUser.uid, { constraints: [status, priority, sortBy], page: 'first' });
        const cached = await queryCache.get(key);
        const previousData = cached ? cached.data : [];

        if (cached) {
            const updatedData = cached.data.filter((t: Task) => t.id !== taskId);
            await queryCache.set(key, updatedData, currentUser.uid);
            refresh();
        }

        try {
            await firebaseService.deleteTask(currentUser.uid, taskId);
            success("Task deleted");
        } catch (err) {
            if (cached) {
                await queryCache.set(key, previousData, currentUser.uid);
                refresh();
            }
            showError("Failed to delete task");
            throw err;
        }
    }, [currentUser, refresh, success, showError, status, priority, sortBy]);

    return {
        tasks,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        addTask,
        updateTask,
        deleteTask
    };
};
