/**
 * Prediction Artifact Types
 * 
 * Defines the schema for persistent prediction artifacts that
 * store AI prediction analysis results for reuse.
 */

import { PredictionReport } from '../types';

/**
 * Input signature for deduplication
 * Same inputs = same cached result
 */
export interface PredictionInputSignature {
    /** Sorted IDs of source extraction artifacts */
    artifactIds: string[];
    /** Total question count from source artifacts */
    questionCount: number;
    /** Hash of sorted artifact IDs for fast lookup */
    hash: string;
    /** Hash of syllabus text if provided */
    syllabusHash: string | null;
}

/**
 * Main Prediction Artifact interface
 * 
 * Represents a cached AI prediction analysis result.
 */
export interface PredictionArtifact {
    // Identity
    id: string;
    version: 1;

    // Input signature (for deduplication)
    inputSignature: PredictionInputSignature;

    // Syllabus text (optional, stored for reference)
    syllabusText: string | null;

    // Analysis Result
    result: PredictionReport;

    // Metadata
    createdAt: number;
    expiresAt: number | null;
    durationMs: number;
}

/**
 * Default TTL for prediction artifacts (7 days in milliseconds)
 */
export const PREDICTION_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute hash for artifact IDs (for deduplication)
 */
export async function computeInputHash(
    artifactIds: string[],
    syllabusText?: string | null
): Promise<string> {
    const sorted = [...artifactIds].sort();
    const input = JSON.stringify({ artifacts: sorted, syllabus: syllabusText || '' });

    // Use SubtleCrypto for hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Compute hash for syllabus text
 */
export async function computeSyllabusHash(syllabusText: string | null): Promise<string | null> {
    if (!syllabusText || syllabusText.trim() === '') return null;

    const encoder = new TextEncoder();
    const data = encoder.encode(syllabusText.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Create a new prediction artifact
 */
export async function createPredictionArtifact(
    artifactIds: string[],
    questionCount: number,
    result: PredictionReport,
    durationMs: number,
    syllabusText?: string | null
): Promise<PredictionArtifact> {
    const now = Date.now();
    const sorted = [...artifactIds].sort();
    const hash = await computeInputHash(sorted, syllabusText);
    const syllabusHash = await computeSyllabusHash(syllabusText || null);

    return {
        id: crypto.randomUUID(),
        version: 1,
        inputSignature: {
            artifactIds: sorted,
            questionCount,
            hash,
            syllabusHash,
        },
        syllabusText: syllabusText || null,
        result,
        createdAt: now,
        expiresAt: now + PREDICTION_ARTIFACT_TTL_MS,
        durationMs,
    };
}
