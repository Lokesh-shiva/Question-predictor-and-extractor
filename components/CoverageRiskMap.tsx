/**
 * Coverage & Risk Map Component
 * 
 * Visualizes topic coverage from historical exam data.
 * Shows frequency, recency, and omission risk—not predictions.
 */

import React, { useState, useMemo } from 'react';
import { CoverageRiskMapData, TopicCoverage, GapAlert, CoverageStatus } from '../types/coverageRiskMap';
import { groupTopicsByStatus } from '../services/coverageAnalysisService';
import { Card, Badge, Button } from './UIComponents';

interface CoverageRiskMapProps {
    data: CoverageRiskMapData;
    onClose?: () => void;
}

/**
 * Frequency bar visualization
 */
const FrequencyBar: React.FC<{ frequency: number; appearances: number; total: number }> = ({
    frequency,
    appearances,
    total,
}) => {
    const percent = Math.round(frequency * 100);
    const getColor = () => {
        if (percent >= 60) return 'bg-emerald-500';
        if (percent >= 30) return 'bg-amber-500';
        return 'bg-slate-400';
    };

    return (
        <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getColor()} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-slate-600 whitespace-nowrap">
                {appearances}/{total} papers
            </span>
        </div>
    );
};

/**
 * Topic card component
 */
const TopicCard: React.FC<{ topic: TopicCoverage }> = ({ topic }) => {
    const { metrics, status, statusIcon, statusLabel, shortReason, actionAdvice } = topic;

    const borderColors: Record<CoverageStatus, string> = {
        'well-covered': 'border-l-emerald-500',
        'steady': 'border-l-blue-500',
        'undercovered': 'border-l-slate-400',
        'gap-alert': 'border-l-red-500',
    };

    const bgColors: Record<CoverageStatus, string> = {
        'well-covered': 'bg-white',
        'steady': 'bg-white',
        'undercovered': 'bg-slate-50',
        'gap-alert': 'bg-red-50',
    };

    return (
        <div className={`p-4 rounded-lg border border-l-4 ${borderColors[status]} ${bgColors[status]} hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{statusIcon}</span>
                        <h4 className="font-semibold text-slate-900 truncate">{metrics.topicName}</h4>
                    </div>

                    <FrequencyBar
                        frequency={metrics.frequency}
                        appearances={metrics.totalAppearances}
                        total={metrics.totalPapers}
                    />

                    <p className="text-xs text-slate-600 mt-2">{shortReason}</p>

                    {/* Marks and question types */}
                    <div className="flex flex-wrap gap-2 mt-2">
                        {metrics.avgMarks !== null && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                Avg: {metrics.avgMarks}M
                            </span>
                        )}
                        {metrics.marksRange && metrics.marksRange[0] !== metrics.marksRange[1] && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                Range: {metrics.marksRange[0]}-{metrics.marksRange[1]}M
                            </span>
                        )}
                        {metrics.questionTypes.slice(0, 2).map((type, i) => (
                            <span key={i} className="text-xs bg-indigo-100 px-2 py-0.5 rounded text-indigo-700">
                                {type}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className={`text-xs font-medium px-2 py-1 rounded ${status === 'gap-alert' ? 'bg-red-100 text-red-800' :
                        status === 'well-covered' ? 'bg-emerald-100 text-emerald-800' :
                            status === 'steady' ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-700'
                        }`}>
                        {statusLabel}
                    </div>
                    {metrics.yearsAppeared.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                            Last: {metrics.yearsAppeared[0]}
                        </p>
                    )}
                </div>
            </div>

            {/* Action advice */}
            <div className="mt-3 pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-600 italic">
                    💡 {actionAdvice}
                </p>
            </div>
        </div>
    );
};

/**
 * Gap alert callout
 */
const GapAlertCard: React.FC<{ alert: GapAlert }> = ({ alert }) => {
    return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg border-l-4 border-l-red-500">
            <div className="flex items-start gap-2">
                <span className="text-lg">🔴</span>
                <div className="flex-1">
                    <h5 className="font-semibold text-red-900">{alert.topicName}</h5>
                    <p className="text-xs text-red-700 mt-1">{alert.reason}</p>
                    <div className="flex gap-3 mt-2 text-xs text-red-600">
                        <span>Last seen: {alert.lastSeen}</span>
                        <span>•</span>
                        <span>{alert.historicalFrequency}</span>
                    </div>
                </div>
                {alert.urgency === 'high' && (
                    <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-medium">
                        High Priority
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * Summary panel
 */
const SummaryPanel: React.FC<{ summary: CoverageRiskMapData['summary'] }> = ({ summary }) => {
    const qualityColors = {
        good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        moderate: 'bg-amber-100 text-amber-800 border-amber-200',
        limited: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                📊 Coverage Summary
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-2xl font-bold text-emerald-600">{summary.wellCoveredCount}</div>
                    <div className="text-xs text-slate-600">Frequently Tested</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-2xl font-bold text-blue-600">{summary.steadyCount}</div>
                    <div className="text-xs text-slate-600">Regularly Tested</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-2xl font-bold text-slate-600">{summary.undercoveredCount}</div>
                    <div className="text-xs text-slate-600">Rarely Tested</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-2xl font-bold text-red-600">{summary.gapAlertCount}</div>
                    <div className="text-xs text-slate-600">Gap Alerts</div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">{summary.summaryText}</p>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${qualityColors[summary.dataQuality]}`}>
                    {summary.dataQuality === 'good' ? 'Good Data' :
                        summary.dataQuality === 'moderate' ? 'Moderate Data' : 'Limited Data'}
                </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                Based on {summary.questionsAnalyzed} questions from {summary.papersAnalyzed} papers
            </div>
        </div>
    );
};

