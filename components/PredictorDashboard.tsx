import React from 'react';
import { PredictionReport, TopicAnalysis, PredictedQuestion } from '../types';
import { Badge, Button, Card } from './UIComponents';

interface PredictorDashboardProps {
  report: PredictionReport;
  onReset: () => void;
}

const PredictorDashboard: React.FC<PredictorDashboardProps> = ({ report, onReset }) => {
  
  const getProbabilityColor = (prob: string) => {
    switch (prob.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const downloadPrediction = () => {
    const content = `
EXAM PREDICTION REPORT
Generated on: ${new Date(report.generatedAt).toLocaleDateString()}
--------------------------------------------------

STRATEGY ADVICE:
${report.strategy}

--------------------------------------------------
FOCUS MAP (HIGH PROBABILITY TOPICS):
${report.focusMap.filter(t => t.probability === 'High').map(t => 
  `- ${t.topicName} (Avg: ${t.avgMarks}) [Types: ${t.commonQuestionTypes.join(', ')}]`
).join('\n')}

--------------------------------------------------
PREDICTED & MUST-PRACTICE QUESTIONS:
${report.predictedQuestions.map((q, i) => 
  `${i+1}. [${q.confidence.toUpperCase()}] ${q.text}
     Reason: ${q.reason}
`).join('\n')}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prediction_Strategy_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Disclaimer */}
      <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Next Paper Predictor</h2>
                    <p className="text-indigo-200 text-sm max-w-2xl">
                        Based on statistical analysis of your uploaded papers. 
                        <br/>
                        <span className="font-bold text-yellow-300">Disclaimer:</span> These are probability-based predictions, not guarantees. Use this to prioritize, but study the full syllabus.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={downloadPrediction}>Export Plan</Button>
                    <Button variant="outline" className="text-white border-indigo-400 hover:bg-indigo-800" onClick={onReset}>New Analysis</Button>
                </div>
            </div>
            
            <div className="mt-6 bg-indigo-800/50 p-4 rounded-lg border border-indigo-700">
                <h4 className="text-xs font-bold text-indigo-300 uppercase mb-1">AI Strategy Insight</h4>
                <p className="text-sm leading-relaxed">{report.strategy}</p>
            </div>
        </div>
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Focus Map */}
        <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2 text-indigo-600">
                        <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 5.25V4.5Z" clipRule="evenodd" />
                    </svg>
                    Focus Map
                </h3>
                <span className="text-sm text-slate-500">Prioritize High & Rising topics</span>
            </div>

            <div className="grid gap-4">
                {report.focusMap.sort((a,b) => (a.probability === 'High' ? -1 : 1)).map((topic, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white hover:shadow-md transition-shadow ${topic.probability === 'High' ? 'border-l-4 border-l-green-500 shadow-sm' : 'border-slate-200'}`}>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-lg text-slate-800">{topic.topicName}</h4>
                                {topic.coverageGap && (
                                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                        Gap Detected
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                <span>Avg Weightage: <strong className="text-slate-700">{topic.avgMarks}</strong></span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full self-center"></span>
                                <span>Usually: {topic.commonQuestionTypes.join(', ')}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                             <div className="text-right">
                                <div className={`px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide text-center ${getProbabilityColor(topic.probability)}`}>
                                    {topic.probability} Prob.
                                </div>
                                <div className={`text-[10px] mt-1 text-center font-medium ${topic.trend === 'rising' ? 'text-green-600' : topic.trend === 'falling' ? 'text-red-500' : 'text-slate-400'}`}>
                                    Trend: {topic.trend.charAt(0).toUpperCase() + topic.trend.slice(1)}
                                </div>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Right Col: Questions */}
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2 text-indigo-600">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
                </svg>
                Predicted Questions
            </h3>

            <div className="space-y-4">
                {report.predictedQuestions.map((q, idx) => (
                    <Card key={q.id} className="p-4 bg-white border-l-4 border-l-indigo-500">
                        <div className="mb-2 flex justify-between items-start">
                            <Badge color={q.type === 'repeated' ? 'red' : q.type === 'template' ? 'blue' : 'gray'}>
                                {q.type === 'repeated' ? 'Repeated' : q.type === 'template' ? 'Pattern Match' : 'Concept'}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{q.confidence} Confidence</span>
                        </div>
                        <p className="font-medium text-slate-800 text-sm mb-2">
                            {q.text}
                        </p>
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 italic">
                            Why: {q.reason}
                        </div>
                    </Card>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default PredictorDashboard;
