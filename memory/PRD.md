# Archiva - Intelligent Multimedia Archive

## Session Status (Feb 25, 2026)
**Last Active:** Phase 3 & 4 implemented
**User Account:** ikaraev@alfangen.com (has story "Multex" with 2 chapters)
**Preview URL:** https://stories-chapter-bug.preview.emergentagent.com

### Completed This Session:
- ✅ Fixed critical race condition bug (chapter content overwrite)
- ✅ Improved edit window size (300px min-height, resizable)
- ✅ Added delete confirmation dialog for content blocks
- ✅ **Phase 3: Translation** - Translate entire story to new language (creates independent copy)
- ✅ **Phase 4: Audio Export (TTS)** - Export story as MP3 using OpenAI voices
- ✅ Fixed PDF Unicode support (Cyrillic/Russian text now renders correctly)
- ✅ Fixed Stories nav click to return to list view

### Known Issues:
- **Audio Export UI blocking**: 502 proxy errors during TTS polling cause dialog to stay blocked. Audio generates successfully but progress polling is unreliable. Works but UX needs improvement.
  - **Potential fixes**: Store task status in DB, use WebSockets, or Server-Sent Events

---

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
  - Inline editing and deletion of content blocks
  - PDF preview for chapters and full stories
- [x] **Bug Fix: Chapter Content Race Condition** (Feb 25, 2026):
  - Fixed race condition where saving content to multiple chapters would overwrite previously saved content
  - Implemented atomic append endpoint using MongoDB's $push operator
  - Both frontend and backend verified working correctly

## Stories Feature Spec
- **Story**: Named container with description, has multiple chapters
- **Chapter**: Sequential by default, reorderable, contains content_blocks[]
- **Content Block**: {type: text|image|video|audio, content, file_id, caption}
- **AI Modes**: Co-author (creative writing help) / Scribe (organize & clean up)
- **Multi-lingual**: Input can be multi-lingual, output translatable (Phase 3)
- **Export**: PDF + Audio/TTS for full story or individual chapters (Phase 4)

## Pending: Stories Phase 3 — Multi-lingual & Translation
**Confirmed Spec (Feb 25, 2026):**
- **UI:** "Translate" button + language dropdown next to Preview/PDF/MP3 buttons
- **Action:** Creates a NEW independent Story with everything translated:
  - Story name & description
  - All chapters (names + content blocks)
- **Languages dropdown:** EN, ES, FR, DE, ZH, JA, PT, RU, IT, AR, KO, NL, PL, TR, etc.
- **Result:** Fully independent story in target language - can edit, add content, export PDF/MP3
- **Multi-lingual input:** User writes in mixed languages (e.g., EN+RU), AI Scribe/Co-author responds in both, original stays mixed, translate creates single-language copy
- **Example:** "Multex" (EN+RU mixed) → Translate to Spanish → New story "Multex (Español)" created

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
