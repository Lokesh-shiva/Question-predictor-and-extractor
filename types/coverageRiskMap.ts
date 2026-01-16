/**
 * Coverage & Risk Map Types
 * 
 * Defines types for analyzing topic coverage from historical exam data.
 * Focuses on frequency, recency, and omission risk—not predictions.
 */

import { Question } from '../types';

/**
 * Coverage status classification
 * - well-covered: Appears frequently and recently
 * - steady: Appears regularly but not dominant
 * - undercovered: Rarely appears in historical papers  
 * - gap-alert: Was historically important but missing recently
 */
export type CoverageStatus = 'well-covered' | 'steady' | 'undercovered' | 'gap-alert';

/**
 * Historical importance level based on past frequency
 */
export type HistoricalImportance = 'core' | 'regular' | 'occasional';

/**
 * Metrics computed for each topic from question data
 */
export interface TopicCoverageMetrics {
    topicName: string;

    // Core frequency metrics
    totalAppearances: number;       // Count across all papers
    frequency: number;              // appearances / totalPapers (0-1)
    totalPapers: number;            // Number of unique papers analyzed

    // Recency metrics
    lastSeenPaperIndex: number;     // 0 = most recent paper, higher = older
    appearedRecently: boolean;      // Appeared in last 2 papers
    recencyScore: number;           // Weighted recency (0-1, higher = more recent)
    yearsAppeared: string[];        // List of years/paper identifiers

    // Pattern metrics
    avgMarks: number | null;        // Average marks when appeared
    marksRange: [number, number] | null; // Min-max marks range
    questionTypes: string[];        // Common question types observed
    questionCount: number;          // Total questions for this topic

    // Gap detection
    omissionStreak: number;         // Consecutive recent papers where absent
    historicalImportance: HistoricalImportance;
}

/**
 * Full topic coverage analysis result
 */
export interface TopicCoverage {
    metrics: TopicCoverageMetrics;
    status: CoverageStatus;

    // Risk labeling (human-readable)
    statusLabel: string;            // e.g., "Frequently Tested"
    statusIcon: string;             // e.g., "📗"
    shortReason: string;            // e.g., "Appeared in 4 of 5 papers"
    actionAdvice: string;           // e.g., "Ensure deep understanding"
}

/**
 * Gap alert for topics that warrant special attention
 */
export interface GapAlert {
    topicName: string;
    reason: string;                 // Why this is flagged
    lastSeen: string;               // e.g., "2019" or "Not in last 2 papers"
    historicalFrequency: string;    // e.g., "Appeared in 3 of 5 papers before 2020"
    urgency: 'high' | 'medium';     // Based on historical importance
}

/**
 * Summary statistics for the coverage map
 */
export interface CoverageSummary {
    totalTopics: number;
    wellCoveredCount: number;
    steadyCount: number;
    undercoveredCount: number;
    gapAlertCount: number;

    // Data quality indicators
    papersAnalyzed: number;
    questionsAnalyzed: number;
    dataQuality: 'limited' | 'moderate' | 'good';

    // Actionable summary
    summaryText: string;            // Human-readable summary
}

/**
 * Complete Coverage & Risk Map data structure
 */
export interface CoverageRiskMapData {
    // Core data
    topics: TopicCoverage[];
    gapAlerts: GapAlert[];
    summary: CoverageSummary;

    // Metadata
    generatedAt: number;
    paperIds: string[];

    // Mode indicator
    isEnhanced: boolean;            // True if cloud AI was used
}

/**
 * Risk labeling configuration (language constants)
 */
export const RISK_LABELS: Record<CoverageStatus, {
    icon: string;
    label: string;
    shortReason: string;
    actionAdvice: string;
}> = {
    'well-covered': {
        icon: '📗',
        label: 'Frequently Tested',
        shortReason: 'Appears often and recently',
        actionAdvice: 'Core topic. Ensure deep understanding.',
    },
    'steady': {
        icon: '📘',
        label: 'Regularly Tested',
        shortReason: 'Appears periodically across papers',
        actionAdvice: 'Include in your study plan. Expect moderate coverage.',
    },
    'undercovered': {
        icon: '📙',
        label: 'Rarely Tested',
        shortReason: 'Appears infrequently in historical papers',
        actionAdvice: 'Basic understanding may be sufficient. Prioritize other topics.',
    },
    'gap-alert': {
        icon: '🔴',
        label: 'Watch This Topic',
        shortReason: 'Historically important but quiet recently',
        actionAdvice: 'Review this topic. Long gaps often precede reappearance.',
    },
};

/**
 * Thresholds for classification
 */
export const COVERAGE_THRESHOLDS = {
    WELL_COVERED_MIN_FREQUENCY: 0.6,
    STEADY_MIN_FREQUENCY: 0.3,
    RECENT_PAPERS_COUNT: 2,          // How many papers count as "recent"
    GAP_OMISSION_THRESHOLD: 2,       // Papers missing to trigger gap alert

    // Data quality thresholds
    GOOD_DATA_PAPERS: 5,
    MODERATE_DATA_PAPERS: 3,
    GOOD_DATA_QUESTIONS: 50,
    MODERATE_DATA_QUESTIONS: 20,
};
