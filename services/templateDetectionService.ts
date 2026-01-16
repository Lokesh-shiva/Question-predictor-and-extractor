/**
 * Template Detection Service
 * 
 * Implements logic to detect recurring structural patterns in questions.
 * Uses deterministic keyword matching and structural analysis.
 */

import { Question } from '../types';
import {
    TemplateType,
    TemplatePattern,
    TemplateAnalysis,
    TopicTemplateOccurrence,
    TemplateReport,
    TemplateSummary
} from '../types/templateDetection';

// Configuration for template signatures (keywords/phrases)
const TEMPLATE_SIGNATURES: Record<TemplateType, string[]> = {
    definition: ['define', 'what is', 'explain the concept', 'describe', 'meaning of'],
    derivation: ['derive', 'prove', 'show that', 'establish', 'obtain expression'],
    numerical: ['calculate', 'find', 'compute', 'determine the value', 'solve', 'evaluate'],
    comparison: ['compare', 'differentiate', 'contrast', 'distinguish', 'difference between'],
    application: ['apply', 'how is', 'use of', 'application', 'significance of'],
    diagram: ['draw', 'sketch', 'with diagram', 'label', 'plot'],
    listing: ['list', 'enumerate', 'types of', 'properties of', 'classification of', 'state the'],
    other: []
};

// Display configuration for template types
const TEMPLATE_DISPLAY: Record<TemplateType, { displayName: string; icon: string; description: string }> = {
    definition: {
        displayName: 'Definition-Based',
        icon: '📝',
        description: 'Questions asking for definitions or conceptual explanations'
    },
    derivation: {
        displayName: 'Derivation-Style',
        icon: '📐',
        description: 'Questions requiring mathematical proof or formula derivation'
    },
    numerical: {
        displayName: 'Numerical Problems',
        icon: '🔢',
        description: 'Calculation-heavy problems, often with variable values'
    },
    comparison: {
        displayName: 'Comparison',
        icon: '⚖️',
        description: 'Questions asking to contrast two or more concepts'
    },
    application: {
        displayName: 'Application',
        icon: '💡',
        description: 'Real-world application or usage of concepts'
    },
    diagram: {
        displayName: 'Diagrammatic',
        icon: '🖼️',
        description: 'Requires drawing, sketching, or labeling diagrams'
    },
    listing: {
        displayName: 'Listing/Enumeration',
        icon: '📋',
        description: 'Asking for lists of properties, types, or factors'
    },
    other: {
        displayName: 'Other Patterns',
        icon: '❓',
        description: 'Other recurring question structures'
    }
};

/**
 * Classify a single question into a template type
 */
export function classifyQuestionTemplate(text: string): TemplateType {
    const lowerText = text.toLowerCase();

    // Check against signatures in priority order
    // Specific types checked before generic ones

    if (TEMPLATE_SIGNATURES.derivation.some(sig => lowerText.includes(sig))) return 'derivation';
    if (TEMPLATE_SIGNATURES.numerical.some(sig => lowerText.includes(sig))) return 'numerical';
    if (TEMPLATE_SIGNATURES.comparison.some(sig => lowerText.includes(sig))) return 'comparison';
    if (TEMPLATE_SIGNATURES.diagram.some(sig => lowerText.includes(sig))) return 'diagram';
    if (TEMPLATE_SIGNATURES.application.some(sig => lowerText.includes(sig))) return 'application';
    if (TEMPLATE_SIGNATURES.definition.some(sig => lowerText.includes(sig))) return 'definition';
    if (TEMPLATE_SIGNATURES.listing.some(sig => lowerText.includes(sig))) return 'listing';

    return 'other';
}

/**
 * Extract a structural skeleton from question text
 * e.g., "Define Thermodynamics" -> "Define [Concept]"
 */
export function extractTemplateSkeleton(text: string, type: TemplateType): string {
    // Simple heuristic: replace detected keywords with standard placeholders
    // This is a basic implementation; could be enhanced with regex or NLP later

    // For now, return a generic skeleton based on type to avoid over-promising specific structure matching
    switch (type) {
        case 'definition': return "Define [Concept] / What is [Concept]?";
        case 'derivation': return "Derive expression for [Concept]";
        case 'numerical': return "Calculate [Value] given [Parameters]";
        case 'comparison': return "Distinguish between [A] and [B]";
        case 'application': return "Explain application of [Concept]";
        case 'diagram': return "Draw and explain [System/Component]";
        case 'listing': return "List properties/types of [Concept]";
        default: return "Question Pattern regarding [Concept]";
    }
}

