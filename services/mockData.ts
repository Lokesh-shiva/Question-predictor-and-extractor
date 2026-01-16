import { Question, QuestionType, TopicAnalysis, PredictionReport } from '../types';
import { UncertaintyLevel } from '../types/uncertaintyIndex';
import { TemplateReport } from '../types/templateDetection';

export const MOCK_QUESTIONS: Question[] = [
    {
        id: 'mock-1',
        mainQuestionNumber: '1',
        subQuestionLabel: 'a',
        fullText: 'Define the concept of Entropy. What is its significance in thermodynamic systems?',
        marks: 5,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2023',
        topic: 'Thermodynamics',
        pageNumber: 1
    },
    {
        id: 'mock-2',
        mainQuestionNumber: '1',
        subQuestionLabel: 'b',
        fullText: 'Derive an expression for the efficiency of a Carnot engine.',
        marks: 10,
        type: 'derivation' as QuestionType,
        sourcePaperId: 'mock-paper-2023',
        topic: 'Thermodynamics',
        pageNumber: 1
    },
    {
        id: 'mock-3',
        mainQuestionNumber: '2',
        subQuestionLabel: 'a',
        fullText: 'Distinguish between isothermal and adiabatic processes.',
        marks: 5,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2023',
        topic: 'Thermodynamics',
        pageNumber: 2
    },
    {
        id: 'mock-4',
        mainQuestionNumber: '2',
        subQuestionLabel: 'b',
        fullText: 'Calculate the work done by a gas during an isothermal expansion from volume V1 to V2.',
        marks: 10,
        type: 'numerical' as QuestionType,
        sourcePaperId: 'mock-paper-2023',
        topic: 'Thermodynamics',
        pageNumber: 2
    },
    {
        id: 'mock-5',
        mainQuestionNumber: '3',
        subQuestionLabel: 'a',
        fullText: 'Define Viscosity. Explain Newton\'s law of viscosity.',
        marks: 5,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2022',
        topic: 'Fluid Mechanics',
        pageNumber: 1
    },
    {
        id: 'mock-6',
        mainQuestionNumber: '3',
        subQuestionLabel: 'b',
        fullText: 'Derive the continuity equation in Cartesian coordinates.',
        marks: 10,
        type: 'derivation' as QuestionType,
        sourcePaperId: 'mock-paper-2022',
        topic: 'Fluid Mechanics',
        pageNumber: 1
    },
    {
        id: 'mock-7',
        mainQuestionNumber: '4',
        subQuestionLabel: 'a',
        fullText: 'Compare laminar and turbulent flow.',
        marks: 5,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2022',
        topic: 'Fluid Mechanics',
        pageNumber: 2
    },
    {
        id: 'mock-8',
        mainQuestionNumber: '4',
        subQuestionLabel: 'b',
        fullText: 'What is a boundary layer? Explain with a neat diagram.',
        marks: 5,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2021',
        topic: 'Fluid Mechanics',
        pageNumber: 2
    },
    {
        id: 'mock-9',
        mainQuestionNumber: '5',
        subQuestionLabel: 'a',
        fullText: 'Draw and explain the working of a Pitot tube.',
        marks: 10,
        type: 'theory' as QuestionType,
        sourcePaperId: 'mock-paper-2021',
        topic: 'Fluid Mechanics',
        pageNumber: 3
    }
];

