"""
Retrieval Pipeline

The main interface for RAG retrieval operations.
Orchestrates document ingestion, embedding, indexing, and search.

This is the primary class to use from external code (e.g., /generate endpoint).

Usage:
    pipeline = RetrievalPipeline()
    
    # Ingest documents
    pipeline.ingest(questions)
    
    # Query for relevant documents
    results = pipeline.query("entropy calculation", top_k=5)
"""

from typing import List, Dict, Any, Optional
import time

from .document_ingestion import DocumentIngestionService
from .chunking import ChunkingService, ChunkingStrategy, Chunk
from .embedding_service import EmbeddingService
from .faiss_index import FAISSIndexManager


class RetrievalPipeline:
    """
    Main retrieval pipeline for the RAG system.
    
    This class provides a unified interface for:
    - Ingesting documents (questions) into the index
    - Querying for semantically similar documents
    - Managing the underlying services
    
    The pipeline orchestrates:
    1. Document ingestion and validation
    2. Chunking with configurable strategies
    3. Embedding generation
    4. FAISS index management
    5. Search and retrieval
    
    Example:
        >>> pipeline = RetrievalPipeline()
        >>> 
        >>> # Ingest questions
        >>> from models.schemas import QuestionDocument
        >>> questions = [QuestionDocument(id="1", text="Define entropy", ...)]
        >>> result = pipeline.ingest(questions)
        >>> 
        >>> # Query
        >>> results = pipeline.query("thermodynamics problems", top_k=5)
    """
    
    def __init__(
        self,
        chunking_strategy: ChunkingStrategy = ChunkingStrategy.QUESTION_BASED
    ):
        """
        Initialize the retrieval pipeline.
        
        Args:
            chunking_strategy: Strategy to use for chunking documents
        """
        self.chunking_strategy = chunking_strategy
        
        # Initialize services
        self._ingestion_service = DocumentIngestionService()
        self._chunking_service = ChunkingService()
        self._embedding_service = EmbeddingService()
        self._index_manager = FAISSIndexManager()
    
    @property
    def index_size(self) -> int:
        """Get the number of documents in the index."""
        return self._index_manager.size
    
    @property
    def embedding_model(self) -> str:
        """Get the current embedding model name."""
        return self._embedding_service.model_name
    
    def ingest(self, questions: List[Any]) -> Dict[str, Any]:
        """
        Ingest questions into the RAG system.
        
        This method processes questions through the full pipeline:
        1. Validate and normalize documents
        2. Chunk documents according to strategy
        3. Generate embeddings for chunks
        4. Add to FAISS index
        
        Args:
            questions: List of QuestionDocument objects or dicts
            
        Returns:
            Dictionary with ingestion statistics
        """
        start_time = time.time()
        
        # Step 1: Ingest and normalize documents
        processed_docs = self._ingestion_service.ingest(questions)
        
        if not processed_docs:
            return {
                "status": "warning",
                "message": "No valid documents to ingest",
                "documents_ingested": 0,
                "index_size": self.index_size
            }
        
        # Step 2: Chunk documents
        chunks = self._chunking_service.chunk(
            processed_docs, 
            strategy=self.chunking_strategy
        )
        
        # Step 3: Generate embeddings
        chunk_texts = [chunk.text for chunk in chunks]
        embeddings = self._embedding_service.embed(chunk_texts, show_progress=True)
        
        # Step 4: Prepare metadata and add to index
        metadata_list = []
        for chunk in chunks:
            meta = {
                "id": chunk.id,
                "source_id": chunk.source_id,
                "text": chunk.text,
                **chunk.metadata
            }
            metadata_list.append(meta)
        
        added_count = self._index_manager.add_documents(embeddings, metadata_list)
        
        elapsed_time = time.time() - start_time
        
        return {
            "status": "success",
            "documents_ingested": added_count,
            "documents_processed": len(processed_docs),
            "chunks_created": len(chunks),
            "index_size": self.index_size,
            "processing_time_seconds": round(elapsed_time, 2)
        }
    
    def query(
        self, 
        query_text: str, 
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Query the RAG system for relevant documents.
        
        Args:
            query_text: The search query
            top_k: Number of results to return
            filters: Optional metadata filters (topics, types, marks range, etc.)
            
        Returns:
            Dictionary with query results and timing info
        """
        start_time = time.time()
        
        if self.index_size == 0:
            return {
                "results": [],
                "query_time_ms": 0,
                "total_documents": 0,
                "message": "Index is empty. Please ingest documents first."
            }
        
        # Generate query embedding
        query_embedding = self._embedding_service.embed_query(query_text)
        
        # Search the index
        search_results = self._index_manager.search(
            query_embedding, 
            k=top_k,
            filters=filters
        )
        
        # Format results
        results = []
        for metadata, score in search_results:
            result = {
                "id": metadata.get("source_id") or metadata.get("id"),
                "text": metadata.get("text", ""),
                "topic": metadata.get("topic", "Unknown"),
                "type": metadata.get("type", "Unknown"),
                "marks": metadata.get("marks"),
                "paper_id": metadata.get("paper_id", ""),
                "score": round(score, 4),
                "page_number": metadata.get("page_number"),
                "main_question_number": metadata.get("main_question_number"),
                "sub_question_label": metadata.get("sub_question_label")
            }
            results.append(result)
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            "results": results,
            "query_time_ms": round(elapsed_ms, 2),
            "total_documents": self.index_size
        }
    
    def get_context_for_generation(
        self, 
        query_text: str, 
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Get formatted context string for use in generation.
        
        This is a convenience method for the /generate endpoint.
        Returns the retrieved documents formatted as a context string
        that can be passed to an LLM.
        
        Args:
            query_text: The query to find relevant context for
            top_k: Number of context documents to retrieve
            filters: Optional metadata filters
            
        Returns:
            Formatted context string for LLM generation
        """
        query_result = self.query(query_text, top_k=top_k, filters=filters)
        
        if not query_result["results"]:
            return ""
        
        # Format context
        context_parts = []
        for i, result in enumerate(query_result["results"], 1):
            context_parts.append(
                f"[{i}] Topic: {result['topic']} | "
                f"Type: {result['type']} | "
                f"Marks: {result['marks'] or 'N/A'}\n"
                f"Question: {result['text']}"
            )
        
        return "\n\n".join(context_parts)
    
    def clear_index(self) -> None:
        """Clear all documents from the index."""
        self._index_manager.clear()
        self._embedding_service.clear_cache()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics."""
        return {
            "index_stats": self._index_manager.get_stats(),
            "embedding_cache": self._embedding_service.get_cache_stats(),
            "ingestion_stats": self._ingestion_service.get_ingestion_stats(),
            "chunking_strategy": self.chunking_strategy.value
        }
