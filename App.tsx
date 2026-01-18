import React, { useState, useEffect } from 'react';
import { Paper, Question, FilterState, ViewMode, PredictionReport } from './types';
import { ExtractionArtifact } from './types/artifact';
import { SelectedArtifactInfo } from './types/predictor';
import { UncertaintyLevel } from './types/uncertaintyIndex';
import HomePage from './components/HomePage';
import UploadSection from './components/UploadSection';
import ProcessingView from './components/ProcessingView';
import QuestionBrowser from './components/QuestionBrowser';
import ExportScreen from './components/ExportScreen';
import PredictorDashboard from './components/PredictorDashboard';
import ArtifactManager from './components/ArtifactManager';
import ArtifactSelector from './components/ArtifactSelector';
import { Button, Modal, Input, ToastContainer, ToastMessage } from './components/UIComponents';
import { PWAUpdatePrompt, InstallBanner } from './components/PWAComponents';
import { convertFileToBase64, pdfToImages } from './services/pdfService';
import { processPaperWithGemini, analyzeExamPatterns, generateSimilarQuestions } from './services/geminiService';
import { ragService } from './services/ragService';
import { computeFileHash } from './services/hashService';
import {
    initializeArtifactService,
    checkForCachedExtraction,
    createArtifactForFile,
    markExtractionStarted,
    completeExtraction,
    failExtraction,
    isReplayModeEnabled,
    getCompleteArtifacts,
} from './services/artifactService';
import {
    findCachedPrediction,
    savePrediction,
    initializePredictionService,
} from './services/predictionArtifactService';
import { MOCK_QUESTIONS, MOCK_PREDICTION_REPORT } from './services/mockData';

