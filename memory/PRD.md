# Archiva - Intelligent Multimedia Archive

## Session Status (Feb 26, 2026)
**Last Active:** Import from Library fixed and improved, Exhibit # labels added
**User Account:** ikaraev@alfangen.com
**Preview URL:** https://chapter-craft-10.preview.emergentagent.com

### Current Stories in DB:
- **Multex** (3 chapters) - Original English
- **Малтекс** (3 chapters) - Russian translation
- **Test Import Story** (1 chapter) - Test story for test@archiva.com

### Completed This Session (Feb 26):
- ✅ **Import from Library UX Improvement** - Moved Import button from header to next to chat input
- ✅ **Import from Library Bug Fix** - Fixed import functionality (was showing "upload failed")
- ✅ **Exhibit # Labels** - Media uploads now automatically add "Exhibit #" labels
- ✅ **Word Export** - Export story as .docx for editing in Microsoft Word
- ✅ Improved translation success navigation
- ✅ Improved error messages for chat failures
- ✅ Fixed temporary OpenAI 502 errors (retry logic)

### Previously Completed:
- ✅ Fixed critical race condition bug (chapter content overwrite)
- ✅ Improved edit window size (300px min-height, resizable)
- ✅ Added delete confirmation dialog for content blocks
- ✅ **Phase 3: Translation** - Translate entire story to new language
- ✅ **Phase 4: Audio Export (TTS)** - Export story as MP3 using OpenAI voices
- ✅ Fixed PDF Unicode support (Cyrillic/Russian text)
- ✅ Fixed Stories nav click to return to list view

### Known Issues:
- **Audio Export UI blocking**: 502 proxy errors during TTS polling cause dialog to stay blocked. Audio generates successfully but progress polling is unreliable.
  - **Potential fixes**: Store task status in DB, use WebSockets, or Server-Sent Events

### Data Backup:
- Backup file: `/app/backend/story_backup.json`
- Restore script: `/app/backend/restore_stories.py`
- If DB is empty after fork, run: `python3 /app/backend/restore_stories.py`

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

## Pending: Stories Phase 3 — Multi-lingual & Translation ✅ COMPLETED
**Implemented (Feb 25, 2026):**
- **UI:** "Translate" button + language dropdown in story header
- **Action:** Creates a NEW independent Story with everything translated (GPT-5.2)
- **Languages:** 18 languages (EN, ES, FR, DE, ZH, JA, PT, RU, IT, AR, KO, NL, PL, TR, HI, SV, NO, DA)
- **Background processing:** Progress bar, can close dialog and see banner
- **Result:** Fully independent story - can edit, add content, export PDF/MP3

## Pending: Stories Phase 4 — Audio Export ✅ COMPLETED
**Implemented (Feb 25, 2026):**
- **UI:** "Audio" button in story header, voice & quality selection dialog
- **Voices:** 9 OpenAI voices (alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer)
- **Quality:** Standard (tts-1) or HD (tts-1-hd)
- **Output:** MP3 file, auto-downloads when complete
- **Known issue:** 502 proxy errors during polling - works but dialog stays blocked

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
