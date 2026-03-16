# AGENTS.md — Backend (FastAPI)

## Stack

- **Runtime**: Python 3.11+
- **Framework**: FastAPI with Uvicorn (ASGI)
- **Database**: PostgreSQL 16 + pgvector (via SQLAlchemy 2.0 + asyncpg)
- **ORM**: SQLAlchemy 2.0 (async, mapped_column style)
- **Migrations**: Alembic (async-aware, auto-generation enabled)
- **Validation**: Pydantic v2 (with `model_config = ConfigDict(from_attributes=True)`)
- **AI**: Azure OpenAI SDK (`openai` Python package, async client)
- **File Parsing**: pdfplumber (PDF text extraction — better than PyPDF2), python-docx, python-pptx
- **OCR**: pytesseract + Pillow + pdf2image (for scanned/image-based PDFs)
- **Chunking**: tiktoken (token-aware text splitting, `cl100k_base` encoding)
- **PDF Export**: WeasyPrint + Jinja2 (HTML → PDF with Telkom branding)
- **HTTP/Upload**: python-multipart (file upload handling)
- **Testing**: pytest + httpx (async test client) + pytest-asyncio
- **Linting**: ruff
- **Type Checking**: mypy (strict)

## Project Structure

```
be-fastapi/
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app, CORS, lifespan, router includes
│   ├── config.py              # Settings via pydantic-settings (env-based)
│   ├── database.py            # async engine, sessionmaker, get_db dependency
│   │
│   ├── features/              # Feature-based modules (each self-contained)
│   │   ├── documents/         # Document upload, parsing, embedding
│   │   │   ├── __init__.py
│   │   │   ├── router.py      # POST /upload, GET /documents, GET /documents/{id}
│   │   │   ├── service.py     # parse → chunk → embed → store
│   │   │   ├── models.py      # Document, DocumentChunk (SQLAlchemy)
│   │   │   └── schemas.py     # DocumentUploadResponse, DocumentOut
│   │   │
│   │   ├── syllabus/          # Syllabus generation (Solution A)
│   │   │   ├── __init__.py
│   │   │   ├── router.py      # POST /generate, GET /syllabi, GET /syllabi/{id}
│   │   │   ├── service.py     # RAG retrieval → prompt chain → structured output
│   │   │   ├── models.py      # Syllabus, SyllabusELO (SQLAlchemy)
│   │   │   └── schemas.py     # SyllabusCreate, SyllabusResponse
│   │   │
│   │   ├── personalize/       # Micro-learning personalization (Solution B)
│   │   │   ├── __init__.py
│   │   │   ├── router.py      # POST /personalize
│   │   │   ├── service.py     # gap analysis → RAG → module recommendations
│   │   │   ├── models.py      # GapAssessment, MicroModule (SQLAlchemy)
│   │   │   └── schemas.py     # PersonalizeRequest, PersonalizeResponse
│   │   │
│   │   ├── chat/              # Chat/revise (human-in-the-loop)
│   │   │   ├── __init__.py
│   │   │   ├── router.py      # POST /revise (SSE streaming)
│   │   │   ├── service.py     # load context → LLM revision → update syllabus
│   │   │   └── schemas.py     # ReviseRequest, ReviseResponse
│   │   │
│   │   └── export/            # PDF export
│   │       ├── __init__.py
│   │       ├── router.py      # POST /export/{syllabus_id}
│   │       ├── service.py     # render syllabus → PDF via WeasyPrint/ReportLab
│   │       └── templates/     # HTML/Jinja2 templates for PDF rendering
│   │           └── syllabus_template.html
│   │
│   ├── ai/                    # Shared AI service layer
│   │   ├── __init__.py
│   │   ├── embeddings.py      # Azure OpenAI embedding calls (text-embedding-3-small)
│   │   ├── llm.py             # Azure OpenAI chat calls (GPT-4o)
│   │   ├── rag.py             # pgvector similarity search, reranking
│   │   └── prompts.py         # All prompt templates (centralized)
│   │
│   └── utils/                 # Shared utilities
│       ├── __init__.py
│       ├── file_parser.py     # PDF/DOCX/PPTX → plain text extraction (with OCR fallback)
│       ├── ocr.py             # Tesseract OCR pipeline (pdf2image → pytesseract)
│       └── chunking.py        # Text chunking (tiktoken-aware, overlap, structure-preserving)
│
├── alembic/                   # Database migrations
│   ├── env.py
│   └── versions/
├── tests/                     # Tests mirror features/ structure
│   ├── conftest.py            # Fixtures: test DB, test client, mock AI
│   ├── test_documents/
│   ├── test_syllabus/
│   ├── test_personalize/
│   ├── test_chat/
│   └── test_export/
├── requirements.txt
├── Dockerfile
├── .env.example
└── pyproject.toml             # ruff + mypy config
```

