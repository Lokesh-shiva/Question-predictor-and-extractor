/**
 * Predictor Module Types
 * 
 * Defines the input contract for the Predictor module.
 * The Predictor only consumes existing extraction artifacts or selected questions,
 * never raw PDFs or images (no AI vision calls).
 */

import { Question } from '../types';

/**
 * Predictor input source - either artifacts or direct question selection
 */
export interface PredictorInputSource {
    type: 'artifacts' | 'questions';
    /** Artifact IDs when type='artifacts' */
    artifactIds?: string[];
    /** Question IDs when type='questions' */
    questionIds?: string[];
}

/**
 * Selected artifact summary for UI display
 */
export interface SelectedArtifactInfo {
    id: string;
    filename: string;
    questionCount: number;
    createdAt: number;
}

/**
 * Predictor state for managing input source
 */
export interface PredictorState {
    inputSource: PredictorInputSource | null;
    selectedArtifacts: SelectedArtifactInfo[];
    resolvedQuestions: Question[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Initial predictor state
 */
export const initialPredictorState: PredictorState = {
    inputSource: null,
    selectedArtifacts: [],
    resolvedQuestions: [],
    isLoading: false,
    error: null,
};
