# Archiva Changelog

## Feb 26, 2026 (Session 2)

### Import from Library Improvements
- **UX Fix**: Moved Import button from chapter header to next to chat input for better contextual placement
- **Bug Fix**: Fixed "upload failed" error when importing files from library
- **Feature**: Import now fetches file text content via `filesAPI.getById` and populates chat input
- **Testing**: All import functionality verified working (dialog, file selection, text import, success toast)

### Exhibit # Labels for Media
- **Feature**: Media uploads now automatically add "Exhibit #" labels before each media block
- **Implementation**: Backend counts existing media blocks to generate sequential exhibit numbers
- **Format**: Labels appear as text blocks with format "\n\nExhibit #\n"

### Testing
- Test report: `/app/test_reports/iteration_14.json`
- Test file: `/app/backend/tests/test_exhibit_label.py`
- All tests passed (100% success rate)

---

## Feb 26, 2026 (Session 1)

### Word Export
- Added Word (.docx) export for stories
- Uses python-docx library
- Includes story title, description, and all chapters

### Translation Improvements
- Fixed navigation after translation completes
- Improved error messages for API failures
- Added retry logic for temporary 502 errors

### Audio Export (TTS)
- Implemented audio export using OpenAI TTS
- Supports 9 voices and 2 quality levels
- Background task with progress polling
- Known issue: 502 proxy errors during long generation

---

## Feb 25, 2026

### Stories Feature - Phase 1 & 2
- Story and Chapter CRUD operations
- AI composition chat (co-author + scribe modes)
- Content blocks (text, image, video, audio)
- Media upload to chapters
- Import from library files
- PDF preview for chapters and stories

### Bug Fixes
- Fixed race condition in chapter content saving
- Implemented atomic append using MongoDB $push
- Fixed PDF Unicode support for Cyrillic text

### Translation (Phase 3)
- Translate entire story to new language
- 18 supported languages
- Background processing with progress indicator
- Creates independent translated story
