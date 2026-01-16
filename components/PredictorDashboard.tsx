import React, { useState, useMemo, useEffect } from 'react';
import { PredictionReport, TopicAnalysis, PredictedQuestion, Question } from '../types';
import { Badge, Button, Card } from './UIComponents';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import { jsPDF } from 'jspdf';
import { UncertaintyLevel, shouldShowPredictions, requiresPredictionOptIn } from '../types/uncertaintyIndex';
import CoverageRiskMap from './CoverageRiskMap';
import TemplatePatterns from './TemplatePatterns';
import { generateCoverageMap } from '../services/coverageAnalysisService';
import { detectTemplates } from '../services/templateDetectionService';
import { TemplateReport } from '../types/templateDetection';

// UI view state
type DashboardView = 'predictions' | 'coverage' | 'templates';

interface PredictorDashboardProps {
    report: PredictionReport;
    onReset: () => void;
    questions: Question[];
}

const PredictorDashboard: React.FC<PredictorDashboardProps> = ({ report, onReset, questions }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'questions'>('overview');
    const [currentView, setCurrentView] = useState<DashboardView>('predictions');
    const [showPredictionsOverride, setShowPredictionsOverride] = useState(false);

    // Computed data
    const coverageData = useMemo(() => generateCoverageMap(questions), [questions]);
    const templateReport = useMemo(() => detectTemplates(questions), [questions]);

    // Determine if we should gate features based on uncertainty
    const uncertainty = report.uncertaintyIndex;
    const isHighUncertainty = uncertainty.level === UncertaintyLevel.HIGH;
    const isMediumUncertainty = uncertainty.level === UncertaintyLevel.MEDIUM;

    // Auto-switch to coverage view if uncertainty is high (as predictions are unsafe)
    useEffect(() => {
        if (isHighUncertainty) {
            setCurrentView('coverage');
        }
    }, [isHighUncertainty]);

    const getProbabilityColor = (prob: string) => {
        switch (prob) {
            case 'High': return 'text-emerald-500 font-bold';
            case 'Medium': return 'text-amber-500 font-semibold';
            case 'Low': return 'text-slate-400';
            default: return 'text-slate-400';
        }
    };

    const downloadPrediction = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.text('Exam Prediction Report', 20, 20);

        doc.setFontSize(12);
        doc.text(`Generated on: ${new Date(report.generatedAt).toLocaleString()}`, 20, 30);

        // Strategy
        doc.setFontSize(16);
        doc.text('Strategy Advice', 20, 45);
        doc.setFontSize(12);
        const splitStrategy = doc.splitTextToSize(report.strategy, 170);
        doc.text(splitStrategy, 20, 55);

        let yPos = 55 + (splitStrategy.length * 7) + 10;

        // High Probability Topics
        doc.setFontSize(16);
        doc.text('High Probability Topics', 20, yPos);
        yPos += 10;

        doc.setFontSize(12);
        report.focusMap
            .filter(t => t.probability === 'High' || t.probability === 'Medium')
            .forEach(t => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(`• ${t.topicName} (${t.probability}) - Avg: ${t.avgMarks}`, 20, yPos);
                yPos += 7;
            });

        // Template Patterns (New Section)
        if (templateReport.templates.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            } else {
                yPos += 10;
            }

            doc.setFontSize(16);
            doc.text('Recurring Patterns', 20, yPos);
            yPos += 10;

            doc.setFontSize(12);
            templateReport.templates.slice(0, 5).forEach(t => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(`• ${t.pattern.displayName}: ${t.totalOccurrences} occurrences`, 20, yPos);
                yPos += 7;
            });
        }

        doc.save('prediction-report.pdf');
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <span>🔮</span> AI Analysis Dashboard
                    </h2>
                    <p className="text-slate-600">Based on {questions.length} historical questions</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={onReset}>
                        New Analysis
                    </Button>
                    <Button onClick={downloadPrediction} disabled={currentView === 'coverage'}>
                        Download Report 📥
                    </Button>
                </div>
            </div>

            {/* Uncertainty Warning Banner */}
            {(isHighUncertainty || isMediumUncertainty) && (
                <div className={`rounded-xl p-4 border ${isHighUncertainty ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`text-xl ${isHighUncertainty ? 'text-red-500' : 'text-amber-500'}`}>
                            {isHighUncertainty ? '⚠️' : '✋'}
                        </div>
                        <div>
                            <h4 className={`font-bold ${isHighUncertainty ? 'text-red-700' : 'text-amber-700'}`}>
                                {uncertainty.label} ({Math.round(uncertainty.score * 100)}% Uncertainty)
                            </h4>
                            <p className="text-slate-700 text-sm mt-1">
                                {uncertainty.explanation}
                            </p>
                            {isHighUncertainty && (
                                <div className="mt-3 text-sm bg-red-100 p-2 rounded text-red-800">
                                    <strong>Note:</strong> Predictive features are disabled to prevent misleading guidance.
                                    Please review the <strong>Coverage Map</strong> instead.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg w-fit border border-slate-200">
                <button
                    onClick={() => setCurrentView('coverage')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'coverage'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                >
                    🗺️ Coverage Map
                </button>
                <button
                    onClick={() => setCurrentView('templates')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'templates'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                >
                    🧩 Recurring Patterns <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded-full">NEW</span>
                </button>
                <button
                    onClick={() => setCurrentView('predictions')}
                    disabled={isHighUncertainty}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'predictions'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : isHighUncertainty
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                >
                    🔮 Predictions {isHighUncertainty && '🔒'}
                </button>
            </div>

            {/* Main Content Area */}
            <div className="min-h-[500px]">
                {/* Coverage Map View */}
                {currentView === 'coverage' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CoverageRiskMap data={coverageData} onClose={() => setCurrentView('predictions')} />
                    </div>
                )}

                {/* Template Patterns View */}
                {currentView === 'templates' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <TemplatePatterns report={templateReport} />
                    </div>
                )}

                {/* Prediction View */}
                {currentView === 'predictions' && (
                    <>
                        {/* Prediction Opt-In Gate (for Medium Uncertainty) */}
                        {isMediumUncertainty && !showPredictionsOverride ? (
                            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                                <div className="text-5xl mb-4">🛡️</div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Predictions require caution</h3>
                                <p className="text-slate-600 max-w-lg mb-6">
                                    Data quantity is moderate. AI predictions might miss edge cases.
                                    We recommend relying on the <strong>Coverage Map</strong> and <strong>Recurring Patterns</strong> first.
                                </p>
                                <div className="flex gap-4">
                                    <Button variant="secondary" onClick={() => setCurrentView('coverage')}>
                                        View Coverage Map Instead
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowPredictionsOverride(true)}>
                                        Show Predictions Anyway
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* Actual Prediction Content */
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Left Column: Stats & Strategy */}
                                <div className="space-y-6">
                                    <Card className="p-5 border-l-4 border-l-indigo-500">
                                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-slate-900">
                                            <span>🎯</span> Exam Strategy
                                        </h3>
                                        <p className="text-slate-600 leading-relaxed text-sm">
                                            {report.strategy}
                                        </p>
                                    </Card>

                                    <Card className="p-5">
                                        <h3 className="font-bold text-lg mb-4 text-slate-900">Topic Probability</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={report.focusMap.slice(0, 5)} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                                    <XAxis type="number" stroke="#64748b" />
                                                    <YAxis
                                                        dataKey="topicName"
                                                        type="category"
                                                        width={100}
                                                        tick={{ fontSize: 11, fill: '#334155' }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }}
                                                        itemStyle={{ color: '#6366f1' }}
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.8 }}
                                                    />
                                                    <Bar dataKey="probability" name="Probability" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                                        {report.focusMap.slice(0, 5).map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.probability === 'High' ? '#10b981' : entry.probability === 'Medium' ? '#f59e0b' : '#64748b'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Column: Detailed Breakdown */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Tabs */}
                                    <div className="border-b border-slate-200 flex gap-6">
                                        <button
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                            onClick={() => setActiveTab('overview')}
                                        >
                                            Priority Topics
                                        </button>
                                        <button
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'questions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                            onClick={() => setActiveTab('questions')}
                                        >
                                            Predicted Questions
                                        </button>
                                    </div>

                                    {/* Tab Content */}
                                    <div className="space-y-3">
                                        {activeTab === 'overview' && (
                                            <div className="space-y-3">
                                                {report.focusMap.map((topic, idx) => (
                                                    <Card key={idx} className="flex items-center justify-between p-4 hover:border-indigo-300 transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-semibold text-slate-900">{topic.topicName}</h4>
                                                                {topic.coverageGap && (
                                                                    <Badge color="yellow">Coverage Gap!</Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-3 text-xs text-slate-500">
                                                                <span>Avg Marks: {topic.avgMarks}</span>
                                                                <span>• Types: {topic.commonQuestionTypes.join(', ')}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`font-bold ${getProbabilityColor(topic.probability)} w-20 text-right`}>
                                                            {topic.probability}
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}

                                        {activeTab === 'questions' && (
                                            <div className="space-y-4">
                                                {report.predictedQuestions.length === 0 ? (
                                                    <Card className="p-8 text-center">
                                                        <div className="text-4xl mb-3">📝</div>
                                                        <p className="text-slate-600">No predicted questions available for this analysis.</p>
                                                    </Card>
                                                ) : (
                                                    report.predictedQuestions.map((q) => (
                                                        <Card key={q.id} className="p-4 hover:shadow-md transition-shadow">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <Badge color={q.confidence === 'high' ? 'green' : q.confidence === 'medium' ? 'yellow' : 'gray'}>
                                                                    {q.confidence.toUpperCase()} Confidence
                                                                </Badge>
                                                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                                    {q.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-800 font-medium mb-3">"{q.text}"</p>
                                                            <div className="flex justify-between items-end">
                                                                <div className="text-xs text-slate-500">
                                                                    Sources: {q.sourceTopics.join(', ')}
                                                                </div>
                                                                <div className="text-xs text-indigo-600 italic">
                                                                    Why: {q.reason}
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PredictorDashboard;
