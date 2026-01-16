import React, { useState, useRef } from 'react';
import { Question } from '../types';
import { Button, Card, Badge } from './UIComponents';

// Declaration for CDN libraries
declare const html2canvas: any;
declare const jspdf: any;

interface ExportScreenProps {
  questions: Question[];
  onBack: () => void;
}

const ExportScreen: React.FC<ExportScreenProps> = ({ questions, onBack }) => {
  const [format, setFormat] = useState<'txt' | 'json' | 'html'>('txt');
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadFile = () => {
    let content = '';
    const filename = `exam_questions_export.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(questions, null, 2);
    } else if (format === 'html') {
      content = `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .question { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                .meta { color: #666; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <h1>Exported Questions</h1>
            ${questions.map((q, i) => `
                <div class="question">
                    <h3>${i+1}. ${q.fullText} (${q.marks ? q.marks + ' Marks' : 'Marks N/A'})</h3>
                    <div class="meta">
                        Topic: ${q.topic} | Type: ${q.type} | Original: Q${q.mainQuestionNumber}${q.subQuestionLabel || ''}
                    </div>
                </div>
            `).join('')}
        </body>
        </html>
      `;
    } else {
      // TXT format
      content = questions.map((q, i) => {
        return `${i+1}. ${q.fullText}  [${q.marks ? q.marks + 'M' : ''}] \n   (Topic: ${q.topic}) \n`;
      }).join('\n-----------------------------------\n\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const { jsPDF } = jspdf;
      const doc = new jsPDF();
      
      let yPos = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxLineWidth = pageWidth - margin * 2;

      doc.setFontSize(18);
      doc.text("Exam Questions Export", margin, yPos);
      yPos += 15;
      
      doc.setFontSize(11);

      questions.forEach((q, i) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const title = `${i + 1}. ${q.fullText} [${q.marks ? q.marks + 'M' : 'NA'}]`;
        const details = `   (Topic: ${q.topic} | Type: ${q.type})`;

        const splitTitle = doc.splitTextToSize(title, maxLineWidth);
        doc.text(splitTitle, margin, yPos);
        yPos += (splitTitle.length * 5) + 2;

        doc.setTextColor(100);
        doc.setFontSize(9);
        doc.text(details, margin, yPos);
        doc.setTextColor(0);
        doc.setFontSize(11);
        yPos += 8;
        
        // Separator line
        doc.setDrawColor(200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
      });

      doc.save("exam_questions.pdf");
    } catch (e) {
      console.error("PDF Export failed", e);
      alert("Failed to export PDF. Please try Text export instead.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Higher quality
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = 'exam_questions.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error("Image Export failed", e);
      alert("Failed to export Image. Please try Text export instead.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={onBack} className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Browser
        </Button>
        <h2 className="text-2xl font-bold text-slate-900">Review & Export</h2>
        <div className="w-24"></div> {/* Spacer */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: List (Wrapped for Capture) */}
        <div className="md:col-span-2 space-y-4" ref={printRef} style={{ padding: '20px', background: 'white' }}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Selected Questions ({questions.length})</h3>
            {questions.map((q, i) => (
                <Card key={q.id} className="p-4 bg-white mb-4 border-slate-200">
                    <div className="flex gap-3">
                        <span className="font-bold text-slate-400 select-none">{i+1}.</span>
                        <div className="flex-1">
                            <p className="text-slate-900 mb-2">{q.fullText}</p>
                            <div className="flex gap-2">
                                <Badge>{q.topic}</Badge>
                                {q.marks && <Badge color="yellow">{q.marks}M</Badge>}
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>

        {/* Right Column: Actions */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 h-fit sticky top-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Export Options</h3>
            
            {/* File Format Export */}
            <div className="mb-6 pb-6 border-b border-slate-100">
                <label className="block text-sm font-medium text-slate-900 mb-2">Text/Code Format</label>
                <div className="flex gap-2 mb-3">
                    <select 
                        value={format} 
                        onChange={(e) => setFormat(e.target.value as any)}
                        className="flex-1 border-slate-300 rounded-lg p-2 border text-sm"
                    >
                        <option value="txt">Plain Text (.txt)</option>
                        <option value="html">HTML Doc (.html)</option>
                        <option value="json">JSON Data (.json)</option>
                    </select>
                </div>
                <Button onClick={handleDownloadFile} variant="primary" className="w-full justify-center text-sm py-2">
                    Download File
                </Button>
            </div>

            {/* Visual Export */}
            <div>
                 <label className="block text-sm font-medium text-slate-900 mb-2">Visual Format</label>
                 <div className="space-y-3">
                    <Button 
                        onClick={handleExportPDF} 
                        variant="outline" 
                        disabled={isExporting}
                        className="w-full justify-center text-sm py-2 flex items-center"
                    >
                        {isExporting ? 'Generating...' : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                Export as PDF
                            </>
                        )}
                    </Button>
                    <Button 
                        onClick={handleExportImage} 
                        variant="outline" 
                        disabled={isExporting}
                        className="w-full justify-center text-sm py-2 flex items-center"
                    >
                        {isExporting ? 'Capturing...' : (
                             <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                </svg>
                                Export as Image
                            </>
                        )}
                    </Button>
                 </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 text-sm text-slate-600">
                <p>Tips:</p>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>PDF export is best for printing.</li>
                    <li>Image export saves the current view as a long PNG.</li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportScreen;