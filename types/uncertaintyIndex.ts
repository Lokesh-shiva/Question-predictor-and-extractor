/**
 * Uncertainty Index Types and Computation
 * 
 * Provides a system-wide uncertainty indicator that honestly communicates
 * prediction reliability based on data quality.
 */

import { Question } from '../types';

/**
 * Uncertainty level classifications
 */
export enum UncertaintyLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
}

/**
 * Individual signal scores contributing to uncertainty
 */
export interface UncertaintySignals {
    /** Score 0-1: Higher = more sparse data */
    sparsity: number;
    /** Score 0-1: Higher = more variance in patterns */
    variance: number;
    /** Score 0-1: Higher = more conflicting signals */
    conflict: number;
}

/**
 * Complete uncertainty index with computed values
 */
export interface UncertaintyIndex {
    /** Overall uncertainty level */
    level: UncertaintyLevel;
    /** Numeric score 0-1 (higher = more uncertain) */
    score: number;
    /** Contributing signal scores */
    signals: UncertaintySignals;
    /** Human-readable explanation */
    explanation: string;
    /** Short label for badges */
    label: string;
}

/**
 * Weight configuration for uncertainty signals
 */
const SIGNAL_WEIGHTS = {
    sparsity: 0.40,
    variance: 0.35,
    conflict: 0.25
};

/**
 * Threshold configuration
 */
const THRESHOLDS = {
    LOW_MAX: 0.33,
    MEDIUM_MAX: 0.66,
    // Minimum data requirements
    MIN_QUESTIONS: 10,
    MIN_PAPERS: 2,
    IDEAL_QUESTIONS: 50,
    IDEAL_PAPERS: 5
};

/**
 * Compute sparsity signal from question count and source diversity
 */
function computeSparsitySignal(questions: Question[]): number {
    const questionCount = questions.length;
    const uniquePapers = new Set(questions.map(q => q.sourcePaperId)).size;

    // Question count contribution (0-0.5)
    let questionScore = 0;
    if (questionCount < THRESHOLDS.MIN_QUESTIONS) {
        questionScore = 0.5;
    } else if (questionCount < THRESHOLDS.IDEAL_QUESTIONS) {
        questionScore = 0.5 * (1 - (questionCount - THRESHOLDS.MIN_QUESTIONS) /
            (THRESHOLDS.IDEAL_QUESTIONS - THRESHOLDS.MIN_QUESTIONS));
    }

    // Paper count contribution (0-0.5)
    let paperScore = 0;
    if (uniquePapers < THRESHOLDS.MIN_PAPERS) {
        paperScore = 0.5;
    } else if (uniquePapers < THRESHOLDS.IDEAL_PAPERS) {
        paperScore = 0.5 * (1 - (uniquePapers - THRESHOLDS.MIN_PAPERS) /
            (THRESHOLDS.IDEAL_PAPERS - THRESHOLDS.MIN_PAPERS));
    }

    return Math.min(1, questionScore + paperScore);
}

/**
 * Compute variance signal from topic and marks distribution
 */
function computeVarianceSignal(questions: Question[]): number {
    if (questions.length === 0) return 1;

    // Topic coverage variance
    const topicCounts = new Map<string, number>();
    questions.forEach(q => {
        topicCounts.set(q.topic, (topicCounts.get(q.topic) || 0) + 1);
    });

    const topicValues = Array.from(topicCounts.values());
    if (topicValues.length <= 1) return 0.7; // Single topic = high variance concern

    // Calculate coefficient of variation for topic distribution
    const mean = topicValues.reduce((a, b) => a + b, 0) / topicValues.length;
    const variance = topicValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / topicValues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    // Normalize CV to 0-1 (CV > 1.5 is very high variance)
    const topicVarianceScore = Math.min(1, cv / 1.5);

    // Marks variance (if available)
    const questionsWithMarks = questions.filter(q => q.marks !== null && q.marks !== undefined);
    let marksVarianceScore = 0.3; // Default if no marks data

    if (questionsWithMarks.length > 3) {
        const marks = questionsWithMarks.map(q => q.marks!);
        const marksMean = marks.reduce((a, b) => a + b, 0) / marks.length;
        const marksVariance = marks.reduce((sum, val) => sum + Math.pow(val - marksMean, 2), 0) / marks.length;
        const marksStdDev = Math.sqrt(marksVariance);
        const marksCv = marksMean > 0 ? marksStdDev / marksMean : 0;
        marksVarianceScore = Math.min(1, marksCv / 1.0);
    }

    return (topicVarianceScore * 0.6) + (marksVarianceScore * 0.4);
}

/**
 * Compute conflict signal from confidence scores and pattern consistency
 */
