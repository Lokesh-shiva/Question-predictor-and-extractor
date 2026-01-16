/**
 * RAG Service - Frontend Integration
 * 
 * This service provides methods to interact with the RAG backend.
 * It handles document ingestion, querying, and context retrieval.
 * 
 * Usage:
 *   import { ragService } from './ragService';
 *   
 *   // Ingest questions after extraction
 *   await ragService.ingestQuestions(questions);
 *   
 *   // Query for similar questions
 *   const results = await ragService.query("entropy problems", 5);
 */

import { Question } from '../types';

// RAG Backend URL - adjust if running on different port
const RAG_API_URL = 'http://localhost:8000';

/**
 * Response types from the RAG API
 */
export interface IngestResponse {
    status: string;
    documents_ingested: number;
    index_size: number;
    message?: string;
}

export interface QueryResult {
    id: string;
    text: string;
    topic: string;
    type: string;
    marks: number | null;
    paper_id: string;
    score: number;
    page_number?: number;
    main_question_number?: string;
    sub_question_label?: string;
}

export interface QueryResponse {
    results: QueryResult[];
    query_time_ms: number;
    total_documents: number;
}

export interface HealthStatus {
    status: string;
    index_loaded: boolean;
    document_count: number;
    embedding_model: string;
}

export interface QueryFilters {
    topics?: string[];
    types?: string[];
    paper_ids?: string[];
    min_marks?: number;
    max_marks?: number;
}

/**
 * RAG Service - API wrapper for the RAG backend
 */
class RAGService {
    private baseUrl: string;

    constructor(baseUrl: string = RAG_API_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Check if the RAG backend is available
     */
    async checkHealth(): Promise<HealthStatus | null> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.warn('RAG backend not available:', error);
            return null;
        }
    }

    /**
     * Ingest questions into the RAG system
     * 
     * Call this after extracting questions from papers to make them
     * searchable via semantic similarity.
     * 
     * @param questions - Array of Question objects to ingest
     * @returns Ingestion result with count of documents added
     */
    async ingestQuestions(questions: Question[]): Promise<IngestResponse> {
        const response = await fetch(`${this.baseUrl}/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ questions }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to ingest questions');
        }

        return await response.json();
    }

    /**
     * Query the RAG system for similar questions
     * 
     * @param query - Search query text
     * @param topK - Number of results to return (default: 5)
     * @param filters - Optional filters (topics, types, marks range)
     * @returns Query results with similarity scores
     */
    async query(
        query: string,
        topK: number = 5,
        filters?: QueryFilters
    ): Promise<QueryResponse> {
        const response = await fetch(`${this.baseUrl}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                top_k: topK,
                filters: filters || null,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Query failed');
        }

        return await response.json();
    }

    /**
     * Get formatted context for LLM generation
     * 
     * Use this when you need to get relevant context for an AI generation task.
     * 
     * @param query - Query to find relevant context for
     * @param topK - Number of context documents
     * @param filters - Optional filters
     * @returns Formatted context string
     */
    async getContext(
        query: string,
        topK: number = 5,
        filters?: QueryFilters
    ): Promise<{ context: string; document_count: number }> {
        const response = await fetch(`${this.baseUrl}/context`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                top_k: topK,
                filters: filters || null,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Context retrieval failed');
        }

        return await response.json();
    }

    /**
     * Get system statistics
     */
    async getStats(): Promise<any> {
        const response = await fetch(`${this.baseUrl}/stats`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error('Failed to get stats');
        }

        return await response.json();
    }

    /**
     * Clear the entire index
     * WARNING: This will delete all indexed documents
     */
    async clearIndex(): Promise<{ status: string; message: string }> {
        const response = await fetch(`${this.baseUrl}/clear`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Failed to clear index');
        }

        return await response.json();
    }
}

// Export a singleton instance
export const ragService = new RAGService();

// Also export the class for custom instances
export { RAGService };