/**
 * Section header with collapse toggle
 */
const SectionHeader: React.FC<{
    icon: string;
    title: string;
    count: number;
    color: string;
    isOpen: boolean;
    onToggle: () => void;
}> = ({ icon, title, count, color, isOpen, onToggle }) => (
    <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 rounded-lg border ${color} hover:shadow-sm transition-shadow`}
    >
        <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="font-semibold">{title}</span>
            <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">{count}</span>
        </div>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
    </button>
);

/**
 * Main Coverage & Risk Map component
 */
const CoverageRiskMap: React.FC<CoverageRiskMapProps> = ({ data, onClose }) => {
    const [openSections, setOpenSections] = useState<Record<CoverageStatus, boolean>>({
        'gap-alert': true,
        'well-covered': true,
        'steady': false,
        'undercovered': false,
    });

    const groupedTopics = useMemo(() => groupTopicsByStatus(data.topics), [data.topics]);

    const toggleSection = (status: CoverageStatus) => {
        setOpenSections(prev => ({ ...prev, [status]: !prev[status] }));
    };

    const sectionConfig: { status: CoverageStatus; icon: string; title: string; color: string }[] = [
        { status: 'gap-alert', icon: '🔴', title: 'Watch These Topics', color: 'bg-red-50 border-red-200 text-red-900' },
        { status: 'well-covered', icon: '📗', title: 'Frequently Tested', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
        { status: 'steady', icon: '📘', title: 'Regularly Tested', color: 'bg-blue-50 border-blue-200 text-blue-900' },
        { status: 'undercovered', icon: '📙', title: 'Rarely Tested', color: 'bg-slate-50 border-slate-200 text-slate-900' },
    ];

    if (data.topics.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Coverage Data</h3>
                <p className="text-slate-500">Upload and extract exam papers to see coverage analysis.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Coverage & Risk Map</h2>
                            <p className="text-indigo-100 text-sm max-w-xl">
                                Based on historical exam patterns—not predictions.
                                Use this to understand topic frequency and identify gaps in your preparation.
                            </p>
                        </div>
                        {onClose && (
                            <Button variant="outline" className="text-white border-indigo-400" onClick={onClose}>
                                Back
                            </Button>
                        )}
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-4 bg-indigo-800/50 rounded-lg p-3 border border-indigo-600">
                        <p className="text-xs text-indigo-200">
                            ⚠️ <strong>Not predictions:</strong> This shows historical patterns only.
                            Exam content varies—treat this as study guidance, not certainty.
                        </p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500 rounded-full opacity-20 blur-3xl" />
            </div>

            {/* Summary */}
            <SummaryPanel summary={data.summary} />

            {/* Gap Alerts Section (if any) */}
            {data.gapAlerts.length > 0 && (
                <div className="bg-red-50/50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                        ⚠️ Gap Alerts
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                            {data.gapAlerts.length}
                        </span>
                    </h3>
                    <p className="text-sm text-red-700 mb-4">
                        These topics were historically important but haven't appeared recently. Consider reviewing them.
                    </p>
                    <div className="grid gap-3">
                        {data.gapAlerts.map((alert, i) => (
                            <GapAlertCard key={i} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Topic Sections */}
            <div className="space-y-4">
                {sectionConfig.map(({ status, icon, title, color }) => {
                    const topics = groupedTopics[status];
                    if (topics.length === 0) return null;

                    return (
                        <div key={status}>
                            <SectionHeader
                                icon={icon}
                                title={title}
                                count={topics.length}
                                color={color}
                                isOpen={openSections[status]}
                                onToggle={() => toggleSection(status)}
                            />
                            {openSections[status] && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {topics.map((topic, i) => (
                                        <TopicCard key={i} topic={topic} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer tip */}
            <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-700">
                💡 <strong>Tip:</strong> Focus on "Watch These Topics" and "Frequently Tested" areas first.
                Don't ignore rarely tested topics entirely—exams can surprise you.
            </div>
        </div>
    );
};

export default CoverageRiskMap;
