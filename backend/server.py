from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
import aiofiles
import re
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000
)
db = client[db_name]

# JWT Config - Key must be at least 32 bytes for HS256
JWT_SECRET = os.environ.get('JWT_SECRET', 'archiva-xk9m2f7v3q1w8e4t-prod-secret-key-32b')
JWT_ALGORITHM = "HS256"

# File upload config
UPLOAD_DIR = ROOT_DIR / "uploads"
try:
    UPLOAD_DIR.mkdir(exist_ok=True)
except OSError:
    UPLOAD_DIR = Path("/tmp/archiva_uploads")
    UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

ALLOWED_EXTENSIONS = {
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'],
    'document': ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.xlsx', '.pptx'],
    'audio': ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    'video': ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm', '.flv']
}

# LLM Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# OpenAI Config for embeddings (separate from Emergent key which doesn't support embeddings)
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# Embedding config
EMBEDDING_CHUNK_SIZE = 1000  # Characters per chunk
EMBEDDING_CHUNK_OVERLAP = 200  # Overlap between chunks
EMBEDDING_MODEL = "text-embedding-3-small"  # OpenAI embedding model (1536 dimensions)

# Initialize OpenAI client for embeddings (uses separate OPENAI_API_KEY)
from openai import OpenAI
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

if openai_client:
    logger.info("OpenAI embeddings client initialized successfully")
else:
    logger.warning("OpenAI API key not configured - embeddings will not be available")

def generate_embeddings_sync(text: str) -> List[float]:
    """Generate embeddings for text using OpenAI text-embedding-3-small model"""
    if not openai_client or not text.strip():
        return []
    try:
        # Normalize text - replace newlines with spaces
        text = text.replace("\n", " ").strip()
        # Truncate to avoid token limits (roughly 8000 chars ~ 2000 tokens)
        text = text[:8000]
        
        response = openai_client.embeddings.create(
            input=text,
            model=EMBEDDING_MODEL
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return []

async def generate_embeddings(text: str) -> List[float]:
    """Async wrapper for embedding generation"""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_embeddings_sync, text)

def generate_embeddings_batch_sync(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for multiple texts in a single API call (more efficient)"""
    if not openai_client or not texts:
        return []
    try:
        # Normalize and truncate all texts
        processed_texts = [t.replace("\n", " ").strip()[:8000] for t in texts if t.strip()]
        if not processed_texts:
            return []
        
        response = openai_client.embeddings.create(
            input=processed_texts,
            model=EMBEDDING_MODEL
        )
        
        # Sort by index to ensure correct ordering
        embeddings = [None] * len(processed_texts)
        for item in response.data:
            embeddings[item.index] = item.embedding
        
        return embeddings
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        return []

async def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Async wrapper for batch embedding generation"""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_embeddings_batch_sync, texts)

def chunk_text(text: str, chunk_size: int = EMBEDDING_CHUNK_SIZE, overlap: int = EMBEDDING_CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks for embedding"""
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    return chunks

async def process_file_embeddings(file_id: str, content_text: str, filename: str, tags: List[str]):
    """Process and store embeddings for a file's content using batch embedding for efficiency"""
    if not content_text and not tags:
        logger.info(f"No content to embed for file {file_id}")
        await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "skipped", "embedding_error": "No text content to embed"}})
        return
    
    if not openai_client:
        logger.warning(f"OpenAI client not configured, skipping embeddings for {file_id}")
        await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "disabled", "embedding_error": "AI service not configured"}})
        return
    
    # Mark as processing
    await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "processing", "embedding_error": None}})
    
    try:
        # Combine content with metadata for richer embeddings
        full_text = f"File: {filename}\nTags: {', '.join(tags)}\n\nContent:\n{content_text}"
        
        # Create chunks
        chunks = chunk_text(full_text)
        if not chunks:
            logger.info(f"No chunks created for file {file_id}")
            await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "skipped", "embedding_error": "No text content to embed"}})
            return
        
        logger.info(f"Processing {len(chunks)} chunks for file {file_id}")
        
        # Use batch embedding for efficiency (process in batches of 100)
        batch_size = 100
        embeddings_docs = []
        
        for batch_start in range(0, len(chunks), batch_size):
            batch_end = min(batch_start + batch_size, len(chunks))
            batch_chunks = chunks[batch_start:batch_end]
            
            # Generate embeddings for this batch
            batch_embeddings = await generate_embeddings_batch(batch_chunks)
            
            if batch_embeddings:
                for i, (chunk, embedding) in enumerate(zip(batch_chunks, batch_embeddings)):
                    if embedding:
                        chunk_index = batch_start + i
                        embeddings_docs.append({
                            "id": f"{file_id}-chunk-{chunk_index}",
                            "file_id": file_id,
                            "chunk_index": chunk_index,
                            "chunk_text": chunk,
                            "embedding": embedding,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
        
        if embeddings_docs:
            # Delete old embeddings for this file
            await db.embeddings.delete_many({"file_id": file_id})
            # Insert new embeddings
            await db.embeddings.insert_many(embeddings_docs)
            logger.info(f"Created {len(embeddings_docs)} embeddings for file {file_id} ({filename})")
            await db.files.update_one({"id": file_id}, {"$set": {
                "embedding_status": "completed",
                "embedding_count": len(embeddings_docs),
                "embedding_error": None
            }})
        else:
            logger.warning(f"No embeddings generated for file {file_id}")
            await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "failed", "embedding_error": "Embedding generation returned empty results"}})
            
    except Exception as e:
        logger.error(f"Error processing embeddings for {file_id}: {e}", exc_info=True)
        error_str = str(e)
        if "401" in error_str or "api_key" in error_str.lower() or "unauthorized" in error_str.lower():
            reason = "API key invalid or expired"
        elif "429" in error_str or "rate" in error_str.lower():
            reason = "Rate limit exceeded — try again shortly"
        elif "timeout" in error_str.lower() or "timed out" in error_str.lower():
            reason = "Request timed out — try again"
        else:
            reason = "Unexpected error during embedding"
        await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "failed", "embedding_error": reason}})