## Coding Conventions

### Async Everything
- All database operations are async (`async def`, `await session.execute(...)`)
- All AI calls are async (Azure OpenAI SDK supports async)
- All route handlers are `async def`
- Use `asyncpg` driver for PostgreSQL

### Router Rules (Thin Controllers)
```python
# GOOD — router delegates to service
@router.post("/generate", response_model=SyllabusResponse)
async def generate_syllabus(
    request: SyllabusCreate,
    db: AsyncSession = Depends(get_db),
) -> SyllabusResponse:
    return await syllabus_service.generate(db, request)

# BAD — business logic in router
@router.post("/generate")
async def generate_syllabus(request: SyllabusCreate, db: AsyncSession = Depends(get_db)):
    chunks = await db.execute(select(DocumentChunk).where(...))  # NO! Move to service
    response = await openai_client.chat(...)  # NO! Move to service
    return response
```

### Service Rules (Business Logic Here)
```python
# service.py contains ALL business logic
async def generate(db: AsyncSession, request: SyllabusCreate) -> SyllabusResponse:
    # 1. RAG retrieval
    relevant_chunks = await rag.similarity_search(db, request.topic, top_k=10)
    # 2. LLM generation
    tlo = await llm.generate_tlo(request.topic, request.target_level, relevant_chunks)
    elos = await llm.generate_elos(tlo, relevant_chunks)
    # 3. Persist
    syllabus = Syllabus(topic=request.topic, tlo=tlo, elos=elos)
    db.add(syllabus)
    await db.commit()
    return SyllabusResponse.model_validate(syllabus)
```

### Pydantic Schema Rules
```python
# Suffixes: Create (input), Response (output), Update (partial), Base (shared)
class SyllabusBase(BaseModel):
    topic: str
    target_level: int  # 1-5

class SyllabusCreate(SyllabusBase):
    doc_ids: list[uuid.UUID]

class SyllabusResponse(SyllabusBase):
    id: uuid.UUID
    tlo: str
    elos: list[ELOResponse]
    journey: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

### SQLAlchemy Model Rules
```python
# Use mapped_column, Mapped[], UUID primary keys
class Syllabus(Base):
    __tablename__ = "syllabi"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(255))
    target_level: Mapped[int]
    tlo: Mapped[str] = mapped_column(Text)
    elos_json: Mapped[dict] = mapped_column(JSONB)
    journey_json: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
```

### File Parsing Pipeline (with OCR)
```python
# utils/file_parser.py — extraction strategy per file type
# 1. PDF → pdfplumber.extract_text() first
#    If text is empty/minimal → fallback to OCR pipeline (scanned PDF)
# 2. DOCX → python-docx paragraph + table extraction
# 3. PPTX → python-pptx slide text + table extraction

# utils/ocr.py — Tesseract OCR pipeline for scanned documents
# 1. pdf2image: convert PDF pages to PIL Images (300 DPI)
# 2. pytesseract: extract text from each image
# 3. Combine page texts with page boundaries preserved
# 4. Return structured text with page metadata

async def parse_file(file: UploadFile) -> ParsedDocument:
    """Route to correct parser based on file extension, with OCR fallback."""
    ext = Path(file.filename).suffix.lower()
    if ext == '.pdf':
        text = extract_pdf_text(file)  # pdfplumber
        if len(text.strip()) < 50:  # likely scanned
            text = extract_pdf_ocr(file)  # pytesseract fallback
    elif ext == '.docx':
        text = extract_docx_text(file)
    elif ext == '.pptx':
        text = extract_pptx_text(file)
    else:
        raise UnsupportedFileError(f"Unsupported: {ext}")
    return ParsedDocument(text=text, metadata={...})
```

### Chunking Strategy (tiktoken-aware)
```python
# utils/chunking.py
# - Encoding: tiktoken cl100k_base
# - Chunk size: 500-1000 tokens, overlap: 100 tokens (context continuity)
# - Preserve structure: split on paragraph/heading boundaries when possible
# - Each chunk retains metadata: {source_doc_id, page_number, heading, section, chunk_index, doc_type}
```

### pgvector Usage
```python
from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    chunk_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list] = mapped_column(Vector(1536))  # text-embedding-3-small dimension
    metadata_json: Mapped[dict] = mapped_column(JSONB, default={})
