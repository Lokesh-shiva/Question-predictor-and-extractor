import React, { useState } from 'react';
import { Button, Modal } from './UIComponents';
import UploadSection from './UploadSection';
import QuestionBrowser from './QuestionBrowser';
import ProcessingView from './ProcessingView';
import { Paper, Question, FilterState, ViewMode } from '../types';

interface HomePageProps {
  onUploadExtractor: (files: File[]) => void;
  onUploadPredictor?: (files: File[]) => void;  // Now optional - Predictor uses artifacts
  onSwitchModule: (module: 'extractor' | 'predictor') => void;
  isProcessing: boolean;
  papers: Paper[];
  predictorPapers: Paper[];
  logs: string[];
  questions: Question[];
  filterState: FilterState;
  setFilterState: (state: FilterState) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedIds: Set<string>;
  toggleSelection: (id: string | string[]) => void;
  onExport: () => void;
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
  onGenerateSimilar: (id: string) => void;
  onDismissHomePage: () => void;
  onOpenSettings: () => void;
  onOpenArtifacts?: () => void;
  onLoadDemoData?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  onUploadExtractor,
  onUploadPredictor,
  onSwitchModule,
  isProcessing,
  papers,
  predictorPapers,
  logs,
  questions,
  filterState,
  setFilterState,
  viewMode,
  setViewMode,
  selectedIds,
  toggleSelection,
  onExport,
  onUpdateQuestion,
  onGenerateSimilar,
  onDismissHomePage,
  onOpenSettings,
  onOpenArtifacts,
  onLoadDemoData
}) => {
  const [activeModal, setActiveModal] = useState<'upload' | 'browse' | null>(null);
  const [selectedModule, setSelectedModule] = useState<'extractor' | 'predictor' | null>(null);

  const handleUploadClick = () => {
    setSelectedModule(null); // Reset selection
    setActiveModal('upload');
  };

  const handleBrowseClick = () => {
    if (questions.length === 0) {
      // If no questions, show upload modal instead
      setSelectedModule(null);
      setActiveModal('upload');
    } else {
      setActiveModal('browse');
    }
  };

  const handleModalClose = () => {
    setActiveModal(null);
    setSelectedModule(null);
  };

  const handleFilesSelected = (files: File[]) => {
    if (selectedModule === 'extractor') {
      onUploadExtractor(files);
    } else if (selectedModule === 'predictor' && onUploadPredictor) {
      onUploadPredictor(files);
    }
    // Keep modal open to show processing
  };

  const handleSuccessfulUpload = () => {
    // After successful upload, switch to selected module and dismiss homepage
    if (selectedModule) {
      onSwitchModule(selectedModule);
    }
    setActiveModal(null);
    setSelectedModule(null);
    onDismissHomePage();
  };

  // Get the relevant papers based on selected module
  const activePapers = selectedModule === 'predictor' ? predictorPapers : papers;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Top Right Corner Buttons */}
      <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 20 }}>
        {/* Artifacts Button */}
        {onOpenArtifacts && (
          <button
            onClick={onOpenArtifacts}
            className="p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all duration-200 group"
            title="Extraction Artifacts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white/80 group-hover:text-white transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all duration-200 group"
          title="Settings / API Key"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white/80 group-hover:text-white transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      </div>

      {/* Fullscreen Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="/assets/monkey-mascot.webm" type="video/webm" />
      </video>

      {/* Dark gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 50%, rgba(51, 65, 85, 0.7) 100%)'
        }}
      ></div>

      {/* Content Overlay */}
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8" style={{ zIndex: 10 }}>
        <div className="max-w-4xl w-full mx-auto text-center space-y-8">

          {/* Headline */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight tracking-tight drop-shadow-lg">
              Extract Questions.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-300">
                Predict Patterns.
              </span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
                Ace Your Exams.
              </span>
            </h1>

            <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              AI-powered analysis that transforms past papers into your personalized study advantage
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-6 justify-center items-center text-sm text-slate-300">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Instant Analysis</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Pattern Recognition</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={handleUploadClick}
              className="px-10 py-5 text-lg shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105 transition-all duration-300 bg-gradient-to-r from-indigo-600 to-indigo-500"
            >
              <span className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Past Papers
              </span>
            </Button>

            <Button
              onClick={handleBrowseClick}
              variant="secondary"
              className="px-10 py-5 text-lg shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-105 transition-all duration-300 bg-gradient-to-r from-emerald-600 to-emerald-500 border-0 text-white"
            >
              <span className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                Browse Questions
              </span>
            </Button>

            {onLoadDemoData && (
              <Button
                onClick={onLoadDemoData}
                variant="ghost"
                className="px-10 py-5 text-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                <span className="flex items-center gap-3">
                  🧪 Try Demo
                </span>
              </Button>
            )}
          </div>

          {/* Subtle feature highlights */}
          <div className="pt-6 text-sm text-slate-400">
            No installation required • Works offline • Your data stays private
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={activeModal === 'upload'}
        onClose={handleModalClose}
        title={selectedModule ? `Upload to ${selectedModule === 'extractor' ? 'Question Extractor' : 'AI Predictor'}` : "Choose Your Goal"}
      >
        <div className="space-y-6">
          {/* Step 1: Module Selection */}
          {!selectedModule ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                What would you like to do with your past papers?
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Extractor Card */}
                <button
                  onClick={() => setSelectedModule('extractor')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg">Question Extractor</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Extract, organize, and filter individual questions from exam papers. Build your question bank.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Browse Questions</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Filter & Search</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Export</span>
                  </div>
                </button>

                {/* Predictor Card - Now redirects to module for artifact selection */}
                <button
                  onClick={() => {
                    onSwitchModule('predictor');
                    handleModalClose();
                    onDismissHomePage();
                  }}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg">AI Predictor</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Analyze patterns from <strong>extracted papers</strong> to predict important topics and likely questions.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">Uses Artifacts</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Pattern Analysis</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Study Strategy</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Back Button */}
              <button
                onClick={() => setSelectedModule(null)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Change selection
              </button>

              {/* Upload Section */}
              <UploadSection onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

              {(activePapers.length > 0 || isProcessing) && (
                <div className="mt-6">
                  <ProcessingView papers={activePapers} logs={logs} />
                </div>
              )}

              {activePapers.length > 0 && !isProcessing && activePapers.every(p => p.status === 'done') && (
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button variant="ghost" onClick={() => setSelectedModule(null)}>
                    Upload More
                  </Button>
                  <Button onClick={handleSuccessfulUpload}>
                    Continue to {selectedModule === 'extractor' ? 'Extractor' : 'Predictor'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Browse Modal */}
      <Modal
        isOpen={activeModal === 'browse'}
        onClose={handleModalClose}
        title="Browse Questions"
        size="xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {questions.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-slate-400 text-5xl">📚</div>
              <p className="text-slate-600">No questions yet. Upload past papers to get started!</p>
              <Button onClick={() => setActiveModal('upload')}>
                Upload Papers
              </Button>
            </div>
          ) : (
            <QuestionBrowser
              questions={questions}
              filterState={filterState}
              setFilterState={setFilterState}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedIds={selectedIds}
              toggleSelection={toggleSelection}
              papers={papers}
              onExport={onExport}
              onUpdateQuestion={onUpdateQuestion}
              onGenerateSimilar={onGenerateSimilar}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;