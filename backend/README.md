# ExamExtractor RAG Backend

A production-ready Retrieval-Augmented Generation (RAG) backend for the ExamExtractor application.

## Features

- **Document Ingestion**: Process exam questions with validation and normalization
- **Smart Chunking**: Exam-specific strategies (question-based, topic-based, hybrid)
- **Embedding Generation**: Fast embeddings using `sentence-transformers`
- **FAISS Index**: Vector similarity search with disk persistence
- **REST API**: FastAPI endpoints for ingestion and retrieval
- **Incremental Updates**: Add new documents without rebuilding the index

## Quick Start

### 1. Create Virtual Environment

```powershell
cd d:\examextractor\backend
python -m venv venv
.\venv\Scripts\Activate
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Start the Server

```powershell
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### 4. View API Documentation

Open `http://localhost:8000/docs` in your browser for interactive API docs.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and system status |
| `/ingest` | POST | Ingest exam questions |
| `/query` | POST | Search for relevant questions |
| `/context` | POST | Get formatted context for LLM generation |
| `/stats` | GET | Get system statistics |
| `/clear` | POST | Clear the index (admin) |

## Usage Examples

### Ingest Questions

```python
import requests

questions = [
    {
        "id": "q1",
        "fullText": "Define thermodynamics and state its first law.",
        "topic": "Thermodynamics",
        "marks": 5,
        "type": "Short Answer",
        "sourcePaperId": "paper_2024"
    }
]

response = requests.post(
    "http://localhost:8000/ingest",
    json={"questions": questions}
)
print(response.json())
```

### Query for Similar Questions

```python
response = requests.post(
    "http://localhost:8000/query",
    json={
        "query": "entropy and heat transfer",
        "top_k": 5,
        "filters": {
            "topics": ["Thermodynamics"],
            "min_marks": 3
        }
    }
)
print(response.json())
```

### Get Context for Generation

```python
response = requests.post(
    "http://localhost:8000/context",
    json={
        "query": "important questions on calculus",
        "top_k": 5
    }
)
context = response.json()["context"]
# Use context in your LLM prompt
```

## Project Structure

```
backend/
├── main.py                    # FastAPI application
├── config.py                  # Configuration settings
├── requirements.txt           # Python dependencies
├── models/
│   ├── __init__.py
│   └── schemas.py             # Pydantic models
├── services/
│   ├── __init__.py
│   ├── document_ingestion.py  # Document processing
│   ├── chunking.py            # Chunking strategies
│   ├── embedding_service.py   # Embedding generation
│   ├── faiss_index.py         # FAISS index manager
│   └── retrieval_pipeline.py  # Main retrieval interface
└── data/
    └── indices/               # Persisted FAISS indices
```

## Configuration

Edit `config.py` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer model |
| `API_PORT` | `8000` | API server port |
| `INDEX_TYPE` | `flat` | `flat` (exact) or `ivf` (approximate) |
| `DEFAULT_TOP_K` | `5` | Default results count |

## Extending the System

### Adding New Embedding Models

1. Update `EMBEDDING_MODEL` in `config.py`
2. Update `EMBEDDING_DIMENSION` to match the model's output dimension
3. Clear and rebuild the index (dimensions must match)

### Custom Chunking Strategies

Extend the `ChunkingStrategy` enum and add a corresponding method in `ChunkingService`.

### Scaling for Large Datasets

For datasets > 10,000 documents:
1. Set `INDEX_TYPE = "ivf"` in `config.py`
2. Adjust `IVF_NLIST` based on your data size (sqrt of doc count is a good start)

## Integration with Frontend

The backend integrates with the React frontend via REST API calls. Add the following to your frontend service:

```typescript
// services/ragService.ts
const RAG_API = 'http://localhost:8000';

export const ingestQuestions = async (questions: Question[]) => {
  const response = await fetch(`${RAG_API}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions })
  });
  return response.json();
};

export const queryRAG = async (query: string, topK = 5, filters = {}) => {
  const response = await fetch(`${RAG_API}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, filters })
  });
  return response.json();
};
```
