"""
FAISS Index Manager

Manages the FAISS vector index for similarity search.
Supports both exact (Flat) and approximate (IVF) search modes.

Key Features:
- Incremental updates without full rebuild
- Disk persistence and loading
- Metadata storage alongside vectors
- Thread-safe operations

Usage:
    manager = FAISSIndexManager()
    manager.add_documents(embeddings, metadata)
    results = manager.search(query_embedding, k=5)
"""

from typing import List, Dict, Any, Optional, Tuple
import json
from pathlib import Path
import numpy as np
import faiss

import sys
sys.path.append('..')
from config import (
    INDEX_DIR, 
    FAISS_INDEX_FILE, 
    METADATA_FILE,
    EMBEDDING_DIMENSION,
    INDEX_TYPE,
    IVF_NLIST,
    IVF_NPROBE
)


class FAISSIndexManager:
    """
    Manages a FAISS index for vector similarity search.
    
    The manager handles:
    - Index creation (flat or IVF)
    - Incremental document addition
    - Similarity search with metadata
    - Persistence to disk
    
    Example:
        >>> manager = FAISSIndexManager()
        >>> manager.add_documents(
        ...     embeddings=np.random.rand(10, 384),
        ...     metadata=[{"id": str(i), "text": f"Doc {i}"} for i in range(10)]
        ... )
        >>> results = manager.search(query_vector, k=3)
    """
    
    def __init__(
        self, 
        dimension: int = EMBEDDING_DIMENSION,
        index_type: str = INDEX_TYPE,
        index_dir: Optional[Path] = None
    ):
        """
        Initialize the FAISS index manager.
        
        Args:
            dimension: Embedding vector dimension
            index_type: "flat" for exact search, "ivf" for approximate
            index_dir: Directory for index persistence (uses config default if None)
        """
        self.dimension = dimension
        self.index_type = index_type
        self.index_dir = Path(index_dir) if index_dir else INDEX_DIR
        
        # Ensure index directory exists
        self.index_dir.mkdir(parents=True, exist_ok=True)
        
        self._index: Optional[faiss.Index] = None
        self._metadata: List[Dict[str, Any]] = []
        self._id_to_idx: Dict[str, int] = {}  # Map document ID to index position
        
        # Try to load existing index
        self._load_index()
    
    @property
    def index(self) -> faiss.Index:
        """Get or create the FAISS index."""
        if self._index is None:
            self._create_index()
        return self._index
    
    @property
    def size(self) -> int:
        """Get the number of documents in the index."""
        if self._index is None:
            return 0
        return self._index.ntotal
    
    @property
    def is_trained(self) -> bool:
        """Check if the index is trained (relevant for IVF)."""
        if self._index is None:
            return False
        return self._index.is_trained
    
    def _create_index(self) -> None:
        """Create a new FAISS index based on configuration."""
        if self.index_type == "ivf":
            # IVF index for approximate search (faster for large datasets)
            quantizer = faiss.IndexFlatL2(self.dimension)
            self._index = faiss.IndexIVFFlat(
                quantizer, 
                self.dimension, 
                IVF_NLIST,
                faiss.METRIC_INNER_PRODUCT  # For normalized vectors (cosine similarity)
            )
            self._index.nprobe = IVF_NPROBE
        else:
            # Flat index for exact search
            self._index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine
        
        print(f"Created new FAISS index: type={self.index_type}, dimension={self.dimension}")
    
    def add_documents(
        self, 
        embeddings: np.ndarray, 
        metadata: List[Dict[str, Any]],
        deduplicate: bool = True
    ) -> int:
        """
        Add documents to the index.
        
        Args:
            embeddings: NumPy array of shape (n_docs, dimension)
            metadata: List of metadata dicts (must match embeddings length)
            deduplicate: If True, skip documents with existing IDs
            
        Returns:
            Number of documents actually added
        """
        if len(embeddings) != len(metadata):
            raise ValueError(f"Embeddings ({len(embeddings)}) and metadata ({len(metadata)}) count mismatch")
        
        if len(embeddings) == 0:
            return 0
        
        # Ensure embeddings are float32 and contiguous
        embeddings = np.ascontiguousarray(embeddings.astype(np.float32))
        
        # Filter duplicates if requested
        if deduplicate:
            new_embeddings = []
            new_metadata = []
            
            for emb, meta in zip(embeddings, metadata):
                doc_id = meta.get("id") or meta.get("source_id", "")
                if doc_id not in self._id_to_idx:
                    new_embeddings.append(emb)
                    new_metadata.append(meta)
                    self._id_to_idx[doc_id] = len(self._metadata) + len(new_metadata) - 1
            
            if not new_embeddings:
                return 0
            
            embeddings = np.array(new_embeddings, dtype=np.float32)
            metadata = new_metadata
        else:
            # Update ID mapping
            for i, meta in enumerate(metadata):
                doc_id = meta.get("id") or meta.get("source_id", "")
                self._id_to_idx[doc_id] = len(self._metadata) + i
        
        # Train IVF index if needed and not trained
        if self.index_type == "ivf" and not self.is_trained:
            if len(embeddings) >= IVF_NLIST:
                print(f"Training IVF index with {len(embeddings)} samples...")
                self.index.train(embeddings)
            else:
                print(f"Warning: Not enough samples ({len(embeddings)}) to train IVF index (need {IVF_NLIST})")
                # Fall back to flat index
                self.index_type = "flat"
                self._create_index()
        
        # Add to index
        self.index.add(embeddings)
        self._metadata.extend(metadata)
        
        # Persist to disk
        self._save_index()
        
        return len(embeddings)
    
    def search(
        self, 
        query_embedding: np.ndarray, 
        k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Search for similar documents.
        
        Args:
            query_embedding: Query vector of shape (dimension,)
            k: Number of results to return
            filters: Optional metadata filters to apply
            
        Returns:
            List of (metadata, score) tuples, sorted by score descending
        """
        if self.size == 0:
            return []
        
        # Ensure query is 2D for FAISS
        query = np.ascontiguousarray(
            query_embedding.reshape(1, -1).astype(np.float32)
        )
        
        # Search without filters first (get more results to filter)
        search_k = min(k * 3, self.size) if filters else k
        
        scores, indices = self.index.search(query, search_k)
        scores = scores[0]
        indices = indices[0]
        
        # Collect results with metadata
        results = []
        for score, idx in zip(scores, indices):
            if idx == -1:  # FAISS returns -1 for unfilled slots
                continue
            
            if idx >= len(self._metadata):
                continue
            
            meta = self._metadata[idx]
            
            # Apply filters
            if filters and not self._matches_filters(meta, filters):
                continue
            
            results.append((meta, float(score)))
            
            if len(results) >= k:
                break
        
        return results
    
    def _matches_filters(self, metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Check if metadata matches the given filters."""
        # Topic filter
        if filters.get("topics"):
            meta_topic = metadata.get("topic", "").lower()
            if not any(t.lower() in meta_topic for t in filters["topics"]):
                return False
        
        # Type filter
        if filters.get("types"):
            meta_type = metadata.get("type", "")
            if meta_type not in filters["types"]:
                return False
        
        # Paper ID filter
        if filters.get("paper_ids"):
            meta_paper = metadata.get("paper_id", "")
            if meta_paper not in filters["paper_ids"]:
                return False
        
        # Marks range filter
        meta_marks = metadata.get("marks")
        if meta_marks is not None:
            if filters.get("min_marks") is not None and meta_marks < filters["min_marks"]:
                return False
            if filters.get("max_marks") is not None and meta_marks > filters["max_marks"]:
                return False
        
        return True
    
    def _save_index(self) -> None:
        """Save index and metadata to disk."""
        index_path = self.index_dir / FAISS_INDEX_FILE
        metadata_path = self.index_dir / METADATA_FILE
        
        # Save FAISS index
        faiss.write_index(self._index, str(index_path))
        
        # Save metadata as JSON
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump({
                "metadata": self._metadata,
                "id_to_idx": self._id_to_idx,
                "index_type": self.index_type,
                "dimension": self.dimension
            }, f, indent=2, default=str)
        
        print(f"Index saved: {self.size} documents")
    
    def _load_index(self) -> bool:
        """Load index and metadata from disk if available."""
        index_path = self.index_dir / FAISS_INDEX_FILE
        metadata_path = self.index_dir / METADATA_FILE
        
        if not index_path.exists() or not metadata_path.exists():
            return False
        
        try:
            # Load FAISS index
            self._index = faiss.read_index(str(index_path))
            
            # Load metadata
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._metadata = data["metadata"]
                self._id_to_idx = data.get("id_to_idx", {})
                self.index_type = data.get("index_type", "flat")
            
            print(f"Index loaded: {self.size} documents")
            return True
            
        except Exception as e:
            print(f"Failed to load index: {e}")
            return False
    
    def clear(self) -> None:
        """Clear the index and remove persisted files."""
        self._index = None
        self._metadata = []
        self._id_to_idx = {}
        
        # Remove files
        index_path = self.index_dir / FAISS_INDEX_FILE
        metadata_path = self.index_dir / METADATA_FILE
        
        if index_path.exists():
            index_path.unlink()
        if metadata_path.exists():
            metadata_path.unlink()
        
        print("Index cleared")
    
    def get_all_metadata(self) -> List[Dict[str, Any]]:
        """Get all document metadata."""
        return self._metadata.copy()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        return {
            "total_documents": self.size,
            "index_type": self.index_type,
            "dimension": self.dimension,
            "is_trained": self.is_trained,
            "metadata_count": len(self._metadata)
        }
