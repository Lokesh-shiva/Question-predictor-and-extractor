import React from 'react';
import { Paper } from '../types';
import { Badge } from './UIComponents';

interface ProcessingViewProps {
  papers: Paper[];
  logs: string[];
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ papers, logs }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Processing Status</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">Files</h3>
            <ul className="space-y-3">
                {papers.map(paper => (
                <li key={paper.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{paper.filename}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {paper.status === 'done' && <Badge color="green">Done ({paper.totalQuestions})</Badge>}
                        {paper.status === 'processing' && <Badge color="blue">Processing</Badge>}
                        {paper.status === 'error' && <Badge color="red">Error</Badge>}
                    </div>
                </li>
                ))}
            </ul>
        </div>
        
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-y-auto max-h-[200px] custom-scroll">
            <h3 className="text-slate-500 mb-2 uppercase tracking-wide font-sans font-bold">Activity Log</h3>
            <div className="flex flex-col-reverse">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-slate-800 pb-1 last:border-0">
                        <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingView;
