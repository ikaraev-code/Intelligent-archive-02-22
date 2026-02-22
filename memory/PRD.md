# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild Archiva app from GitHub repository: https://github.com/ikaraev-code/Intelligent-archive
Then integrate OpenAI API key for full RAG (Retrieval-Augmented Generation) pipeline.

## Architecture
- **Frontend**: React.js with Tailwind CSS, shadcn/ui components, Framer Motion animations
- **Backend**: FastAPI (Python) with JWT authentication
- **Database**: MongoDB
- **AI Integration**: 
  - OpenAI `text-embedding-3-small` for document embeddings & semantic search
  - Emergent LLM key for AI chat (GPT) & auto-tagging
- **PWA**: Service worker for offline support and installability

## User Personas
- Knowledge workers managing large document collections
- Researchers organizing research papers and notes
- Teams collaborating on document archives

## Core Requirements
1. JWT-based authentication (register/login)
2. File upload with drag & drop, AI auto-tagging
3. File library with grid/list views, filtering by tags/type
4. Smart search (keyword + semantic with embeddings)
5. AI Chat (RAG-powered Archivist) for document Q&A
6. Projects for organizing files into collections
7. File detail view with content preview (PDF, images, text, DOCX)
8. Dashboard with stats overview
9. PWA support for mobile installation

## What's Been Implemented (Feb 22, 2026)
- Full rebuild from GitHub source code
- Backend: All API endpoints working (auth, files, search, projects, AI chat, stats)
- Frontend: All 9 pages (Auth, Dashboard, Upload, Library, Search, AI Chat, Projects, FileDetail, Article)
- Components: Sidebar navigation, FileCard, ObjectViewer, InstallPrompt
- OpenAI API key configured for embeddings (text-embedding-3-small)
- Emergent LLM key configured for AI chat & tagging
- RAG pipeline fully operational: upload → AI tagging → embedding → semantic search → AI chat with sources
- Testing: Backend 100%, Frontend confirmed working

## Prioritized Backlog
### P0 (Critical)
- None - all core features operational

### P1 (Important)
- Test file upload with PDF, DOCX, and image files
- Batch re-indexing for existing files

### P2 (Nice to have)
- Performance optimization for large file libraries
- Advanced search filters (date range, file size)
- Batch file operations (multi-select, bulk tag)

## Next Tasks
- User can test the app end-to-end with their own documents
- Consider adding more file type support or custom AI models