```

### Error Handling
```python
# Use HTTPException with consistent error codes
from fastapi import HTTPException

# In service layer
if not document:
    raise HTTPException(status_code=404, detail="Document not found")

# Custom exceptions for AI failures
class AIGenerationError(Exception):
    pass

# Global exception handler in main.py
@app.exception_handler(AIGenerationError)
async def ai_error_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc), "status": "error", "code": "AI_GENERATION_FAILED"}
    )
```

### Response Format (Consistent)
```python
# All successful responses
{"data": {...}, "message": "Syllabus generated successfully", "status": "success"}

# All error responses
{"detail": "Document not found", "status": "error", "code": "NOT_FOUND"}
```

## API Endpoints

| Method | Path                          | Feature      | Description                     |
| ------ | ----------------------------- | ------------ | ------------------------------- |
| POST   | `/api/v1/documents/upload`    | documents    | Upload & process files          |
| GET    | `/api/v1/documents`           | documents    | List uploaded documents         |
| GET    | `/api/v1/documents/{id}`      | documents    | Get document detail             |
| POST   | `/api/v1/syllabi/generate`    | syllabus     | Generate syllabus from docs     |
| GET    | `/api/v1/syllabi`             | syllabus     | List generated syllabi          |
| GET    | `/api/v1/syllabi/{id}`        | syllabus     | Get syllabus detail             |
| POST   | `/api/v1/personalize`         | personalize  | Generate micro-learning recs    |
| POST   | `/api/v1/chat/revise`         | chat         | Revise syllabus via chat (SSE)  |
| POST   | `/api/v1/export/{syllabus_id}`| export       | Export syllabus as PDF          |

## AI Service Layer Rules

### Prompt Templates (centralized in `prompts.py`)
- Every prompt is a named constant or function
- No inline prompt strings in service files
- Prompts use f-strings or `.format()` with explicit variable names
- System prompts define role + constraints + output format

### RAG Pipeline
1. Query embedding via `embeddings.py` (text-embedding-3-small, 1536 dims)
2. Hybrid search via `rag.py`: pgvector cosine similarity + PostgreSQL FTS, merged via Reciprocal Rank Fusion
3. Filter by similarity threshold (>0.75), top-10 chunks selected
4. Build structured context block: `[Section — Page N]: <chunk_text>` per chunk
5. Inject context into prompt with explicit section labels for LLM grounding
6. LLM generates structured output (JSON mode preferred)

### Azure OpenAI Configuration
```python
# config.py
class Settings(BaseSettings):
    AZURE_OPENAI_API_KEY: str
    AZURE_OPENAI_ENDPOINT: str
    AZURE_OPENAI_CHAT_DEPLOYMENT: str      # e.g., "gpt-4o"
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str  # e.g., "text-embedding-3-small"
    AZURE_OPENAI_API_VERSION: str = "2024-02-01"
    DATABASE_URL: str

    model_config = SettingsConfigDict(env_file=".env")
```

## Testing Rules

- Every feature has integration tests using `httpx.AsyncClient`
- Mock AI responses in tests (never call real Azure OpenAI in tests)
- Use factory fixtures for test data
- Test file naming: `test_<feature>_<aspect>.py`

## Dependency Management

- Pin major versions in `requirements.txt`
- Use virtual environment (`venv` or `poetry`)
- No unused dependencies

## Database

- PostgreSQL 16 with pgvector extension enabled
- Alembic for all schema changes — no manual DDL
- UUID primary keys everywhere
- `created_at` and `updated_at` timestamps on all tables
- JSONB for flexible structured data (ELOs, journey structures)

### Alembic Setup
```bash
# Initialize (already done in scaffold)
alembic init alembic

# alembic/env.py must use async engine:
# - Import Base from app.database
# - Import ALL models (so autogenerate detects them)
# - Use run_async() wrapper for async engine

# Generate migration after model changes
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Migration Rules
- Every model change requires a migration — never edit DB directly
- Migration messages are descriptive: `"add_document_chunks_table"`, `"add_embedding_index"`
- Always review auto-generated migrations before applying
- Migrations must be idempotent where possible
- Include both `upgrade()` and `downgrade()` functions
- pgvector extension creation: `op.execute('CREATE EXTENSION IF NOT EXISTS vector')`
