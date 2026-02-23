# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild an application from GitHub repository `https://github.com/ikaraev-code/Intelligent-archive` and extend it with AI-powered features.

## Core Requirements
1. **Rebuild App** from GitHub repo
2. **OpenAI RAG Integration** - auto-tagging, embeddings, semantic search, AI chat
3. **Save Search to Project** - save search results + summary as new project
4. **Append Search to Project** - append to existing project
5. **Export Project to PDF** - full project export
6. **File Upload in Chat** - paperclip button + drag-and-drop in both chat interfaces
7. **Embedding Status Indicators** - real-time visual feedback on file upload/embedding lifecycle
8. **Cascade File Delete** - delete file removes embeddings + cleans project references
9. **Priority File Search** - recently uploaded files boosted in AI Archivist RAG
10. **Unique Test IDs** - desktop/mobile sidebar have distinct data-testid attributes
11. **RAG Source Deduplication** - sources array has unique file entries, deleted files skipped
12. **Batch Re-indexing** - Library panel with stats breakdown + filtered re-index (all/failed/unindexed)

## Tech Stack
- Frontend: React + Tailwind CSS + shadcn/ui
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- AI: OpenAI (text-embedding-3-small for embeddings, GPT-5.2 via Emergent LLM key for chat)
- PDF: fpdf2

## Architecture
```
/app/
├── backend/
│   ├── .env (MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, OPENAI_API_KEY)
│   ├── requirements.txt
│   ├── server.py (all API logic)
│   └── uploads/
└── frontend/
    ├── .env (REACT_APP_BACKEND_URL)
    ├── src/
    │   ├── components/ (ui/, Sidebar.js, FileCard.js, ObjectViewer.js)
    │   ├── lib/api.js (all API calls)
    │   ├── pages/ (Dashboard, Upload, Library, Search, AIChatPage, ProjectsPage, ArticlePage, FileDetailPage)
    │   └── App.js
```

## Key DB Collections
- **users**: {id, email, name, password_hash}
- **files**: {id, user_id, original_filename, content_text, tags[], embedding_status, embedding_count, embedding_error}
- **embeddings**: {id, file_id, chunk_index, chunk_text, embedding[]}
- **projects**: {id, user_id, name, description, file_ids[], status}
- **project_messages**: {id, project_id, role, content, sources[]}

## Completed Features (All Tested)
- [x] App rebuild from GitHub
- [x] OpenAI RAG pipeline (embeddings + semantic search + AI chat)
- [x] Save/Append search to project
- [x] PDF export (from project view + card)
- [x] File upload in chat (click + drag-and-drop)
- [x] Immediate content access bug fix
- [x] P0: Embedding status indicators with retry + error messages (Feb 23)
- [x] Cascade file delete with project inactive status (Feb 23)
- [x] P1: Priority file search in AI Archivist (Feb 23)
- [x] P2: Unique data-testid for desktop/mobile sidebar (Feb 23)
- [x] P3: RAG source deduplication + deleted file skip (Feb 23)
- [x] Batch Re-indexing UI with stats + filtered reindex (Feb 23)

## Future / Backlog
- Test with diverse file types (PDF, DOCX, images)
- Project comparison view
- Optionally clear project chat history when files are removed
- Smart Collections (AI auto-groups related files into suggested projects)

## Credentials
- Test user: test@archiva.com / test123
