import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType, PredictionReport } from "../types";
import { computeUncertaintyIndex } from "../types/uncertaintyIndex";

// Define the response schema for strict JSON output
const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    extracted_questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          main_number: { type: Type.STRING, description: "The main question number (e.g., '1', '2', 'Q3')" },
          sub_label: { type: Type.STRING, description: "Subpart label if exists (e.g., 'a', 'b', 'i'), else null", nullable: true },
          text: { type: Type.STRING, description: "The content of the question" },
          marks: { type: Type.INTEGER, description: "Marks assigned to this specific part", nullable: true },
          type: {
            type: Type.STRING,
            enum: [
              "Short Answer",
              "Long Answer",
              "MCQ",
              "Fill in the Blanks",
              "True/False",
              "Unknown"
            ]
          },
          topic: { type: Type.STRING, description: "Inferred topic or chapter (e.g., 'Thermodynamics', 'Calculus')" },
          confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0 indicating OCR and classification certainty." }
        },
        required: ["main_number", "text", "type", "topic", "confidence"]
      }
    }
  }
};

const predictionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    focusMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topicName: { type: Type.STRING },
          probability: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          avgMarks: { type: Type.STRING, description: "e.g. '5-10M'" },
          commonQuestionTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
          trend: { type: Type.STRING, enum: ["rising", "falling", "stable", "erratic"] },
          coverageGap: { type: Type.BOOLEAN, description: "True if historically important but missed in recent papers" }
        },
        required: ["topicName", "probability", "avgMarks", "commonQuestionTypes", "trend", "coverageGap"]
      }
    },
    predictedQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["repeated", "template", "concept"] },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
          sourceTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          reason: { type: Type.STRING }
        },
        required: ["text", "type", "confidence", "sourceTopics", "reason"]
      }
    },
    strategy: { type: Type.STRING }
  },
  required: ["focusMap", "predictedQuestions", "strategy"]
};

// Custom error class for API errors
export class GeminiAPIError extends Error {
  code: string;
  isRateLimit: boolean;
  retryAfter?: number;

  constructor(message: string, code: string, isRateLimit = false, retryAfter?: number) {
    super(message);
    this.name = 'GeminiAPIError';
    this.code = code;
    this.isRateLimit = isRateLimit;
    this.retryAfter = retryAfter;
  }
}

// Helper function to detect and parse rate limit errors
const handleAPIError = (error: any): never => {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorStatus = error?.status || error?.code;

  // Rate limit detection (429, RESOURCE_EXHAUSTED, quota exceeded)
  if (
    errorStatus === 429 ||
    errorMessage.includes('429') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('exceeded')
  ) {
    // Try to extract retry-after time
    let retryAfter: number | undefined;
    const retryMatch = errorMessage.match(/retry after (\d+)/i);
    if (retryMatch) {
      retryAfter = parseInt(retryMatch[1]);
    }

    throw new GeminiAPIError(
      `⚠️ Rate Limit Exceeded: You've hit the API rate limit. Please wait ${retryAfter ? `${retryAfter} seconds` : 'a few minutes'} before trying again.`,
      'RATE_LIMIT',
      true,
      retryAfter
    );
  }

  // API Key errors (401, 403)
  if (
    errorStatus === 401 ||
    errorStatus === 403 ||
    errorMessage.includes('401') ||
    errorMessage.includes('403') ||
    errorMessage.includes('API Key') ||
    errorMessage.includes('PERMISSION_DENIED') ||
    errorMessage.includes('Unauthorized')
  ) {
    throw new GeminiAPIError(
      'Invalid API Key: Please check your Gemini API key in settings.',
      'AUTH_ERROR',
      false
    );
  }

  // Model overloaded
  if (
    errorMessage.includes('overloaded') ||
    errorMessage.includes('503') ||
    errorMessage.includes('SERVICE_UNAVAILABLE')
  ) {
    throw new GeminiAPIError(
      'Service Temporarily Unavailable: The Gemini API is currently overloaded. Please try again in a few minutes.',
      'SERVICE_UNAVAILABLE',
      false
    );
  }

  // Generic error
  throw new GeminiAPIError(
    `API Error: ${errorMessage}`,
    'UNKNOWN',
    false
  );
};

