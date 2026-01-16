"""
ExamExtractor RAG Backend - FastAPI Application

This is the main entry point for the RAG backend server.
Run with: uvicorn main:app --reload

Endpoints:
- POST /ingest  - Ingest exam questions into the RAG system
- POST /query   - Query for relevant questions
- GET  /health  - Health check and system status
- POST /clear   - Clear the index (admin)
"""

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import (
    API_TITLE, 
    API_VERSION, 
    API_HOST, 
    API_PORT,
    CORS_ORIGINS,
    EMBEDDING_MODEL
)
from models.schemas import (
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    QueryResult,
    HealthResponse
)
from services.retrieval_pipeline import RetrievalPipeline


# Global pipeline instance
pipeline: Optional[RetrievalPipeline] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Initializes the retrieval pipeline on startup.
    """
    global pipeline
    print("Initializing RAG pipeline...")
    pipeline = RetrievalPipeline()
    print(f"Pipeline ready. Index contains {pipeline.index_size} documents.")
    yield
    print("Shutting down RAG pipeline...")


# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description="RAG backend for ExamExtractor - semantic search over exam questions",
    lifespan=lifespan
)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API info."""
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """
    Health check endpoint.
    
    Returns system status including:
    - Whether the index is loaded
    - Number of documents in the index
    - Current embedding model
    """
    return HealthResponse(
        status="healthy",
        index_loaded=pipeline is not None,
        document_count=pipeline.index_size if pipeline else 0,
        embedding_model=EMBEDDING_MODEL
    )


@app.post("/ingest", response_model=IngestResponse, tags=["RAG"])
async def ingest_documents(request: IngestRequest):
    """
    Ingest exam questions into the RAG system.
    
    Send a list of questions extracted from exam papers.
    The questions will be processed, embedded, and added to the FAISS index.
    
    **Request Body:**
    - `questions`: List of question objects with text, topic, marks, etc.
    
    **Example:**
    ```json
    {
        "questions": [
            {
                "id": "q1",
                "fullText": "Define thermodynamics and its laws.",
                "topic": "Thermodynamics",
                "marks": 5,
                "type": "Short Answer",
                "sourcePaperId": "paper_2024"
            }
        ]
    }
    ```
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    
    if not request.questions:
        raise HTTPException(status_code=400, detail="No questions provided")
    
    try:
        result = pipeline.ingest(request.questions)
        
        return IngestResponse(
            status=result["status"],
            documents_ingested=result["documents_ingested"],
            index_size=result["index_size"],
            message=result.get("message")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/query", response_model=QueryResponse, tags=["RAG"])
async def query_documents(request: QueryRequest):
    """
    Query the RAG system for relevant questions.
    
    Search for exam questions similar to the query text.
    Optionally filter by topic, type, marks range, or paper ID.
    
    **Request Body:**
    - `query`: Search query text
    - `top_k`: Number of results to return (1-50, default: 5)
    - `filters`: Optional filters (topics, types, min_marks, max_marks, paper_ids)
    
    **Example:**
    ```json
    {
        "query": "entropy calculation problems",
        "top_k": 5,
        "filters": {
            "topics": ["Thermodynamics"],
            "min_marks": 5
        }
    }
    ```
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    
    try:
        # Convert filter model to dict if present
        filters_dict = None
        if request.filters:
            filters_dict = {
                "topics": request.filters.topics,
                "types": request.filters.types,
                "paper_ids": request.filters.paper_ids,
                "min_marks": request.filters.min_marks,
                "max_marks": request.filters.max_marks
            }
            # Remove None values
            filters_dict = {k: v for k, v in filters_dict.items() if v is not None}
        
        result = pipeline.query(
            query_text=request.query,
            top_k=request.top_k,
            filters=filters_dict
        )
        
        # Convert to response model
        results = [
            QueryResult(
                id=r["id"],
                text=r["text"],
                topic=r["topic"],
                type=r["type"],
                marks=r["marks"],
                paper_id=r["paper_id"],
                score=r["score"],
                page_number=r.get("page_number"),
                main_question_number=r.get("main_question_number"),
                sub_question_label=r.get("sub_question_label")
            )
            for r in result["results"]
        ]
        
        return QueryResponse(
            results=results,
            query_time_ms=result["query_time_ms"],
            total_documents=result["total_documents"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.post("/context", tags=["RAG"])
async def get_generation_context(request: QueryRequest):
    """
    Get formatted context for LLM generation.
    
    This endpoint is designed for use with a /generate endpoint.
    It returns the retrieved documents formatted as a context string
    suitable for passing to an LLM.
    
    **Request Body:** Same as /query
    
    **Returns:** Formatted context string
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    
    try:
        filters_dict = None
        if request.filters:
            filters_dict = {
                "topics": request.filters.topics,
                "types": request.filters.types,
                "paper_ids": request.filters.paper_ids,
                "min_marks": request.filters.min_marks,
                "max_marks": request.filters.max_marks
            }
            filters_dict = {k: v for k, v in filters_dict.items() if v is not None}
        
        context = pipeline.get_context_for_generation(
            query_text=request.query,
            top_k=request.top_k,
            filters=filters_dict
        )
        
        return {
            "context": context,
            "document_count": len(context.split("\n\n")) if context else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Context retrieval failed: {str(e)}")


@app.get("/stats", tags=["System"])
async def get_stats():
    """
    Get detailed system statistics.
    
    Returns information about:
    - Index statistics
    - Embedding cache status
    - Ingestion history
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    
    return pipeline.get_stats()


@app.post("/clear", tags=["Admin"])
async def clear_index():
    """
    Clear the entire index.
    
    **WARNING:** This will delete all indexed documents.
    Use with caution in production.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    
    pipeline.clear_index()
    
    return {
        "status": "success",
        "message": "Index cleared successfully",
        "index_size": pipeline.index_size
    }


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
