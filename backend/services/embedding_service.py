"""
Embedding Service

Generates vector embeddings for text chunks using sentence-transformers.
Supports batch processing and caching for efficiency.

Usage:
    service = EmbeddingService()
    embeddings = service.embed(["text1", "text2"])
"""

from typing import List, Optional, Dict, Union
import numpy as np
from sentence_transformers import SentenceTransformer

import sys
sys.path.append('..')
from config import EMBEDDING_MODEL, EMBEDDING_DIMENSION, EMBEDDING_BATCH_SIZE


class EmbeddingService:
    """
    Service for generating text embeddings using sentence-transformers.
    
    The service uses a pre-trained model (default: all-MiniLM-L6-v2) to
    convert text into fixed-dimension vector representations suitable
    for similarity search.
    
    Features:
    - Lazy model loading (loads on first use)
    - Batch processing for efficiency
    - Simple caching layer for repeated texts
    
    Example:
        >>> service = EmbeddingService()
        >>> embeddings = service.embed(["What is entropy?", "Define thermodynamics"])
        >>> print(embeddings.shape)  # (2, 384)
    """
    
    def __init__(
        self, 
        model_name: Optional[str] = None,
        batch_size: int = EMBEDDING_BATCH_SIZE
    ):
        """
        Initialize the embedding service.
        
        Args:
            model_name: Sentence-transformer model name (uses config default if None)
            batch_size: Number of texts to embed in each batch
        """
        self._model_name = model_name or EMBEDDING_MODEL
        self._batch_size = batch_size
        self._model: Optional[SentenceTransformer] = None
        self._cache: Dict[str, np.ndarray] = {}
        self._cache_max_size = 1000  # Limit cache size
    
    @property
    def model(self) -> SentenceTransformer:
        """
        Get the embedding model (lazy loading).
        
        Returns:
            Loaded SentenceTransformer model
        """
        if self._model is None:
            print(f"Loading embedding model: {self._model_name}")
            self._model = SentenceTransformer(self._model_name)
            print(f"Model loaded. Embedding dimension: {self._model.get_sentence_embedding_dimension()}")
        return self._model
    
    @property
    def dimension(self) -> int:
        """Get the embedding dimension for the current model."""
        return self.model.get_sentence_embedding_dimension()
    
    @property
    def model_name(self) -> str:
        """Get the current model name."""
        return self._model_name
    
    def embed(
        self, 
        texts: Union[str, List[str]], 
        use_cache: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Generate embeddings for one or more texts.
        
        Args:
            texts: Single text string or list of texts to embed
            use_cache: Whether to use caching for repeated texts
            show_progress: Whether to show progress bar for large batches
            
        Returns:
            NumPy array of shape (n_texts, embedding_dimension)
        """
        # Handle single text input
        if isinstance(texts, str):
            texts = [texts]
        
        if not texts:
            return np.array([]).reshape(0, EMBEDDING_DIMENSION)
        
        # Check cache and separate cached/uncached texts
        if use_cache:
            embeddings_list = []
            texts_to_embed = []
            text_indices = []
            
            for i, text in enumerate(texts):
                cache_key = self._get_cache_key(text)
                if cache_key in self._cache:
                    embeddings_list.append((i, self._cache[cache_key]))
                else:
                    texts_to_embed.append(text)
                    text_indices.append(i)
            
            # Embed uncached texts
            if texts_to_embed:
                new_embeddings = self._embed_batch(texts_to_embed, show_progress)
                
                # Cache new embeddings
                for text, embedding in zip(texts_to_embed, new_embeddings):
                    self._add_to_cache(text, embedding)
                
                for idx, embedding in zip(text_indices, new_embeddings):
                    embeddings_list.append((idx, embedding))
            
            # Sort by original index and stack
            embeddings_list.sort(key=lambda x: x[0])
            embeddings = np.vstack([e for _, e in embeddings_list])
            
        else:
            embeddings = self._embed_batch(texts, show_progress)
        
        return embeddings
    
    def embed_query(self, query: str) -> np.ndarray:
        """
        Embed a single query text.
        
        This is a convenience method optimized for single query embedding.
        
        Args:
            query: Query text to embed
            
        Returns:
            1D embedding array of shape (embedding_dimension,)
        """
        return self.embed([query], use_cache=False)[0]
    
    def _embed_batch(self, texts: List[str], show_progress: bool = False) -> np.ndarray:
        """
        Embed a batch of texts using the model.
        
        Args:
            texts: List of texts to embed
            show_progress: Whether to show progress bar
            
        Returns:
            NumPy array of embeddings
        """
        embeddings = self.model.encode(
            texts,
            batch_size=self._batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
            normalize_embeddings=True  # L2 normalize for cosine similarity
        )
        return embeddings
    
    def _get_cache_key(self, text: str) -> str:
        """Generate a cache key for text (first 100 chars + length)."""
        return f"{text[:100]}_{len(text)}"
    
    def _add_to_cache(self, text: str, embedding: np.ndarray) -> None:
        """Add embedding to cache with size management."""
        if len(self._cache) >= self._cache_max_size:
            # Remove oldest entries (simple FIFO)
            keys_to_remove = list(self._cache.keys())[:100]
            for key in keys_to_remove:
                del self._cache[key]
        
        self._cache[self._get_cache_key(text)] = embedding
    
    def clear_cache(self) -> None:
        """Clear the embedding cache."""
        self._cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics."""
        return {
            "cache_size": len(self._cache),
            "max_size": self._cache_max_size
        }
