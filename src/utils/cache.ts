import { logger } from './logger';

const DB_NAME = 'BiztrackCache';
const DB_VERSION = 1;
const STORE_NAME = 'queries';

interface CacheEntry {
    key: string;
    data: any[];
    timestamp: number;
    userId: string;
    metadata?: any; // For pagination cursor etc
}

class CacheManager {
    private dbPromise: Promise<IDBDatabase> | null = null;
    private memoryCache: Map<string, CacheEntry> = new Map();
    private isSupported: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

    constructor() {
        if (this.isSupported) {
            this.dbPromise = this.openDB();
        } else {
            logger.warn("IndexedDB not supported, falling back to memory cache.");
        }
    }

    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                logger.error("IndexedDB error:", (event.target as any).error);
                // Fallback to memory only if DB fails to open
                this.isSupported = false;
                reject((event.target as any).error);
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async set(key: string, data: any[], userId: string, metadata?: any): Promise<void> {
        const entry: CacheEntry = {
            key,
            data,
            timestamp: Date.now(),
            userId,
            metadata
        };

        // Always update memory cache for speed
        this.memoryCache.set(key, entry);

        if (!this.isSupported || !this.dbPromise) return;

        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(entry);
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            logger.error("Failed to write to cache:", error);
        }
    }

    async get(key: string): Promise<CacheEntry | null> {
        // Check memory first
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key) || null;
        }

        if (!this.isSupported || !this.dbPromise) return null;

        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    const result = request.result as CacheEntry;
                    if (result) {
                        // Hydrate memory cache
                        this.memoryCache.set(key, result);
                    }
                    resolve(result || null);
                };
                request.onerror = () => resolve(null); // Fail gracefully
            });
        } catch (error) {
            logger.error("Failed to read from cache:", error);
            return null;
        }
    }

    async clearUserCache(userId: string): Promise<void> {
        // Clear memory cache for user
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.userId === userId) {
                this.memoryCache.delete(key);
            }
        }

        if (!this.isSupported || !this.dbPromise) return;

        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('userId');
            const request = index.getAllKeys(userId);

            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => store.delete(key));
            };
        } catch (error) {
            logger.error("Failed to clear user cache:", error);
        }
    }

    // Helper to generate consistent keys
    generateKey(collection: string, userId: string, queryParams: any = {}): string {
        return `${userId}:${collection}:${JSON.stringify(queryParams)}`;
    }
}

export const queryCache = new CacheManager();