async def find_relevant_content(query: str, user_id: str, limit: int = 5) -> List[dict]:
    """Find most relevant content chunks for a query using cosine similarity"""
    if not openai_client:
        logger.warning("OpenAI client not configured, skipping RAG search")
        return []
    
    try:
        # Get query embedding
        query_embedding = await generate_embeddings(query)
        if not query_embedding:
            logger.warning("Failed to generate query embedding")
            return []
        
        # Get user's files (their own + public files)
        user_files = await db.files.find(
            {"$or": [{"user_id": user_id}, {"is_public": True}]},
            {"id": 1}
        ).to_list(1000)
        file_ids = [f["id"] for f in user_files]
        
        if not file_ids:
            logger.info("No files found for user")
            return []
        
        # Get all embeddings for accessible files
        embeddings = await db.embeddings.find(
            {"file_id": {"$in": file_ids}}
        ).to_list(5000)  # Increased limit for larger archives
        
        if not embeddings:
            logger.info("No embeddings found for user's files")
            return []
        
        logger.info(f"Searching through {len(embeddings)} embeddings from {len(file_ids)} files")
        
        # Calculate cosine similarity using numpy
        import numpy as np
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)
        
        if query_norm == 0:
            return []
        
        results = []
        for emb in embeddings:
            embedding_vec = emb.get("embedding")
            if embedding_vec and len(embedding_vec) == len(query_embedding):
                emb_vec = np.array(embedding_vec)
                emb_norm = np.linalg.norm(emb_vec)
                if emb_norm > 0:
                    similarity = np.dot(query_vec, emb_vec) / (query_norm * emb_norm)
                    # Only include results with meaningful similarity (> 0.3)
                    if similarity > 0.3:
                        results.append({
                            "file_id": emb["file_id"],
                            "chunk_text": emb["chunk_text"],
                            "chunk_index": emb.get("chunk_index", 0),
                            "similarity": float(similarity)
                        })
        
        # Sort by similarity and return top results
        results.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = results[:limit]
        
        logger.info(f"Found {len(top_results)} relevant chunks (out of {len(results)} above threshold)")
        return top_results
        
    except Exception as e:
        logger.error(f"Error finding relevant content: {e}", exc_info=True)
        return []

# App creation - no lifespan hooks, instant startup, MongoDB connects lazily
app = FastAPI()

# Create text index on startup
@app.on_event("startup")
async def create_indexes():
    """Create MongoDB text index for full-text search"""
    try:
        # Create compound text index with weights
        # Higher weight = more important in search ranking
        await db.files.create_index(
            [
                ("original_filename", "text"),
                ("tags", "text"),
                ("content_text", "text")
            ],
            weights={
                "original_filename": 10,  # Filename matches are most important
                "tags": 5,                # Tag matches are next
                "content_text": 1         # Content matches have lowest priority
            },
            default_language="english",
            name="files_text_search"
        )
        logger.info("Text search index created successfully")
    except Exception as e:
        # Index might already exist, that's fine
        if "already exists" not in str(e).lower():
            logger.warning(f"Could not create text index: {e}")

# CORS - add immediately after app creation
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class TagUpdate(BaseModel):
    tags: List[str]

class SummarizeRequest(BaseModel):
    file_ids: List[str]
    query: Optional[str] = None

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    include_file_context: bool = True
    priority_file_ids: Optional[List[str]] = None

class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"
    speed: float = 1.0

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    file_ids: List[str] = []
    summary: Optional[str] = None  # If provided, seeds the first assistant message in project chat

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    file_ids: Optional[List[str]] = None

class ProjectAppend(BaseModel):
    file_ids: List[str] = []
    summary: Optional[str] = None

class ProjectChatRequest(BaseModel):
    message: str
    include_file_context: bool = True

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== FILE HELPERS ====================

def get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    for ftype, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            return ftype
    return "other"

def is_allowed_file(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    all_exts = [e for exts in ALLOWED_EXTENSIONS.values() for e in exts]
    return ext in all_exts

async def extract_text_content(file_path: str, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    try:
        if ext in ['.txt', '.md', '.csv']:
            async with aiofiles.open(file_path, 'r', errors='ignore') as f:
                content = await f.read()
                return content[:50000]  # Increased limit for full content
        elif ext == '.pdf':
            import PyPDF2
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages[:50]:  # Increased page limit
                    text += page.extract_text() or ""
                return text[:50000]
        elif ext == '.docx':
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([p.text for p in doc.paragraphs])
            return text[:50000]
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
    return ""

async def generate_ai_tags(filename: str, file_type: str, content_text: str) -> List[str]:
    if not EMERGENT_LLM_KEY:
        return []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tagging-{uuid.uuid4()}",
            system_message="You are a file tagging assistant. Given a filename, file type, and optional content, generate 3-8 relevant tags. Return ONLY a JSON array of lowercase tag strings, nothing else. Example: [\"report\", \"finance\", \"quarterly\"]"
        )
        chat.with_model("openai", "gpt-5.2")

        prompt = f"Filename: {filename}\nFile type: {file_type}\n"
        if content_text:
            prompt += f"Content preview: {content_text[:2000]}\n"
        prompt += "\nGenerate relevant tags as a JSON array:"

        response = await chat.send_message(UserMessage(text=prompt))
        tags = json.loads(response.strip().strip('`').replace('json\n', '').replace('json', ''))
        if isinstance(tags, list):
            return [str(t).lower().strip() for t in tags if t][:8]
    except Exception as e:
        logger.error(f"AI tagging error: {e}")
    return []

async def generate_article(files_data: list, query: str = None) -> dict:
    if not EMERGENT_LLM_KEY:
        return {"title": "Summary", "content": "AI summarization unavailable.", "sources": []}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"article-{uuid.uuid4()}",
            system_message="You are a content summarization expert. Given information about multiple files and their content, create a well-structured article that synthesizes the information. Return a JSON object with 'title' (string), 'content' (string in markdown format), and 'key_points' (array of strings). The content should be informative and well-organized with headings and paragraphs."
        )
        chat.with_model("openai", "gpt-5.2")

        files_info = []
        for f in files_data:
            info = f"- File: {f.get('original_filename', 'Unknown')} (Type: {f.get('file_type', 'unknown')})"
            if f.get('tags'):
                info += f"\n  Tags: {', '.join(f['tags'])}"
            if f.get('content_text'):
                info += f"\n  Content: {f['content_text'][:1000]}"
            files_info.append(info)

        prompt = f"Create a summarized article based on the following archived files:\n\n{''.join(files_info)}"
        if query:
            prompt += f"\n\nThe user searched for: {query}\nFocus the article around this topic."

        response = await chat.send_message(UserMessage(text=prompt))
        cleaned = response.strip().strip('`').replace('json\n', '').replace('json', '')
        result = json.loads(cleaned)
        return {
            "title": result.get("title", "Summary"),
            "content": result.get("content", ""),
            "key_points": result.get("key_points", []),
            "sources": [f.get("original_filename", "") for f in files_data]
        }
    except Exception as e:
        logger.error(f"Article generation error: {e}")
        return {"title": "Summary", "content": f"Error generating article: {str(e)}", "key_points": [], "sources": []}

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, data.email)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"]}

# ==================== FILE ROUTES ====================

@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    tags: str = Form(""),
    user=Depends(get_current_user)
):
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")

    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower()
    stored_filename = f"{file_id}{ext}"
    file_path = str(UPLOAD_DIR / stored_filename)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 100MB)")

    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    file_type = get_file_type(file.filename)
    content_text = await extract_text_content(file_path, file.filename)

    manual_tags = [t.strip().lower() for t in tags.split(",") if t.strip()] if tags else []
    ai_tags = await generate_ai_tags(file.filename, file_type, content_text)
    all_tags = list(set(manual_tags + ai_tags))

    file_doc = {
        "id": file_id,
        "user_id": user["id"],
        "owner_name": user.get("name", "Unknown"),
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "file_type": file_type,
        "file_extension": ext,
        "file_size": len(content),
        "tags": all_tags,
        "ai_tags": ai_tags,
        "manual_tags": manual_tags,
        "content_text": content_text,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "mime_type": file.content_type or "application/octet-stream",
        "is_public": False,
        "embedding_status": "pending"
    }
    await db.files.insert_one(file_doc)
    file_doc.pop("_id", None)
    
    # Generate embeddings for RAG (in background, don't block response)
    import asyncio
    asyncio.create_task(process_file_embeddings(file_id, content_text, file.filename, all_tags))
    
    return file_doc

