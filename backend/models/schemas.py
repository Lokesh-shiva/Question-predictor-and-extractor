"""
Pydantic schemas for API request/response models.

These models define the data structures used by the RAG API endpoints.
All models use Pydantic v2 syntax for validation and serialization.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QuestionDocument(BaseModel):
    """
    Represents a single exam question document for ingestion.
    
    This schema matches the Question interface from the frontend's types.ts,
    making it easy to send extracted questions directly to the backend.
    """
    id: str = Field(..., description="Unique identifier for the question")
    text: str = Field(..., description="The full text of the question", alias="fullText")
    topic: str = Field(default="General", description="Topic or chapter classification")
    marks: Optional[int] = Field(default=None, description="Marks assigned to the question")
    type: str = Field(default="Unknown", description="Question type (Short Answer, MCQ, etc.)")
    paper_id: str = Field(..., description="ID of the source paper", alias="sourcePaperId")
    page_number: Optional[int] = Field(default=None, description="Page number in source", alias="pageNumber")
    main_question_number: Optional[str] = Field(default=None, alias="mainQuestionNumber")
    sub_question_label: Optional[str] = Field(default=None, alias="subQuestionLabel")
    
    class Config:
        # Allow both snake_case and camelCase field names
        populate_by_name = True


class IngestRequest(BaseModel):
    """Request payload for the /ingest endpoint."""
    questions: List[QuestionDocument] = Field(
        ..., 
        description="List of questions to ingest into the RAG system"
    )
    
    
class IngestResponse(BaseModel):
    """Response payload for the /ingest endpoint."""
    status: str = Field(default="success", description="Operation status")
    documents_ingested: int = Field(..., description="Number of documents successfully ingested")
    index_size: int = Field(..., description="Total number of documents in the index")
    message: Optional[str] = Field(default=None, description="Additional information")


class MetadataFilter(BaseModel):
    """
    Optional filters to apply during retrieval.
    
    All filters are optional - only specified filters are applied.
    Multiple values in a list are treated as OR conditions.
    """
    topics: Optional[List[str]] = Field(
        default=None, 
        description="Filter by topic names (OR logic)"
    )
    types: Optional[List[str]] = Field(
        default=None, 
        description="Filter by question types (OR logic)"
    )
    paper_ids: Optional[List[str]] = Field(
        default=None, 
        description="Filter by source paper IDs (OR logic)"
    )
    min_marks: Optional[int] = Field(
        default=None, 
        description="Minimum marks threshold"
    )
    max_marks: Optional[int] = Field(
        default=None, 
        description="Maximum marks threshold"
    )


class QueryRequest(BaseModel):
    """Request payload for the /query endpoint."""
    query: str = Field(..., description="Search query text")
    top_k: int = Field(
        default=5, 
        ge=1, 
        le=50, 
        description="Number of results to return (1-50)"
    )
    filters: Optional[MetadataFilter] = Field(
        default=None, 
        description="Optional metadata filters"
    )


class QueryResult(BaseModel):
    """A single result from the retrieval query."""
    id: str = Field(..., description="Document ID")
    text: str = Field(..., description="Question text")
    topic: str = Field(..., description="Topic classification")
    type: str = Field(..., description="Question type")
    marks: Optional[int] = Field(default=None, description="Marks if available")
    paper_id: str = Field(..., description="Source paper ID")
    score: float = Field(..., description="Similarity score (higher is better)")
    
    # Additional metadata
    page_number: Optional[int] = Field(default=None)
    main_question_number: Optional[str] = Field(default=None)
    sub_question_label: Optional[str] = Field(default=None)


class QueryResponse(BaseModel):
    """Response payload for the /query endpoint."""
    results: List[QueryResult] = Field(..., description="Retrieved documents")
    query_time_ms: float = Field(..., description="Query execution time in milliseconds")
    total_documents: int = Field(..., description="Total documents in index")


class HealthResponse(BaseModel):
    """Response payload for the /health endpoint."""
    status: str = Field(default="healthy")
    index_loaded: bool = Field(..., description="Whether the FAISS index is loaded")
    document_count: int = Field(..., description="Number of documents in index")
    embedding_model: str = Field(..., description="Current embedding model")
