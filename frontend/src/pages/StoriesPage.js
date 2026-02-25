import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { storiesAPI, filesAPI } from "../lib/api";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  ChevronLeft,
  Send,
  Loader2,
  Bot,
  User,
  Pen,
  BookCopy,
  GripVertical,
  FileText,
  Image,
  Music,
  Video,
  Paperclip,
  Upload,
  Import,
  ChevronDown,
  ChevronUp,
  FileDown,
  Eye,
  Languages,
} from "lucide-react";

// ========== Chapter Composition Chat ==========
function ChapterChat({ story, chapter, onContentUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [mode, setMode] = useState("coauthor"); // "coauthor" | "scribe"
  const scrollRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [chapter?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    setLoadingHistory(true);
    try {
      const res = await storiesAPI.getMessages(story.id, chapter?.id);
      setMessages(res.data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text, id: Date.now() }]);
    setLoading(true);

    try {
      const res = await storiesAPI.chat(story.id, text, mode, chapter?.id);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.message,
        id: Date.now() + 1
      }]);
    } catch {
      toast.error("Chat failed");
    } finally {
      setLoading(false);
    }
  };

  const applyToChapter = async (content) => {
    if (!chapter) return;
    try {
      // Use atomic append endpoint to avoid race conditions with stale state
      await storiesAPI.appendContentBlock(story.id, chapter.id, { type: "text", content });
      toast.success("Content added to chapter");
      if (onContentUpdate) onContentUpdate();
    } catch {
      toast.error("Failed to add content");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground mr-1">Mode:</span>
        <Button
          variant={mode === "coauthor" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode("coauthor")}
          data-testid="mode-coauthor"
        >
          <Pen className="w-3 h-3" /> Co-author
        </Button>
        <Button
          variant={mode === "scribe" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode("scribe")}
          data-testid="mode-scribe"
        >
          <BookCopy className="w-3 h-3" /> Scribe
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {mode === "coauthor" ? "AI helps write & suggest" : "AI organizes & cleans up"}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{mode === "coauthor"
              ? "Start writing with your AI co-author. Share your ideas and let's create together."
              : "Dictate or paste your content. The AI will organize and structure it for you."
            }</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border border-border"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && chapter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] mt-1 gap-1 opacity-60 hover:opacity-100"
                      onClick={() => applyToChapter(msg.content)}
                      data-testid={`apply-content-${i}`}
                    >
                      <Plus className="w-2.5 h-2.5" /> Add to chapter
                    </Button>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  Writing...
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={mode === "coauthor" ? "Share your ideas..." : "Dictate or paste content..."}
            disabled={loading}
            data-testid="story-chat-input"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()} data-testid="story-chat-send">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== Content Block Viewer/Editor ==========
function ContentBlockView({ block, index, storyId, chapterId, onUpdate, onDelete, isLast }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(block.content || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await storiesAPI.updateBlock(storyId, chapterId, index, { ...block, content: editText });
      setEditing(false);
      if (onUpdate) onUpdate();
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async () => {
    try {
      await storiesAPI.deleteBlock(storyId, chapterId, index);
      setShowDeleteConfirm(false);
      if (onDelete) onDelete();
      toast.success("Block deleted");
    } catch {
      toast.error("Failed to delete block");
    }
  };

  if (block.type === "text") {
    if (editing) {
      return (
        <div className="group relative border border-primary/30 rounded-lg p-3 bg-background shadow-sm" data-testid={`content-block-${index}`}>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Editing content block</p>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[300px] text-sm font-normal leading-relaxed resize-y"
            autoFocus
            data-testid={`edit-block-textarea-${index}`}
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-8 px-4" onClick={saveEdit} data-testid={`save-block-${index}`}>Save Changes</Button>
            <Button size="sm" variant="outline" className="h-8 px-4" onClick={() => { setEditing(false); setEditText(block.content || ""); }}>Cancel</Button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="group relative py-1.5 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors" data-testid={`content-block-${index}`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
          <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)} title="Edit this block" data-testid={`edit-block-${index}`}>
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)} title="Delete this entire block" data-testid={`delete-block-${index}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-sm" data-testid={`delete-block-confirm-${index}`}>
            <DialogHeader>
              <DialogTitle>Delete Content Block?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this entire text block ({block.content?.length || 0} characters). This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} data-testid={`confirm-delete-block-${index}`}>Delete Block</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const token = localStorage.getItem("archiva_token");
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const mediaUrl = block.file_id ? `${baseUrl}/api/files/download/${block.file_id}?token=${token}` : block.url;

  if (block.type === "image") {
    return (
      <div className="group relative my-3" data-testid={`content-block-${index}`}>
        <img src={mediaUrl} alt={block.caption || ""} className="max-w-full rounded-lg border" />
        {block.caption && <p className="text-xs text-muted-foreground mt-1">{block.caption}</p>}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="icon" className="h-6 w-6 shadow-sm" onClick={handleDelete} data-testid={`delete-block-${index}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="group relative my-3" data-testid={`content-block-${index}`}>
        <video controls className="max-w-full rounded-lg border">
          <source src={mediaUrl} />
        </video>
        {block.caption && <p className="text-xs text-muted-foreground mt-1">{block.caption}</p>}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="icon" className="h-6 w-6 shadow-sm" onClick={handleDelete} data-testid={`delete-block-${index}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (block.type === "audio") {
    return (
      <div className="group relative my-3 flex items-center gap-2" data-testid={`content-block-${index}`}>
        <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <audio controls className="flex-1 h-8">
          <source src={mediaUrl} />
        </audio>
        {block.caption && <span className="text-xs text-muted-foreground">{block.caption}</span>}
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={handleDelete} data-testid={`delete-block-${index}`}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return null;
}

// ========== Story Detail View ==========
function StoryDetailView({ story: initialStory, onBack, onTranslateSuccess }) {
  const [story, setStory] = useState(initialStory);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const mediaInputRef = useRef(null);
  
  // Translation state
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    loadStory();
    loadLanguages();
  }, []);
  
  const loadLanguages = async () => {
    try {
      const res = await storiesAPI.getLanguages();
      setLanguages(res.data.languages || []);
    } catch {
      setLanguages(["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Chinese", "Japanese", "Korean"]);
    }
  };

  const loadStory = async () => {
    setLoading(true);
    try {
      const res = await storiesAPI.get(story.id);
      setStory(res.data);
      setChapters(res.data.chapters || []);
      // Auto-select first chapter if none selected
      if (!selectedChapter && res.data.chapters?.length > 0) {
        setSelectedChapter(res.data.chapters[0]);
      } else if (selectedChapter) {
        // Refresh selected chapter data
        const updated = res.data.chapters?.find(c => c.id === selectedChapter.id);
        if (updated) setSelectedChapter(updated);
      }
    } catch {
      toast.error("Failed to load story");
    } finally {
      setLoading(false);
    }
  };

  const createChapter = async () => {
    try {
      const res = await storiesAPI.createChapter(story.id, { name: newChapterName || undefined });
      setChapters(prev => [...prev, res.data]);
      setSelectedChapter(res.data);
      setNewChapterName("");
      setShowNewChapter(false);
      toast.success(`${res.data.name} created`);
    } catch {
      toast.error("Failed to create chapter");
    }
  };

  const deleteChapter = async (chapterId) => {
    try {
      await storiesAPI.deleteChapter(story.id, chapterId);
      setChapters(prev => prev.filter(c => c.id !== chapterId));
      if (selectedChapter?.id === chapterId) {
        setSelectedChapter(null);
      }
      toast.success("Chapter deleted");
    } catch {
      toast.error("Failed to delete chapter");
    }
  };

  const handleMediaUpload = async (e) => {
    if (!selectedChapter) return;
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", file.name);
        await storiesAPI.uploadMedia(story.id, selectedChapter.id, formData);
        toast.success(`${file.name} added`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    loadStory();
  };

  const openImportDialog = async () => {
    setShowImportDialog(true);
    setLoadingFiles(true);
    try {
      const res = await filesAPI.list({ limit: 50 });
      setLibraryFiles((res.data.files || []).filter(f => f.content_text));
    } catch {
      setLibraryFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const importFromLibrary = async (fileId) => {
    if (!selectedChapter) return;
    try {
      const res = await storiesAPI.importFile(story.id, selectedChapter.id, fileId);
      toast.success(`Imported: ${res.data.filename}`);
      setShowImportDialog(false);
      loadStory();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="story-detail">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="story-back-btn">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate">{story.name}</h2>
          {story.description && <p className="text-xs text-muted-foreground truncate">{story.description}</p>}
        </div>
        <Badge variant="outline" className="text-xs">
          {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chapters Sidebar */}
        <div className="w-56 border-r border-border flex flex-col bg-muted/20" data-testid="chapters-sidebar">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chapters</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewChapter(true)} data-testid="add-chapter-btn">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {showNewChapter && (
            <div className="p-2 border-b border-border space-y-1.5">
              <Input
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                placeholder="Chapter name (optional)"
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && createChapter()}
                data-testid="new-chapter-name"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs flex-1" onClick={createChapter} data-testid="confirm-create-chapter">Add</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowNewChapter(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : chapters.length === 0 ? (
              <div className="text-center py-6 px-3">
                <p className="text-xs text-muted-foreground">No chapters yet. Create one to start writing.</p>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {chapters.map((ch, i) => (
                  <div
                    key={ch.id}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md cursor-pointer text-xs transition-colors group ${
                      selectedChapter?.id === ch.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setSelectedChapter(ch)}
                    data-testid={`chapter-item-${i}`}
                  >
                    <GripVertical className="w-3 h-3 opacity-30" />
                    <span className="flex-1 truncate">{ch.name}</span>
                    <span className="text-[10px] opacity-40">
                      {(ch.content_blocks || []).length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteChapter(ch.id); }}
                      data-testid={`delete-chapter-${i}`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel: Content + Chat */}
        {selectedChapter ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chapter Header with Actions */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-background">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold flex-1">{selectedChapter.name}</h3>
              <input
                ref={mediaInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*"
                multiple
                onChange={handleMediaUpload}
                data-testid="media-upload-input"
              />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => mediaInputRef.current?.click()} data-testid="upload-media-btn">
                <Paperclip className="w-3 h-3" /> Media
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={openImportDialog} data-testid="import-file-btn">
                <Import className="w-3 h-3" /> Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => window.open(storiesAPI.previewPdfUrl(story.id, selectedChapter.id), "_blank")}
                data-testid="preview-chapter-pdf-btn"
              >
                <Eye className="w-3 h-3" /> Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => window.open(storiesAPI.previewPdfUrl(story.id), "_blank")}
                data-testid="preview-story-pdf-btn"
              >
                <FileDown className="w-3 h-3" /> Full PDF
              </Button>
            </div>

            {/* Split: Content Preview + Chat */}
            <div className="flex-1 flex overflow-hidden">
              {/* Content Preview */}
              <div className="w-2/5 border-r border-border overflow-auto p-4" data-testid="chapter-content-preview">
                {(selectedChapter.content_blocks || []).length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No content yet</p>
                    <p className="text-xs mt-1">Use the chat to compose, or import content from files</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(selectedChapter.content_blocks || []).map((block, i) => (
                      <ContentBlockView
                        key={i}
                        block={block}
                        index={i}
                        storyId={story.id}
                        chapterId={selectedChapter.id}
                        onUpdate={loadStory}
                        onDelete={loadStory}
                        isLast={i === (selectedChapter.content_blocks || []).length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Chat */}
              <div className="flex-1 flex flex-col" data-testid="chapter-chat">
                <ChapterChat story={story} chapter={selectedChapter} onContentUpdate={loadStory} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a chapter or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Import from Library Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md" data-testid="import-dialog">
          <DialogHeader>
            <DialogTitle>Import from Library</DialogTitle>
          </DialogHeader>
          {loadingFiles ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : libraryFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No files with text content found in your library.</p>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-1">
                {libraryFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => importFromLibrary(f.id)}
                    data-testid={`import-file-option-${f.id}`}
                  >
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.original_filename}</p>
                      <p className="text-[10px] text-muted-foreground">{f.file_type} · {(f.tags || []).join(", ") || "no tags"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== Stories List View ==========
export default function StoriesPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingStory, setDeletingStory] = useState(null);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    setLoading(true);
    try {
      const res = await storiesAPI.list();
      setStories(res.data);
    } catch {
      toast.error("Failed to load stories");
    } finally {
      setLoading(false);
    }
  };

  const createStory = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await storiesAPI.create({ name: newName.trim(), description: newDesc.trim() });
      setStories(prev => [res.data, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setSelectedStory(res.data);
      toast.success("Story created");
    } catch {
      toast.error("Failed to create story");
    } finally {
      setCreating(false);
    }
  };

  const deleteStory = async () => {
    if (!deletingStory) return;
    try {
      await storiesAPI.delete(deletingStory.id);
      setStories(prev => prev.filter(s => s.id !== deletingStory.id));
      setDeletingStory(null);
      toast.success("Story deleted");
    } catch {
      toast.error("Failed to delete story");
    }
  };

  // Story detail view
  if (selectedStory) {
    return (
      <StoryDetailView
        story={selectedStory}
        onBack={() => { setSelectedStory(null); loadStories(); }}
      />
    );
  }

  return (
    <div className="space-y-5" data-testid="stories-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stories</h1>
          <p className="text-sm text-muted-foreground">Create and compose multi-chapter stories with AI</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)} data-testid="create-story-btn">
          <Plus className="w-4 h-4" /> New Story
        </Button>
      </div>

      {/* Stories Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stories.length === 0 ? (
        <Card className="border border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold mb-1">No stories yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first story to get started</p>
            <Button onClick={() => setShowCreate(true)} data-testid="create-first-story-btn">
              <Plus className="w-4 h-4 mr-2" /> Create Story
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {stories.map((story) => (
            <Card
              key={story.id}
              className="border border-border shadow-none hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => setSelectedStory(story)}
              data-testid={`story-card-${story.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeletingStory(story); }}
                    data-testid={`delete-story-${story.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-0.5 truncate">{story.name}</h3>
                {story.description && (
                  <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{story.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{story.chapter_count || 0} chapter{(story.chapter_count || 0) !== 1 ? "s" : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Story Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm" data-testid="create-story-dialog">
          <DialogHeader>
            <DialogTitle>New Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Story name"
              onKeyDown={(e) => e.key === "Enter" && createStory()}
              data-testid="story-name-input"
              autoFocus
            />
            <Textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              data-testid="story-desc-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createStory} disabled={!newName.trim() || creating} data-testid="confirm-create-story">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingStory} onOpenChange={() => setDeletingStory(null)}>
        <DialogContent className="max-w-sm" data-testid="delete-story-dialog">
          <DialogHeader>
            <DialogTitle>Delete Story</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Are you sure you want to delete <strong>{deletingStory?.name}</strong>? All chapters and chat history will be permanently removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingStory(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteStory} data-testid="confirm-delete-story">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
