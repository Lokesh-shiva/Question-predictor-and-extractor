import React, { useMemo } from 'react';
import { Question, FilterState, ViewMode, QuestionType, FilterCriteria } from '../types';
import { Button, Badge, Card } from './UIComponents';

interface QuestionBrowserProps {
  questions: Question[];
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedIds: Set<string>;
  toggleSelection: (id: string | string[]) => void;
  papers: {id: string, filename: string}[];
  onExport: () => void;
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
  onExport
}) => {
  
  // -- Helper Functions --
  const getFrequency = (text: string) => {
    // Basic similarity check: matches if the first 20 chars appear in other questions
    // This is a heuristic for "Repeated Question" detection
    if (text.length < 10) return 1;
    const sample = text.substring(0, 20).toLowerCase();
    return questions.filter(q => q.fullText.toLowerCase().includes(sample)).length;
  };

  const activeGroup = useMemo(() => 
    filterState.groups.find(g => g.id === filterState.activeGroupId) || filterState.groups[0]
  , [filterState.groups, filterState.activeGroupId]);

  // -- Derived Data (Filtered Questions) --
  const filteredQuestions = useMemo(() => {
    // A question is included if it matches ANY of the filter groups (OR logic between groups)
    return questions.filter(q => {
      return filterState.groups.some(group => {
        // Within a group, all conditions must match (AND logic within group)
        
        // Search
        if (group.searchQuery && !q.fullText.toLowerCase().includes(group.searchQuery.toLowerCase())) {
          return false;
        }
        // Types
        if (group.types.length > 0 && !group.types.includes(q.type)) {
          return false;
        }
        // Topics
        if (group.topics.length > 0 && !group.topics.includes(q.topic)) {
          return false;
        }
        // Marks
        if (group.minMarks !== null && (q.marks === null || q.marks < group.minMarks)) return false;
        if (group.maxMarks !== null && (q.marks === null || q.marks > group.maxMarks)) return false;
        
        // Paper Source
        if (group.paperIds.length > 0 && !group.paperIds.includes(q.sourcePaperId)) return false;

        // Frequency
        if (group.minFrequency > 1) {
          if (getFrequency(q.fullText) < group.minFrequency) return false;
        }

        return true;
      });
    });
  }, [questions, filterState]);

  // -- Grouping Logic --
  const groupedQuestions = useMemo(() => {
    if (viewMode === 'separated') return filteredQuestions;

    const groups: { [key: string]: Question[] } = {};
    filteredQuestions.forEach(q => {
      // Key by PaperID + MainNumber to avoid collisions across papers
      const key = `${q.sourcePaperId}-${q.mainQuestionNumber}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(q);
    });
    
    // Flatten back to a list of "Main Question" representations
    return Object.values(groups).map(group => {
       // Sort subparts: a, b, c...
       return group.sort((a, b) => (a.subQuestionLabel || '').localeCompare(b.subQuestionLabel || ''));
    });
  }, [filteredQuestions, viewMode]);

  // -- Unique values for filters --
  const uniqueTopics = Array.from(new Set(questions.map(q => q.topic))).filter((t): t is string => !!t);
  const uniqueTypes = Object.values(QuestionType);

  // -- State Updaters --
  
  const updateActiveGroup = (updates: Partial<FilterCriteria>) => {
    setFilterState(prev => ({
        ...prev,
        groups: prev.groups.map(g => g.id === prev.activeGroupId ? { ...g, ...updates } : g)
    }));
  };

  const toggleFilter = (type: 'types' | 'topics' | 'paperIds', value: string) => {
    if (!activeGroup) return;
    
    // Type-safe generic toggler
    const current = activeGroup[type] as string[];
    const exists = current.includes(value);
    
    // For arrays, we toggle existence
    const updated = exists 
      ? current.filter(item => item !== value) 
      : [...current, value];
      
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

  const setActiveGroup = (id: string) => {
      setFilterState(prev => ({ ...prev, activeGroupId: id }));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      
      {/* --- Filter Sidebar --- */}
      <div className="w-full lg:w-64 flex-shrink-0 bg-white p-4 rounded-xl border border-slate-200 h-fit lg:sticky lg:top-4 overflow-y-auto max-h-[90vh]">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            Filters
        </h3>
        
        {/* Filter Groups Management */}
        <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Filter Groups (OR Logic)</h4>
            <div className="flex flex-wrap gap-2 mb-2">
                {filterState.groups.map((group, idx) => (
                    <div 
                        key={group.id}
                        onClick={() => setActiveGroup(group.id)}
                        className={`
                            px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border flex items-center shadow-sm transition-all
                            ${filterState.activeGroupId === group.id 
                                ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}
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
                    className="px-2 py-1 rounded text-xs font-bold border border-dashed border-slate-400 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-500 transition-colors"
                    title="Add another group of conditions (OR)"
                >
                    + Add OR Group
                </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight mt-2">
                Editing <span className="font-bold text-indigo-600">Group {filterState.groups.findIndex(g => g.id === filterState.activeGroupId) + 1}</span>. 
                Questions match if they satisfy <span className="underline">all</span> conditions in this group.
            </p>
        </div>

        <div className="border-t border-slate-100 pt-4">
            {/* Search */}
            <div className="mb-6">
                <input 
                    type="text" 
                    placeholder="Search keywords..." 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={activeGroup.searchQuery}
                    onChange={(e) => updateActiveGroup({ searchQuery: e.target.value })}
                />
            </div>

            {/* Papers */}
            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Source Papers</h4>
                <div className="space-y-2">
                    {papers.map(p => (
                        <label key={p.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-indigo-600">
                            <input 
                                type="checkbox" 
                                className="rounded text-indigo-600 focus:ring-indigo-500"
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
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Topics</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scroll pr-1">
                    {uniqueTopics.map(t => (
                        <label key={t} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-indigo-600">
                            <input 
                                type="checkbox" 
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                checked={activeGroup.topics.includes(t)}
                                onChange={() => toggleFilter('topics', t)}
                            />
                            <span className="truncate">{t}</span>
                        </label>
                    ))}
                    {uniqueTopics.length === 0 && <span className="text-xs text-slate-400 italic">No topics found</span>}
                </div>
            </div>

            {/* Question Types */}
            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Type</h4>
                <div className="space-y-2">
                    {uniqueTypes.map(t => (
                        <label key={t} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-indigo-600">
                            <input 
                                type="checkbox" 
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                checked={activeGroup.types.includes(t)}
                                onChange={() => toggleFilter('types', t)}
                            />
                            <span>{t}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Marks Range */}
            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Marks</h4>
                <div className="flex gap-2">
                    <input 
                        type="number" placeholder="Min" 
                        className="w-1/2 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={activeGroup.minMarks ?? ''}
                        onChange={(e) => updateActiveGroup({ minMarks: e.target.value ? parseInt(e.target.value) : null })}
                    />
                    <input 
                        type="number" placeholder="Max" 
                        className="w-1/2 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={activeGroup.maxMarks ?? ''}
                        onChange={(e) => updateActiveGroup({ maxMarks: e.target.value ? parseInt(e.target.value) : null })}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
            <div className="flex items-center space-x-4">
                <div className="flex bg-slate-100 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('separated')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'separated' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Separated
                    </button>
                    <button 
                        onClick={() => setViewMode('grouped')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'grouped' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Grouped
                    </button>
                </div>
                <span className="text-sm text-slate-500">
                    Showing <b>{viewMode === 'separated' ? filteredQuestions.length : groupedQuestions.length}</b> questions
                </span>
            </div>

            <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-slate-700">
                    Selected: {selectedIds.size}
                </span>
                <Button variant="secondary" onClick={onExport} disabled={selectedIds.size === 0}>
                    Review & Export
                </Button>
            </div>
        </div>

        {/* Questions Grid */}
        <div className="space-y-4 pb-20">
            {filteredQuestions.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg">No questions match your filters.</p>
                    <button onClick={() => setFilterState(prev => ({...prev, groups: [{...prev.groups[0], types:[], topics:[], paperIds:[], searchQuery:''}]}))} className="text-indigo-600 text-sm mt-2 hover:underline">
                        Clear all filters
                    </button>
                </div>
            ) : viewMode === 'separated' ? (
                // Separated View
                (groupedQuestions as Question[]).map(q => (
                    <Card 
                        key={q.id} 
                        className="p-4 cursor-pointer hover:shadow-md transition-shadow relative"
                        selected={selectedIds.has(q.id)}
                        onClick={() => toggleSelection(q.id)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3 w-full">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                                    {q.mainQuestionNumber}{q.subQuestionLabel ? `(${q.subQuestionLabel})` : ''}
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-slate-900 text-base leading-relaxed mb-2 break-words">{q.fullText}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge>{q.topic}</Badge>
                                        <Badge color="blue">{q.type}</Badge>
                                        {q.marks && <Badge color="yellow">{q.marks} Marks</Badge>}
                                        <span className="text-xs text-slate-400 mt-1 ml-1 truncate max-w-[150px] inline-block align-bottom" title={papers.find(p => p.id === q.sourcePaperId)?.filename}>
                                            {papers.find(p => p.id === q.sourcePaperId)?.filename}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-1 flex-shrink-0">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {selectedIds.has(q.id) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
                                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))
            ) : (
                // Grouped View
                (groupedQuestions as Question[][]).map((group, idx) => {
                    const mainQ = group[0];
                    const allIds = group.map(g => g.id);
                    const isAllSelected = allIds.every(id => selectedIds.has(id));
                    
                    return (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                             <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center cursor-pointer" onClick={() => toggleSelection(allIds)}>
                                <h4 className="font-semibold text-slate-700">Question {mainQ.mainQuestionNumber}</h4>
                                <Button 
                                    variant="outline" 
                                    className="text-xs px-2 py-1 h-auto"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelection(allIds);
                                    }}
                                >
                                    {isAllSelected ? 'Deselect All' : 'Select Group'}
                                </Button>
                             </div>
                             <div className="divide-y divide-slate-100">
                                {group.map(q => (
                                    <div 
                                        key={q.id} 
                                        onClick={() => toggleSelection(q.id)}
                                        className={`p-4 cursor-pointer hover:bg-indigo-50 transition-colors flex justify-between items-start ${selectedIds.has(q.id) ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <div className="flex gap-4 w-full">
                                            <span className="font-medium text-slate-500 w-8 pt-0.5">{q.subQuestionLabel ? `(${q.subQuestionLabel})` : ''}</span>
                                            <div className="flex-1">
                                                <p className="text-slate-800">{q.fullText}</p>
                                                <div className="flex gap-2 mt-2">
                                                    {q.marks && <span className="text-xs font-semibold text-slate-500">[{q.marks}M]</span>}
                                                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{q.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded border mt-1 flex-shrink-0 flex items-center justify-center transition-colors ${selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                             {selectedIds.has(q.id) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
                                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    );
                })
            )}
        </div>

      </div>
    </div>
  );
};

export default QuestionBrowser;