import React, { useState } from 'react';
import { UncertaintyIndex, UncertaintyLevel } from '../types/uncertaintyIndex';

interface UncertaintyBadgeProps {
    uncertainty: UncertaintyIndex;
    showDetails?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Visual badge component for displaying uncertainty level
 */
const UncertaintyBadge: React.FC<UncertaintyBadgeProps> = ({
    uncertainty,
    showDetails = false,
    size = 'md'
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Color schemes for each level
    const colorScheme = {
        [UncertaintyLevel.LOW]: {
            bg: 'bg-emerald-100',
            border: 'border-emerald-300',
            text: 'text-emerald-800',
            icon: '🟢',
            glow: 'shadow-emerald-200'
        },
        [UncertaintyLevel.MEDIUM]: {
            bg: 'bg-amber-100',
            border: 'border-amber-300',
            text: 'text-amber-800',
            icon: '🟡',
            glow: 'shadow-amber-200'
        },
        [UncertaintyLevel.HIGH]: {
            bg: 'bg-red-100',
            border: 'border-red-300',
            text: 'text-red-800',
            icon: '🔴',
            glow: 'shadow-red-200'
        }
    };

    const colors = colorScheme[uncertainty.level];

    // Size variants
    const sizeClass = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base'
    }[size];

    return (
        <div className="inline-flex flex-col">
            {/* Main Badge */}
            <button
                onClick={() => showDetails && setIsExpanded(!isExpanded)}
                className={`
                    inline-flex items-center gap-1.5 rounded-full border font-medium
                    ${colors.bg} ${colors.border} ${colors.text} ${sizeClass}
                    ${showDetails ? 'cursor-pointer hover:shadow-md transition-shadow' : 'cursor-default'}
                `}
                title={uncertainty.explanation}
            >
                <span className="text-sm">{colors.icon}</span>
                <span>{uncertainty.label}</span>
                {showDetails && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            {/* Expanded Details Panel */}
            {showDetails && isExpanded && (
                <div className={`
                    mt-2 p-4 rounded-lg border ${colors.bg} ${colors.border}
                    text-sm max-w-sm
                `}>
                    <p className={`${colors.text} mb-3`}>{uncertainty.explanation}</p>

                    {/* Signal Breakdown */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Data completeness</span>
                            <SignalBar value={1 - uncertainty.signals.sparsity} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Pattern consistency</span>
                            <SignalBar value={1 - uncertainty.signals.variance} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Signal clarity</span>
                            <SignalBar value={1 - uncertainty.signals.conflict} />
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-xs text-slate-500">
                            Confidence score: {Math.round((1 - uncertainty.score) * 100)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Small horizontal bar indicator for signal strength
 */
const SignalBar: React.FC<{ value: number }> = ({ value }) => {
    const percent = Math.round(value * 100);
    const getColor = () => {
        if (percent >= 70) return 'bg-emerald-500';
        if (percent >= 40) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getColor()} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-slate-500 w-8">{percent}%</span>
        </div>
    );
};

/**
 * Prominent warning banner for high uncertainty
 */
export const HighUncertaintyBanner: React.FC<{
    uncertainty: UncertaintyIndex;
    className?: string;
}> = ({ uncertainty, className = '' }) => {
    if (uncertainty.level !== UncertaintyLevel.HIGH) return null;

    return (
        <div className={`
            bg-gradient-to-r from-amber-50 to-red-50 
            border border-amber-300 rounded-xl p-4
            ${className}
        `}>
            <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div>
                    <h4 className="font-semibold text-amber-900 mb-1">
                        Limited Data Available
                    </h4>
                    <p className="text-amber-800 text-sm">
                        {uncertainty.explanation}
                    </p>
                    <p className="text-amber-700 text-xs mt-2">
                        Only coverage analysis and risk areas are shown. Specific predictions
                        are hidden because the data is insufficient for reliable forecasting.
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Medium uncertainty toggle warning
 */
export const MediumUncertaintyToggle: React.FC<{
    uncertainty: UncertaintyIndex;
    isShowing: boolean;
    onToggle: () => void;
}> = ({ uncertainty, isShowing, onToggle }) => {
    if (uncertainty.level !== UncertaintyLevel.MEDIUM) return null;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <span className="text-amber-800 text-sm">
                        Predictions may be less reliable due to {
                            uncertainty.signals.sparsity > 0.5
                                ? 'limited data'
                                : 'pattern variability'
                        }.
                    </span>
                </div>
                <button
                    onClick={onToggle}
                    className="text-amber-700 hover:text-amber-900 text-sm font-medium underline"
                >
                    {isShowing ? 'Hide predictions' : 'Show anyway'}
                </button>
            </div>
        </div>
    );
};

export default UncertaintyBadge;
