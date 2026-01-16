/**
 * Artifact Manager Component
 * 
 * Visual UI for managing extraction artifacts:
 * - View all artifacts with status badges
 * - Select artifacts for use
 * - Delete, lock, or export artifacts
 * - Toggle replay mode
 */

import React, { useState, useEffect } from 'react';
import { ExtractionArtifact, ArtifactStatus } from '../types/artifact';
import {
    getAllArtifacts,
    getStorageStats,
    deleteArtifact,
    lockArtifact,
    unlockArtifact,
    isReplayModeEnabled,
    setReplayMode,
} from '../services/artifactService';
import { exportArtifactAsJSON } from '../services/artifactStorage';

interface ArtifactManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onArtifactSelect?: (artifact: ExtractionArtifact) => void;
    onArtifactsChange?: () => void;
}

const statusColors: Record<ArtifactStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    extracting: 'bg-blue-100 text-blue-800 border-blue-200',
    complete: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons: Record<ArtifactStatus, string> = {
    pending: '⏳',
    extracting: '🔄',
    complete: '✅',
    error: '❌',
};

export const ArtifactManager: React.FC<ArtifactManagerProps> = ({
    isOpen,
    onClose,
    onArtifactSelect,
    onArtifactsChange,
}) => {
    const [artifacts, setArtifacts] = useState<ExtractionArtifact[]>([]);
    const [stats, setStats] = useState({ count: 0, completeCount: 0, totalQuestions: 0 });
    const [replayMode, setReplayModeState] = useState(isReplayModeEnabled());
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'complete' | 'error'>('all');

    const loadArtifacts = async () => {
        setLoading(true);
        try {
            const all = await getAllArtifacts();
            const storageStats = await getStorageStats();

            // Sort by createdAt descending (newest first)
            all.sort((a, b) => b.createdAt - a.createdAt);

            setArtifacts(all);
            setStats(storageStats);
        } catch (err) {
            console.error('Failed to load artifacts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadArtifacts();
        }
    }, [isOpen]);

    const handleDelete = async (id: string) => {
        if (confirm('Delete this artifact? This cannot be undone.')) {
            const deleted = await deleteArtifact(id, false);
            if (deleted) {
                await loadArtifacts();
                onArtifactsChange?.();
            } else {
                alert('Cannot delete locked artifact. Unlock it first.');
            }
        }
    };

    const handleLockToggle = async (artifact: ExtractionArtifact) => {
        if (artifact.locked) {
            await unlockArtifact(artifact.id);
        } else {
            await lockArtifact(artifact.id);
        }
        await loadArtifacts();
    };

    const handleExport = (artifact: ExtractionArtifact) => {
        const json = exportArtifactAsJSON(artifact);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `artifact_${artifact.sourceFile.name.replace(/\.[^/.]+$/, '')}_${artifact.id.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleReplayModeToggle = () => {
        const newValue = !replayMode;
        setReplayMode(newValue);
        setReplayModeState(newValue);
    };

    const filteredArtifacts = artifacts.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'complete') return a.extraction.status === 'complete';
        if (filter === 'error') return a.extraction.status === 'error';
        return true;
    });

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatTTL = (expiresAt: number | null) => {
        if (expiresAt === null) return 'Never';
        const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        if (days <= 0) return 'Expired';
        return `${days} day${days > 1 ? 's' : ''}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Extraction Artifacts</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {stats.count} artifacts • {stats.totalQuestions} questions cached
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

                {/* Toolbar */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Show:</span>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                            {(['all', 'complete', 'error'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === f
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Replay Mode Toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">Dev Replay:</span>
                        <button
                            onClick={handleReplayModeToggle}
                            className={`relative w-12 h-6 rounded-full transition-colors ${replayMode ? 'bg-green-500' : 'bg-slate-300'
                                }`}
                        >
                            <span
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${replayMode ? 'left-7' : 'left-1'
                                    }`}
                            />
                        </button>
                        {replayMode && (
                            <span className="text-xs text-green-600 font-medium">Active - No API calls</span>
                        )}
                    </div>
                </div>

                {/* Artifact List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredArtifacts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-4xl mb-3">📦</div>
                            <p className="text-slate-600">No artifacts found</p>
                            <p className="text-sm text-slate-400 mt-1">Upload files to create extraction artifacts</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredArtifacts.map((artifact) => (
                                <div
                                    key={artifact.id}
                                    className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${artifact.locked ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-slate-900 truncate">
                                                    {artifact.sourceFile.name}
                                                </span>
                                                {artifact.locked && (
                                                    <span className="text-amber-600" title="Locked">🔒</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span>{formatDate(artifact.createdAt)}</span>
                                                <span>•</span>
                                                <span>{(artifact.sourceFile.sizeBytes / 1024).toFixed(1)} KB</span>
                                                <span>•</span>
                                                <span>TTL: {formatTTL(artifact.expiresAt)}</span>
                                            </div>

                                            {/* Extraction Stats */}
                                            {artifact.extraction.status === 'complete' && (
                                                <div className="flex items-center gap-4 mt-2 text-sm">
                                                    <span className="text-slate-600">
                                                        <strong>{artifact.extraction.questions.length}</strong> questions
                                                    </span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-slate-600">
                                                        Confidence: <strong>{(artifact.extraction.confidence.overall * 100).toFixed(0)}%</strong>
                                                    </span>
                                                    {artifact.extraction.durationMs && (
                                                        <>
                                                            <span className="text-slate-400">•</span>
                                                            <span className="text-slate-500">
                                                                {(artifact.extraction.durationMs / 1000).toFixed(1)}s
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {artifact.extraction.status === 'error' && artifact.extraction.error && (
                                                <div className="mt-2 text-sm text-red-600">
                                                    {artifact.extraction.error.message}
                                                    {artifact.extraction.error.retryable && (
                                                        <span className="ml-2 text-slate-500">(Retryable)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Badge */}
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[artifact.extraction.status]}`}>
                                            {statusIcons[artifact.extraction.status]} {artifact.extraction.status}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                        {onArtifactSelect && artifact.extraction.status === 'complete' && (
                                            <button
                                                onClick={() => onArtifactSelect(artifact)}
                                                className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                Use Questions
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleLockToggle(artifact)}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            {artifact.locked ? 'Unlock' : 'Lock'}
                                        </button>
                                        <button
                                            onClick={() => handleExport(artifact)}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Export JSON
                                        </button>
                                        <button
                                            onClick={() => handleDelete(artifact.id)}
                                            disabled={artifact.locked}
                                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Delete
                                        </button>
                                        <div className="flex-1"></div>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {artifact.id.slice(0, 8)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Artifacts persist across refreshes for up to 7 days (or until locked)
                        </span>
                        <button
                            onClick={loadArtifacts}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtifactManager;
