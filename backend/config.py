"""
Configuration settings for the RAG backend.

To customize:
- Change EMBEDDING_MODEL for different quality/speed tradeoffs
- Adjust DATA_DIR for custom storage locations
- Modify API_* settings for different deployment scenarios
"""

import os
from pathlib import Path

# ============================================================================
# PATHS
# ============================================================================
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
INDEX_DIR = DATA_DIR / "indices"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)

# ============================================================================
# EMBEDDING CONFIGURATION
# ============================================================================
# Model options (from sentence-transformers):
# - "all-MiniLM-L6-v2": Fast, 384 dimensions, good for general use
# - "all-mpnet-base-v2": Higher quality, 768 dimensions, slower
# - "paraphrase-multilingual-MiniLM-L12-v2": For multilingual support
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384  # Must match the model's output dimension

# Batch size for embedding generation (adjust based on available memory)
EMBEDDING_BATCH_SIZE = 32

# ============================================================================
# FAISS INDEX CONFIGURATION
# ============================================================================
# Index file names
FAISS_INDEX_FILE = "exam_questions.index"
METADATA_FILE = "exam_questions_metadata.json"

# Index type: "flat" for exact search, "ivf" for approximate (faster for large datasets)
# Use "ivf" when document count exceeds 10,000
INDEX_TYPE = "flat"

# IVF parameters (only used if INDEX_TYPE = "ivf")
IVF_NLIST = 100  # Number of clusters
IVF_NPROBE = 10  # Number of clusters to search

# ============================================================================
# RETRIEVAL CONFIGURATION
# ============================================================================
DEFAULT_TOP_K = 5  # Default number of results to return
MAX_TOP_K = 50     # Maximum allowed top_k value

# ============================================================================
# API CONFIGURATION
# ============================================================================
API_HOST = "0.0.0.0"
API_PORT = 8000
API_TITLE = "ExamExtractor RAG Backend"
API_VERSION = "1.0.0"

# CORS settings for frontend integration
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:4173",  # Vite preview
    "http://localhost:3000",  # Alternative dev port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://192.168.1.6:4173",  # Network access
]
