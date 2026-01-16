/**
 * RAG Search Component
 * 
 * Provides a semantic search interface for finding similar questions
 * using the RAG backend.
 */

import React, { useState } from 'react';
import { ragService, QueryResult, QueryFilters } from '../services/ragService';

interface RAGSearchProps {
    onResultSelect?: (result: QueryResult) => void;
}

const RAGSearch: React.FC<RAGSearchProps> = ({ onResultSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<QueryResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [queryTime, setQueryTime] = useState<number | null>(null);
    const [totalDocs, setTotalDocs] = useState<number>(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        setError(null);

        try {
            const response = await ragService.query(query, 5);
            setResults(response.results);
            setQueryTime(response.query_time_ms);
            setTotalDocs(response.total_documents);
        } catch (err: any) {
            setError(err.message || 'Search failed');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <span className="font-semibold text-slate-800">RAG Semantic Search</span>
                    {totalDocs > 0 && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {totalDocs} indexed
                        </span>
                    )}
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 border-t border-slate-100">
                    {/* Search Input */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Search for similar questions... (e.g., 'entropy calculation')"
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !query.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            {isSearching ? (
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : 'Search'}
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                <span>Found {results.length} similar questions</span>
                                {queryTime !== null && <span>Query time: {queryTime.toFixed(0)}ms</span>}
                            </div>

                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-md transition-all cursor-pointer group"
                                    onClick={() => onResultSelect?.(result)}
                                    title="Click to navigate to this question"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                                #{index + 1}
                                            </span>
                                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                                                {result.topic}
                                            </span>
                                            {result.marks && (
                                                <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                                                    {result.marks}M
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Click to navigate →
                                            </span>
                                            <span className="text-xs font-mono text-slate-400">
                                                {(result.score * 100).toFixed(1)}% match
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-700 line-clamp-2">
                                        {result.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {results.length === 0 && !error && query && !isSearching && (
                        <div className="text-center py-4 text-slate-500 text-sm">
                            No results found. Try a different search term.
                        </div>
                    )}

                    {/* Initial State */}
                    {results.length === 0 && !query && (
                        <div className="text-center py-4 text-slate-400 text-sm">
                            Enter a query to search for semantically similar questions
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RAGSearch;
