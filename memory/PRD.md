# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild an application from GitHub repository and extend with AI-powered features including RAG, projects, and now Stories.

## Completed Features
- [x] App rebuild from GitHub
- [x] OpenAI RAG pipeline (embeddings + semantic search + AI chat)
- [x] Save/Append search to project + PDF export
- [x] File upload in chat (click + drag-and-drop)
- [x] P0: Embedding status indicators with retry + error messages
- [x] Cascade file delete with project inactive status
- [x] P1: Priority file search in AI Archivist
- [x] P2: Unique data-testid for sidebar
- [x] P3: RAG source deduplication
- [x] Batch Re-indexing UI with stats + filtered reindex
- [x] Dashboard Embedding Health donut widget
- [x] AI Search Unavailable warning for missing API key
- [x] **Stories Phase 1 & 2** (Feb 25, 2026):
  - Story CRUD (create, list, get, update, delete)
  - Chapter CRUD (create, update, delete, reorder)
  - AI composition chat (co-author + scribe modes, GPT-5.2)
  - Content blocks (text, image, video, audio)
  - Media upload to chapters
  - Import from library files
  - "Add to chapter" button on AI messages
  - Chat history persistence per chapter

## Stories Feature Spec
- **Story**: Named container with description, has multiple chapters
- **Chapter**: Sequential by default, reorderable, contains content_blocks[]
- **Content Block**: {type: text|image|video|audio, content, file_id, caption}
- **AI Modes**: Co-author (creative writing help) / Scribe (organize & clean up)
- **Multi-lingual**: Input can be multi-lingual, output translatable (Phase 3)
- **Export**: PDF + Audio/TTS for full story or individual chapters (Phase 4)

## Pending: Stories Phase 3 — Multi-lingual & Translation
- Auto-detect input languages per chapter
- Translation output selector (translate via GPT)
- Preview translated content before export

## Pending: Stories Phase 4 — Export
- PDF export (full story or individual chapters, in selected language)
- Audio export via OpenAI TTS (full story or chapters, in selected language)

## Other Backlog
- Test with diverse file types (PDF, DOCX, images)
- Project comparison view
- Smart Collections (AI auto-groups related files)
- Optional chat history cleanup when files deleted

## Tech Stack
- Frontend: React + Tailwind CSS + shadcn/ui
- Backend: FastAPI + Motor (async MongoDB)
- AI: OpenAI embeddings + Emergent LLM key (GPT-5.2) for chat
- PDF: fpdf2, TTS: OpenAI TTS (planned)

## Key DB Collections
- users, files, embeddings, projects, project_messages
- **stories**: {id, user_id, name, description, detected_languages[], status}
- **chapters**: {id, story_id, name, order, content_blocks[], detected_languages[]}
- **story_messages**: {id, story_id, chapter_id, role, content}

## Credentials
- Test user: test@archiva.com / test123
