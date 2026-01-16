/**
 * Artifact Selector Component
 * 
 * A picker for selecting extraction artifacts to use in the Predictor.
 * Supports multi-select and shows only complete artifacts.
 */

import React, { useState, useEffect } from 'react';
import { ExtractionArtifact } from '../types/artifact';
import { SelectedArtifactInfo } from '../types/predictor';
import { getCompleteArtifacts } from '../services/artifactService';
import { Button, Modal } from './UIComponents';

interface ArtifactSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedArtifacts: ExtractionArtifact[]) => void;
    /** Already selected artifact IDs (for editing selection) */
    initialSelection?: string[];
}

export const ArtifactSelector: React.FC<ArtifactSelectorProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialSelection = [],
}) => {
    const [artifacts, setArtifacts] = useState<ExtractionArtifact[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelection));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadArtifacts();
            setSelectedIds(new Set(initialSelection));
        }
    }, [isOpen, initialSelection]);

    const loadArtifacts = async () => {
        setLoading(true);
        try {
            const complete = await getCompleteArtifacts();
            // Sort by newest first
            complete.sort((a, b) => b.createdAt - a.createdAt);
            setArtifacts(complete);
        } catch (err) {
            console.error('Failed to load artifacts:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(artifacts.map(a => a.id)));
    };

    const clearAll = () => {
        setSelectedIds(new Set());
    };

    const handleConfirm = () => {
        const selected = artifacts.filter(a => selectedIds.has(a.id));
        onConfirm(selected);
    };

    const totalQuestions = artifacts
        .filter(a => selectedIds.has(a.id))
        .reduce((sum, a) => sum + a.extraction.questions.length, 0);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const isExpiringSoon = (expiresAt: number | null) => {
        if (expiresAt === null) return false;
        const daysLeft = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        return daysLeft <= 2;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Select Extraction Artifacts</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Choose papers to analyze for pattern prediction
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Selection Actions */}
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={selectAll}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            onClick={clearAll}
                            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                        >
                            Clear All
                        </button>
                    </div>
                    <div className="text-sm">
                        <span className="text-slate-500">Selected: </span>
                        <span className="font-medium text-indigo-600">{selectedIds.size} artifacts</span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span className="font-medium text-emerald-600">{totalQuestions} questions</span>
                    </div>
                </div>

                {/* Artifact List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : artifacts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-4xl mb-3">📭</div>
                            <p className="text-slate-600 font-medium">No extraction artifacts found</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Use the Extractor module to extract questions from papers first.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {artifacts.map((artifact) => (
                                <label
                                    key={artifact.id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedIds.has(artifact.id)
                                            ? 'border-indigo-500 bg-indigo-50/50'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(artifact.id)
                                            ? 'bg-indigo-600 border-indigo-600'
                                            : 'border-slate-300'
                                        }`}>
                                        {selectedIds.has(artifact.id) && (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-white">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(artifact.id)}
                                        onChange={() => toggleSelection(artifact.id)}
                                        className="sr-only"
                                    />

                                    {/* Artifact Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-900 truncate">
                                                {artifact.sourceFile.name}
                                            </span>
                                            {artifact.locked && (
                                                <span className="text-amber-500" title="Locked">🔒</span>
                                            )}
                                            {isExpiringSoon(artifact.expiresAt) && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                                    Expiring soon
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                            <span>{formatDate(artifact.createdAt)}</span>
                                            <span>•</span>
                                            <span className="font-medium text-slate-700">
                                                {artifact.extraction.questions.length} questions
                                            </span>
                                        </div>
                                    </div>

                                    {/* Question count badge */}
                                    <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-700">
                                        {artifact.extraction.questions.length}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        Tip: Select multiple papers from different years for better pattern analysis
                    </p>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirm Selection ({totalQuestions} questions)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtifactSelector;
