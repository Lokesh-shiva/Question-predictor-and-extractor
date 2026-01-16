/**
 * Prediction Artifact Storage Service
 * 
 * IndexedDB-based persistent storage for prediction analysis results.
 * Separate from extraction artifacts to avoid mixing concerns.
 */

import { PredictionArtifact } from '../types/predictionArtifact';

const DB_NAME = 'ExamExtractorPredictions';
const DB_VERSION = 1;
const STORE_NAME = 'predictions';
const HASH_INDEX = 'by_hash';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize and get the IndexedDB database
 */
function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[PredictionStorage] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

                // Create index for input hash lookups (deduplication)
                store.createIndex(HASH_INDEX, 'inputSignature.hash', { unique: false });

                console.log('[PredictionStorage] Created database and object store');
            }
        };
    });

    return dbPromise;
}

/**
 * Save a prediction artifact to IndexedDB
 */
export async function savePredictionArtifact(artifact: PredictionArtifact): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(artifact);

        request.onsuccess = () => {
            console.log(`[PredictionStorage] Saved prediction: ${artifact.id} (hash: ${artifact.inputSignature.hash})`);
            resolve();
        };

        request.onerror = () => {
            console.error('[PredictionStorage] Save failed:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Find prediction artifact by input hash (for cache lookup)
 */
export async function findPredictionByHash(hash: string): Promise<PredictionArtifact | null> {
    const db = await getDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index(HASH_INDEX);
        const request = index.getAll(hash);

        request.onsuccess = () => {
            // Filter out expired and return most recent
            const valid = (request.result || [])
                .filter((a: PredictionArtifact) => a.expiresAt === null || a.expiresAt > now)
                .sort((a: PredictionArtifact, b: PredictionArtifact) => b.createdAt - a.createdAt);

            resolve(valid[0] || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get a prediction artifact by ID
 */
export async function getPredictionArtifact(id: string): Promise<PredictionArtifact | null> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get all prediction artifacts
 */
export async function getAllPredictionArtifacts(): Promise<PredictionArtifact[]> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const now = Date.now();
            const artifacts = (request.result || []).filter((a: PredictionArtifact) =>
                a.expiresAt === null || a.expiresAt > now
            );
            resolve(artifacts);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Delete a prediction artifact by ID
 */
export async function deletePredictionArtifact(id: string): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[PredictionStorage] Deleted prediction: ${id}`);
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Clean up expired prediction artifacts
 */
export async function cleanupExpiredPredictions(): Promise<number> {
    const db = await getDB();
    const now = Date.now();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const artifact = cursor.value as PredictionArtifact;
                if (artifact.expiresAt !== null && artifact.expiresAt < now) {
                    cursor.delete();
                    deletedCount++;
                }
                cursor.continue();
            } else {
                console.log(`[PredictionStorage] Cleaned up ${deletedCount} expired predictions`);
                resolve(deletedCount);
            }
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get prediction storage statistics
 */
export async function getPredictionStorageStats(): Promise<{
    count: number;
    oldestDate: number | null;
    newestDate: number | null;
}> {
    const artifacts = await getAllPredictionArtifacts();

    if (artifacts.length === 0) {
        return { count: 0, oldestDate: null, newestDate: null };
    }

    const dates = artifacts.map(a => a.createdAt).sort((a, b) => a - b);

    return {
        count: artifacts.length,
        oldestDate: dates[0],
        newestDate: dates[dates.length - 1],
    };
}
