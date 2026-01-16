/**
 * Artifact Storage Service
 * 
 * IndexedDB-based persistent storage for extraction artifacts.
 * Survives page refreshes, hard refreshes, and browser restarts.
 */

import { ExtractionArtifact } from '../types/artifact';

const DB_NAME = 'ExamExtractorArtifacts';
const DB_VERSION = 1;
const STORE_NAME = 'artifacts';
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
            console.error('[ArtifactStorage] Failed to open database:', request.error);
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

                // Create index for file hash lookups (deduplication)
                store.createIndex(HASH_INDEX, 'sourceFile.hash', { unique: false });

                console.log('[ArtifactStorage] Created database and object store');
            }
        };
    });

    return dbPromise;
}

/**
 * Save an artifact to IndexedDB
 */
export async function saveArtifact(artifact: ExtractionArtifact): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(artifact);

        request.onsuccess = () => {
            console.log(`[ArtifactStorage] Saved artifact: ${artifact.id}`);
            resolve();
        };

        request.onerror = () => {
            console.error('[ArtifactStorage] Save failed:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get an artifact by ID
 */
export async function getArtifact(id: string): Promise<ExtractionArtifact | null> {
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
 * Find artifact by file hash (for deduplication)
 */
export async function findArtifactByHash(hash: string): Promise<ExtractionArtifact | null> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index(HASH_INDEX);
        const request = index.get(hash);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get all artifacts
 */
export async function getAllArtifacts(): Promise<ExtractionArtifact[]> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Filter out expired artifacts
            const now = Date.now();
            const artifacts = (request.result || []).filter((a: ExtractionArtifact) =>
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
 * Get all complete artifacts (status === 'complete')
 */
export async function getCompleteArtifacts(): Promise<ExtractionArtifact[]> {
    const artifacts = await getAllArtifacts();
    return artifacts.filter(a => a.extraction.status === 'complete');
}

/**
 * Delete an artifact by ID
 */
export async function deleteArtifact(id: string): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[ArtifactStorage] Deleted artifact: ${id}`);
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Clear all artifacts (for development/testing)
 */
export async function clearAllArtifacts(): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[ArtifactStorage] Cleared all artifacts');
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Clean up expired artifacts
 */
export async function cleanupExpiredArtifacts(): Promise<number> {
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
                const artifact = cursor.value as ExtractionArtifact;
                if (artifact.expiresAt !== null && artifact.expiresAt < now) {
                    cursor.delete();
                    deletedCount++;
                }
                cursor.continue();
            } else {
                console.log(`[ArtifactStorage] Cleaned up ${deletedCount} expired artifacts`);
                resolve(deletedCount);
            }
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Export an artifact as JSON (for backup/sharing)
 */
export function exportArtifactAsJSON(artifact: ExtractionArtifact): string {
    return JSON.stringify(artifact, null, 2);
}

/**
 * Import an artifact from JSON
 */
export function parseArtifactFromJSON(json: string): ExtractionArtifact {
    const artifact = JSON.parse(json) as ExtractionArtifact;
    // Validate required fields
    if (!artifact.id || !artifact.sourceFile || !artifact.extraction) {
        throw new Error('Invalid artifact format');
    }
    return artifact;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
    count: number;
    completeCount: number;
    totalQuestions: number;
}> {
    const artifacts = await getAllArtifacts();
    const complete = artifacts.filter(a => a.extraction.status === 'complete');
    const totalQuestions = complete.reduce((sum, a) => sum + a.extraction.questions.length, 0);

    return {
        count: artifacts.length,
        completeCount: complete.length,
        totalQuestions,
    };
}