@api_router.get("/files")
async def list_files(
    file_type: Optional[str] = None,
    tag: Optional[str] = None,
    visibility: Optional[str] = "all",  # "all", "public", "private"
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user)
):
    # Build query based on visibility filter
    if visibility == "public":
        # Show all public files from any user
        query = {"is_public": True}
    elif visibility == "private":
        # Show only user's own private files
        query = {"user_id": user["id"], "is_public": {"$ne": True}}
    else:
        # "all" - show user's own files + all public files
        query = {"$or": [
            {"user_id": user["id"]},
            {"is_public": True}
        ]}
    
    if file_type and file_type != "all":
        query["file_type"] = file_type
    if tag:
        query["tags"] = tag
    
    skip = (page - 1) * limit
    total = await db.files.count_documents(query)
    files = await db.files.find(query, {"_id": 0, "content_text": 0}).sort("upload_date", -1).skip(skip).limit(limit).to_list(limit)
    return {"files": files, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/files/stats")
async def get_stats(user=Depends(get_current_user)):
    user_id = user["id"]
    total = await db.files.count_documents({"user_id": user_id})
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$file_type", "count": {"$sum": 1}, "size": {"$sum": "$file_size"}}}
    ]
    type_stats = await db.files.aggregate(pipeline).to_list(100)
    tag_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    top_tags = await db.files.aggregate(tag_pipeline).to_list(20)
    recent = await db.files.find({"user_id": user_id}, {"_id": 0, "content_text": 0}).sort("upload_date", -1).limit(5).to_list(5)
    total_size = sum(s.get("size", 0) for s in type_stats)
    return {
        "total_files": total,
        "total_size": total_size,
        "type_breakdown": {s["_id"]: {"count": s["count"], "size": s["size"]} for s in type_stats},
        "top_tags": [{"tag": t["_id"], "count": t["count"]} for t in top_tags],
        "recent_files": recent
    }