export const processPaperWithGemini = async (
  base64Images: string[],
  paperId: string,
  onProgress: (msg: string) => void,
  apiKey?: string
): Promise<Question[]> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) {
    throw new Error("API Key is missing. Please add it in settings.");
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const allQuestions: Question[] = [];

  // Process pages in batches or individually to avoid payload limits. 

  for (let i = 0; i < base64Images.length; i++) {
    onProgress(`Analyzing page ${i + 1} of ${base64Images.length}...`);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png', // Matched with pdfService
                data: base64Images[i]
              }
            },
            {
              text: `You are an expert OCR and exam digitization engine. Your ONLY goal is to extract questions from this image with 100% completeness and accuracy.

              ### CRITICAL LAYOUT & PARSING RULES:
              1. **NO SKIPPING**: Extract EVERY single question found on the page. Even if it seems small or part of a list (i, ii, iii). Do not summarize.
              2. **COLUMNS**: Be careful with 2-column layouts. Read Column 1 (top-down) then Column 2 (top-down). Do not read across columns.
              3. **INLINE QUESTIONS**: If multiple questions are on one line (e.g., "1. Define X. 2. Define Y."), split them into separate entries.
              4. **TABLES & BOXES**: Look for questions inside borders, boxes, or tables.
              
              ### QUESTION NUMBER DETECTION:
              1. **Main Question Numbers**: Look for patterns like "1.", "Q1.", "1)", "Question 1", or just "1" at the start.
              2. **Sub-Questions**: Identify (a), (b), (c) OR (i), (ii), (iii) OR a), b), c) as sub-labels.
              3. **Each sub-question is a SEPARATE entry** with its own text, marks, and the parent main_number.
              4. **Example**: Q1 has parts (a), (b), (c) → Create 3 entries: main_number="1", sub_label="a", "b", "c" respectively.
              
              ### MARKS & TYPES LOGIC:
              1. **Section Marks**: Check section headers like "Part A (10 x 2 = 20)". Apply "2 marks" to all questions in that section if individual marks are missing.
              2. **2-Mark Rule**: If marks ≤ 2, classify as "Short Answer" unless it's MCQ/Fill-in/True-False.
              3. **Marks Location**: Look in margins, end of lines [2], brackets (2M), or section headers.

              ### TEXT CLEANUP - CRITICAL:
              1. **PRESERVE SPACES**: Keep spaces between words. "Define entropy" stays as "Define entropy", NOT "Defineentropy".
              2. **Only fix obvious OCR breaks**: Single characters separated by space that form a word (e.g., "t h e r m o" → "thermo").
              3. **Mathematical notation**: Keep LaTeX/math symbols. Use ^ for superscripts, _ for subscripts.
              4. **Remove junk**: Page numbers ("Page 1 of 3"), footers ("Turn Over"), headers that aren't questions.
              5. **Punctuation**: Preserve periods, colons, question marks. These help identify question boundaries.

              ### CONFIDENCE SCORE:
              - 1.0 = Clear text, unambiguous marks, standard layout.
              - 0.8-0.9 = Minor OCR issues but meaning is clear.
              - < 0.8 = Blurry text, guessed marks, or complex/broken layout.
              
              Output strictly in JSON format.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: questionSchema,
          systemInstruction: "You are a meticulous academic archivist. You never miss a question. You handle complex layouts, small fonts, and dense text with ease. You prefer splitting complex questions into sub-parts rather than merging them.",
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        if (parsed.extracted_questions && Array.isArray(parsed.extracted_questions)) {
          const pageQuestions: Question[] = parsed.extracted_questions.map((q: any) => {
            // Post-processing logic to enforce business rules
            let finalType = q.type as QuestionType;

            // Rule: If marks are 1 or 2, and it's not clearly an objective type, force Short Answer
            // This overrides AI classification if it gets confused
            if (q.marks !== null && q.marks <= 2) {
              if (finalType !== QuestionType.MCQ &&
                finalType !== QuestionType.FILL_IN_BLANKS &&
                finalType !== QuestionType.TRUE_FALSE) {
                finalType = QuestionType.SHORT_ANSWER;
              }
            }

            return {
              id: crypto.randomUUID(),
              mainQuestionNumber: q.main_number,
              subQuestionLabel: q.sub_label || null,
              fullText: q.text,
              marks: q.marks || null,
              type: finalType,
              sourcePaperId: paperId,
              topic: q.topic || "General",
              pageNumber: i + 1,
              confidenceScore: q.confidence
            };
          });
          allQuestions.push(...pageQuestions);
        }
      }
    } catch (err: any) {
      console.error(`Error processing page ${i + 1}`, err);

      // Check if it's a rate limit or auth error - stop processing
      try {
        handleAPIError(err);
      } catch (apiError) {
        if (apiError instanceof GeminiAPIError && (apiError.isRateLimit || apiError.code === 'AUTH_ERROR')) {
          throw apiError; // Rethrow to stop all processing
        }
      }
      // Continue to next page for other errors
    }
  }

  return allQuestions;
};

export const analyzeExamPatterns = async (
  questions: Question[],
  syllabusText: string | null,
  apiKey?: string
): Promise<PredictionReport> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing. Please add it in settings.");

  const ai = new GoogleGenAI({ apiKey: key });

  // Minimize the payload by removing unnecessary fields for analysis
  const simplifiedQuestions = questions.map(q => ({
    text: q.fullText,
    marks: q.marks,
    type: q.type,
    topic: q.topic,
    paperId: q.sourcePaperId
  }));

  const promptText = `
    You are an expert academic strategist and statistical analyst.
    
    I am providing you with a list of extracted questions from past exam papers.
    ${syllabusText ? `Here is the Syllabus/Focus Area context: "${syllabusText}"` : "No specific syllabus provided, infer from question content."}

    Your goal is to generate a "Next Paper Prediction" for students.

    ### 1. FOCUS MAP ANALYSIS
    - Group questions by Topic/Concept.
    - Calculate frequency and total marks weightage for each topic.
    - **Trend Analysis**:
      - If a topic appears in *every* paper, it is "High" probability.
      - If a topic has high marks but was MISSING in the most recent paper (infer purely from data variance), it might have a "Coverage Gap" (likely to return).
      - If a topic appears rarely, it is "Low".

    ### 2. PREDICTED QUESTIONS
    - Identify **Repeated Questions**: Exact or near-exact duplicates. Label as "repeated".
    - Create **Template Questions**: For high-probability topics, create a "Question Template". 
      - Example: If "Calculate Entropy" appears often with different numbers, the template is "Numerical problem on Entropy calculation".
      - Label as "template".
    - Suggest **Concept Questions**: Important definitions or derivations that are statistically due.

    ### 3. OUTPUT RULES
    - Be realistic. Do not promise certainty.
    - "Coverage Gap" is true if a historically important topic hasn't appeared recently.
    - "Trend" should vary (rising/falling/stable).

    Return JSON matching the schema.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: JSON.stringify(simplifiedQuestions) },
        { text: promptText }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: predictionSchema,
      systemInstruction: "You are a specialized Exam Predictor AI. You analyze datasets of past questions to find statistical patterns, biases, and anomalies to help students study smarter.",
    }
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("Failed to generate prediction analysis.");

  const parsed = JSON.parse(jsonText);

  // Compute uncertainty index from the input questions
  const uncertaintyIndex = computeUncertaintyIndex(questions);

  return {
    generatedAt: Date.now(),
    focusMap: parsed.focusMap,
    predictedQuestions: parsed.predictedQuestions.map((q: any) => ({ ...q, id: crypto.randomUUID() })),
    strategy: parsed.strategy,
    uncertaintyIndex
  };
};

export const generateSimilarQuestions = async (
  questionText: string,
  topic: string,
  apiKey?: string
): Promise<string[]> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `
    You are an expert teacher.
    I need 5 similar practice questions based on the following question.
    Original Question: "${questionText}"
    Topic: "${topic}"
    
    Rules:
    1. Keep the same difficulty level.
    2. Keep the same question type (e.g. if it's a definition, give definitions; if numerical, give numericals with different values).
    3. Ensure they are relevant to the topic.
    
    Output strictly a JSON array of strings.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  const jsonText = response.text;
  if (!jsonText) return [];

  const parsed = JSON.parse(jsonText);
  if (Array.isArray(parsed)) {
    return parsed as string[];
  }
  return [];
};