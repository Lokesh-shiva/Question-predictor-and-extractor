export enum QuestionType {
  SHORT_ANSWER = "Short Answer",
  LONG_ANSWER = "Long Answer",
  MCQ = "MCQ",
  FILL_IN_BLANKS = "Fill in the Blanks",
  TRUE_FALSE = "True/False",
  UNKNOWN = "Unknown"
}

export interface Question {
  id: string; // Unique internal ID
  mainQuestionNumber: string; // e.g., "1", "2"
  subQuestionLabel: string | null; // e.g., "a", "b", "i"
  fullText: string;
  marks: number | null;
  type: QuestionType;
  sourcePaperId: string;
  topic: string;
  pageNumber: number;
  confidenceScore?: number;
  isImportant?: boolean;
  isHidden?: boolean;
  similarQuestions?: string[]; // Array of AI-generated similar questions
  isGeneratingSimilar?: boolean; // Loading state for similar question generation
}

export interface Paper {
  id: string;
  filename: string;
  uploadDate: number;
  status: 'processing' | 'done' | 'error';
  totalQuestions: number;
  errorMsg?: string;
}

export interface FilterCriteria {
  id: string;
  types: QuestionType[];
  topics: string[];
  minMarks: number | null;
  maxMarks: number | null;
  paperIds: string[];
  searchQuery: string;
  minFrequency: number;
}

export interface FilterState {
  groups: FilterCriteria[];
  activeGroupId: string; // The group currently being edited in the UI
}

export type ViewMode = 'separated' | 'grouped' | 'topic' | 'marks' | 'page';

// --- Predictor Module Types ---

export interface PredictedQuestion {
  id: string;
  text: string;
  type: 'repeated' | 'template' | 'concept'; // Is this a literal repeat, a template variation, or a core concept?
  confidence: 'high' | 'medium' | 'low';
  sourceTopics: string[];
  reason: string; // e.g., "Appeared in 3/5 papers"
}

export interface TopicAnalysis {
  topicName: string;
  probability: 'High' | 'Medium' | 'Low';
  avgMarks: string; // e.g., "5-10M"
  commonQuestionTypes: string[]; // e.g., ["Numerical", "Derivation"]
  trend: 'rising' | 'falling' | 'stable' | 'erratic';
  lastAppearedYear?: string;
  coverageGap: boolean; // True if important but missed recently
}

export interface PredictionReport {
  generatedAt: number;
  focusMap: TopicAnalysis[];
  predictedQuestions: PredictedQuestion[];
  strategy: string; // General advice text
}