@api_router.get("/files/tags")
async def get_all_tags(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    tags = await db.files.aggregate(pipeline).to_list(200)
    return [{"tag": t["_id"], "count": t["count"]} for t in tags]

@api_router.get("/files/embedding-stats")
async def get_embedding_stats(user=Depends(get_current_user)):
    """Get a breakdown of embedding statuses for user's files"""
    user_filter = {"$or": [{"user_id": user["id"]}, {"is_public": True}]}
    total = await db.files.count_documents(user_filter)
    
    pipeline = [
        {"$match": user_filter},
        {"$group": {"_id": "$embedding_status", "count": {"$sum": 1}}}
    ]
    status_counts = {}
    async for doc in db.files.aggregate(pipeline):
        status_counts[doc["_id"] or "none"] = doc["count"]
    
    # Get files that failed or have no embeddings for the detail list
    problem_files = await db.files.find(
        {**user_filter, "embedding_status": {"$in": ["failed", "skipped", "disabled", "pending", None]}},
        {"_id": 0, "id": 1, "original_filename": 1, "embedding_status": 1, "embedding_error": 1, "file_type": 1, "upload_date": 1}
    ).to_list(500)
    
    return {
        "total": total,
        "completed": status_counts.get("completed", 0),
        "processing": status_counts.get("processing", 0),
        "pending": status_counts.get("pending", 0),
        "failed": status_counts.get("failed", 0),
        "skipped": status_counts.get("skipped", 0),
        "disabled": status_counts.get("disabled", 0),
        "none": status_counts.get("none", 0),
        "problem_files": problem_files
    }


@api_router.post("/files/reindex")
async def reindex_embeddings(user=Depends(get_current_user), filter: str = "all"):
    """Start background reindex of embeddings. Filter: all, failed, unindexed"""
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI embedding service not configured")
    
    user_filter = {"$or": [{"user_id": user["id"]}, {"is_public": True}]}
    if filter == "failed":
        user_filter["embedding_status"] = {"$in": ["failed"]}
    elif filter == "unindexed":
        user_filter["embedding_status"] = {"$in": ["failed", "skipped", "disabled", "pending", None]}
    
    files = await db.files.find(
        user_filter,
        {"_id": 0, "id": 1, "original_filename": 1, "content_text": 1, "tags": 1}
    ).to_list(1000)
    
    if not files:
        return {"message": "No files to reindex", "task_id": None, "total": 0}
    
    task_id = str(uuid.uuid4())
    reindex_tasks[task_id] = {
        "status": "running",
        "processed": 0,
        "total": len(files),
        "errors": [],
        "current_file": ""
    }
    
    async def run_reindex():
        try:
            for i, f in enumerate(files):
                try:
                    reindex_tasks[task_id]["current_file"] = f["original_filename"]
                    content_text = f.get("content_text", "")
                    if content_text or f.get("tags"):
                        await process_file_embeddings(
                            f["id"], content_text, f["original_filename"], f.get("tags", [])
                        )
                    else:
                        await db.files.update_one(
                            {"id": f["id"]},
                            {"$set": {"embedding_status": "skipped", "embedding_error": "No text content to embed"}}
                        )
                    reindex_tasks[task_id]["processed"] = i + 1
                except Exception as e:
                    reindex_tasks[task_id]["errors"].append(f"{f['original_filename']}: {str(e)}")
                    reindex_tasks[task_id]["processed"] = i + 1
            
            reindex_tasks[task_id]["status"] = "completed"
            reindex_tasks[task_id]["current_file"] = ""
        except Exception as e:
            reindex_tasks[task_id]["status"] = "failed"
            logger.error(f"Reindex task {task_id} failed: {e}")
    
    import asyncio
    asyncio.create_task(run_reindex())
    
    return {"message": "Reindex started", "task_id": task_id, "total": len(files)}

@api_router.get("/files/reindex-progress/{task_id}")
async def get_reindex_progress(task_id: str, user=Depends(get_current_user)):
    """Poll reindex progress"""
    task = reindex_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@api_router.get("/files/embedding-status")
async def get_embedding_status(user=Depends(get_current_user)):
    """Get the status of embeddings for the archive"""
    if not openai_client:
        return {
            "status": "disabled",
            "message": "AI embedding service not configured",
            "total_files": 0,
            "files_with_embeddings": 0,
            "total_embeddings": 0
        }
    
    # Count total accessible files
    total_files = await db.files.count_documents({
        "$or": [{"user_id": user["id"]}, {"is_public": True}]
    })
    
    # Count files with textual content
    files_with_content = await db.files.count_documents({
        "$or": [{"user_id": user["id"]}, {"is_public": True}],
        "content_text": {"$exists": True, "$ne": ""}
    })
    
    # Get file IDs for accessible files
    file_docs = await db.files.find(
        {"$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"id": 1}
    ).to_list(1000)
    file_ids = [f["id"] for f in file_docs]
    
    # Count embeddings
    total_embeddings = await db.embeddings.count_documents({"file_id": {"$in": file_ids}})
    
    # Count unique files that have embeddings
    if file_ids:
        pipeline = [
            {"$match": {"file_id": {"$in": file_ids}}},
            {"$group": {"_id": "$file_id"}},
            {"$count": "count"}
        ]
        result = await db.embeddings.aggregate(pipeline).to_list(1)
        files_with_embeddings = result[0]["count"] if result else 0
    else:
        files_with_embeddings = 0
    
    return {
        "status": "enabled",
        "model": EMBEDDING_MODEL,
        "total_files": total_files,
        "files_with_content": files_with_content,
        "files_with_embeddings": files_with_embeddings,
        "total_embeddings": total_embeddings,
        "rag_ready": files_with_embeddings > 0
    }


@api_router.get("/files/batch-status")
async def get_batch_file_status(ids: str = "", user=Depends(get_current_user)):
    """Get embedding status for multiple files by comma-separated IDs"""
    if not ids:
        return {"statuses": []}
    file_ids = [fid.strip() for fid in ids.split(",") if fid.strip()]
    if not file_ids:
        return {"statuses": []}
    files = await db.files.find(
        {"id": {"$in": file_ids}, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0, "id": 1, "original_filename": 1, "embedding_status": 1, "embedding_count": 1, "file_type": 1, "content_text": 1, "embedding_error": 1}
    ).to_list(100)
    # Add has_text flag and strip content_text from response
    for f in files:
        f["has_text"] = bool(f.get("content_text"))
        f.pop("content_text", None)
    return {"statuses": files}


@api_router.post("/files/{file_id}/retry-embedding")
async def retry_file_embedding(file_id: str, user=Depends(get_current_user)):
    """Retry embedding generation for a file that failed or was skipped"""
    file_doc = await db.files.find_one(
        {"id": file_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI embedding service not configured")
    # Reset status to pending and re-trigger
    await db.files.update_one({"id": file_id}, {"$set": {"embedding_status": "pending"}})
    import asyncio
    asyncio.create_task(process_file_embeddings(
        file_id,
        file_doc.get("content_text", ""),
        file_doc.get("original_filename", ""),
        file_doc.get("tags", [])
    ))
    return {"message": "Embedding retry started", "file_id": file_id, "embedding_status": "pending"}


@api_router.get("/files/search")
async def search_files(
    q: str = "",
    file_type: Optional[str] = None,
    visibility: Optional[str] = "all",  # "all", "public", "private"
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user)
):
    if not q:
        return {"files": [], "total": 0, "page": 1, "pages": 0}
    
    # Build query based on visibility filter
    if visibility == "public":
        query = {"is_public": True}
    elif visibility == "private":
        query = {"user_id": user["id"], "is_public": {"$ne": True}}
    else:
        # "all" - search user's own files + all public files
        query = {"$or": [
            {"user_id": user["id"]},
            {"is_public": True}
        ]}
    
    # Use MongoDB full-text search with $text operator
    query["$text"] = {"$search": q}
    
    if file_type and file_type != "all":
        query["file_type"] = file_type
    
    skip = (page - 1) * limit
    total = await db.files.count_documents(query)
    
    # Sort by text search score (relevance) then by upload date
    files = await db.files.find(
        query, 
        {"_id": 0, "content_text": 0, "score": {"$meta": "textScore"}}
    ).sort([
        ("score", {"$meta": "textScore"}),
        ("upload_date", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    # Remove the score field from response
    for f in files:
        f.pop("score", None)
    
    return {"files": files, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/files/smart-search")
async def smart_search_files(
    q: str = "",
    file_type: Optional[str] = None,
    visibility: Optional[str] = "all",
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user)
):
    """
    Smart Search: Combines keyword search with semantic search for better results.
    - Keyword matches get boosted scores
    - Semantic matches find conceptually related content
    - Results are merged and deduplicated
    """
    if not q:
        return {"files": [], "total": 0, "page": 1, "pages": 0, "search_type": "smart"}
    
    # Build visibility filter
    if visibility == "public":
        vis_filter = {"is_public": True}
    elif visibility == "private":
        vis_filter = {"user_id": user["id"], "is_public": {"$ne": True}}
    else:
        vis_filter = {"$or": [{"user_id": user["id"]}, {"is_public": True}]}
    
    results_map = {}  # file_id -> {file_doc, score, match_types}
    
    # 1. Keyword Search (MongoDB full-text)
    try:
        keyword_query = {**vis_filter, "$text": {"$search": q}}
        if file_type and file_type != "all":
            keyword_query["file_type"] = file_type
        
        keyword_results = await db.files.find(
            keyword_query,
            {"_id": 0, "content_text": 0, "score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(50).to_list(50)
        
        for i, f in enumerate(keyword_results):
            file_id = f["id"]
            text_score = f.pop("score", 1.0)
            
            # Skip low-relevance keyword matches (score < 2.0 means very weak match)
            if text_score < 2.0:
                continue
                
            # Normalize text score (typically 0-20) to 0-1 range, boost keyword matches
            normalized_score = min(text_score / 10.0, 1.0) * 1.2  # 20% boost for keyword matches
            results_map[file_id] = {
                "file": f,
                "score": normalized_score,
                "match_types": ["keyword"],
                "keyword_rank": i + 1,
                "keyword_score": text_score
            }
    except Exception as e:
        logger.warning(f"Keyword search failed: {e}")
    
    # 2. Semantic Search (Embeddings)
    if openai_client:
        try:
            semantic_results = await find_relevant_content(q, user["id"], limit=20)
            
            # Track best similarity per file (a file may have multiple matching chunks)
            file_best_similarity = {}
            for chunk in semantic_results:
                file_id = chunk["file_id"]
                similarity = chunk["similarity"]
                if file_id not in file_best_similarity or similarity > file_best_similarity[file_id]:
                    file_best_similarity[file_id] = similarity
            
            # Only include semantic matches with high similarity (0.5+ threshold)
            for file_id, similarity in file_best_similarity.items():
                if similarity < 0.5:  # Skip weak semantic matches
                    continue
                if file_id in results_map:
                    # Combine scores - file matches both keyword and semantic
                    existing = results_map[file_id]
                    existing["score"] = max(existing["score"], similarity) * 1.3  # 30% boost for dual match
                    if "semantic" not in existing["match_types"]:
                        existing["match_types"].append("semantic")
                    existing["semantic_similarity"] = similarity
                else:
                    # Get file doc for semantic-only match
                    file_doc = await db.files.find_one(
                        {"id": file_id, **vis_filter},
                        {"_id": 0, "content_text": 0}
                    )
                    if file_doc:
                        # Apply file_type filter if specified
                        if file_type and file_type != "all" and file_doc.get("file_type") != file_type:
                            continue
                        results_map[file_id] = {
                            "file": file_doc,
                            "score": similarity,
                            "match_types": ["semantic"],
                            "semantic_similarity": similarity
                        }
        except Exception as e:
            logger.warning(f"Semantic search failed: {e}")
    
    # 3. Sort by combined score and paginate
    sorted_results = sorted(results_map.values(), key=lambda x: x["score"], reverse=True)
    total = len(sorted_results)
    
    # Paginate
    skip = (page - 1) * limit
    paginated = sorted_results[skip:skip + limit]
    
    # Format response with match info
    files = []
    for r in paginated:
        file_doc = r["file"]
        file_doc["_search_info"] = {
            "score": round(r["score"], 3),
            "match_types": r["match_types"],
            "semantic_similarity": r.get("semantic_similarity"),
            "keyword_rank": r.get("keyword_rank")
        }
        files.append(file_doc)
    
    return {
        "files": files,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
        "search_type": "smart",
        "semantic_enabled": openai_client is not None
    }

@api_router.get("/files/download/{file_id}")
async def download_file(file_id: str, token: Optional[str] = None, inline: bool = False, credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    # Accept auth from either Bearer header or query param (for img/audio/video src)
    auth_token = None
    if credentials:
        auth_token = credentials.credentials
    elif token:
        auth_token = token
    if not auth_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(auth_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["user_id"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Allow access if user owns the file OR if file is public
    file_doc = await db.files.find_one({
        "id": file_id,
        "$or": [{"user_id": user_id}, {"is_public": True}]
    }, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = UPLOAD_DIR / file_doc["stored_filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    from urllib.parse import quote
    filename = file_doc["original_filename"]
    encoded_filename = quote(filename)
    
    # Use inline disposition for preview, attachment for download
    if inline:
        disposition = f'inline; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'
    else:
        disposition = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'
    
    headers = {
        "Content-Disposition": disposition,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self' https://*.emergentagent.com https://upload-status-hub-1.preview.emergentagent.com",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }
    return FileResponse(
        str(file_path), 
        filename=filename, 
        media_type=file_doc.get("mime_type", "application/octet-stream"),
        headers=headers
    )

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, user=Depends(get_current_user)):
    # Allow access if user owns the file OR if file is public
    file_doc = await db.files.find_one({
        "id": file_id,
        "$or": [{"user_id": user["id"]}, {"is_public": True}]
    }, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return file_doc

@api_router.put("/files/{file_id}/tags")
async def update_tags(file_id: str, data: TagUpdate, user=Depends(get_current_user)):
    file_doc = await db.files.find_one({"id": file_id, "user_id": user["id"]})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    clean_tags = [t.strip().lower() for t in data.tags if t.strip()]
    await db.files.update_one({"id": file_id}, {"$set": {"tags": clean_tags, "manual_tags": clean_tags}})
    updated = await db.files.find_one({"id": file_id}, {"_id": 0})
    return updated

class VisibilityUpdate(BaseModel):
    is_public: bool

@api_router.put("/files/{file_id}/visibility")
async def update_visibility(file_id: str, data: VisibilityUpdate, user=Depends(get_current_user)):
    # Only the owner can change visibility
    file_doc = await db.files.find_one({"id": file_id, "user_id": user["id"]})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found or you don't have permission")
    await db.files.update_one({"id": file_id}, {"$set": {"is_public": data.is_public}})
    updated = await db.files.find_one({"id": file_id}, {"_id": 0})
    return updated

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, user=Depends(get_current_user)):
    file_doc = await db.files.find_one({"id": file_id, "user_id": user["id"]}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file
    file_path = UPLOAD_DIR / file_doc["stored_filename"]
    if file_path.exists():
        file_path.unlink()
    
    # Delete embeddings for this file
    deleted_embeddings = await db.embeddings.delete_many({"file_id": file_id})
    
    # Remove file ID from all projects that reference it
    affected_projects = await db.projects.find(
        {"file_ids": file_id, "user_id": user["id"]},
        {"_id": 0, "id": 1, "name": 1, "file_ids": 1}
    ).to_list(100)
    
    affected_info = []
    for proj in affected_projects:
        new_file_ids = [fid for fid in proj["file_ids"] if fid != file_id]
        update_fields = {"file_ids": new_file_ids, "updated_at": datetime.now(timezone.utc).isoformat()}
        if len(new_file_ids) == 0:
            update_fields["status"] = "inactive"
        await db.projects.update_one({"id": proj["id"]}, {"$set": update_fields})
        affected_info.append({
            "id": proj["id"],
            "name": proj["name"],
            "remaining_files": len(new_file_ids),
            "became_inactive": len(new_file_ids) == 0
        })
    
    # Delete file document
    await db.files.delete_one({"id": file_id})
    
    return {
        "message": "File deleted",
        "embeddings_removed": deleted_embeddings.deleted_count,
        "affected_projects": affected_info
    }

@api_router.post("/files/summarize")
async def summarize_files(data: SummarizeRequest, user=Depends(get_current_user)):
    files = await db.files.find(
        {"id": {"$in": data.file_ids}, "user_id": user["id"]}, {"_id": 0}
    ).to_list(50)
    if not files:
        raise HTTPException(status_code=404, detail="No files found")
    article = await generate_article(files, data.query)
    return article

# ==================== AI CHAT ROUTES ====================

# Store chat sessions in memory (for simplicity - could use MongoDB for persistence)
chat_sessions: Dict[str, list] = {}

# Reindex progress tracking
reindex_tasks: Dict[str, dict] = {}  # task_id -> {processed, total, status, errors}

async def get_user_file_context(user_id: str, limit: int = 20) -> str:
    """Get a summary of user's files for AI context"""
    files = await db.files.find(
        {"$or": [{"user_id": user_id}, {"is_public": True}]}, 
        {"_id": 0, "original_filename": 1, "file_type": 1, "tags": 1, "content_text": 1}
    ).sort("upload_date", -1).limit(limit).to_list(limit)
    
    if not files:
        return "The user has no files in their archive yet."
    
    context_parts = [f"The user has access to {len(files)} files in the archive:"]
    for f in files:
        tags = ", ".join(f.get("tags", [])[:5]) if f.get("tags") else "no tags"
        content_preview = f.get("content_text", "")[:500] if f.get("content_text") else ""
        context_parts.append(f"- {f['original_filename']} ({f['file_type']}): tags=[{tags}]")
        if content_preview:
            context_parts.append(f"  Content preview: {content_preview}...")
    
    return "\n".join(context_parts)

async def get_rag_context(query: str, user_id: str, priority_file_ids: List[str] = None) -> tuple:
    """Get relevant content from embeddings for RAG. Returns (context_string, sources_list).
    If priority_file_ids provided, those files get a similarity boost."""
    relevant_chunks = await find_relevant_content(query, user_id, limit=8)
    
    if not relevant_chunks:
        return "", []
    
    # Boost priority files (recently uploaded)
    if priority_file_ids:
        BOOST = 0.15
        for chunk in relevant_chunks:
            if chunk["file_id"] in priority_file_ids:
                chunk["similarity"] = min(1.0, chunk["similarity"] + BOOST)
        relevant_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    
    # Take top 5 after re-ranking
    top_chunks = relevant_chunks[:5]
    
    context_parts = ["Relevant content from the archive (use this to answer the user's question). IMPORTANT: When citing information, reference the source file name."]
    seen_files = set()
    sources = []
    seen_source_files = set()
    
    for chunk in top_chunks:
        file_doc = await db.files.find_one({"id": chunk["file_id"]}, {"original_filename": 1, "file_type": 1, "id": 1})
        if not file_doc:
            continue
        filename = file_doc.get("original_filename", "Unknown file")
        file_type = file_doc.get("file_type", "document")
        file_id = file_doc.get("id", chunk["file_id"])
        
        if chunk["file_id"] not in seen_files:
            context_parts.append(f"\n--- From: {filename} (relevance: {chunk['similarity']:.2f}) ---")
            seen_files.add(chunk["file_id"])
        
        context_parts.append(chunk["chunk_text"])
        
        # Deduplicate sources by file_id
        if file_id not in seen_source_files:
            sources.append({
                "file_id": file_id,
                "filename": filename,
                "file_type": file_type,
                "passage": chunk["chunk_text"][:300],
                "relevance": round(chunk["similarity"], 2)
            })
            seen_source_files.add(file_id)
    
    return "\n".join(context_parts), sources

@api_router.post("/chat")
async def chat_with_ai(data: ChatRequest, user=Depends(get_current_user)):
    """AI chat endpoint with RAG-based file context awareness"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Get or create session
        session_id = data.session_id or f"chat-{user['id']}-{uuid.uuid4()}"
        
        # Build system message with file context
        system_message = """You are the AI Archivist, an intelligent assistant for a multimedia archive application. 
You help users with:
- Finding and searching their archived files
- Summarizing content from their documents
- Creating abstracts and insights from their archive
- Answering questions about their stored content
- General assistance with organizing and managing their files

Be helpful, concise, and reference specific files when relevant. When answering questions about 
file content, use the RELEVANT CONTENT section provided - this contains the most pertinent 
information from the user's archive that matches their query. Always cite which file the 
information comes from."""

        # Get RAG-based context (semantic search for relevant content)
        rag_context, rag_sources = await get_rag_context(data.message, user["id"], data.priority_file_ids)
        if rag_context:
            system_message += f"\n\n{rag_context}"
        
        # Also include general file overview if requested
        if data.include_file_context:
            file_context = await get_user_file_context(user["id"])
            system_message += f"\n\nGeneral archive overview:\n{file_context}"
        
        # Initialize chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_message
        )
        chat.with_model("openai", "gpt-5.2")
        
        # Get chat history for this session
        if session_id in chat_sessions:
            for msg in chat_sessions[session_id]:
                if msg["role"] == "user":
                    chat.messages.append({"role": "user", "content": msg["content"]})
                else:
                    chat.messages.append({"role": "assistant", "content": msg["content"]})
        
        # Send message and get response
        response = await chat.send_message(UserMessage(text=data.message))
        
        # Store in session history
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []
        chat_sessions[session_id].append({"role": "user", "content": data.message})
        chat_sessions[session_id].append({"role": "assistant", "content": response})
        
        # Keep only last 20 messages per session
        if len(chat_sessions[session_id]) > 20:
            chat_sessions[session_id] = chat_sessions[session_id][-20:]
        
        return {
            "response": response,
            "session_id": session_id,
            "sources": rag_sources if rag_sources else []
        }
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@api_router.get("/chat/sessions")
async def get_chat_session(session_id: Optional[str] = None, user=Depends(get_current_user)):
    """Get chat history for a session"""
    if not session_id:
        return {"messages": []}
    if session_id in chat_sessions:
        return {"messages": chat_sessions[session_id]}
    return {"messages": []}

@api_router.delete("/chat/sessions/{session_id}")
async def clear_chat_session(session_id: str, user=Depends(get_current_user)):
    """Clear a chat session"""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"message": "Session cleared"}

@api_router.post("/chat/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Convert speech audio to text using OpenAI Whisper"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        # Read audio file
        audio_content = await audio.read()
        
        # Check file size (25MB limit)
        if len(audio_content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
        
        # Save temporarily
        temp_path = UPLOAD_DIR / f"temp_audio_{uuid.uuid4()}{Path(audio.filename or 'audio.webm').suffix}"
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(audio_content)
        
        try:
            # Transcribe
            stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
            with open(temp_path, "rb") as audio_file:
                result = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json",
                    language="en"
                )
            
            return {"text": result.text}
        finally:
            # Clean up temp file
            if temp_path.exists():
                temp_path.unlink()
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Speech-to-text error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@api_router.post("/chat/text-to-speech")
async def text_to_speech(data: TTSRequest, user=Depends(get_current_user)):
    """Convert text to speech audio using OpenAI TTS"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")
    
    if len(data.text) > 4096:
        raise HTTPException(status_code=400, detail="Text too long (max 4096 characters)")
    
    try:
        from emergentintegrations.llm.openai import OpenAITextToSpeech
        
        tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
        
        # Generate speech
        audio_bytes = await tts.generate_speech(
            text=data.text,
            model="tts-1",
            voice=data.voice,
            speed=data.speed,
            response_format="mp3"
        )
        
        # Return as base64 for easy frontend handling
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return {
            "audio_base64": audio_base64,
            "format": "mp3"
        }
        
    except Exception as e:
        logger.error(f"Text-to-speech error: {e}")
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

# ==================== PROJECT ROUTES ====================

@api_router.post("/projects")
async def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    """Create a new project with selected files"""
    project_id = str(uuid.uuid4())
    
    # Validate file_ids belong to user or are public
    if data.file_ids:
        valid_files = await db.files.find(
            {"id": {"$in": data.file_ids}, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
            {"id": 1}
        ).to_list(1000)
        valid_ids = [f["id"] for f in valid_files]
    else:
        valid_ids = []
    
    now = datetime.now(timezone.utc).isoformat()
    project_doc = {
        "id": project_id,
        "user_id": user["id"],
        "name": data.name,
        "description": data.description or "",
        "file_ids": valid_ids,
        "created_at": now,
        "updated_at": now,
        "last_message_at": None
    }
    await db.projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    
    # If summary provided (e.g. from search summarization), seed it as first assistant message
    if data.summary:
        now_msg = datetime.now(timezone.utc).isoformat()
        summary_msg = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "role": "assistant",
            "content": data.summary,
            "sources": [],
            "created_at": now_msg
        }
        await db.project_messages.insert_one(summary_msg)
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"last_message_at": now_msg, "updated_at": now_msg}}
        )
    
    return project_doc

@api_router.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    """List all projects for the current user"""
    projects = await db.projects.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Enrich with file count and message count
    for p in projects:
        p["file_count"] = len(p.get("file_ids", []))
        msg_count = await db.project_messages.count_documents({"project_id": p["id"]})
        p["message_count"] = msg_count
        if "status" not in p:
            p["status"] = "inactive" if p["file_count"] == 0 else "active"
    
    return projects

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user=Depends(get_current_user)):
    """Get project details with file info"""
    project = await db.projects.find_one(
        {"id": project_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get file details for the project
    if project.get("file_ids"):
        files = await db.files.find(
            {"id": {"$in": project["file_ids"]}},
            {"_id": 0, "id": 1, "original_filename": 1, "file_type": 1, "file_size": 1, "tags": 1, "upload_date": 1, "embedding_status": 1}
        ).to_list(1000)
        project["files"] = files
    else:
        project["files"] = []
    
    project["file_count"] = len(project.get("files", []))
    msg_count = await db.project_messages.count_documents({"project_id": project_id})
    project["message_count"] = msg_count
    if "status" not in project:
        project["status"] = "inactive" if project["file_count"] == 0 else "active"
    
    return project

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, user=Depends(get_current_user)):
    """Update project name, description, or file selection"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_fields["name"] = data.name
    if data.description is not None:
        update_fields["description"] = data.description
    if data.file_ids is not None:
        # Validate file_ids
        valid_files = await db.files.find(
            {"id": {"$in": data.file_ids}, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
            {"id": 1}
        ).to_list(1000)
        update_fields["file_ids"] = [f["id"] for f in valid_files]
        update_fields["status"] = "active" if update_fields["file_ids"] else "inactive"
    
    await db.projects.update_one({"id": project_id}, {"$set": update_fields})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return updated

@api_router.post("/projects/{project_id}/append")
async def append_to_project(project_id: str, data: ProjectAppend, user=Depends(get_current_user)):
    """Append files and/or a summary to an existing project"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc).isoformat()
    existing_file_ids = project.get("file_ids", [])
    
    # Merge and deduplicate file_ids
    if data.file_ids:
        valid_files = await db.files.find(
            {"id": {"$in": data.file_ids}, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
            {"id": 1}
        ).to_list(1000)
        new_ids = [f["id"] for f in valid_files]
        merged_ids = list(dict.fromkeys(existing_file_ids + new_ids))  # preserves order, deduplicates
    else:
        merged_ids = existing_file_ids
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"file_ids": merged_ids, "updated_at": now, "status": "active" if merged_ids else "inactive"}}
    )
    
    # Add summary as a new assistant message
    if data.summary:
        summary_msg = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "role": "assistant",
            "content": data.summary,
            "sources": [],
            "created_at": now
        }
        await db.project_messages.insert_one(summary_msg)
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"last_message_at": now}}
        )
    
    added_count = len(merged_ids) - len(existing_file_ids)
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    updated["files_added"] = added_count
    return updated

@api_router.get("/projects/{project_id}/export-pdf")
async def export_project_pdf(project_id: str, user=Depends(get_current_user)):
    """Export project content (messages + file list) as a PDF"""
    from fpdf import FPDF
    import textwrap
    
    def sanitize(text):
        """Replace Unicode chars unsupported by Helvetica with ASCII equivalents"""
        replacements = {
            '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'",
            '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u2022': '-',
            '\u00b7': '-', '\u2019': "'", '\u00a0': ' ', '\u200b': '',
            '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u25cf': '-',
            '\u2192': '->', '\u2190': '<-', '\u2794': '->', '\u00d7': 'x',
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
        # Remove any remaining non-latin1 characters
        return text.encode('latin-1', 'replace').decode('latin-1')
    
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    messages = await db.project_messages.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(5000)
    
    # Get file names
    file_ids = project.get("file_ids", [])
    files = []
    if file_ids:
        files = await db.files.find(
            {"id": {"$in": file_ids}},
            {"_id": 0, "original_filename": 1, "file_type": 1, "tags": 1}
        ).to_list(1000)
    
    # Build PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    
    def safe_cell(w, h, txt="", **kwargs):
        pdf.cell(w, h, txt=sanitize(txt), **kwargs)
    
    # Title
    pdf.set_font("Helvetica", "B", 22)
    safe_cell(0, 12, txt=project.get("name", "Untitled Project"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    # Subtitle / description
    desc = project.get("description", "")
    if desc:
        pdf.set_font("Helvetica", "I", 10)
        pdf.set_text_color(100, 100, 100)
        for line in textwrap.wrap(desc, width=90):
            safe_cell(0, 5, txt=line, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
    pdf.ln(4)
    
    # Metadata line
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    meta = f"Files: {len(file_ids)}  |  Messages: {len(messages)}  |  Exported: {datetime.now(timezone.utc).strftime('%B %d, %Y')}"
    safe_cell(0, 5, txt=meta, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)
    
    # Divider
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    
    # Files section
    if files:
        pdf.set_font("Helvetica", "B", 13)
        safe_cell(0, 8, txt="Source Files", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        pdf.set_font("Helvetica", "", 10)
        for i, f in enumerate(files):
            name = f.get("original_filename", "Unknown")
            ftype = f.get("file_type", "")
            tags = ", ".join(f.get("tags", [])[:5])
            bullet = f"{i+1}. {name}"
            if ftype:
                bullet += f"  ({ftype})"
            safe_cell(0, 6, txt=bullet, new_x="LMARGIN", new_y="NEXT")
            if tags:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(100, 100, 100)
                safe_cell(0, 5, txt=f"   Tags: {tags}", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(0, 0, 0)
                pdf.set_font("Helvetica", "", 10)
        pdf.ln(4)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(6)
    
    # Messages section
    if messages:
        pdf.set_font("Helvetica", "B", 13)
        safe_cell(0, 8, txt="Conversation", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            # Role label
            if role == "assistant":
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(59, 130, 246)
                safe_cell(0, 6, txt="AI Archivist", new_x="LMARGIN", new_y="NEXT")
            else:
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(30, 30, 30)
                safe_cell(0, 6, txt="You", new_x="LMARGIN", new_y="NEXT")
            
            pdf.set_text_color(40, 40, 40)
            pdf.set_font("Helvetica", "", 10)
            
            # Process content - handle markdown-like formatting
            clean = content.replace('\r\n', '\n').replace('\r', '\n')
            for para in clean.split('\n'):
                para = para.strip()
                if not para:
                    pdf.ln(2)
                    continue
                
                # Detect headings (## )
                if para.startswith('## '):
                    pdf.set_font("Helvetica", "B", 11)
                    for line in textwrap.wrap(para[3:], width=85):
                        safe_cell(0, 6, txt=line, new_x="LMARGIN", new_y="NEXT")
                    pdf.set_font("Helvetica", "", 10)
                elif para.startswith('# '):
                    pdf.set_font("Helvetica", "B", 12)
                    for line in textwrap.wrap(para[2:], width=80):
                        safe_cell(0, 7, txt=line, new_x="LMARGIN", new_y="NEXT")
                    pdf.set_font("Helvetica", "", 10)
                else:
                    # Strip markdown bold/italic markers for PDF
                    display = para.replace('**', '').replace('*', '')
                    for line in textwrap.wrap(display, width=90):
                        safe_cell(0, 5, txt=line, new_x="LMARGIN", new_y="NEXT")
            
            # Sources
            sources = msg.get("sources", [])
            if sources:
                unique = list(dict.fromkeys(s.get("filename", s) if isinstance(s, dict) else s for s in sources))
                pdf.set_font("Helvetica", "I", 8)
                pdf.set_text_color(120, 120, 120)
                safe_cell(0, 5, txt=f"Sources: {', '.join(unique)}", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(40, 40, 40)
                pdf.set_font("Helvetica", "", 10)
            
            pdf.ln(4)
    
    # Footer
    pdf.ln(6)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    safe_cell(0, 5, txt="Generated by Archiva - Intelligent Multimedia Archive", new_x="LMARGIN", new_y="NEXT")
    
    # Output
    safe_name = re.sub(r'[^\w\s-]', '', project.get("name", "project")).strip().replace(' ', '_')[:50]
    filename = f"{safe_name}.pdf"
    pdf_bytes = pdf.output()
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Type": "application/pdf"
        }
    )

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    """Delete a project and all its messages"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.project_messages.delete_many({"project_id": project_id})
    await db.projects.delete_one({"id": project_id})
    
    return {"message": "Project deleted"}

@api_router.get("/projects/{project_id}/messages")
async def get_project_messages(project_id: str, user=Depends(get_current_user)):
    """Get all chat messages for a project"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    messages = await db.project_messages.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return {"messages": messages, "project_id": project_id}

async def get_project_rag_context(query: str, file_ids: List[str]) -> tuple:
    """Get RAG context scoped to project files only"""
    if not openai_client or not file_ids:
        return "", []
    
    try:
        query_embedding = await generate_embeddings(query)
        if not query_embedding:
            return "", []
        
        # Only search embeddings for project files
        embeddings = await db.embeddings.find(
            {"file_id": {"$in": file_ids}}
        ).to_list(5000)
        
        if not embeddings:
            return "", []
        
        import numpy as np
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)
        
        if query_norm == 0:
            return "", []
        
        results = []
        for emb in embeddings:
            embedding_vec = emb.get("embedding")
            if embedding_vec and len(embedding_vec) == len(query_embedding):
                emb_vec = np.array(embedding_vec)
                emb_norm = np.linalg.norm(emb_vec)
                if emb_norm > 0:
                    similarity = np.dot(query_vec, emb_vec) / (query_norm * emb_norm)
                    if similarity > 0.3:
                        results.append({
                            "file_id": emb["file_id"],
                            "chunk_text": emb["chunk_text"],
                            "chunk_index": emb.get("chunk_index", 0),
                            "similarity": float(similarity)
                        })
        
        results.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = results[:5]
        
        context_parts = ["Relevant content from the project files (cite source file names when using this):"]
        sources = []
        seen_files = set()
        seen_source_files = set()
        
        for chunk in top_results:
            file_doc = await db.files.find_one({"id": chunk["file_id"]}, {"original_filename": 1, "file_type": 1, "id": 1})
            if not file_doc:
                continue
            filename = file_doc.get("original_filename", "Unknown")
            file_type = file_doc.get("file_type", "document")
            
            if chunk["file_id"] not in seen_files:
                context_parts.append(f"\n--- From: {filename} (relevance: {chunk['similarity']:.2f}) ---")
                seen_files.add(chunk["file_id"])
            
            context_parts.append(chunk["chunk_text"])
            
            if chunk["file_id"] not in seen_source_files:
                sources.append({
                    "file_id": chunk["file_id"],
                    "filename": filename,
                    "file_type": file_type,
                    "passage": chunk["chunk_text"][:300],
                    "relevance": round(chunk["similarity"], 2)
                })
                seen_source_files.add(chunk["file_id"])
        
        return "\n".join(context_parts), sources
        
    except Exception as e:
        logger.error(f"Error in project RAG: {e}", exc_info=True)
        return "", []

@api_router.post("/projects/{project_id}/chat")
async def project_chat(project_id: str, data: ProjectChatRequest, user=Depends(get_current_user)):
    """Chat within a project context — RAG scoped to project files, messages persisted"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")
    
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        file_ids = project.get("file_ids", [])
        
        # Build system message scoped to project
        file_list_parts = []
        file_content_parts = []
        if file_ids:
            project_files = await db.files.find(
                {"id": {"$in": file_ids}},
                {"_id": 0, "original_filename": 1, "file_type": 1, "tags": 1, "content_text": 1}
            ).to_list(100)
            for f in project_files:
                tags = ", ".join(f.get("tags", [])[:5]) if f.get("tags") else "no tags"
                file_list_parts.append(f"- {f['original_filename']} ({f['file_type']}): tags=[{tags}]")
                # Include actual content so AI can always answer about files
                ct = f.get("content_text", "")
                if ct:
                    file_content_parts.append(f"=== {f['original_filename']} ===\n{ct[:3000]}")
        
        file_content_section = ""
        if file_content_parts:
            file_content_section = "\n\nFILE CONTENTS (use this to answer questions about the files):\n" + "\n\n".join(file_content_parts)
        
        system_message = f"""You are the AI Archivist working on the project "{project['name']}".
{f'Project description: {project["description"]}' if project.get("description") else ''}

This project has {len(file_ids)} selected file(s):
{chr(10).join(file_list_parts) if file_list_parts else 'No files selected yet.'}
{file_content_section}

You help the user analyze, summarize, and discuss the content of these project files.
Be helpful, concise, and always cite which file the information comes from.
When answering questions about file content, use the FILE CONTENTS and RELEVANT CONTENT sections."""

        # Get RAG context scoped to project files
        rag_context, rag_sources = await get_project_rag_context(data.message, file_ids)
        if rag_context:
            system_message += f"\n\n{rag_context}"
        
        # Initialize chat
        session_id = f"project-{project_id}"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_message
        )
        chat.with_model("openai", "gpt-5.2")
        
        # Load existing project messages for context
        existing_messages = await db.project_messages.find(
            {"project_id": project_id},
            {"_id": 0}
        ).sort("created_at", 1).to_list(50)
        
        # Add last N messages for context (limit to avoid token overflow)
        recent = existing_messages[-20:] if len(existing_messages) > 20 else existing_messages
        for msg in recent:
            if msg["role"] == "user":
                chat.messages.append({"role": "user", "content": msg["content"]})
            else:
                chat.messages.append({"role": "assistant", "content": msg["content"]})
        
        # Send message
        response = await chat.send_message(UserMessage(text=data.message))
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Persist user message
        user_msg_doc = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "role": "user",
            "content": data.message,
            "sources": [],
            "created_at": now
        }
        await db.project_messages.insert_one(user_msg_doc)
        
        # Persist assistant message with sources
        assistant_msg_doc = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "role": "assistant",
            "content": response,
            "sources": rag_sources,
            "created_at": now
        }
        await db.project_messages.insert_one(assistant_msg_doc)
        
        # Update project last_message_at
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"last_message_at": now, "updated_at": now}}
        )
        
        return {
            "response": response,
            "sources": rag_sources,
            "project_id": project_id
        }
        
    except Exception as e:
        logger.error(f"Project chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# Root API route for deployment startup checks
@api_router.get("/")
async def api_root():
    return {"status": "ok", "app": "archiva"}

# Include the router
app.include_router(api_router)

# Root routes for deployment health checks and startup probes
@app.get("/")
async def root():
    return {"status": "ok", "app": "archiva"}

# Health check endpoints for Kubernetes probes
@app.get("/health")
async def health_check():
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "healthy", "database": "disconnected"}

@app.get("/api/health")
async def api_health_check():
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "healthy", "database": "disconnected"}

@app.on_event("shutdown")
async def shutdown():
    client.close()
