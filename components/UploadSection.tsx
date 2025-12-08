import React, { useRef } from 'react';
import { Button } from './UIComponents';

interface UploadSectionProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onFilesSelected, isProcessing }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        multiple 
        ref={inputRef} 
        className="hidden" 
        accept=".pdf,image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="bg-indigo-100 p-4 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Upload Exam Papers</h3>
          <p className="text-slate-500 text-sm mt-1">Drag & drop PDFs or Images here, or click to browse</p>
        </div>
        <Button disabled={isProcessing} className="pointer-events-none">
            {isProcessing ? 'Processing...' : 'Select Files'}
        </Button>
        <p className="text-xs text-slate-400">Supported: PDF, JPG, PNG</p>
      </div>
    </div>
  );
};

export default UploadSection;
