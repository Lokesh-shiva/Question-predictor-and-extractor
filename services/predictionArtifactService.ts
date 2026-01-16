/**
 * Prediction Artifact Service
 * 
 * High-level operations for prediction caching.
 * Handles deduplication by input hash and lifecycle management.
 */

import { PredictionReport } from '../types';
import {
    PredictionArtifact,
    computeInputHash,
    createPredictionArtifact,
} from '../types/predictionArtifact';
import {
    savePredictionArtifact,
    findPredictionByHash,
    getAllPredictionArtifacts,
    deletePredictionArtifact,
    cleanupExpiredPredictions,
    getPredictionStorageStats,
} from './predictionStorage';

/**
 * Check for cached prediction matching the input artifacts and syllabus
 */
export async function findCachedPrediction(
    artifactIds: string[],
    syllabusText?: string | null
): Promise<PredictionArtifact | null> {
    try {
        const hash = await computeInputHash(artifactIds, syllabusText);
        const cached = await findPredictionByHash(hash);

        if (cached) {
            console.log(`[PredictionService] Cache hit for hash: ${hash}`);
            return cached;
        }

        console.log(`[PredictionService] Cache miss for hash: ${hash}`);
        return null;
    } catch (error) {
        console.error('[PredictionService] Error checking cache:', error);
        return null;
    }
}

/**
 * Save a prediction result to cache
 */
export async function savePrediction(
    artifactIds: string[],
    questionCount: number,
    result: PredictionReport,
    durationMs: number,
    syllabusText?: string | null
): Promise<PredictionArtifact> {
    const artifact = await createPredictionArtifact(
        artifactIds,
        questionCount,
        result,
        durationMs,
        syllabusText
    );

    await savePredictionArtifact(artifact);
    console.log(`[PredictionService] Saved prediction: ${artifact.id}`);

    return artifact;
}

/**
 * Initialize prediction service (cleanup expired on app start)
 */
export async function initializePredictionService(): Promise<void> {
    try {
        const cleaned = await cleanupExpiredPredictions();
        const stats = await getPredictionStorageStats();
        console.log(`[PredictionService] Initialized. ${stats.count} cached predictions. Cleaned ${cleaned} expired.`);
    } catch (error) {
        console.error('[PredictionService] Initialization error:', error);
    }
}

// Re-export for convenience
export {
    getAllPredictionArtifacts,
    deletePredictionArtifact,
    getPredictionStorageStats,
};