/**
 * Main function: Detect templates across all questions
 */
export function detectTemplates(questions: Question[]): TemplateReport {
    const templates: TemplateAnalysis[] = [];
    const validQuestions = questions.filter(q => q.fullText && q.fullText.length > 5);

    // 1. Group questions by type
    const questionsByType: Record<TemplateType, Question[]> = {
        definition: [], derivation: [], numerical: [], comparison: [],
        application: [], diagram: [], listing: [], other: []
    };

    validQuestions.forEach(q => {
        const type = classifyQuestionTemplate(q.fullText);
        if (type !== 'other') {
            questionsByType[type].push(q);
        }
    });

    // 2. Analyze each type
    (Object.keys(questionsByType) as TemplateType[]).forEach(type => {
        const typeQuestions = questionsByType[type];
        if (typeQuestions.length === 0) return;

        // Group by topic within this type
        const questionsByTopic: Record<string, Question[]> = {};
        typeQuestions.forEach(q => {
            const topic = q.topic || 'Uncategorized';
            if (!questionsByTopic[topic]) questionsByTopic[topic] = [];
            questionsByTopic[topic].push(q);
        });

        // Create topic occurrences
        const topicBreakdown: TopicTemplateOccurrence[] = Object.entries(questionsByTopic).map(([topic, qs]) => {
            const marks = qs.map(q => q.marks || 0).filter(m => m > 0);
            const avgMarks = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
            const minMark = marks.length > 0 ? Math.min(...marks) : 0;
            const maxMark = marks.length > 0 ? Math.max(...marks) : 0;

            // Get unique years (from sourcePaperId usually containing year, or extract if available)
            const uniqueYears = Array.from(new Set(qs.map(q => q.sourcePaperId)));

            return {
                topic,
                count: qs.length,
                marksRange: marks.length > 0 ? [minMark, maxMark] as [number, number] : null,
                avgMarks,
                yearsAppeared: uniqueYears,
                exampleQuestions: qs.slice(0, 2).map(q => q.fullText.substring(0, 100) + (q.fullText.length > 100 ? '...' : ''))
            };
        }).sort((a, b) => b.count - a.count); // Sort by most frequent topics

        // Only include if we have meaningful patterns (more than 1 occurrence total or spread across topics)
        if (typeQuestions.length >= 2) {
            templates.push({
                pattern: {
                    type,
                    skeleton: extractTemplateSkeleton(typeQuestions[0].fullText, type),
                    displayName: TEMPLATE_DISPLAY[type].displayName,
                    icon: TEMPLATE_DISPLAY[type].icon,
                    description: TEMPLATE_DISPLAY[type].description
                },
                totalOccurrences: typeQuestions.length,
                paperCount: new Set(typeQuestions.map(q => q.sourcePaperId)).size,
                topicBreakdown,
                recencyScore: 0 // Placeholder, requires more complex date logic
            });
        }
    });

    // 3. Sort templates by total frequency
    templates.sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    // 4. Generate Summary
    const papersAnalyzed = new Set(questions.map(q => q.sourcePaperId)).size;
    const dataQuality = determineDataQuality(papersAnalyzed, validQuestions.length);

    const mostCommon = templates.length > 0 ? templates[0].pattern.type : 'other';
    // Find strongest recurrence (specific topic in specific template)
    let maxTopicCount = 0;
    let strongestRecurrence = "None detected";

    templates.forEach(t => {
        t.topicBreakdown.forEach(tb => {
            if (tb.count > maxTopicCount) {
                maxTopicCount = tb.count;
                strongestRecurrence = `${t.pattern.displayName} in ${tb.topic}`;
            }
        });
    });

    return {
        templates,
        summary: {
            totalPatterns: templates.length,
            mostCommonType: mostCommon,
            strongestRecurrence,
            papersAnalyzed,
            questionsAnalyzed: validQuestions.length
        },
        generatedAt: Date.now(),
        dataQuality,
        disclaimer: "These are detected structural patterns, not specific question predictions. While structures recur (e.g., 'Define X'), specific content varies."
    };
}

function determineDataQuality(papers: number, questions: number): 'limited' | 'moderate' | 'good' {
    if (papers >= 4 && questions >= 40) return 'good';
    if (papers >= 2 && questions >= 15) return 'moderate';
    return 'limited';
}
