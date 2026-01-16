import React, { useMemo, useState, useEffect } from 'react';
import { Question, FilterState, ViewMode, QuestionType, FilterCriteria, VerificationLogEntry } from '../types';
import { Button, Badge, Card } from './UIComponents';
import RAGSearch from './RAGSearch';
import DatasetExportModal from './DatasetExportModal';

interface QuestionBrowserProps {
    questions: Question[];
    filterState: FilterState;
    setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    selectedIds: Set<string>;
    toggleSelection: (id: string | string[]) => void;
    papers: { id: string, filename: string }[];
    onExport: () => void;
    onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
    onGenerateSimilar: (id: string) => void;
}

const QuestionBrowser: React.FC<QuestionBrowserProps> = ({
    questions,
    filterState,
    setFilterState,
    viewMode,
    setViewMode,
    selectedIds,
    toggleSelection,
    papers,
    onExport,
    onUpdateQuestion,
    onGenerateSimilar
}) => {
    const [showHidden, setShowHidden] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);

    // Verification state
    const [correctionModalId, setCorrectionModalId] = useState<string | null>(null);
    const [correctionText, setCorrectionText] = useState('');
    const [verificationLog, setVerificationLog] = useState<VerificationLogEntry[]>(() => {
        const saved = localStorage.getItem('examextractor_verification_log');
        return saved ? JSON.parse(saved) : [];
    });

    // Persist verification log to localStorage
    useEffect(() => {
        localStorage.setItem('examextractor_verification_log', JSON.stringify(verificationLog));
    }, [verificationLog]);

    // Log verification action
    const logVerificationAction = (entry: Omit<VerificationLogEntry, 'timestamp'>) => {
        const logEntry: VerificationLogEntry = {
            ...entry,
            timestamp: new Date().toISOString()
        };
        setVerificationLog(prev => [...prev, logEntry]);
    };

    // Verification handlers
    const handleMarkVerified = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateQuestion(id, {
            verificationStatus: 'verified',
            verifiedAt: new Date().toISOString()
        });
        logVerificationAction({ questionId: id, action: 'verified' });
    };

    const handleOpenCorrectionModal = (q: Question, e: React.MouseEvent) => {
        e.stopPropagation();
        setCorrectionModalId(q.id);
        setCorrectionText(q.fullText);
        logVerificationAction({ questionId: q.id, action: 'needs_correction' });
        onUpdateQuestion(q.id, { verificationStatus: 'needs_correction' });
    };

    const handleSaveCorrection = () => {
        if (!correctionModalId) return;
        const question = questions.find(q => q.id === correctionModalId);
        if (question) {
            logVerificationAction({
                questionId: correctionModalId,
                action: 'correction_saved',
                previousText: question.fullText,
                newText: correctionText
            });
        }
        onUpdateQuestion(correctionModalId, {
            fullText: correctionText,
            verificationStatus: null, // Clear after correction
            verifiedAt: undefined
        });
        setCorrectionModalId(null);
        setCorrectionText('');
    };

    const handleReject = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateQuestion(id, {
            verificationStatus: 'rejected',
            rejectedAt: new Date().toISOString(),
            isHidden: true
        });
        logVerificationAction({ questionId: id, action: 'rejected' });
    };

    // Handler for RAG search result navigation
    const handleRAGResultSelect = (result: { id: string }) => {
        // The result.id from RAG is the source_id which matches question.id
        const questionId = result.id;

        // Clear filters to show all questions (in case the question is filtered out)
        setFilterState(prev => ({
            ...prev,
            groups: [{
                ...prev.groups[0],
                types: [],
                topics: [],
                paperIds: [],
                searchQuery: '',
                minMarks: null,
                maxMarks: null,
                minFrequency: 1
            }]
        }));

        // Set highlighted question
        setHighlightedId(questionId);

        // Scroll to the question after a brief delay (to allow re-render)
        setTimeout(() => {
            const element = document.getElementById(`question-${questionId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash animation
                element.classList.add('ring-4', 'ring-indigo-400', 'ring-opacity-75');
                setTimeout(() => {
                    element.classList.remove('ring-4', 'ring-indigo-400', 'ring-opacity-75');
                }, 2000);
            }
        }, 100);

        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedId(null), 3000);
    };

    // -- Helper Functions --
    const getFrequency = (text: string) => {
        if (text.length < 10) return 1;
        const sample = text.substring(0, 20).toLowerCase();
        return questions.filter(q => q.fullText.toLowerCase().includes(sample)).length;
    };

    const activeGroup = useMemo(() =>
        filterState.groups.find(g => g.id === filterState.activeGroupId) || filterState.groups[0]
        , [filterState.groups, filterState.activeGroupId]);

    // -- Derived Data (Filtered Questions) --
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            // 1. Check Hidden Status
            if (q.isHidden && !showHidden) return false;

            // 2. Check Filter Criteria
            return filterState.groups.some(group => {
                if (group.searchQuery && !q.fullText.toLowerCase().includes(group.searchQuery.toLowerCase())) return false;
                if (group.types.length > 0 && !group.types.includes(q.type)) return false;
                if (group.topics.length > 0 && !group.topics.includes(q.topic)) return false;
                if (group.minMarks !== null && (q.marks === null || q.marks < group.minMarks)) return false;
                if (group.maxMarks !== null && (q.marks === null || q.marks > group.maxMarks)) return false;
                if (group.paperIds.length > 0 && !group.paperIds.includes(q.sourcePaperId)) return false;
                if (group.minFrequency > 1) {
                    if (getFrequency(q.fullText) < group.minFrequency) return false;
                }
                return true;
            });
        });
    }, [questions, filterState, showHidden]);

    // -- Grouping Logic --
    const groupedQuestions = useMemo(() => {
        const groups: { title: string; items: Question[] }[] = [];

        if (viewMode === 'separated') {
            groups.push({ title: 'All Questions', items: filteredQuestions });
        } else if (viewMode === 'grouped') {
            // Group by Paper + Main Question Number (Special Logic)
            const map: { [key: string]: Question[] } = {};
            filteredQuestions.forEach(q => {
                const key = `${q.sourcePaperId}-${q.mainQuestionNumber}`;
                if (!map[key]) map[key] = [];
                map[key].push(q);
            });
            Object.values(map).forEach(group => {
                group.sort((a, b) => (a.subQuestionLabel || '').localeCompare(b.subQuestionLabel || ''));
                const mainQ = group[0];
                const paperName = papers.find(p => p.id === mainQ.sourcePaperId)?.filename || 'Unknown Paper';
                groups.push({
                    title: `${paperName} - Question ${mainQ.mainQuestionNumber}`,
                    items: group
                });
            });
        } else {
            // Generic Grouping (Topic, Marks, Page)
            const map: { [key: string]: Question[] } = {};
            filteredQuestions.forEach(q => {
                let key = 'Other';
                if (viewMode === 'topic') key = q.topic || 'Uncategorized';
                else if (viewMode === 'marks') key = q.marks ? `${q.marks} Marks` : 'Marks N/A';
                else if (viewMode === 'page') key = `Page ${q.pageNumber}`;

                if (!map[key]) map[key] = [];
                map[key].push(q);
            });

            // Sort keys naturally
            const sortedKeys = Object.keys(map).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            sortedKeys.forEach(key => {
                groups.push({ title: key, items: map[key] });
            });
        }
        return groups;
    }, [filteredQuestions, viewMode, papers]);

    // -- Selection Logic --
    const filteredIds = filteredQuestions.map(q => q.id);
    const isAllSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));

    // -- Unique values for filters --
    const uniqueTopics = Array.from(new Set(questions.map(q => q.topic))).filter((t): t is string => !!t);
    const uniqueTypes = Object.values(QuestionType);

    // -- Handlers --
    const startEditing = (q: Question, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(q.id);
        setEditText(q.fullText);
    };

    const saveEdit = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateQuestion(id, { fullText: editText });
        setEditingId(null);
    };

    const cancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
    };

    // State Updaters
    const updateActiveGroup = (updates: Partial<FilterCriteria>) => {
        setFilterState(prev => ({
            ...prev,
            groups: prev.groups.map(g => g.id === prev.activeGroupId ? { ...g, ...updates } : g)
        }));
    };

    const toggleFilter = (type: 'types' | 'topics' | 'paperIds', value: string) => {
        if (!activeGroup) return;
        const current = activeGroup[type] as string[];
        const exists = current.includes(value);
        const updated = exists ? current.filter(item => item !== value) : [...current, value];
        updateActiveGroup({ [type]: updated });
    };

    const addGroup = () => {
        const newId = crypto.randomUUID();
        setFilterState(prev => ({
            groups: [...prev.groups, {
                id: newId,
                types: [],
                topics: [],
                minMarks: null,
                maxMarks: null,
                paperIds: [],
                searchQuery: '',
                minFrequency: 1
            }],
            activeGroupId: newId
        }));
    };

    const removeGroup = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setFilterState(prev => {
            if (prev.groups.length <= 1) return prev;
            const newGroups = prev.groups.filter(g => g.id !== id);
            return {
                groups: newGroups,
                activeGroupId: prev.activeGroupId === id ? newGroups[0].id : prev.activeGroupId
            };
        });
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6">

            {/* --- Filter Sidebar --- */}
            <div className="w-full lg:w-64 flex-shrink-0 bg-white p-4 rounded-xl border border-slate-200 h-fit lg:sticky lg:top-4 overflow-y-auto max-h-[90vh] shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                        </svg>
                        Filters
                    </span>
                </h3>

                {/* Filter Groups Management */}
                <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Filter Groups (OR Logic)</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {filterState.groups.map((group, idx) => (
                            <div
                                key={group.id}
                                onClick={() => setFilterState(prev => ({ ...prev, activeGroupId: group.id }))}
                            className={`
                            px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border flex items-center shadow-sm transition-all
                            ${filterState.activeGroupId === group.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'}
                        `}
                            >
                                Group {idx + 1}
                                {filterState.groups.length > 1 && (
                                    <span
                                        onClick={(e) => removeGroup(e, group.id)}
                                        className="ml-2 hover:bg-red-500 hover:text-white rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                                    >×</span>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={addGroup}
                            className="px-2 py-1 rounded text-xs font-bold border border-dashed border-slate-300 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-400 transition-colors"
                            title="Add another group of conditions (OR)"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    {/* Show Hidden */}
                    <div className="mb-6">
                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded text-indigo-600 focus:ring-indigo-600"
                                checked={showHidden}
                                onChange={() => setShowHidden(!showHidden)}
                            />
                            <span>Show Hidden / Incorrect</span>
                        </label>
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                        <input
                            type="text"
                            placeholder="Search keywords..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none"
                            value={activeGroup.searchQuery}
                            onChange={(e) => updateActiveGroup({ searchQuery: e.target.value })}
                        />
                    </div>

                    {/* Papers */}
                    <div className="mb-6">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Source Papers</h4>
                        <div className="space-y-2">
                            {papers.map(p => (
                                <label key={p.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-indigo-700">
                                    <input
                                        type="checkbox"
                                        className="rounded text-indigo-600 focus:ring-indigo-600"
                                        checked={activeGroup.paperIds.includes(p.id)}
                                        onChange={() => toggleFilter('paperIds', p.id)}
                                    />
                                    <span className="truncate">{p.filename}</span>
                                </label>
                            ))}
                            {papers.length === 0 && <span className="text-xs text-slate-400 italic">No papers uploaded</span>}
                        </div>
                    </div>

                    {/* Topics */}
                    <div className="mb-6">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Topics</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scroll pr-1">
                            {uniqueTopics.map(t => (
                                <label key={t} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-indigo-700">
                                    <input
                                        type="checkbox"
                                        className="rounded text-indigo-600 focus:ring-indigo-600"
                                        checked={activeGroup.topics.includes(t)}
                                        onChange={() => toggleFilter('topics', t)}
                                    />
                                    <span className="truncate">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Marks Range */}
                    <div className="mb-6">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Marks</h4>
                        <div className="flex gap-2">
                            <input
                                type="number" placeholder="Min"
                                className="w-1/2 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none"
                                value={activeGroup.minMarks ?? ''}
                                onChange={(e) => updateActiveGroup({ minMarks: e.target.value ? parseInt(e.target.value) : null })}
                            />
                            <input
                                type="number" placeholder="Max"
                                className="w-1/2 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none"
                                value={activeGroup.maxMarks ?? ''}
                                onChange={(e) => updateActiveGroup({ maxMarks: e.target.value ? parseInt(e.target.value) : null })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="flex-1 min-w-0">

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center space-x-4 w-full md:w-auto">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                            <span className="text-sm font-medium text-slate-600">Group By:</span>
                            <select
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                                className="bg-slate-100 border border-slate-200 text-sm font-medium rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                            >
                                <option value="separated">None (List)</option>
                                <option value="grouped">Question Number</option>
                                <option value="topic">Topic</option>
                                <option value="marks">Marks</option>
                                <option value="page">Page</option>
                            </select>
                        </div>

                        {/* Vertical Separator */}
                        <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>

                        {/* Select All Checkbox */}
                        <label className={`flex items-center space-x-2 ${filteredIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-indigo-700'}`}>
                            <input
                                type="checkbox"
                                className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 border-slate-300 transition-colors"
                                checked={isAllSelected}
                                onChange={() => toggleSelection(filteredIds)}
                                disabled={filteredIds.length === 0}
                            />
                            <span className="text-sm font-medium text-slate-700 select-none">
                                Select All ({filteredQuestions.length})
                            </span>
                        </label>
                    </div>

                    <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                            {selectedIds.size} selected
                        </span>
                        <Button variant="primary" onClick={() => setIsDatasetModalOpen(true)} disabled={selectedIds.size === 0}>
                            Export Dataset
                        </Button>
                        <Button variant="secondary" onClick={onExport} disabled={selectedIds.size === 0}>
                            Review & Export
                        </Button>
                    </div>
                </div>

                {/* RAG Semantic Search */}
                <div className="mb-6">
                    <RAGSearch onResultSelect={handleRAGResultSelect} />
                </div>

                {/* Questions Grid */}
                <div className="space-y-6 pb-20">
                    {groupedQuestions.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p className="text-lg">No questions match your filters.</p>
                            <button onClick={() => setFilterState(prev => ({ ...prev, groups: [{ ...prev.groups[0], types: [], topics: [], paperIds: [], searchQuery: '' }] }))} className="text-indigo-600 text-sm mt-2 hover:underline">
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        groupedQuestions.map((group, groupIdx) => {
                            // Calculate selection state for this group
                            const groupIds = group.items.map(q => q.id);
                            const selectedInGroup = groupIds.filter(id => selectedIds.has(id)).length;
                            const isGroupFullySelected = selectedInGroup === groupIds.length && groupIds.length > 0;
                            const isGroupPartiallySelected = selectedInGroup > 0 && selectedInGroup < groupIds.length;

                            return (
                                <div key={groupIdx}>
                                    {viewMode !== 'separated' && (
                                        <div className="flex items-center justify-between mb-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                                            <div className="flex items-center space-x-3">
                                                {/* Group Selection Checkbox */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(groupIds);
                                                    }}
                                                    className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isGroupFullySelected
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : isGroupPartiallySelected
                                                            ? 'bg-indigo-300 border-indigo-500'
                                                            : 'border-slate-300 hover:border-indigo-500'
                                                        }`}
                                                >
                                                    {isGroupFullySelected && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                                                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    {isGroupPartiallySelected && (
                                                        <div className="w-2 h-2 bg-indigo-600 rounded-sm"></div>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-slate-900 text-lg">{group.title}</h3>
                                                <Badge color="gray">{group.items.length}</Badge>
                                            </div>
                                            {/* Selection Count */}
                                            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                                {selectedInGroup} of {groupIds.length} selected
                                            </span>
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        {group.items.map(q => (
                                            <Card
                                                key={q.id}
                                                id={`question-${q.id}`}
                                                className={`p-4 transition-all relative group ${q.isHidden ? 'opacity-60 bg-slate-50 border-dashed' : ''} ${q.isImportant ? 'ring-2 ring-amber-400 border-amber-400' : ''} ${highlightedId === q.id ? 'ring-4 ring-indigo-500 bg-indigo-50 border-indigo-400' : ''}`}
                                                selected={selectedIds.has(q.id)}
                                                onClick={() => toggleSelection(q.id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    {/* Left Side: Checkbox & Content */}
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">

                                                        {/* Number Bubble */}
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm mt-0.5">
                                                            {q.mainQuestionNumber}{q.subQuestionLabel || ''}
                                                        </div>

                                                        <div className="flex-1 min-w-0 pr-4">
                                                            {/* Text Area or Display Text */}
                                                            {editingId === q.id ? (
                                                                <div className="mb-3" onClick={e => e.stopPropagation()}>
                                                                    <textarea
                                                                        value={editText}
                                                                        onChange={(e) => setEditText(e.target.value)}
                                                                        className="w-full p-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none text-slate-900 text-base"
                                                                        rows={3}
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2 mt-2">
                                                                        <button
                                                                            onClick={(e) => saveEdit(q.id, e)}
                                                                            className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700"
                                                                        >Save</button>
                                                                        <button
                                                                            onClick={cancelEdit}
                                                                            className="px-3 py-1 bg-white border border-slate-300 text-slate-600 text-xs font-medium rounded hover:bg-slate-50"
                                                                        >Cancel</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="relative group/text">
                                                                    <p className="text-slate-900 text-base leading-relaxed mb-2 break-words whitespace-pre-wrap">
                                                                        {q.fullText}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap gap-2 items-center">
                                                                <Badge>{q.topic}</Badge>
                                                                <Badge color="blue">{q.type}</Badge>
                                                                {q.marks && <Badge color="yellow">{q.marks} Marks</Badge>}
                                                                {q.isImportant && (
                                                                    <span className="flex items-center text-amber-700 text-xs font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 mr-1">
                                                                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006Z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Important
                                                                    </span>
                                                                )}
                                                                {q.isHidden && <span className="text-xs text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-200">Hidden</span>}
                                                                {/* Verification Status Badge */}
                                                                {q.verificationStatus === 'verified' && (
                                                                    <span className="verification-badge verified">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Verified
                                                                    </span>
                                                                )}
                                                                {q.verificationStatus === 'rejected' && (
                                                                    <span className="verification-badge rejected">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Rejected
                                                                    </span>
                                                                )}
                                                                {q.verificationStatus === 'needs_correction' && (
                                                                    <span className="verification-badge needs-correction">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Needs Correction
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Similar Questions Section */}
                                                            {(q.similarQuestions && q.similarQuestions.length > 0) && (
                                                                <div className="mt-4 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                                                                    <h5 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 mr-1">
                                                                            <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813a3.75 3.75 0 0 0 2.576-2.576l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
                                                                        </svg>
                                                                        AI-Generated Practice Questions
                                                                    </h5>
                                                                    <ul className="space-y-2">
                                                                        {q.similarQuestions.map((sq, idx) => (
                                                                            <li key={idx} className="text-sm text-slate-700 flex gap-2">
                                                                                <span className="font-medium text-indigo-600 select-none">{idx + 1}.</span>
                                                                                <span>{sq}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Verification Controls */}
                                                            <div className="verification-controls mt-3" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={(e) => handleMarkVerified(q.id, e)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${q.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'}`}
                                                                    title="Mark as verified and correct"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                                                    </svg>
                                                                    {q.verificationStatus === 'verified' ? 'Verified' : 'Mark Verified'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleOpenCorrectionModal(q, e)}
                                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                                                                    title="Needs correction - edit the text"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                                                                        <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                                                                    </svg>
                                                                    Needs Correction
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleReject(q.id, e)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${q.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'}`}
                                                                    title="Reject this question (marks as hidden)"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Side: Actions */}
                                                    <div className="flex flex-col gap-2 flex-shrink-0 ml-2">
                                                        {/* Selection Checkbox */}
                                                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white hover:border-indigo-500'}`}>
                                                            {selectedIds.has(q.id) && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                                                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons (visible on hover or active) */}
                                                        <div className="flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => onUpdateQuestion(q.id, { isImportant: !q.isImportant })}
                                                                title="Mark as Important"
                                                                className={`p-1.5 rounded-md transition-colors ${q.isImportant ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400 hover:text-amber-700 hover:bg-amber-50'}`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill={q.isImportant ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                                </svg>
                                                            </button>

                                                            <button
                                                                onClick={(e) => startEditing(q, e)}
                                                                title="Edit Text"
                                                                className="p-1.5 rounded-md bg-slate-100 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                                </svg>
                                                            </button>

                                                            {/* Sparkles / Generate Similar Button */}
                                                            <button
                                                                onClick={() => onGenerateSimilar(q.id)}
                                                                title="Generate 5 similar questions"
                                                                disabled={q.isGeneratingSimilar}
                                                                className={`p-1.5 rounded-md transition-colors ${q.similarQuestions && q.similarQuestions.length > 0 ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50'} ${q.isGeneratingSimilar ? 'animate-pulse cursor-wait' : ''}`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                                                </svg>
                                                            </button>

                                                            <button
                                                                onClick={() => onUpdateQuestion(q.id, { isHidden: !q.isHidden })}
                                                                title={q.isHidden ? "Unhide" : "Hide / Incorrect"}
                                                                className={`p-1.5 rounded-md transition-colors ${q.isHidden ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-400 hover:text-red-700 hover:bg-red-50'}`}
                                                            >
                                                                {q.isHidden ? (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>

            {/* Correction Modal */}
            {correctionModalId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/80">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-600">
                                    <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                                </svg>
                                Correct Question Text
                            </h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Question Text</label>
                            <textarea
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-amber-600 focus:outline-none text-slate-900 text-base min-h-[150px]"
                                placeholder="Edit the question text..."
                            />
                            <p className="text-xs text-slate-500 mt-2">Make corrections to the extracted text. Saving will clear the verification status.</p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => { setCorrectionModalId(null); setCorrectionText(''); }}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleSaveCorrection}>
                                Save Correction
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dataset Export Modal */}
            <DatasetExportModal
                isOpen={isDatasetModalOpen}
                onClose={() => setIsDatasetModalOpen(false)}
                questions={questions.filter(q => selectedIds.has(q.id))}
                papers={papers}
            />
        </div>
    );
};

export default QuestionBrowser;