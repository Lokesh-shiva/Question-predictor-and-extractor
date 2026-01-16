"""
Document Ingestion Service

Handles the processing and preparation of exam questions for the RAG pipeline.
This service acts as the entry point for documents into the system.

Usage:
    service = DocumentIngestionService()
    processed_docs = service.ingest(questions)
"""

from typing import List, Dict, Any
from datetime import datetime
import hashlib

from models.schemas import QuestionDocument


class DocumentIngestionService:
    """
    Service for ingesting and preparing documents for the RAG pipeline.
    
    Responsibilities:
    - Validate incoming documents
    - Normalize and clean text
    - Generate document hashes for deduplication
    - Prepare documents for chunking and embedding
    
    Example:
        >>> service = DocumentIngestionService()
        >>> docs = [QuestionDocument(id="1", text="What is entropy?", ...)]
        >>> processed = service.ingest(docs)
    """
    
    def __init__(self):
        """Initialize the ingestion service."""
        self._ingestion_log: List[Dict[str, Any]] = []
    
    def ingest(self, documents: List[QuestionDocument]) -> List[Dict[str, Any]]:
        """
        Process a list of question documents for the RAG pipeline.
        
        Args:
            documents: List of QuestionDocument objects to ingest
            
        Returns:
            List of processed document dictionaries ready for embedding
        """
        processed_docs = []
        
        for doc in documents:
            processed = self._process_document(doc)
            if processed:
                processed_docs.append(processed)
        
        # Log ingestion
        self._log_ingestion(len(documents), len(processed_docs))
        
        return processed_docs
    
    def _process_document(self, doc: QuestionDocument) -> Dict[str, Any]:
        """
        Process a single document.
        
        - Cleans and normalizes text
        - Generates content hash for deduplication
        - Prepares metadata structure
        
        Args:
            doc: QuestionDocument to process
            
        Returns:
            Processed document dictionary
        """
        # Clean and normalize text
        cleaned_text = self._clean_text(doc.text)
        
        if not cleaned_text:
            return None
        
        # Generate content hash for deduplication
        content_hash = self._generate_hash(cleaned_text)
        
        # Build the processed document
        processed = {
            "id": doc.id,
            "text": cleaned_text,
            "content_hash": content_hash,
            "metadata": {
                "topic": doc.topic,
                "type": doc.type,
                "marks": doc.marks,
                "paper_id": doc.paper_id,
                "page_number": doc.page_number,
                "main_question_number": doc.main_question_number,
                "sub_question_label": doc.sub_question_label,
                "ingested_at": datetime.utcnow().isoformat(),
            }
        }
        
        return processed
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize question text.
        
        - Strip whitespace
        - Normalize unicode characters
        - Remove excessive newlines
        - Fix common OCR artifacts
        
        Args:
            text: Raw question text
            
        Returns:
            Cleaned text string
        """
        if not text:
            return ""
        
        # Strip leading/trailing whitespace
        cleaned = text.strip()
        
        # Normalize multiple spaces/newlines to single space
        import re
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        # Remove any control characters except spaces
        cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned)
        
        return cleaned
    
    def _generate_hash(self, text: str) -> str:
        """
        Generate a hash of the document content for deduplication.
        
        Args:
            text: Cleaned text content
            
        Returns:
            SHA256 hash string
        """
        return hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
    
    def _log_ingestion(self, total: int, processed: int) -> None:
        """Log ingestion statistics."""
        self._ingestion_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "total_received": total,
            "successfully_processed": processed,
            "skipped": total - processed
        })
    
    def get_ingestion_stats(self) -> Dict[str, Any]:
        """
        Get cumulative ingestion statistics.
        
        Returns:
            Dictionary with ingestion statistics
        """
        if not self._ingestion_log:
            return {"total_ingestions": 0, "total_documents": 0}
        
        total_docs = sum(log["successfully_processed"] for log in self._ingestion_log)
        
        return {
            "total_ingestions": len(self._ingestion_log),
            "total_documents": total_docs,
            "last_ingestion": self._ingestion_log[-1] if self._ingestion_log else None
        }