export const MOCK_TEMPLATE_REPORT: TemplateReport = {
    templates: [
        {
            pattern: {
                type: 'definition',
                skeleton: 'Define [Concept] / What is [Concept]?',
                displayName: 'Definition-Based',
                icon: '📝',
                description: 'Questions asking for definitions or conceptual explanations'
            },
            totalOccurrences: 3,
            paperCount: 3,
            recencyScore: 1,
            topicBreakdown: [
                {
                    topic: 'Thermodynamics',
                    count: 1,
                    marksRange: [5, 5] as [number, number],
                    avgMarks: 5,
                    yearsAppeared: ['mock-paper-2023'],
                    exampleQuestions: ['Define the concept of Entropy. What is its significance in thermodynamic systems?']
                },
                {
                    topic: 'Fluid Mechanics',
                    count: 2,
                    marksRange: [5, 5] as [number, number],
                    avgMarks: 5,
                    yearsAppeared: ['mock-paper-2022', 'mock-paper-2021'],
                    exampleQuestions: ['Define Viscosity. Explain Newton\'s law of viscosity.']
                }
            ]
        },
        {
            pattern: {
                type: 'derivation',
                skeleton: 'Derive expression for [Concept]',
                displayName: 'Derivation-Style',
                icon: '📐',
                description: 'Questions requiring mathematical proof or formula derivation'
            },
            totalOccurrences: 2,
            paperCount: 2,
            recencyScore: 1,
            topicBreakdown: [
                {
                    topic: 'Thermodynamics',
                    count: 1,
                    marksRange: [10, 10] as [number, number],
                    avgMarks: 10,
                    yearsAppeared: ['mock-paper-2023'],
                    exampleQuestions: ['Derive an expression for the efficiency of a Carnot engine.']
                },
                {
                    topic: 'Fluid Mechanics',
                    count: 1,
                    marksRange: [10, 10] as [number, number],
                    avgMarks: 10,
                    yearsAppeared: ['mock-paper-2022'],
                    exampleQuestions: ['Derive the continuity equation in Cartesian coordinates.']
                }
            ]
        },
        {
            pattern: {
                type: 'comparison',
                skeleton: 'Distinguish between [A] and [B]',
                displayName: 'Comparison',
                icon: '⚖️',
                description: 'Questions asking to contrast two or more concepts'
            },
            totalOccurrences: 2,
            paperCount: 2,
            recencyScore: 1,
            topicBreakdown: [
                {
                    topic: 'Thermodynamics',
                    count: 1,
                    marksRange: [5, 5] as [number, number],
                    avgMarks: 5,
                    yearsAppeared: ['mock-paper-2023'],
                    exampleQuestions: ['Distinguish between isothermal and adiabatic processes.']
                },
                {
                    topic: 'Fluid Mechanics',
                    count: 1,
                    marksRange: [5, 5] as [number, number],
                    avgMarks: 5,
                    yearsAppeared: ['mock-paper-2022'],
                    exampleQuestions: ['Compare laminar and turbulent flow.']
                }
            ]
        }
    ],
    summary: {
        totalPatterns: 3,
        mostCommonType: 'definition',
        strongestRecurrence: 'Definition-Based in Fluid Mechanics',
        papersAnalyzed: 3,
        questionsAnalyzed: 9
    },
    generatedAt: Date.now(),
    dataQuality: 'good',
    disclaimer: "These are detected structural patterns, not specific question predictions. While structures recur (e.g., 'Define X'), specific content varies."
};

export const MOCK_PREDICTION_REPORT: PredictionReport = {
    generatedAt: Date.now(),
    focusMap: [
        {
            topicName: 'Thermodynamics',
            probability: 'High',
            avgMarks: '8-10M',
            commonQuestionTypes: ['Definition', 'Derivation'],
            trend: 'stable',
            coverageGap: false
        },
        {
            topicName: 'Fluid Mechanics',
            probability: 'Medium',
            avgMarks: '5-10M',
            commonQuestionTypes: ['Definition', 'Diagram'],
            trend: 'rising',
            coverageGap: false
        }
    ],
    predictedQuestions: [],
    strategy: 'Focus on Thermodynamics and Fluid Mechanics definitions and derivations.',
    uncertaintyIndex: {
        level: UncertaintyLevel.LOW,
        score: 0.2,
        signals: { sparsity: 0.1, variance: 0.15, conflict: 0.1 },
        explanation: 'Sufficient data for analysis.',
        label: 'Low Uncertainty'
    }
};
