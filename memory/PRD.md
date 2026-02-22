# Archiva - Multimedia Archive PRD

## Original Problem Statement
Build an archive that is able to load multimedia files with tagging information about each file. Step 1: Upload files with tags. Step 2: Search/retrieve files by tags or content. Step 3: Present search results as a nicely summarized article about the retrieved content.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Chat**: OpenAI GPT-5.2 via emergentintegrations (Emergent LLM Key)
- **AI Embeddings**: OpenAI text-embedding-3-small (separate OpenAI API Key)
- **File Storage**: Local filesystem (/app/backend/uploads/)

## What's Been Implemented

### Core Features
- **Auth**: JWT register/login with bcrypt password hashing
- **Upload**: Drag & drop with auto AI tagging via GPT-5.2
- **Library**: File grid/list view with type/tag filters, pagination, visibility filter (All/My Files/Public)
- **Search**: Full-text search across tags, filenames, content
- **Summarize**: AI article generation from selected search results
- **File Detail**: Preview (image/audio/video/text), metadata, tag editing
- **Dashboard**: Stats overview, type breakdown, popular tags, recent uploads
- **PWA**: Service worker, manifest, installable on mobile
- **Object Viewer**: Modal-based file preview with zoom/rotate for images, PDF viewer, video/audio players, Office file support

### AI Archivist (Chat with RAG)
- **AI Chat Page**: Full-featured AI chat assistant for the archive
- **RAG System** (Feb 20, 2026): Retrieval-Augmented Generation for full document knowledge
  - Text extraction from PDF, DOCX, TXT, MD, CSV files
  - Embeddings via OpenAI text-embedding-3-small model (1536 dimensions)
  - Chunked embedding with overlap for better context (1000 chars, 200 overlap)
  - Batch embedding for efficiency
  - Cosine similarity search with 0.3 threshold
  - MongoDB storage in `embeddings` collection
  - Semantic search finds relevant content and cites sources
- **Voice I/O**: Speech-to-text (Whisper) and text-to-speech (TTS)
- **Session Management**: Multi-turn conversations with history

### Smart Search (Feb 20, 2026)
- **Hybrid Search**: Combines keyword matching with semantic AI understanding
- Results show match type badges:
  - **Keyword + Semantic** (purple) - best match, found by both methods
  - **Semantic Match** (blue) - found by AI understanding
  - **Keyword Match** (green) - found by text matching
- Smart Search toggle in Search page (enabled by default)
- API endpoint: `/api/files/smart-search`
- Score boosting: +20% for keyword matches, +30% for dual matches

### Public/Private Files
- Files can be toggled between public and private
- Public files visible to all logged-in users
- Public files included in RAG search for all users
- Visibility filter in Library view

### API Endpoints
- `/api/files/embedding-status` - Check RAG system status
- `/api/files/reindex` - Regenerate embeddings for all files
- `/api/files/smart-search` - Hybrid keyword + semantic search
- `/api/chat` - AI chat with RAG context
- `/api/chat/speech-to-text` - Voice input
- `/api/chat/text-to-speech` - Voice output

## Environment Variables
- `EMERGENT_LLM_KEY` - For GPT-5.2 chat and auto-tagging
- `OPENAI_API_KEY` - For embeddings (text-embedding-3-small)
- `MONGO_URL` - MongoDB connection
- `JWT_SECRET` - Authentication

## Testing Status (Feb 20, 2026)
- **RAG System**: 18/18 tests passed
- **Embedding Status**: 8 files, 21 embeddings, rag_ready: true
- **Verified Documents**: The Multex Story.docx, Karaev_Red_Star PDFs

## Next Tasks
- Image thumbnail previews in file grid
- Batch operations (multi-select delete, tag)

## Completed Tasks

### Feb 20, 2026
- **RAG Implementation**: Full content AI knowledge via embeddings
  - OpenAI text-embedding-3-small integration
  - Semantic search with cosine similarity
  - Source citation in AI responses
  - Embedding status endpoint
  - Reindex endpoint for bulk embedding generation
- **Smart Search**: Hybrid keyword + semantic search
  - Combines MongoDB text search with AI embeddings
  - Match type badges (Keyword, Semantic, Keyword+Semantic)
  - Score boosting for dual matches
  - Minimum relevance thresholds to filter false positives
- **UI Fix**: Select dropdown now has solid white background

### Feb 18, 2026
- **Public/Private Files**: Visibility toggle and filters
- **File Download Fix**: Robust fetch-as-blob method
- **Library UI Redesign**: Smaller grid tiles with hover details

### Feb 17, 2026
- **Download Button Fix**: Programmatic anchor element for reliable downloads

### Feb 16, 2026
- **AI Chat Feature**: Chat with archive files, voice I/O
- **MongoDB Full-Text Search**: Weighted text indexes
- **Delete UI Fix**: Proper white backgrounds in dialogs
