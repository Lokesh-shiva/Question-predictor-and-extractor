/**
 * Artifact Service
 * 
 * High-level CRUD operations for extraction artifacts.
 * Handles deduplication, lifecycle management, and replay mode.
 */

import { ExtractionArtifact, createPendingArtifact, ArtifactSourceFile, CURRENT_PROMPT_VERSION } from '../types/artifact';
import { Question } from '../types';
import { computeFileHash } from './hashService';
import {
    saveArtifact,
    getArtifact,
    findArtifactByHash,
    getAllArtifacts,
    getCompleteArtifacts,
    deleteArtifact as deleteFromStorage,
    cleanupExpiredArtifacts,
    getStorageStats,
} from './artifactStorage';

// Replay mode flag
const REPLAY_MODE_KEY = 'dev_replay_mode';

/**
 * Check if replay mode is enabled
 */
export function isReplayModeEnabled(): boolean {
    return localStorage.getItem(REPLAY_MODE_KEY) === 'true';
}

/**
 * Toggle replay mode
 */
export function setReplayMode(enabled: boolean): void {
    localStorage.setItem(REPLAY_MODE_KEY, enabled ? 'true' : 'false');
    console.log(`[ArtifactService] Replay mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if a file has already been extracted (by hash)
 * Returns the cached artifact if found and complete
 */
export async function checkForCachedExtraction(file: File): Promise<ExtractionArtifact | null> {
    const hash = await computeFileHash(file);
    const existing = await findArtifactByHash(hash);

    if (existing && existing.extraction.status === 'complete' && !isExpired(existing)) {
        console.log(`[ArtifactService] Cache hit for file: ${file.name} (hash: ${hash.slice(0, 8)}...)`);
        return existing;
    }

    return null;
}

/**
 * Check if an artifact is expired
 */
function isExpired(artifact: ExtractionArtifact): boolean {
    if (artifact.expiresAt === null) return false;
    return Date.now() > artifact.expiresAt;
}

/**
 * Create a new artifact for a file upload
 */
export async function createArtifactForFile(file: File): Promise<ExtractionArtifact> {
    const hash = await computeFileHash(file);

    const sourceFile: ArtifactSourceFile = {
        name: file.name,
        hash,
        sizeBytes: file.size,
        mimeType: file.type as ArtifactSourceFile['mimeType'],
        uploadedAt: Date.now(),
    };

    const artifact = createPendingArtifact(sourceFile);
    await saveArtifact(artifact);

    console.log(`[ArtifactService] Created artifact ${artifact.id} for file: ${file.name}`);
    return artifact;
}

/**
 * Update artifact status to 'extracting'
 */
export async function markExtractionStarted(artifactId: string): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const updated: ExtractionArtifact = {
        ...artifact,
        extraction: {
            ...artifact.extraction,
            status: 'extracting',
            startedAt: Date.now(),
        },
    };

    await saveArtifact(updated);
    return updated;
}

/**
 * Complete extraction with questions
 */
export async function completeExtraction(
    artifactId: string,
    questions: Question[],
    confidenceScores: Record<string, number> = {}
): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const now = Date.now();
    const overallConfidence = questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.confidenceScore || 0.8), 0) / questions.length
        : 0;

    const updated: ExtractionArtifact = {
        ...artifact,
        extraction: {
            ...artifact.extraction,
            status: 'complete',
            completedAt: now,
            durationMs: artifact.extraction.startedAt
                ? now - artifact.extraction.startedAt
                : null,
            questions,
            confidence: {
                overall: overallConfidence,
                perQuestion: confidenceScores,
            },
        },
    };

    await saveArtifact(updated);
    console.log(`[ArtifactService] Completed extraction for ${artifactId}: ${questions.length} questions`);
    return updated;
}

/**
 * Mark extraction as failed
 */
export async function failExtraction(
    artifactId: string,
    error: { code: string; message: string; retryable: boolean }
): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const updated: ExtractionArtifact = {
        ...artifact,
        extraction: {
            ...artifact.extraction,
            status: 'error',
            completedAt: Date.now(),
            error,
        },
    };

    await saveArtifact(updated);
    console.log(`[ArtifactService] Extraction failed for ${artifactId}: ${error.message}`);
    return updated;
}

/**
 * Lock an artifact to prevent re-extraction
 */
export async function lockArtifact(artifactId: string): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const updated: ExtractionArtifact = {
        ...artifact,
        locked: true,
        expiresAt: null, // Locked artifacts don't expire
    };

    await saveArtifact(updated);
    console.log(`[ArtifactService] Locked artifact: ${artifactId}`);
    return updated;
}

/**
 * Unlock an artifact
 */
export async function unlockArtifact(artifactId: string): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const updated: ExtractionArtifact = {
        ...artifact,
        locked: false,
    };

    await saveArtifact(updated);
    return updated;
}

/**
 * Extend artifact TTL
 */
export async function extendArtifactTTL(
    artifactId: string,
    additionalDays: number = 7
): Promise<ExtractionArtifact | null> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return null;

    const newExpiry = Date.now() + (additionalDays * 24 * 60 * 60 * 1000);

    const updated: ExtractionArtifact = {
        ...artifact,
        expiresAt: newExpiry,
    };

    await saveArtifact(updated);
    return updated;
}

/**
 * Delete an artifact (respects lock)
 */
export async function deleteArtifact(artifactId: string, force: boolean = false): Promise<boolean> {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return false;

    if (artifact.locked && !force) {
        console.warn(`[ArtifactService] Cannot delete locked artifact: ${artifactId}`);
        return false;
    }

    await deleteFromStorage(artifactId);
    return true;
}

/**
 * Get questions from replay mode (if enabled and artifact exists)
 */
export async function getReplayQuestions(fileHash: string): Promise<Question[] | null> {
    if (!isReplayModeEnabled()) return null;

    const artifact = await findArtifactByHash(fileHash);
    if (artifact && artifact.extraction.status === 'complete') {
        console.log(`[ArtifactService] Replaying artifact: ${artifact.id}`);
        return artifact.extraction.questions;
    }

    return null;
}

/**
 * Get all questions from complete artifacts
 */
export async function getAllQuestionsFromArtifacts(): Promise<Question[]> {
    const artifacts = await getCompleteArtifacts();
    return artifacts.flatMap(a => a.extraction.questions);
}

/**
 * Cleanup expired artifacts on app start
 */
export async function initializeArtifactService(): Promise<void> {
    try {
        const cleaned = await cleanupExpiredArtifacts();
        const stats = await getStorageStats();
        console.log(`[ArtifactService] Initialized. ${stats.count} artifacts, ${stats.totalQuestions} questions. Cleaned ${cleaned} expired.`);
    } catch (err) {
        console.error('[ArtifactService] Initialization failed:', err);
    }
}

// Re-export storage functions for convenience
export {
    getArtifact,
    getAllArtifacts,
    getCompleteArtifacts,
    getStorageStats,
    findArtifactByHash,
};