function computeConflictSignal(questions: Question[]): number {
    if (questions.length === 0) return 1;

    // Low confidence scores indicate extraction uncertainty
    const questionsWithConfidence = questions.filter(q =>
        q.confidenceScore !== undefined && q.confidenceScore !== null
    );

    let confidenceConflict = 0.3; // Default if no confidence data
    if (questionsWithConfidence.length > 0) {
        const avgConfidence = questionsWithConfidence.reduce((sum, q) =>
            sum + (q.confidenceScore || 0), 0) / questionsWithConfidence.length;
        // Lower confidence = higher conflict signal
        confidenceConflict = 1 - avgConfidence;
    }

    // Check for topic per paper consistency
    const paperTopics = new Map<string, Set<string>>();
    questions.forEach(q => {
        if (!paperTopics.has(q.sourcePaperId)) {
            paperTopics.set(q.sourcePaperId, new Set());
        }
        paperTopics.get(q.sourcePaperId)!.add(q.topic);
    });

    // If different papers have very different topic distributions, that's conflict
    const topicSets = Array.from(paperTopics.values());
    let consistencyConflict = 0;
    if (topicSets.length >= 2) {
        // Calculate Jaccard similarity between paper topic sets
        const allTopics = new Set<string>();
        topicSets.forEach(s => s.forEach(t => allTopics.add(t)));

        let totalSimilarity = 0;
        let comparisons = 0;
        for (let i = 0; i < topicSets.length; i++) {
            for (let j = i + 1; j < topicSets.length; j++) {
                const intersection = new Set([...topicSets[i]].filter(x => topicSets[j].has(x)));
                const union = new Set([...topicSets[i], ...topicSets[j]]);
                totalSimilarity += intersection.size / union.size;
                comparisons++;
            }
        }
        const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
        consistencyConflict = 1 - avgSimilarity;
    }

    return (confidenceConflict * 0.5) + (consistencyConflict * 0.5);
}

/**
 * Get human-readable label for uncertainty level
 */
function getLabel(level: UncertaintyLevel): string {
    switch (level) {
        case UncertaintyLevel.LOW:
            return 'Strong signal';
        case UncertaintyLevel.MEDIUM:
            return 'Some gaps';
        case UncertaintyLevel.HIGH:
            return 'Limited data';
    }
}

/**
 * Generate human-readable explanation for uncertainty
 */
function generateExplanation(
    level: UncertaintyLevel,
    signals: UncertaintySignals,
    questionCount: number,
    paperCount: number
): string {
    const issues: string[] = [];

    if (signals.sparsity > 0.5) {
        if (paperCount < THRESHOLDS.MIN_PAPERS) {
            issues.push(`only ${paperCount} paper${paperCount === 1 ? '' : 's'} analyzed`);
        }
        if (questionCount < THRESHOLDS.MIN_QUESTIONS) {
            issues.push(`only ${questionCount} questions found`);
        }
    }

    if (signals.variance > 0.6) {
        issues.push('topic coverage varies significantly across papers');
    }

    if (signals.conflict > 0.6) {
        issues.push('some patterns are inconsistent');
    }

    switch (level) {
        case UncertaintyLevel.LOW:
            return 'Patterns are based on consistent data across multiple papers.';
        case UncertaintyLevel.MEDIUM:
            return issues.length > 0
                ? `Predictions have some uncertainty: ${issues.join(', ')}.`
                : 'Some patterns may not hold across all exams.';
        case UncertaintyLevel.HIGH:
            return issues.length > 0
                ? `Predictions are limited because ${issues.join(' and ')}.`
                : 'Not enough data for reliable predictions.';
    }
}

/**
 * Main function: Compute uncertainty index from questions
 */
export function computeUncertaintyIndex(questions: Question[]): UncertaintyIndex {
    // Edge case: no questions
    if (questions.length === 0) {
        return {
            level: UncertaintyLevel.HIGH,
            score: 1.0,
            signals: { sparsity: 1, variance: 1, conflict: 1 },
            explanation: 'No questions available for analysis.',
            label: 'No data'
        };
    }

    // Compute individual signals
    const sparsity = computeSparsitySignal(questions);
    const variance = computeVarianceSignal(questions);
    const conflict = computeConflictSignal(questions);

    const signals: UncertaintySignals = { sparsity, variance, conflict };

    // Weighted combination
    const score =
        (sparsity * SIGNAL_WEIGHTS.sparsity) +
        (variance * SIGNAL_WEIGHTS.variance) +
        (conflict * SIGNAL_WEIGHTS.conflict);

    // Determine level
    let level: UncertaintyLevel;
    if (score <= THRESHOLDS.LOW_MAX) {
        level = UncertaintyLevel.LOW;
    } else if (score <= THRESHOLDS.MEDIUM_MAX) {
        level = UncertaintyLevel.MEDIUM;
    } else {
        level = UncertaintyLevel.HIGH;
    }

    const paperCount = new Set(questions.map(q => q.sourcePaperId)).size;
    const explanation = generateExplanation(level, signals, questions.length, paperCount);
    const label = getLabel(level);

    return {
        level,
        score: Math.round(score * 100) / 100,
        signals,
        explanation,
        label
    };
}

/**
 * Check if predictions should be shown based on uncertainty
 */
export function shouldShowPredictions(uncertainty: UncertaintyIndex): boolean {
    return uncertainty.level !== UncertaintyLevel.HIGH;
}

/**
 * Check if predictions should require user opt-in (medium uncertainty)
 */
export function requiresPredictionOptIn(uncertainty: UncertaintyIndex): boolean {
    return uncertainty.level === UncertaintyLevel.MEDIUM;
}
