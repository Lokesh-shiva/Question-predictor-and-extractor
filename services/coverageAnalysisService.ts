/**
 * Coverage Analysis Service
 * 
 * Computes topic coverage metrics from historical exam questions.
 * Works entirely locally without AI—based on frequency, recency, and omission patterns.
 */

import { Question } from '../types';
import {
    CoverageStatus,
    TopicCoverageMetrics,
    TopicCoverage,
    GapAlert,
    CoverageSummary,
    CoverageRiskMapData,
    HistoricalImportance,
    RISK_LABELS,
    COVERAGE_THRESHOLDS,
} from '../types/coverageRiskMap';

/**
 * Extract year from paper filename or ID
 * Attempts to find 4-digit year in the string
 */
function extractYear(paperId: string, filename?: string): string | null {
    const text = filename || paperId;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
}

/**
 * Compute recency score based on paper index
 * Papers are assumed ordered from newest (0) to oldest
 */
function computeRecencyScore(lastSeenIndex: number, totalPapers: number): number {
    if (totalPapers <= 1) return 1;
    // Exponential decay: more recent papers get higher scores
    const normalized = lastSeenIndex / (totalPapers - 1);
    return Math.max(0, 1 - normalized);
}

/**
 * Determine historical importance based on past frequency
 */
function determineHistoricalImportance(frequency: number): HistoricalImportance {
    if (frequency >= 0.6) return 'core';
    if (frequency >= 0.3) return 'regular';
    return 'occasional';
}

/**
 * Classify topic into coverage status based on metrics
 */
export function classifyTopic(metrics: TopicCoverageMetrics): CoverageStatus {
    const { frequency, appearedRecently, omissionStreak, historicalImportance } = metrics;

    // Gap Alert: Was important historically, now suddenly missing
    if (historicalImportance !== 'occasional' && omissionStreak >= COVERAGE_THRESHOLDS.GAP_OMISSION_THRESHOLD) {
        return 'gap-alert';
    }

    // Well-Covered: Frequent and recent
    if (frequency >= COVERAGE_THRESHOLDS.WELL_COVERED_MIN_FREQUENCY && appearedRecently) {
        return 'well-covered';
    }

    // Undercovered: Rarely appears
    if (frequency < COVERAGE_THRESHOLDS.STEADY_MIN_FREQUENCY) {
        return 'undercovered';
    }

    // Steady: Everything else
    return 'steady';
}

/**
 * Generate human-readable reason based on metrics
 */
function generateShortReason(metrics: TopicCoverageMetrics): string {
    const { totalAppearances, totalPapers, omissionStreak, appearedRecently } = metrics;

    if (omissionStreak >= 2) {
        return `Not seen in last ${omissionStreak} papers`;
    }

    if (appearedRecently) {
        return `Appeared in ${totalAppearances} of ${totalPapers} papers (recent)`;
    }

    return `Appeared in ${totalAppearances} of ${totalPapers} papers`;
}

/**
 * Compute coverage metrics for all topics from questions
 */
