import React, { useState, useEffect } from 'react';
import { Paper, Question, FilterState, ViewMode, PredictionReport } from './types';
import UploadSection from './components/UploadSection';
import ProcessingView from './components/ProcessingView';
import QuestionBrowser from './components/QuestionBrowser';
import ExportScreen from './components/ExportScreen';
import PredictorDashboard from './components/PredictorDashboard';
import { Button, Modal, Input, ToastContainer, ToastMessage } from './components/UIComponents';
import { convertFileToBase64, pdfToImages } from './services/pdfService';
import { processPaperWithGemini, analyzeExamPatterns, generateSimilarQuestions } from './services/geminiService';

const App: React.FC = () => {
  // --- Module State ---
  const [activeModule, setActiveModule] = useState<'extractor' | 'predictor'>('extractor');

  // --- Extractor State ---
  const [papers, setPapers] = useState<Paper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'browse' | 'export'>('upload');
  const [viewMode, setViewMode] = useState<ViewMode>('separated');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState<FilterState>({
    groups: [{
      id: 'default',
      types: [],
      topics: [],
      minMarks: null,
      maxMarks: null,
      paperIds: [],
      searchQuery: '',
      minFrequency: 1
    }],
    activeGroupId: 'default'
  });

  // --- Predictor State ---
  const [predictorPapers, setPredictorPapers] = useState<Paper[]>([]);
  const [predictorQuestions, setPredictorQuestions] = useState<Question[]>([]);
  const [predictionReport, setPredictionReport] = useState<PredictionReport | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  
  // --- Shared State ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Load API Key ---
  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('user_gemini_api_key', userApiKey);
    setIsSettingsOpen(false);
    addToast("API Key saved successfully!", 'success');
  };

  // --- Handlers ---

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleQuestionUpdate = (id: string, updates: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleGenerateSimilarQuestions = async (id: string) => {
    const question = questions.find(q => q.id === id);
    if (!question) return;

    // Set loading state
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, isGeneratingSimilar: true } : q));

    try {
        const similarQs = await generateSimilarQuestions(
            question.fullText, 
            question.topic,
            userApiKey || undefined
        );
        
        setQuestions(prev => prev.map(q => q.id === id ? { 
            ...q, 
            similarQuestions: similarQs, 
            isGeneratingSimilar: false 
        } : q));
        
        addToast(`Generated 5 similar questions for Q${question.mainQuestionNumber}`, 'success');
    } catch (e: any) {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, isGeneratingSimilar: false } : q));
        addToast(`Failed to generate questions: ${e.message}`, 'error');
        if (e.message.includes("API Key")) setIsSettingsOpen(true);
    }
  };

  const processFiles = async (files: File[], target: 'extractor' | 'predictor') => {
    // 1. Validation: API Key
    if (!userApiKey && !process.env.API_KEY) {
        addToast("API Key is missing. Please add it in Settings.", 'error');
        setIsSettingsOpen(true);
        return [];
    }

    setIsProcessing(true);
    setLogs([]); // Clear logs for new run
    addLog(`Started processing ${files.length} files for ${target}...`);

    const newPapers: Paper[] = [];
    const extractedQuestions: Question[] = [];
    
    // 2. Validation: File Types
    const supportedFiles: File[] = [];
    const unsupportedFiles: File[] = [];
    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    for (const f of files) {
        if (supportedTypes.includes(f.type)) {
            supportedFiles.push(f);
        } else {
            unsupportedFiles.push(f);
        }
    }

    if (unsupportedFiles.length > 0) {
        addToast(`Skipped ${unsupportedFiles.length} unsupported file(s). Use PDF, PNG, or JPG.`, 'error');
    }

    if (supportedFiles.length === 0) {
        setIsProcessing(false);
        if (unsupportedFiles.length === 0) addToast("No files selected.", 'info');
        return [];
    }

    for (const file of supportedFiles) {
      const paperId = crypto.randomUUID();
      const newPaper: Paper = {
        id: paperId,
        filename: file.name,
        uploadDate: Date.now(),
        status: 'processing',
        totalQuestions: 0
      };
      
      newPapers.push(newPaper);
      if (target === 'extractor') setPapers(prev => [...prev, newPaper]);
      else setPredictorPapers(prev => [...prev, newPaper]);

      try {
        let images: string[] = [];
        
        if (file.type === 'application/pdf') {
          addLog(`Converting PDF: ${file.name}`);
          images = await pdfToImages(file);
        } else if (file.type.startsWith('image/')) {
          addLog(`Reading Image: ${file.name}`);
          const base64 = await convertFileToBase64(file);
          images = [base64];
        }

        addLog(`Analyzing content for ${file.name}...`);
        
        // Pass the user API key if available
        const paperQs = await processPaperWithGemini(
            images, 
            paperId, 
            (msg) => addLog(`[${file.name}] ${msg}`),
            userApiKey || undefined
        );
        
        extractedQuestions.push(...paperQs);
        
        const updateDone = (p: Paper) => p.id === paperId ? {...p, status: 'done' as const, totalQuestions: paperQs.length} : p;
        if (target === 'extractor') setPapers(prev => prev.map(updateDone));
        else setPredictorPapers(prev => prev.map(updateDone));
        
        addLog(`Extracted ${paperQs.length} questions from ${file.name}`);

      } catch (error: any) {
        console.error(error);
        const errorMsg = error.message || "Unknown error";
        addLog(`Error: ${errorMsg}`);
        
        // Specific Error Handling
        if (errorMsg.includes("API Key") || errorMsg.includes("401") || errorMsg.includes("403")) {
            addToast("API Key Error: Please check your key in settings.", 'error');
            setIsSettingsOpen(true);
            
            // Fail this paper and stop processing others to save user time
            const updateError = (p: Paper) => p.id === paperId ? {...p, status: 'error' as const, errorMsg: "API Key Error"} : p;
            if (target === 'extractor') setPapers(prev => prev.map(updateError));
            else setPredictorPapers(prev => prev.map(updateError));
            
            setIsProcessing(false);
            return extractedQuestions; 
        } else {
            addToast(`Failed to process ${file.name}`, 'error');
            const updateError = (p: Paper) => p.id === paperId ? {...p, status: 'error' as const, errorMsg: errorMsg} : p;
            if (target === 'extractor') setPapers(prev => prev.map(updateError));
            else setPredictorPapers(prev => prev.map(updateError));
        }
      }
    }

    if (extractedQuestions.length > 0) {
        addToast(`Successfully extracted ${extractedQuestions.length} questions!`, 'success');
    }

    setIsProcessing(false);
    return extractedQuestions;
  };

  const handleExtractorUpload = async (files: File[]) => {
    const newQs = await processFiles(files, 'extractor');
    setQuestions(prev => [...prev, ...newQs]);
    if (newQs.length > 0) setCurrentScreen('browse');
  };

  const handlePredictorUpload = async (files: File[]) => {
    // 1. Extract questions first
    const newQs = await processFiles(files, 'predictor');
    const allPredictorQs = [...predictorQuestions, ...newQs];
    setPredictorQuestions(allPredictorQs);

    if (allPredictorQs.length === 0) {
        addLog("No questions found to analyze.");
        return;
    }

    // 2. Run Prediction Analysis
    setIsProcessing(true);
    addLog("Running Statistical Analysis & Prediction Model...");
    try {
        const report = await analyzeExamPatterns(
            allPredictorQs, 
            syllabusText || null, 
            userApiKey || undefined
        );
        setPredictionReport(report);
        addLog("Prediction Analysis Complete.");
        addToast("Pattern analysis complete!", 'success');
    } catch (e: any) {
        addLog(`Prediction Error: ${e.message}`);
        addToast(`Prediction Failed: ${e.message}`, 'error');
        if (e.message.includes("API Key")) setIsSettingsOpen(true);
    } finally {
        setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string | string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (Array.isArray(id)) {
        const allIn = id.every(i => prev.has(i));
        id.forEach(i => allIn ? next.delete(i) : next.add(i));
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  // --- Render ---

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="bg-indigo-600 rounded-lg p-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">ExamExtractor</h1>
            </div>

            {/* Main Nav Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveModule('extractor')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${activeModule === 'extractor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Extractor
                </button>
                <button
                    onClick={() => setActiveModule('predictor')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${activeModule === 'predictor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Predictor
                </button>
            </div>

            {/* Settings Button */}
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
                title="Settings / API Key"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </button>
        </div>
      </header>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <div className="space-y-4">
            <div>
                <Input 
                    label="Gemini API Key"
                    placeholder="Enter your Google Gemini API Key"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    type="password"
                />
                <p className="text-xs text-slate-500 mt-2">
                    Required for processing. Your key is stored locally in your browser and sent directly to Google.
                </p>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                    Get an API Key here
                </a>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button onClick={saveApiKey}>Save & Close</Button>
            </div>
        </div>
      </Modal>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto h-full">
            
            {/* ================= EXTRACTOR MODULE ================= */}
            {activeModule === 'extractor' && (
                <>
                    {/* Sub Nav for Extractor */}
                    {papers.length > 0 && (
                        <div className="flex space-x-6 mb-6 border-b border-slate-200 pb-2">
                            <button 
                                onClick={() => setCurrentScreen('upload')}
                                className={`text-sm font-medium pb-2 border-b-2 ${currentScreen === 'upload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
                            >Upload More</button>
                            <button 
                                onClick={() => setCurrentScreen('browse')}
                                className={`text-sm font-medium pb-2 border-b-2 ${currentScreen === 'browse' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
                            >Browse Questions</button>
                        </div>
                    )}

                    {currentScreen === 'upload' && (
                        <div className="max-w-2xl mx-auto mt-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">Build Your Question Bank</h2>
                                <p className="text-slate-500">Upload past papers to extract, filter, and organize specific questions instantly.</p>
                            </div>
                            
                            <UploadSection onFilesSelected={handleExtractorUpload} isProcessing={isProcessing} />
                            
                            {(papers.length > 0 || isProcessing) && (
                                <div className="mt-8">
                                    <ProcessingView papers={papers} logs={logs} />
                                </div>
                            )}
                        </div>
                    )}

                    {currentScreen === 'browse' && (
                        <QuestionBrowser 
                            questions={questions}
                            filterState={filterState}
                            setFilterState={setFilterState}
                            viewMode={viewMode}
                            setViewMode={setViewMode}
                            selectedIds={selectedIds}
                            toggleSelection={toggleSelection}
                            papers={papers}
                            onExport={() => setCurrentScreen('export')}
                            onUpdateQuestion={handleQuestionUpdate}
                            onGenerateSimilar={handleGenerateSimilarQuestions}
                        />
                    )}

                    {currentScreen === 'export' && (
                        <ExportScreen 
                            questions={questions.filter(q => selectedIds.has(q.id) && !q.isHidden)}
                            onBack={() => setCurrentScreen('browse')}
                        />
                    )}
                </>
            )}

            {/* ================= PREDICTOR MODULE ================= */}
            {activeModule === 'predictor' && (
                <>
                    {!predictionReport ? (
                        <div className="max-w-2xl mx-auto mt-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">AI Paper Predictor</h2>
                                <p className="text-slate-500">Upload multiple years of the same subject paper to find patterns, trends, and predicted questions.</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h3 className="font-semibold text-slate-800 mb-3">1. Optional: Add Syllabus / Focus Topics</h3>
                                <textarea 
                                    className="w-full p-3 border border-slate-300 rounded-lg text-sm h-24 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="Paste syllabus topics or list important chapters here to help the AI align predictions..."
                                    value={syllabusText}
                                    onChange={(e) => setSyllabusText(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h3 className="font-semibold text-slate-800 mb-3">2. Upload Past Papers (Min 2 recommended)</h3>
                                <UploadSection onFilesSelected={handlePredictorUpload} isProcessing={isProcessing} />
                            </div>

                            {(predictorPapers.length > 0 || isProcessing) && (
                                <div className="mt-8">
                                    <ProcessingView papers={predictorPapers} logs={logs} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <PredictorDashboard 
                            report={predictionReport} 
                            onReset={() => {
                                setPredictionReport(null);
                                setPredictorQuestions([]);
                                setPredictorPapers([]);
                                setLogs([]);
                            }} 
                        />
                    )}
                </>
            )}

        </div>
      </main>
    </div>
  );
};

export default App;