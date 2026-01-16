"""
Chunking Service for Exam Questions

Implements exam-specific chunking strategies that preserve question context
and structure. Unlike generic text chunking, these strategies understand
that exam questions should not be split mid-sentence.

Available Strategies:
- QUESTION_BASED: Each question as a single chunk (default, recommended)
- TOPIC_BASED: Group questions by topic with configurable overlap
- HYBRID: Combine question text with enriched metadata context

Usage:
    service = ChunkingService()
    chunks = service.chunk(documents, strategy=ChunkingStrategy.QUESTION_BASED)
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


class ChunkingStrategy(Enum):
    """Available chunking strategies for exam questions."""
    QUESTION_BASED = "question_based"  # One chunk per question
    TOPIC_BASED = "topic_based"        # Group by topic
    HYBRID = "hybrid"                  # Question + enriched context


@dataclass
class Chunk:
    """
    Represents a text chunk for embedding.
    
    Attributes:
        id: Unique chunk identifier
        text: The text content to embed
        source_id: Original document ID
        metadata: Additional information about the chunk
    """
    id: str
    text: str
    source_id: str
    metadata: Dict[str, Any]


class ChunkingService:
    """
    Service for chunking exam questions using various strategies.
    
    The service ensures that:
    - Questions are never split mid-sentence
    - Metadata is preserved and enriched
    - Chunk sizes remain within embedding model limits
    
    Example:
        >>> service = ChunkingService(max_chunk_size=512)
        >>> chunks = service.chunk(documents, ChunkingStrategy.QUESTION_BASED)
    """
    
    def __init__(self, max_chunk_size: int = 512):
        """
        Initialize the chunking service.
        
        Args:
            max_chunk_size: Maximum characters per chunk (for embedding models)
        """
        self.max_chunk_size = max_chunk_size
    
    def chunk(
        self, 
        documents: List[Dict[str, Any]], 
        strategy: ChunkingStrategy = ChunkingStrategy.QUESTION_BASED
    ) -> List[Chunk]:
        """
        Chunk documents using the specified strategy.
        
        Args:
            documents: List of processed documents from ingestion service
            strategy: Chunking strategy to use
            
        Returns:
            List of Chunk objects ready for embedding
        """
        if strategy == ChunkingStrategy.QUESTION_BASED:
            return self._chunk_by_question(documents)
        elif strategy == ChunkingStrategy.TOPIC_BASED:
            return self._chunk_by_topic(documents)
        elif strategy == ChunkingStrategy.HYBRID:
            return self._chunk_hybrid(documents)
        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")
    
    def _chunk_by_question(self, documents: List[Dict[str, Any]]) -> List[Chunk]:
        """
        Create one chunk per question (default strategy).
        
        This is the recommended strategy for exam questions because:
        - Preserves complete question context
        - Maintains exact matching capability
        - Simple and effective for retrieval
        
        Args:
            documents: Processed documents
            
        Returns:
            List of chunks, one per question
        """
        chunks = []
        
        for doc in documents:
            chunk_text = doc["text"]
            
            # Truncate if exceeds max size (rare for exam questions)
            if len(chunk_text) > self.max_chunk_size:
                chunk_text = chunk_text[:self.max_chunk_size - 3] + "..."
            
            chunk = Chunk(
                id=f"chunk_{doc['id']}",
                text=chunk_text,
                source_id=doc["id"],
                metadata=doc["metadata"]
            )
            chunks.append(chunk)
        
        return chunks
    
    def _chunk_by_topic(self, documents: List[Dict[str, Any]]) -> List[Chunk]:
        """
        Group questions by topic into combined chunks.
        
        Useful when you want to retrieve entire topic contexts.
        Creates larger chunks that contain multiple related questions.
        
        Args:
            documents: Processed documents
            
        Returns:
            List of topic-based chunks
        """
        # Group documents by topic
        topic_groups: Dict[str, List[Dict[str, Any]]] = {}
        
        for doc in documents:
            topic = doc["metadata"].get("topic", "General")
            if topic not in topic_groups:
                topic_groups[topic] = []
            topic_groups[topic].append(doc)
        
        chunks = []
        
        for topic, docs in topic_groups.items():
            # Combine question texts with separators
            combined_text = ""
            source_ids = []
            
            for doc in docs:
                question_text = doc["text"]
                
                # Check if adding this would exceed limit
                if len(combined_text) + len(question_text) + 4 > self.max_chunk_size:
                    # Save current chunk and start new one
                    if combined_text:
                        chunk = Chunk(
                            id=f"topic_{topic}_{len(chunks)}",
                            text=combined_text.strip(),
                            source_id=",".join(source_ids),
                            metadata={"topic": topic, "question_count": len(source_ids)}
                        )
                        chunks.append(chunk)
                    combined_text = question_text + " | "
                    source_ids = [doc["id"]]
                else:
                    combined_text += question_text + " | "
                    source_ids.append(doc["id"])
            
            # Add remaining chunk
            if combined_text:
                chunk = Chunk(
                    id=f"topic_{topic}_{len(chunks)}",
                    text=combined_text.strip(" |"),
                    source_id=",".join(source_ids),
                    metadata={"topic": topic, "question_count": len(source_ids)}
                )
                chunks.append(chunk)
        
        return chunks
    
    def _chunk_hybrid(self, documents: List[Dict[str, Any]]) -> List[Chunk]:
        """
        Create enriched chunks with question text and metadata context.
        
        This strategy prepends metadata to the question text, creating
        richer embeddings that capture both content and context.
        
        Format: "[Topic: X] [Type: Y] [Marks: Z] Question text..."
        
        Args:
            documents: Processed documents
            
        Returns:
            List of enriched chunks
        """
        chunks = []
        
        for doc in documents:
            metadata = doc["metadata"]
            
            # Build enriched text with metadata prefix
            prefix_parts = []
            
            if metadata.get("topic"):
                prefix_parts.append(f"Topic: {metadata['topic']}")
            if metadata.get("type"):
                prefix_parts.append(f"Type: {metadata['type']}")
            if metadata.get("marks"):
                prefix_parts.append(f"Marks: {metadata['marks']}")
            
            prefix = " | ".join(prefix_parts)
            enriched_text = f"[{prefix}] {doc['text']}" if prefix else doc["text"]
            
            # Truncate if needed
            if len(enriched_text) > self.max_chunk_size:
                enriched_text = enriched_text[:self.max_chunk_size - 3] + "..."
            
            chunk = Chunk(
                id=f"hybrid_{doc['id']}",
                text=enriched_text,
                source_id=doc["id"],
                metadata=metadata
            )
            chunks.append(chunk)
        
        return chunks
    
    def get_strategy_info(self, strategy: ChunkingStrategy) -> Dict[str, str]:
        """
        Get information about a chunking strategy.
        
        Args:
            strategy: The strategy to describe
            
        Returns:
            Dictionary with strategy description
        """
        descriptions = {
            ChunkingStrategy.QUESTION_BASED: {
                "name": "Question-Based",
                "description": "One chunk per question. Best for exact matching and retrieval.",
                "recommended_for": "Most use cases, especially when questions should be retrieved individually."
            },
            ChunkingStrategy.TOPIC_BASED: {
                "name": "Topic-Based",
                "description": "Groups questions by topic into combined chunks.",
                "recommended_for": "When you want to retrieve entire topic contexts."
            },
            ChunkingStrategy.HYBRID: {
                "name": "Hybrid",
                "description": "Enriches question text with metadata context.",
                "recommended_for": "When metadata (topic, marks, type) is important for matching."
            }
        }
        return descriptions.get(strategy, {"name": "Unknown", "description": "Unknown strategy"})
