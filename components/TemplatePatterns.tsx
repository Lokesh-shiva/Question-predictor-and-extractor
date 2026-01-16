/**
 * TemplatePatterns Component
 * 
 * Displays recurring question structures grouped by template type.
 * Emphasizes transparency: "Structures recur, content varies".
 */

import React, { useState } from 'react';
import { TemplateReport, TemplateAnalysis, TopicTemplateOccurrence } from '../types/templateDetection';
import { Card, Badge } from './UIComponents';

interface TemplatePatternsProps {
    report: TemplateReport;
}

const TemplatePatterns: React.FC<TemplatePatternsProps> = ({ report }) => {
    const [expandedType, setExpandedType] = useState<string | null>(
        report.templates.length > 0 ? report.templates[0].pattern.type : null
    );

    const toggleExpand = (type: string) => {
        setExpandedType(expandedType === type ? null : type);
    };

    if (!report || report.templates.length === 0) {
        return (
            <Card className="p-8 text-center">
                <div className="text-5xl mb-4">🧩</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Patterns Detected Yet</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                    We need more exam papers to identify recurring question structures reliably.
                    Upload at least 2-3 papers to unlock this feature.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Transparency Header */}
            <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
                <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        💡
                    </div>
                    <div>
                        <h3 className="font-bold text-indigo-900 text-lg">About Question Templates</h3>
                        <p className="text-slate-600 mt-1 leading-relaxed">
                            {report.disclaimer} These patterns identify <strong className="text-indigo-700">how</strong> questions are asked (the structure),
                            which often repeats even when the specific <strong className="text-indigo-700">content</strong> changes.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total Patterns"
                    value={report.summary.totalPatterns.toString()}
                    icon="🧩"
                    color="indigo"
                />
                <StatCard
                    label="Top Pattern"
                    value={report.summary.mostCommonType ?
                        report.summary.mostCommonType.charAt(0).toUpperCase() + report.summary.mostCommonType.slice(1)
                        : '—'}
                    icon="📈"
                    color="emerald"
                />
                <StatCard
                    label="Strongest Match"
                    value={report.summary.strongestRecurrence || '—'}
                    icon="🏆"
                    color="amber"
                    highlight
                />
                <StatCard
                    label="Data Quality"
                    value={report.dataQuality === 'good' ? 'High' : report.dataQuality === 'moderate' ? 'Moderate' : 'Low'}
                    icon={report.dataQuality === 'good' ? '🟢' : report.dataQuality === 'moderate' ? '🟡' : '🟠'}
                    color={report.dataQuality === 'good' ? 'emerald' : report.dataQuality === 'moderate' ? 'amber' : 'red'}
                />
            </div>

            {/* Templates List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span>📚</span> Detected Patterns
                </h3>
                {report.templates.map((template) => (
                    <TemplateCard
                        key={template.pattern.type}
                        template={template}
                        isExpanded={expandedType === template.pattern.type}
                        onToggle={() => toggleExpand(template.pattern.type)}
                    />
                ))}
            </div>
        </div>
    );
};

// Sub-components

interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    color: 'indigo' | 'emerald' | 'amber' | 'red';
    highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, highlight = false }) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        red: 'bg-red-50 border-red-200 text-red-700',
    };

    const valueColorClasses = {
        indigo: 'text-indigo-900',
        emerald: 'text-emerald-900',
        amber: 'text-amber-900',
        red: 'text-red-900',
    };

    return (
        <Card className={`p-4 ${highlight ? 'ring-2 ring-amber-300 shadow-md' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className={`font-bold text-lg truncate ${valueColorClasses[color]}`} title={value}>
                {value}
            </div>
        </Card>
    );
};

interface TemplateCardProps {
    template: TemplateAnalysis;
    isExpanded: boolean;
    onToggle: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, isExpanded, onToggle }) => {
    const { pattern, totalOccurrences, topicBreakdown, paperCount } = template;

    // Color mapping for different template types
    const typeColors: Record<string, { bg: string; text: string; border: string; badge: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }> = {
        definition: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'blue' },
        derivation: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'blue' },
        numerical: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'green' },
        comparison: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'yellow' },
        application: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'yellow' },
        diagram: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', badge: 'red' },
        listing: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'gray' },
    };

    const colors = typeColors[pattern.type] || typeColors.listing;

    return (
        <Card className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-300 shadow-lg' : 'hover:shadow-md'}`}>
            {/* Clickable Header */}
            <div
                className={`p-5 flex items-center justify-between cursor-pointer group transition-colors ${isExpanded ? colors.bg : 'hover:bg-slate-50'}`}
                onClick={onToggle}
            >
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors.bg} ${colors.border} border-2`}>
                        {pattern.icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-lg flex items-center gap-3">
                            {pattern.displayName}
                            <Badge color={colors.badge}>
                                {totalOccurrences}x found
                            </Badge>
                        </h4>
                        <p className="text-slate-500 text-sm mt-1">
                            Found across <strong className="text-slate-700">{paperCount} papers</strong> • {pattern.description}
                        </p>
                    </div>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'} transition-colors`}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-100">
                    <div className="p-5 bg-slate-50/50">
                        <h5 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span>📊</span> Topic Breakdown for "{pattern.skeleton}"
                        </h5>

                        <div className="space-y-3">
                            {topicBreakdown.map((item, idx) => (
                                <TopicRow key={`${item.topic}-${idx}`} item={item} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

interface TopicRowProps {
    item: TopicTemplateOccurrence;
}

const TopicRow: React.FC<TopicRowProps> = ({ item }) => {
    return (
        <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="font-semibold text-slate-800">
                    📖 {item.topic}
                </div>
                <div className="flex items-center gap-2">
                    {item.marksRange && (
                        <Badge color="blue">
                            {item.marksRange[0] === item.marksRange[1]
                                ? `${item.marksRange[0]} Marks`
                                : `${item.marksRange[0]}-${item.marksRange[1]} Marks`}
                        </Badge>
                    )}
                    <Badge color="green">
                        {item.count} {item.count === 1 ? 'occurrence' : 'occurrences'}
                    </Badge>
                </div>
            </div>

            {item.exampleQuestions.length > 0 && (
                <div className="mt-3 bg-indigo-50 rounded-lg p-3 border-l-4 border-indigo-400">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Example Question</p>
                    <p className="text-slate-700 italic">
                        "{item.exampleQuestions[0]}"
                    </p>
                </div>
            )}
        </div>
    );
};

export default TemplatePatterns;
