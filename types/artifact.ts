/**
 * Extraction Artifact Types
 * 
 * Defines the schema for persistent extraction artifacts that
 * store AI extraction results as reusable data objects.
 */

import { Question } from '../types';

/**
 * Source file metadata for an extraction artifact
 */
export interface ArtifactSourceFile {
    name: string;                    // Original filename
    hash: string;                    // SHA-256 of file bytes (for dedup)
    sizeBytes: number;
    mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
    uploadedAt: number;              // Unix timestamp
}

/**
 * Confidence signals for extraction quality
 */
export interface ExtractionConfidence {
    overall: number;                 // 0.0-1.0 average
    perQuestion: Record<string, number>;  // questionId -> score
}

/**
 * Error details when extraction fails
 */
export interface ExtractionError {
    code: string;
    message: string;
    retryable: boolean;
}

/**
 * Extraction data containing raw and structured output
 */
export interface ExtractionData {
    status: 'pending' | 'extracting' | 'complete' | 'error';
    startedAt: number | null;
    completedAt: number | null;
    durationMs: number | null;

    // Structured Output
    questions: Question[];

    // Quality Signals
    confidence: ExtractionConfidence;

    // Error Details (if status === 'error')
    error?: ExtractionError;
}

/**
 * AI Provider information
 */
export interface ArtifactProvider {
    name: 'gemini';
    model: string;                   // e.g., 'gemini-2.0-flash'
    promptVersion: string;           // Hash/ID of prompt used
}

/**
 * Main Extraction Artifact interface
 * 
 * Represents a persistent, reusable snapshot of an AI extraction operation.
 */
export interface ExtractionArtifact {
    // Identity
    id: string;                      // UUID, immutable after creation
    version: 1;                      // Schema version for migrations

    // Source Metadata
    sourceFile: ArtifactSourceFile;

    // Extraction Data
    extraction: ExtractionData;

    // AI Provider Info
    provider: ArtifactProvider;

    // Lifecycle
    createdAt: number;
    expiresAt: number | null;        // TTL in unix timestamp, null = no expiry
    locked: boolean;                 // Prevent re-extraction when true
}

/**
 * Artifact status for UI display
 */
export type ArtifactStatus = ExtractionData['status'];

/**
 * Default TTL for artifacts (7 days in milliseconds)
 */
export const DEFAULT_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Current prompt version identifier
 */
export const CURRENT_PROMPT_VERSION = 'v1.0.0';

/**
 * Create a new artifact with pending status
 */
export function createPendingArtifact(
    sourceFile: ArtifactSourceFile,
    provider: Partial<ArtifactProvider> = {}
): ExtractionArtifact {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        version: 1,
        sourceFile,
        extraction: {
            status: 'pending',
            startedAt: null,
            completedAt: null,
            durationMs: null,
            questions: [],
            confidence: { overall: 0, perQuestion: {} },
        },
        provider: {
            name: 'gemini',
            model: provider.model || 'gemini-2.0-flash',
            promptVersion: provider.promptVersion || CURRENT_PROMPT_VERSION,
        },
        createdAt: now,
        expiresAt: now + DEFAULT_ARTIFACT_TTL_MS,
        locked: false,
    };
}
