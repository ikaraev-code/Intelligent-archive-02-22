# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild Archiva from GitHub. Integrate OpenAI RAG. Save/append search summaries to projects. Export projects as PDF. Attach files from chat.

## Architecture
- Frontend: React.js + Tailwind CSS + shadcn/ui + Framer Motion
- Backend: FastAPI + JWT auth + fpdf2 (PDF generation)
- Database: MongoDB
- AI: OpenAI text-embedding-3-small (embeddings), Emergent LLM key (GPT chat & tagging)

## What's Been Implemented
### Session 1 - Feb 22, 2026
1. Full rebuild from GitHub
2. OpenAI RAG pipeline (upload -> AI tagging -> embeddings -> semantic search -> AI chat)
3. Save to Project from search summaries
4. Append to Existing Project (two-tab dialog)
5. Export Project as PDF
6. Quick PDF export from project cards

### Session 2 - Feb 23, 2026
7. **Attach files from chat** — Paperclip icon in AI Archivist and Project chat inputs. Uploads files, auto-tags, generates embeddings. In Project chat, also appends files to the project. Shows upload progress chips.

## GitHub Repo
https://github.com/ikaraev-code/intelligent-archive-02-22

## Backlog
- P1: Test with diverse file types (PDF, DOCX, images)
- P2: Batch re-indexing UI
- P2: Comparison view between projects