const App: React.FC = () => {
    // --- HomePage State ---
    // Always show homepage on fresh page load (session-based, not persisted)
    const [showHomePage, setShowHomePage] = useState<boolean>(true);

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
    const [isArtifactManagerOpen, setIsArtifactManagerOpen] = useState(false);
    const [isArtifactSelectorOpen, setIsArtifactSelectorOpen] = useState(false);
    const [selectedArtifactsInfo, setSelectedArtifactsInfo] = useState<SelectedArtifactInfo[]>([]);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);

    // --- Load API Key and Initialize Artifact Service ---
    useEffect(() => {
        const savedKey = localStorage.getItem('user_gemini_api_key');
        if (savedKey) setUserApiKey(savedKey);

        const hasSeenWelcome = localStorage.getItem('has_seen_welcome_modal');
        const envKey = process.env.API_KEY;

        // Check if envKey is a valid API key (not undefined, empty, or a placeholder)
        const hasValidEnvKey = envKey &&
            envKey.length > 10 &&
            !envKey.toLowerCase().includes('placeholder') &&
            envKey.startsWith('AIza');

        if (!savedKey && !hasValidEnvKey && !hasSeenWelcome) {
            // Show welcome modal after a brief delay
            setTimeout(() => setIsWelcomeOpen(true), 1500);
        }

        // Initialize artifact service (cleanup expired artifacts)
        initializeArtifactService().then(async () => {
            // Restore questions from cached artifacts on page load
            const cachedArtifacts = await getCompleteArtifacts();
            if (cachedArtifacts.length > 0) {
                const cachedQuestions = cachedArtifacts.flatMap(a => a.extraction.questions);
                const cachedPapers: Paper[] = cachedArtifacts.map(a => ({
                    id: a.id,
                    filename: a.sourceFile.name,
                    uploadDate: a.sourceFile.uploadedAt,
                    status: 'done' as const,
                    totalQuestions: a.extraction.questions.length,
                }));

                if (cachedQuestions.length > 0) {
                    setQuestions(cachedQuestions);
                    setPredictorQuestions(cachedQuestions);
                    setPapers(cachedPapers);
                    setPredictorPapers(cachedPapers);
                    console.log(`[App] Restored ${cachedQuestions.length} questions from ${cachedArtifacts.length} cached artifacts`);
                }
            }
        });

        // Initialize prediction cache service
        initializePredictionService();
    }, []);

    const handleDismissHomePage = () => {
        setShowHomePage(false);
        // Session-only dismiss - homepage will show again on refresh
        setCurrentScreen('browse');
    };

    const saveApiKey = () => {
        localStorage.setItem('user_gemini_api_key', userApiKey);
        setIsSettingsOpen(false);
        addToast("API Key saved successfully!", 'success');
    };

    const handleWelcomeSave = () => {
        localStorage.setItem('user_gemini_api_key', userApiKey);
        localStorage.setItem('has_seen_welcome_modal', 'true');
        setIsWelcomeOpen(false);
        addToast("API Key saved! You're ready to use AI features.", 'success');
    };

    const handleSkipWelcome = () => {
        localStorage.setItem('has_seen_welcome_modal', 'true');
        setIsWelcomeOpen(false);
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
            // Check for cached extraction (artifact deduplication)
            try {
                const cachedArtifact = await checkForCachedExtraction(file);
                if (cachedArtifact) {
                    addLog(`📦 Cache hit for ${file.name} - using cached extraction`);
                    addToast(`Using cached extraction for ${file.name} (no API cost)`, 'info');

                    const cachedPaper: Paper = {
                        id: cachedArtifact.id,
                        filename: file.name,
                        uploadDate: cachedArtifact.sourceFile.uploadedAt,
                        status: 'done',
                        totalQuestions: cachedArtifact.extraction.questions.length,
                    };

                    newPapers.push(cachedPaper);
                    extractedQuestions.push(...cachedArtifact.extraction.questions);

                    // Add to both modules
                    setPapers(prev => [...prev.filter(p => p.id !== cachedPaper.id), cachedPaper]);
                    setPredictorPapers(prev => [...prev.filter(p => p.id !== cachedPaper.id), cachedPaper]);

                    continue; // Skip to next file
                }
            } catch (cacheError) {
                console.warn('Cache check failed, proceeding with extraction:', cacheError);
            }

            // Create new artifact for this file
            let artifact: ExtractionArtifact | null = null;
            try {
                artifact = await createArtifactForFile(file);
                addLog(`📦 Created artifact ${artifact.id.slice(0, 8)}... for ${file.name}`);
            } catch (artifactError) {
                console.warn('Failed to create artifact, proceeding without caching:', artifactError);
            }

            const paperId = artifact?.id || crypto.randomUUID();
            const newPaper: Paper = {
                id: paperId,
                filename: file.name,
                uploadDate: Date.now(),
                status: 'processing',
                totalQuestions: 0
            };

            newPapers.push(newPaper);
            // Add paper to target module
            if (target === 'extractor') {
                setPapers(prev => [...prev, newPaper]);
                // Also sync to predictor (bidirectional sync)
                setPredictorPapers(prev => {
                    if (prev.some(p => p.id === newPaper.id)) return prev;
                    return [...prev, newPaper];
                });
            } else {
                setPredictorPapers(prev => [...prev, newPaper]);
                // Also sync to extractor (bidirectional sync)
                setPapers(prev => {
                    if (prev.some(p => p.id === newPaper.id)) return prev;
                    return [...prev, newPaper];
                });
            }

            try {
                // Mark artifact as extracting
                if (artifact) {
                    await markExtractionStarted(artifact.id);
                }

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

                // Complete artifact with extraction results
                if (artifact) {
                    const confidenceScores: Record<string, number> = {};
                    paperQs.forEach(q => {
                        if (q.confidenceScore !== undefined) {
                            confidenceScores[q.id] = q.confidenceScore;
                        }
                    });
                    await completeExtraction(artifact.id, paperQs, confidenceScores);
                    addLog(`📦 Artifact ${artifact.id.slice(0, 8)}... saved with ${paperQs.length} questions`);
                }

                const updateDone = (p: Paper) => p.id === paperId ? { ...p, status: 'done' as const, totalQuestions: paperQs.length } : p;
                // Update status in BOTH modules for bidirectional sync
                setPapers(prev => prev.map(updateDone));
                setPredictorPapers(prev => prev.map(updateDone));

                addLog(`Extracted ${paperQs.length} questions from ${file.name}`);

            } catch (error: any) {
                console.error(error);
                const errorMsg = error.message || "Unknown error";
                addLog(`Error: ${errorMsg}`);

                // Update artifact with error
                if (artifact) {
                    const isRetryable = error.isRateLimit ||
                        errorMsg.includes('429') ||
                        errorMsg.includes('overloaded') ||
                        errorMsg.includes('503');
                    await failExtraction(artifact.id, {
                        code: error.code || 'EXTRACTION_ERROR',
                        message: errorMsg,
                        retryable: isRetryable,
                    });
                }

                // Update paper status in BOTH modules
                const updateError = (p: Paper) => p.id === paperId ? { ...p, status: 'error' as const, errorMsg: errorMsg } : p;
                setPapers(prev => prev.map(updateError));
                setPredictorPapers(prev => prev.map(updateError));

                // Rate Limit Error
                if (error.isRateLimit || errorMsg.includes('Rate Limit') || errorMsg.includes('429') || errorMsg.includes('quota')) {
                    addToast("⚠️ Rate Limit Hit: You've exceeded the API quota. Please wait a few minutes before trying again.", 'error');
                    addLog("💡 Tip: The free Gemini API has limits. Consider waiting 1-2 minutes or upgrading to a paid plan.");
                    setIsProcessing(false);
                    return extractedQuestions; // Stop processing
                }

                // API Key Error
                if (error.code === 'AUTH_ERROR' || errorMsg.includes("API Key") || errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("Invalid")) {
                    addToast("🔑 API Key Error: Please check your key in settings.", 'error');
                    setIsSettingsOpen(true);
                    setIsProcessing(false);
                    return extractedQuestions; // Stop processing
                }

                // Service Unavailable
                if (errorMsg.includes("overloaded") || errorMsg.includes("503") || errorMsg.includes("Unavailable")) {
                    addToast("⏳ Gemini API is busy. Please try again in a few minutes.", 'error');
                    setIsProcessing(false);
                    return extractedQuestions; // Stop processing
                }

                // Other errors - continue processing remaining files
                addToast(`Failed to process ${file.name}: ${errorMsg.substring(0, 50)}...`, 'error');
            }
        }

        if (extractedQuestions.length > 0) {
            addToast(`Successfully extracted ${extractedQuestions.length} questions!`, 'success');

            // Auto-ingest to RAG backend (non-blocking)
            ragService.ingestQuestions(extractedQuestions)
                .then(result => {
                    addLog(`[RAG] Indexed ${result.documents_ingested} questions. Total in index: ${result.index_size}`);
                })
                .catch(err => {
                    addLog(`[RAG] Backend not available: ${err.message}`);
                });
        }

        setIsProcessing(false);
        return extractedQuestions;
    };

    const handleExtractorUpload = async (files: File[]) => {
        const newQs = await processFiles(files, 'extractor');
        setQuestions(prev => [...prev, ...newQs]);

        // Sync questions to Predictor module (papers already synced during processing)
        if (newQs.length > 0) {
            const allPredictorQs = [...predictorQuestions, ...newQs];
            setPredictorQuestions(allPredictorQs);
            addLog(`📤 Synced ${newQs.length} questions to Predictor module`);

            // Dismiss homepage after successful upload
            if (showHomePage) {
                handleDismissHomePage();
            } else {
                setCurrentScreen('browse');
            }

            // Note: AI Analysis is now manual - user can click "Start AI Analysis" button when ready
            addToast(`Extracted ${newQs.length} questions! Use "Start AI Analysis" to run predictions.`, 'success');
        }
    };

    // Handle artifact selection for Predictor (replaces handlePredictorUpload)
    const handleArtifactConfirm = (selectedArtifacts: ExtractionArtifact[]) => {
        // Extract questions from selected artifacts
        const artifactQuestions = selectedArtifacts.flatMap(a => a.extraction.questions);

        // Create artifact info for UI display
        const artifactInfo: SelectedArtifactInfo[] = selectedArtifacts.map(a => ({
            id: a.id,
            filename: a.sourceFile.name,
            questionCount: a.extraction.questions.length,
            createdAt: a.createdAt,
        }));

        setPredictorQuestions(artifactQuestions);
        setSelectedArtifactsInfo(artifactInfo);
        setIsArtifactSelectorOpen(false);

        addLog(`📦 Loaded ${artifactQuestions.length} questions from ${selectedArtifacts.length} artifacts`);
        addToast(`Loaded ${artifactQuestions.length} questions from ${selectedArtifacts.length} artifact(s). Ready for analysis!`, 'success');
    };

    // Use questions already in Extractor module for Predictor
    const handleUseExtractorQuestions = () => {
        if (questions.length === 0) {
            addToast('No questions in Extractor. Extract papers first using the Extractor module.', 'error');
            return;
        }

        setPredictorQuestions([...questions]);
        setSelectedArtifactsInfo([]); // Clear artifact info since using direct questions

        addLog(`📋 Using ${questions.length} questions from Extractor module`);
        addToast(`Using ${questions.length} questions from Extractor. Ready for analysis!`, 'success');
    };

    // Clear predictor selection
    const handleClearPredictorSelection = () => {
        setPredictorQuestions([]);
        setSelectedArtifactsInfo([]);
        addLog('🗑️ Cleared Predictor question selection');
    };

    // Manual AI Analysis - can be triggered from either module
    const runPredictionAnalysis = async (forceRefresh = false) => {
        // Use predictorQuestions which contains all synced questions
        const questionsToAnalyze = predictorQuestions.length > 0 ? predictorQuestions : questions;

        if (questionsToAnalyze.length === 0) {
            addToast("No questions to analyze. Select artifacts or use Extractor questions first.", 'error');
            return;
        }

        // In demo mode, use mock prediction report directly (no API key needed)
        if (isDemoMode) {
            setPredictionReport(MOCK_PREDICTION_REPORT);
            addLog(`🧪 Demo mode: Using mock prediction report`);
            addToast("Demo analysis complete! Showing mock predictions.", 'success');
            setActiveModule('predictor');
            return;
        }

        if (!userApiKey && !process.env.API_KEY) {
            addToast("API Key is missing. Please add it in Settings.", 'error');
            setIsSettingsOpen(true);
            return;
        }

        // Get artifact IDs for cache lookup
        const artifactIds = selectedArtifactsInfo.map(a => a.id);

        // Check for cached prediction (unless force refresh)
        if (!forceRefresh && artifactIds.length > 0) {
            try {
                const cached = await findCachedPrediction(artifactIds, syllabusText || null);
                if (cached) {
                    setPredictionReport(cached.result);
                    addLog(`📦 Using cached prediction (saved ${(cached.durationMs / 1000).toFixed(1)}s of processing)`);
                    addToast(`Using cached prediction! Original analysis took ${(cached.durationMs / 1000).toFixed(1)}s`, 'success');
                    setActiveModule('predictor');
                    return;
                }
            } catch (cacheError) {
                console.warn('[App] Cache check failed, running fresh analysis:', cacheError);
            }
        }

        setIsProcessing(true);
        addLog(`🔮 Running AI Analysis on ${questionsToAnalyze.length} questions...`);
        addToast("Starting AI prediction analysis...", 'info');

        const startTime = Date.now();

        try {
            const report = await analyzeExamPatterns(
                questionsToAnalyze,
                syllabusText || null,
                userApiKey || undefined
            );

            const durationMs = Date.now() - startTime;

            // Save to cache if we have artifact IDs
            if (artifactIds.length > 0) {
                try {
                    await savePrediction(
                        artifactIds,
                        questionsToAnalyze.length,
                        report,
                        durationMs,
                        syllabusText || null
                    );
                    addLog(`📦 Prediction cached for future reuse`);
                } catch (saveError) {
                    console.warn('[App] Failed to cache prediction:', saveError);
                }
            }

            setPredictionReport(report);
            addLog(`✅ Prediction Analysis Complete! (${(durationMs / 1000).toFixed(1)}s)`);

            // Uncertainty-aware notifications
            const uncertainty = report.uncertaintyIndex;
            if (uncertainty.level === UncertaintyLevel.HIGH) {
                addToast(`Analysis complete with limited data. Only coverage analysis is available.`, 'info');
                addLog(`⚠️ High uncertainty detected: ${uncertainty.explanation}`);
            } else if (uncertainty.level === UncertaintyLevel.MEDIUM) {
                addToast(`Pattern analysis complete! Some predictions may have gaps.`, 'success');
            } else {
                addToast(`Pattern analysis complete! Strong data signal detected.`, 'success');
            }

            // Switch to predictor module to show results
            setActiveModule('predictor');
        } catch (e: any) {
            addLog(`❌ Prediction Error: ${e.message}`);
            addToast(`Prediction Failed: ${e.message}`, 'error');
            if (e.message.includes("API Key")) setIsSettingsOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Demo data loader for testing - loads mock data but shows setup page first
    const handleLoadDemoData = () => {
        setQuestions(MOCK_QUESTIONS);
        setPredictorQuestions(MOCK_QUESTIONS);
        setPapers([
            { id: 'mock-paper-2023', filename: 'Thermo_2023.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 4 },
            { id: 'mock-paper-2022', filename: 'Fluids_2022.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 3 },
            { id: 'mock-paper-2021', filename: 'Fluids_2021.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 2 }
        ]);
        setPredictorPapers([
            { id: 'mock-paper-2023', filename: 'Thermo_2023.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 4 },
            { id: 'mock-paper-2022', filename: 'Fluids_2022.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 3 },
            { id: 'mock-paper-2021', filename: 'Fluids_2021.pdf', uploadDate: Date.now(), status: 'done', totalQuestions: 2 }
        ]);
        // Don't set predictionReport - show setup page first like the regular Predictor flow
        setIsDemoMode(true);
        setActiveModule('predictor');
        addToast("Demo data loaded! Click 'Start AI Analysis' to see predictions.", "success");
        setShowHomePage(false);
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

    // Show HomePage if not dismissed
    if (showHomePage) {
        return (
            <>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                <PWAUpdatePrompt />
                <InstallBanner />

                <HomePage
                    onUploadExtractor={handleExtractorUpload}
                    onSwitchModule={setActiveModule}
                    isProcessing={isProcessing}
                    papers={papers}
                    predictorPapers={predictorPapers}
                    logs={logs}
                    questions={questions}
                    filterState={filterState}
                    setFilterState={setFilterState}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    selectedIds={selectedIds}
                    toggleSelection={toggleSelection}
                    onExport={() => setCurrentScreen('export')}
                    onUpdateQuestion={handleQuestionUpdate}
                    onGenerateSimilar={handleGenerateSimilarQuestions}
                    onDismissHomePage={handleDismissHomePage}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onOpenArtifacts={() => setIsArtifactManagerOpen(true)}
                    onLoadDemoData={handleLoadDemoData}
                />

                {/* Artifact Manager (accessible from homepage) */}
                <ArtifactManager
                    isOpen={isArtifactManagerOpen}
                    onClose={() => setIsArtifactManagerOpen(false)}
                    onArtifactSelect={(artifact) => {
                        const newQuestions = artifact.extraction.questions;
                        setQuestions(prev => [...prev, ...newQuestions]);
                        setPredictorQuestions(prev => [...prev, ...newQuestions]);
                        addToast(`Loaded ${newQuestions.length} questions from artifact`, 'success');
                        setIsArtifactManagerOpen(false);
                    }}
                />

                {/* Settings Modal (accessible from homepage too) */}
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
                            <p className="text-xs text-slate-600 mt-2">
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

                {/* Welcome Modal */}
                <Modal isOpen={isWelcomeOpen} onClose={() => { }} title="Welcome to ExamExtractor! 🎓">
                    <div className="space-y-4">
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800">
                            <p className="font-semibold mb-1">supercharge your study workflow</p>
                            <p>To use the AI question extraction and prediction features, you'll need a Google Gemini API Key. It's free and easy to get!</p>
                        </div>

                        <div>
                            <Input
                                label="Gemini API Key"
                                placeholder="Paste your API Key here (starts with AIza...)"
                                value={userApiKey}
                                onChange={(e) => setUserApiKey(e.target.value)}
                                type="password"
                            />
                            <div className="mt-2 text-xs flex justify-between items-center text-slate-500">
                                <span>Your key is stored locally in your browser.</span>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">
                                    Get free API Key &rarr;
                                </a>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                            <Button variant="ghost" onClick={handleSkipWelcome}>Skip for now</Button>
                            <Button onClick={handleWelcomeSave} disabled={!userApiKey}>Save & Get Started</Button>
                        </div>
                    </div>
                </Modal>
            </>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50/50 relative">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <PWAUpdatePrompt />
            <InstallBanner />

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 rounded-lg p-1.5 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">ExamExtractor</h1>
                    </div>

                    {/* Main Nav Tabs */}
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setActiveModule('extractor')}
                            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${activeModule === 'extractor' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Extractor
                        </button>
                        <button
                            onClick={() => setActiveModule('predictor')}
                            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${activeModule === 'predictor' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Predictor
                        </button>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-1">
                        {/* Artifact Manager Button */}
                        <button
                            onClick={() => setIsArtifactManagerOpen(true)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
                            title="Extraction Artifacts"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                        </button>

                        {/* Settings Button */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
                            title="Settings / API Key"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Artifact Manager Modal */}
            <ArtifactManager
                isOpen={isArtifactManagerOpen}
                onClose={() => setIsArtifactManagerOpen(false)}
                onArtifactSelect={(artifact) => {
                    // Load questions from selected artifact
                    const newQuestions = artifact.extraction.questions;
                    setQuestions(prev => [...prev, ...newQuestions]);
                    setPredictorQuestions(prev => [...prev, ...newQuestions]);
                    addToast(`Loaded ${newQuestions.length} questions from artifact`, 'success');
                    setIsArtifactManagerOpen(false);
                }}
            />

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
                        <p className="text-xs text-slate-600 mt-2">
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

            {/* Welcome Modal (Main View) */}
            <Modal isOpen={isWelcomeOpen} onClose={() => { }} title="Welcome to ExamExtractor! 🎓">
                <div className="space-y-4">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800">
                        <p className="font-semibold mb-1">Supercharge your study workflow</p>
                        <p>To use the AI question extraction and prediction features, you'll need a Google Gemini API Key. It's free and easy to get!</p>
                    </div>

                    <div>
                        <Input
                            label="Gemini API Key"
                            placeholder="Paste your API Key here (starts with AIza...)"
                            value={userApiKey}
                            onChange={(e) => setUserApiKey(e.target.value)}
                            type="password"
                        />
                        <div className="mt-2 text-xs flex justify-between items-center text-slate-500">
                            <span>Your key is stored locally in your browser.</span>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">
                                Get free API Key &rarr;
                            </a>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button variant="ghost" onClick={handleSkipWelcome}>Skip for now</Button>
                        <Button onClick={handleWelcomeSave} disabled={!userApiKey}>Save & Get Started</Button>
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
                                        <p className="text-slate-600">Upload past papers to extract, filter, and organize specific questions instantly.</p>
                                    </div>

                                    <UploadSection onFilesSelected={handleExtractorUpload} isProcessing={isProcessing} />

                                    {(papers.length > 0 || isProcessing) && (
                                        <div className="mt-8">
                                            <ProcessingView papers={papers} logs={logs} />
                                        </div>
                                    )}

                                    {/* AI Analysis Card - shown when there are questions */}
                                    {questions.length > 0 && !isProcessing && (
                                        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 mb-1">🔮 AI Prediction Available</h3>
                                                    <p className="text-sm text-slate-600">
                                                        {questions.length} questions ready for pattern analysis and prediction.
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={runPredictionAnalysis}
                                                    disabled={isProcessing}
                                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                                    </svg>
                                                    Start AI Analysis
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentScreen === 'browse' && (
                                <div className="relative">
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

                                    {/* Floating AI Analysis Button */}
                                    {questions.length > 0 && !predictionReport && (
                                        <div className="fixed bottom-6 right-6 z-30">
                                            <Button
                                                onClick={runPredictionAnalysis}
                                                disabled={isProcessing}
                                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-5 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                                        </svg>
                                                        Start AI Analysis
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
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
                                        <p className="text-slate-600">Upload multiple years of the same subject paper to find patterns, trends, and predicted questions.</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                        <h3 className="font-semibold text-slate-900 mb-3">1. Select Question Source</h3>
                                        <p className="text-sm text-slate-600 mb-4">
                                            Choose previously extracted papers to analyze for patterns and predictions.
                                        </p>

                                        {/* Source Selection Buttons */}
                                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                                            <Button
                                                onClick={() => setIsArtifactSelectorOpen(true)}
                                                variant="secondary"
                                                className="flex-1 py-3 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50"
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                                    </svg>
                                                    Select from Artifacts
                                                </span>
                                            </Button>
                                            <Button
                                                onClick={handleUseExtractorQuestions}
                                                variant="ghost"
                                                disabled={questions.length === 0}
                                                className="flex-1 py-3 border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                    </svg>
                                                    Use Extractor Questions ({questions.length})
                                                </span>
                                            </Button>
                                        </div>

                                        {/* Selected Artifacts Summary */}
                                        {(selectedArtifactsInfo.length > 0 || predictorQuestions.length > 0) && (
                                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-indigo-900">
                                                        {selectedArtifactsInfo.length > 0
                                                            ? `${selectedArtifactsInfo.length} artifact(s) selected`
                                                            : 'Using Extractor questions'
                                                        }
                                                    </span>
                                                    <button
                                                        onClick={handleClearPredictorSelection}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedArtifactsInfo.length > 0 ? (
                                                        selectedArtifactsInfo.map(a => (
                                                            <span
                                                                key={a.id}
                                                                className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded text-xs text-slate-700 border border-indigo-200"
                                                            >
                                                                📄 {a.filename} ({a.questionCount})
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-indigo-700">
                                                            📋 {predictorQuestions.length} questions from Extractor
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-sm font-medium text-emerald-700">
                                                    Total: {predictorQuestions.length} questions ready for analysis
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                        <h3 className="font-semibold text-slate-900 mb-3">2. Optional: Add Syllabus / Focus Topics</h3>
                                        <textarea
                                            className="w-full p-3 border border-slate-300 rounded-lg text-sm h-24 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none"
                                            placeholder="Paste syllabus topics or list important chapters here to help the AI align predictions..."
                                            value={syllabusText}
                                            onChange={(e) => setSyllabusText(e.target.value)}
                                        ></textarea>
                                    </div>

                                    {/* Step 3: Start Analysis Button */}
                                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200 shadow-sm mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold text-slate-900">3. Start AI Analysis</h3>
                                            {selectedArtifactsInfo.length > 0 && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                                    ⚡ Cache enabled
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 mb-4">
                                            {predictorQuestions.length === 0
                                                ? "Select artifacts or use Extractor questions first."
                                                : `Ready to analyze ${predictorQuestions.length} questions. Results will be cached for reuse.`
                                            }
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={() => runPredictionAnalysis(false)}
                                                disabled={isProcessing || predictorQuestions.length === 0}
                                                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                                        </svg>
                                                        Start AI Analysis
                                                    </>
                                                )}
                                            </Button>
                                            {predictorQuestions.length > 0 && !isProcessing && (
                                                <button
                                                    onClick={() => runPredictionAnalysis(true)}
                                                    className="px-4 py-2 text-sm text-slate-600 hover:text-indigo-600 bg-white border border-slate-300 hover:border-indigo-400 rounded-lg transition-colors flex items-center gap-1"
                                                    title="Bypass cache and run fresh analysis"
                                                >
                                                    🔄 Force Re-analyze
                                                </button>
                                            )}
                                        </div>
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
                                    questions={predictorQuestions}
                                    onReset={() => {
                                        setPredictionReport(null);
                                        setPredictorQuestions([]);
                                        setPredictorPapers([]);
                                        setLogs([]);
                                        setIsDemoMode(false);
                                    }}
                                />
                            )}
                        </>
                    )}

                </div>
            </main>

            {/* Artifact Selector for Predictor */}
            <ArtifactSelector
                isOpen={isArtifactSelectorOpen}
                onClose={() => setIsArtifactSelectorOpen(false)}
                onConfirm={handleArtifactConfirm}
                initialSelection={selectedArtifactsInfo.map(a => a.id)}
            />
        </div>
    );
};

export default App;