export function computeTopicMetrics(questions: Question[]): TopicCoverageMetrics[] {
    if (questions.length === 0) return [];

    // Get unique papers sorted by most recent first (assuming higher upload date = more recent)
    const paperMap = new Map<string, { id: string; index: number }>();
    const uniquePaperIds = [...new Set(questions.map(q => q.sourcePaperId))];

    // Sort papers - we'll use the paper ID order as proxy for recency
    // In a real scenario, this would use actual dates
    uniquePaperIds.forEach((paperId, index) => {
        paperMap.set(paperId, { id: paperId, index });
    });

    const totalPapers = uniquePaperIds.length;

    // Group questions by topic
    const topicGroups = new Map<string, Question[]>();
    questions.forEach(q => {
        const topic = q.topic || 'Uncategorized';
        if (!topicGroups.has(topic)) {
            topicGroups.set(topic, []);
        }
        topicGroups.get(topic)!.push(q);
    });

    // Compute metrics for each topic
    const metrics: TopicCoverageMetrics[] = [];

    topicGroups.forEach((topicQuestions, topicName) => {
        // Papers this topic appears in
        const papersWithTopic = new Set(topicQuestions.map(q => q.sourcePaperId));
        const totalAppearances = papersWithTopic.size;
        const frequency = totalAppearances / totalPapers;

        // Find most recent paper index for this topic
        let lastSeenIndex = totalPapers; // Max if never seen
        papersWithTopic.forEach(paperId => {
            const paperInfo = paperMap.get(paperId);
            if (paperInfo && paperInfo.index < lastSeenIndex) {
                lastSeenIndex = paperInfo.index;
            }
        });

        // Recency calculations
        const appearedRecently = lastSeenIndex < COVERAGE_THRESHOLDS.RECENT_PAPERS_COUNT;
        const recencyScore = computeRecencyScore(lastSeenIndex, totalPapers);

        // Calculate omission streak (consecutive recent papers without this topic)
        let omissionStreak = 0;
        for (let i = 0; i < totalPapers; i++) {
            const paperId = uniquePaperIds[i];
            if (papersWithTopic.has(paperId)) {
                break;
            }
            omissionStreak++;
        }

        // Years appeared
        const yearsAppeared: string[] = [];
        papersWithTopic.forEach(paperId => {
            const year = extractYear(paperId);
            if (year && !yearsAppeared.includes(year)) {
                yearsAppeared.push(year);
            }
        });
        yearsAppeared.sort().reverse(); // Most recent first

        // Marks analysis
        const questionsWithMarks = topicQuestions.filter(q => q.marks !== null && q.marks !== undefined);
        let avgMarks: number | null = null;
        let marksRange: [number, number] | null = null;

        if (questionsWithMarks.length > 0) {
            const marks = questionsWithMarks.map(q => q.marks!);
            avgMarks = Math.round(marks.reduce((a, b) => a + b, 0) / marks.length);
            marksRange = [Math.min(...marks), Math.max(...marks)];
        }

        // Question types
        const typeSet = new Set<string>();
        topicQuestions.forEach(q => {
            if (q.type && q.type !== 'Unknown') {
                typeSet.add(q.type);
            }
        });
        const questionTypes = Array.from(typeSet);

        // Historical importance (based on overall frequency)
        const historicalImportance = determineHistoricalImportance(frequency);

        metrics.push({
            topicName,
            totalAppearances,
            frequency,
            totalPapers,
            lastSeenPaperIndex: lastSeenIndex,
            appearedRecently,
            recencyScore,
            yearsAppeared,
            avgMarks,
            marksRange,
            questionTypes,
            questionCount: topicQuestions.length,
            omissionStreak,
            historicalImportance,
        });
    });

    // Sort by frequency (descending) then by recency
    metrics.sort((a, b) => {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        return a.lastSeenPaperIndex - b.lastSeenPaperIndex;
    });

    return metrics;
}

/**
 * Generate gap alerts for topics that warrant special attention
 */
export function detectGapAlerts(metrics: TopicCoverageMetrics[]): GapAlert[] {
    const alerts: GapAlert[] = [];

    metrics.forEach(m => {
        // Only alert for historically important topics with omission streak
        if (m.historicalImportance !== 'occasional' &&
            m.omissionStreak >= COVERAGE_THRESHOLDS.GAP_OMISSION_THRESHOLD) {

            const lastSeen = m.yearsAppeared.length > 0
                ? m.yearsAppeared[0]
                : `Not in last ${m.omissionStreak} papers`;

            const historicalFreq = `Appeared in ${m.totalAppearances} of ${m.totalPapers} papers`;

            alerts.push({
                topicName: m.topicName,
                reason: 'Historically important but hasn\'t appeared recently. Could return anytime.',
                lastSeen,
                historicalFrequency: historicalFreq,
                urgency: m.historicalImportance === 'core' ? 'high' : 'medium',
            });
        }
    });

    // Sort by urgency (high first) then by omission streak
    alerts.sort((a, b) => {
        if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
        return 0;
    });

    return alerts;
}

/**
 * Determine data quality based on paper and question counts
 */
