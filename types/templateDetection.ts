/**
 * Template Detection Types
 * 
 * Defines types for structural pattern detection in questions.
 * Focuses on identifying recurring question formats (not content).
 */

// Template type classification
export type TemplateType =
    | 'definition'
    | 'derivation'
    | 'numerical'
    | 'comparison'
    | 'application'
    | 'diagram'
    | 'listing'
    | 'other';

// A detected template pattern
export interface TemplatePattern {
    type: TemplateType;
    skeleton: string;           // e.g., "Define [TOPIC]"
    displayName: string;        // e.g., "Definition Questions"
    icon: string;               // e.g., "📝"
    description: string;        // User-facing description of this pattern type
}

// Topic-specific template occurrence
export interface TopicTemplateOccurrence {
    topic: string;
    count: number;
    marksRange: [number, number] | null;
    avgMarks: number | null;
    yearsAppeared: string[];
    exampleQuestions: string[];  // 1-2 sanitized examples
}

// Complete template analysis for a pattern type
export interface TemplateAnalysis {
    pattern: TemplatePattern;
    totalOccurrences: number;
    paperCount: number;
    topicBreakdown: TopicTemplateOccurrence[];
    recencyScore: number;       // 0-1, higher = appeared recently
}

// Summary statistics for templates
export interface TemplateSummary {
    totalPatterns: number;
    mostCommonType: TemplateType;
    strongestRecurrence: string;  // e.g., "Numerical problems in Thermodynamics"
    papersAnalyzed: number;
    questionsAnalyzed: number;
}

// Complete template report
export interface TemplateReport {
    templates: TemplateAnalysis[];
    summary: TemplateSummary;
    generatedAt: number;
    dataQuality: 'limited' | 'moderate' | 'good';
    disclaimer: string;
}
