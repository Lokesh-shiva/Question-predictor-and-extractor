import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { Button, Badge, Modal } from './UIComponents';

// Declaration for CDN libraries (jsPDF)
declare const jspdf: any;

interface DatasetExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    questions: Question[];
    papers: { id: string; filename: string }[];
}

type ExportFormat = 'jsonl' | 'txt' | 'pdf';

interface ExportItem {
    id: string;
    prompt: string;
    completion: string;
    meta: {
        topic: string;
        marks: number | null;
        verified: boolean;
        source: string;
        timestamp: string;
    };
}

const DatasetExportModal: React.FC<DatasetExportModalProps> = ({
    isOpen,
    onClose,
    questions,
    papers
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(questions.map(q => q.id)));
    const [format, setFormat] = useState<ExportFormat>('jsonl');
    const [isExporting, setIsExporting] = useState(false);

    // Reset selections when questions change
    React.useEffect(() => {
        setSelectedIds(new Set(questions.map(q => q.id)));
    }, [questions]);

    // Get paper filename by id
    const getPaperName = (paperId: string) => {
        return papers.find(p => p.id === paperId)?.filename || 'Unknown';
    };

    // Computed values
    const selectedQuestions = useMemo(() =>
        questions.filter(q => selectedIds.has(q.id)),
        [questions, selectedIds]
    );

    const isAllSelected = selectedIds.size === questions.length && questions.length > 0;

    // Toggle single selection
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

    // Toggle all
    const toggleAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(questions.map(q => q.id)));
        }
    };

    // Build export items
    const buildExportItems = (): ExportItem[] => {
        return selectedQuestions.map(q => ({
            id: q.id,
            prompt: q.fullText,
            completion: '', // Empty by default, can be filled later
            meta: {
                topic: q.topic || 'Uncategorized',
                marks: q.marks,
                verified: !q.isHidden, // isHidden = false means verified
                source: getPaperName(q.sourcePaperId),
                timestamp: new Date().toISOString()
            }
        }));
    };

    // Export as JSONL
    const exportJSONL = () => {
        const items = buildExportItems();
        const content = items.map(item => JSON.stringify(item)).join('\n');
        downloadFile(content, 'dataset_export.jsonl', 'application/jsonl');
    };

    // Export as TXT
    const exportTXT = () => {
        const items = buildExportItems();
        const content = items.map((item, idx) => {
            return [
                `--- Question ${idx + 1} ---`,
                `ID: ${item.id}`,
                `Prompt: ${item.prompt}`,
                `Topic: ${item.meta.topic}`,
                `Marks: ${item.meta.marks ?? 'N/A'}`,
                `Verified: ${item.meta.verified ? 'Yes' : 'No'}`,
                `Source: ${item.meta.source}`,
                ''
            ].join('\n');
        }).join('\n');
        downloadFile(content, 'dataset_export.txt', 'text/plain');
    };

    // Export as PDF
    const exportPDF = async () => {
        setIsExporting(true);
        try {
            const { jsPDF } = jspdf;
            const doc = new jsPDF();

            let yPos = 20;
            const margin = 20;
            const pageWidth = doc.internal.pageSize.getWidth();
            const maxLineWidth = pageWidth - margin * 2;

            // Title
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Dataset Export', margin, yPos);
            yPos += 10;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()} | Total: ${selectedQuestions.length} questions`, margin, yPos);
            doc.setTextColor(0);
            yPos += 15;

            doc.setFontSize(11);

            selectedQuestions.forEach((q, i) => {
                // Check if need new page
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }

                // Question number and text
                const title = `${i + 1}. ${q.fullText}`;
                const splitTitle = doc.splitTextToSize(title, maxLineWidth);
                doc.setFont('helvetica', 'bold');
                doc.text(splitTitle, margin, yPos);
                yPos += splitTitle.length * 5 + 2;

                // Metadata line
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100);
                const meta = `Topic: ${q.topic || 'N/A'} | Marks: ${q.marks ?? 'N/A'} | Verified: ${!q.isHidden ? 'Yes' : 'No'} | Source: ${getPaperName(q.sourcePaperId)}`;
                doc.text(meta, margin, yPos);
                doc.setTextColor(0);
                doc.setFontSize(11);
                yPos += 8;

                // Separator line
                doc.setDrawColor(220);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 10;
            });

            doc.save('dataset_export.pdf');
        } catch (e) {
            console.error('PDF Export failed', e);
            alert('Failed to export PDF. Make sure jsPDF is loaded.');
        } finally {
            setIsExporting(false);
        }
    };

    // File download helper
    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Handle export
    const handleExport = () => {
        if (selectedQuestions.length === 0) {
            alert('Please select at least one question to export.');
            return;
        }

        switch (format) {
            case 'jsonl':
                exportJSONL();
                break;
            case 'txt':
                exportTXT();
                break;
            case 'pdf':
                exportPDF();
                break;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600">
                    <div>
                        <h3 className="font-bold text-lg text-white">Export Dataset</h3>
                        <p className="text-indigo-100 text-sm">Export selected questions for training or analysis</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Format Selector */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-6">
                        <span className="text-sm font-medium text-slate-700">Export Format:</span>
                        <div className="flex gap-4">
                            {(['jsonl', 'txt', 'pdf'] as ExportFormat[]).map(f => (
                                <label key={f} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="format"
                                        value={f}
                                        checked={format === f}
                                        onChange={() => setFormat(f)}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`text-sm font-medium ${format === f ? 'text-indigo-600' : 'text-slate-600'}`}>
                                        {f.toUpperCase()}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="ml-auto text-sm text-slate-500">
                            {selectedIds.size} of {questions.length} selected
                        </div>
                    </div>
                </div>

                {/* Questions Table */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-200">
                                <th className="py-3 px-2 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleAll}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                </th>
                                <th className="py-3 px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Question
                                </th>
                                <th className="py-3 px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                                    Topic
                                </th>
                                <th className="py-3 px-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                                    Marks
                                </th>
                                <th className="py-3 px-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                                    Verified
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {questions.map((q, idx) => (
                                <tr
                                    key={q.id}
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(q.id) ? 'bg-indigo-50/50' : ''}`}
                                    onClick={() => toggleSelection(q.id)}
                                >
                                    <td className="py-3 px-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(q.id)}
                                            onChange={() => toggleSelection(q.id)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-slate-400 text-sm font-mono">{idx + 1}.</span>
                                            <p className="text-sm text-slate-800 line-clamp-2">{q.fullText}</p>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2">
                                        <Badge>{q.topic || 'N/A'}</Badge>
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                        {q.marks ? (
                                            <Badge color="yellow">{q.marks}M</Badge>
                                        ) : (
                                            <span className="text-slate-400 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                        {!q.isHidden ? (
                                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                                                </svg>
                                                Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                                </svg>
                                                Unverified
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {questions.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <p>No questions available for export.</p>
                            <p className="text-sm mt-2">Select questions from the browser first.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                        {format === 'jsonl' && (
                            <span>Schema: <code className="bg-slate-200 px-1 rounded text-xs">{'{id, prompt, completion, meta}'}</code></span>
                        )}
                        {format === 'txt' && <span>Plain text format with metadata</span>}
                        {format === 'pdf' && <span>PDF document with formatted questions</span>}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleExport}
                            disabled={selectedIds.size === 0 || isExporting}
                            className="flex items-center gap-2"
                        >
                            {isExporting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Download {format.toUpperCase()}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatasetExportModal;