function determineDataQuality(
    paperCount: number,
    questionCount: number
): 'limited' | 'moderate' | 'good' {
    if (paperCount >= COVERAGE_THRESHOLDS.GOOD_DATA_PAPERS &&
        questionCount >= COVERAGE_THRESHOLDS.GOOD_DATA_QUESTIONS) {
        return 'good';
    }
    if (paperCount >= COVERAGE_THRESHOLDS.MODERATE_DATA_PAPERS &&
        questionCount >= COVERAGE_THRESHOLDS.MODERATE_DATA_QUESTIONS) {
        return 'moderate';
    }
    return 'limited';
}

/**
 * Generate summary statistics
 */
function generateSummary(
    topics: TopicCoverage[],
    gapAlerts: GapAlert[],
    paperCount: number,
    questionCount: number
): CoverageSummary {
    const wellCoveredCount = topics.filter(t => t.status === 'well-covered').length;
    const steadyCount = topics.filter(t => t.status === 'steady').length;
    const undercoveredCount = topics.filter(t => t.status === 'undercovered').length;
    const gapAlertCount = gapAlerts.length;

    const dataQuality = determineDataQuality(paperCount, questionCount);

    // Generate summary text
    const parts: string[] = [];
    if (wellCoveredCount > 0) {
        parts.push(`${wellCoveredCount} topic${wellCoveredCount > 1 ? 's' : ''} frequently tested`);
    }
    if (gapAlertCount > 0) {
        parts.push(`${gapAlertCount} topic${gapAlertCount > 1 ? 's' : ''} with gap alerts`);
    }
    if (undercoveredCount > 0) {
        parts.push(`${undercoveredCount} rarely tested`);
    }

    let summaryText = parts.join(' • ');
    if (dataQuality === 'limited') {
        summaryText += '. Add more papers for better analysis.';
    }

    return {
        totalTopics: topics.length,
        wellCoveredCount,
        steadyCount,
        undercoveredCount,
        gapAlertCount,
        papersAnalyzed: paperCount,
        questionsAnalyzed: questionCount,
        dataQuality,
        summaryText,
    };
}

/**
 * Main function: Generate complete Coverage & Risk Map from questions
 */
export function generateCoverageMap(questions: Question[]): CoverageRiskMapData {
    if (questions.length === 0) {
        return {
            topics: [],
            gapAlerts: [],
            summary: {
                totalTopics: 0,
                wellCoveredCount: 0,
                steadyCount: 0,
                undercoveredCount: 0,
                gapAlertCount: 0,
                papersAnalyzed: 0,
                questionsAnalyzed: 0,
                dataQuality: 'limited',
                summaryText: 'No questions available for analysis.',
            },
            generatedAt: Date.now(),
            paperIds: [],
            isEnhanced: false,
        };
    }

    // Compute metrics for all topics
    const metrics = computeTopicMetrics(questions);

    // Classify each topic and build TopicCoverage objects
    const topics: TopicCoverage[] = metrics.map(m => {
        const status = classifyTopic(m);
        const labels = RISK_LABELS[status];

        return {
            metrics: m,
            status,
            statusLabel: labels.label,
            statusIcon: labels.icon,
            shortReason: generateShortReason(m),
            actionAdvice: labels.actionAdvice,
        };
    });

    // Detect gap alerts
    const gapAlerts = detectGapAlerts(metrics);

    // Get unique paper IDs
    const paperIds = [...new Set(questions.map(q => q.sourcePaperId))];

    // Generate summary
    const summary = generateSummary(topics, gapAlerts, paperIds.length, questions.length);

    return {
        topics,
        gapAlerts,
        summary,
        generatedAt: Date.now(),
        paperIds,
        isEnhanced: false,
    };
}

/**
 * Get topics grouped by status for UI rendering
 */
export function groupTopicsByStatus(topics: TopicCoverage[]): Record<CoverageStatus, TopicCoverage[]> {
    const groups: Record<CoverageStatus, TopicCoverage[]> = {
        'well-covered': [],
        'steady': [],
        'undercovered': [],
        'gap-alert': [],
    };

    topics.forEach(topic => {
        groups[topic.status].push(topic);
    });

    return groups;
}
