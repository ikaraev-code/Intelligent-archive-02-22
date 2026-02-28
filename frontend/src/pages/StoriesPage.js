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
  Headphones,
} from "lucide-react";

// ========== Chapter Composition Chat ==========
function ChapterChat({ story, chapter, onContentUpdate, importedText, onImportedTextUsed, onImportClick }) {
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

  // Handle imported text - set it in the input
  useEffect(() => {
    if (importedText) {
      setInput(importedText);
      if (onImportedTextUsed) onImportedTextUsed();
    }
  }, [importedText]);

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
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Chat failed - please try again";
      toast.error(errorMsg, { duration: 8000 });
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
          {onImportClick && (
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9 flex-shrink-0" 
              onClick={onImportClick}
              title="Import from Library"
              data-testid="import-file-btn"
            >
              <Import className="w-4 h-4" />
            </Button>
          )}
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
  const [clickRatio, setClickRatio] = useState(0); // Ratio of where user clicked (0-1)
  const textareaRef = useRef(null);

  // Scroll textarea to approximate click position when editing starts
  useEffect(() => {
    if (editing && textareaRef.current && clickRatio > 0) {
      const textarea = textareaRef.current;
      // Calculate scroll position based on click ratio
      const scrollTarget = (textarea.scrollHeight - textarea.clientHeight) * clickRatio;
      textarea.scrollTop = Math.max(0, scrollTarget);
      
      // Also try to position cursor near the clicked area
      const totalLength = editText.length;
      const cursorPos = Math.floor(totalLength * clickRatio);
      textarea.setSelectionRange(cursorPos, cursorPos);
    }
  }, [editing, clickRatio, editText.length]);

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
      if (onDelete) onDelete();
      toast.success("Block deleted");
    } catch {
      toast.error("Failed to delete block");
    }
  };

  const handleTextClick = (e) => {
    // Calculate where in the text block the user clicked (as a ratio 0-1)
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    setClickRatio(ratio);
    setEditing(true);
  };

  if (block.type === "text") {
    if (editing) {
      return (
        <div className="relative border border-primary/30 rounded-lg p-3 bg-background shadow-sm my-2" data-testid={`content-block-${index}`}>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Editing content block</p>
          <Textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[300px] max-h-[500px] text-sm font-normal leading-relaxed resize-y overflow-y-auto"
            data-testid={`edit-block-textarea-${index}`}
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-8 px-4" onClick={saveEdit} data-testid={`save-block-${index}`}>Save Changes</Button>
            <Button size="sm" variant="outline" className="h-8 px-4" onClick={() => { setEditing(false); setEditText(block.content || ""); setClickRatio(0); }}>Cancel</Button>
          </div>
        </div>
      );
    }

    // Text block: click anywhere to open edit mode directly (no intermediate icon)
    return (
      <div 
        className="relative py-1.5 px-2 -mx-2 rounded hover:bg-muted/30 transition-colors cursor-pointer" 
        data-testid={`content-block-${index}`}
        onClick={handleTextClick}
        title="Click to edit"
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
      </div>
    );
  }

  const token = localStorage.getItem("archiva_token");
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const mediaUrl = block.file_id ? `${baseUrl}/api/files/download/${block.file_id}?token=${token}` : block.url;

  // Media blocks: show delete button (dim, brightens on hover)
  if (block.type === "image") {
    return (
      <div 
        className="relative my-3" 
        data-testid={`content-block-${index}`}
      >
        <img src={mediaUrl} alt={block.caption || ""} className="max-w-full rounded-lg border" />
        {block.caption && <p className="text-xs text-muted-foreground mt-1">{block.caption}</p>}
        <button 
          className="absolute top-2 right-2 h-8 w-8 rounded-md bg-red-600 text-white flex items-center justify-center shadow-lg opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleDelete}
          title="Delete this image"
          data-testid={`delete-block-${index}`}
          style={{ zIndex: 50 }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div 
        className="relative my-3" 
        data-testid={`content-block-${index}`}
      >
        <video controls className="max-w-full rounded-lg border">
          <source src={mediaUrl} />
        </video>
        {block.caption && <p className="text-xs text-muted-foreground mt-1">{block.caption}</p>}
        <button 
          className="absolute top-2 right-2 h-8 w-8 rounded-md bg-red-600 text-white flex items-center justify-center shadow-lg opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleDelete}
          title="Delete this video"
          data-testid={`delete-block-${index}`}
          style={{ zIndex: 50 }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (block.type === "audio") {
    return (
      <div 
        className="relative my-3 flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30" 
        data-testid={`content-block-${index}`}
      >
        <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <audio controls className="flex-1 h-8">
          <source src={mediaUrl} />
        </audio>
        {block.caption && <span className="text-xs text-muted-foreground">{block.caption}</span>}
        <button 
          className="h-7 w-7 rounded-md bg-red-600 text-white flex items-center justify-center shadow-lg opacity-30 hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
          onClick={handleDelete}
          title="Delete this audio"
          data-testid={`delete-block-${index}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
  const chapterNameInputRef = useRef(null);
  
  // Edit title/chapter state
  const [editingStoryTitle, setEditingStoryTitle] = useState(false);
  const [editStoryName, setEditStoryName] = useState("");
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editChapterName, setEditChapterName] = useState("");
  
  // Translation state
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translationStatus, setTranslationStatus] = useState("");
  const [translationProgress, setTranslationProgress] = useState(null);

  // Audio export state
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [ttsOptions, setTtsOptions] = useState({ voices: [], models: [] });
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [selectedModel, setSelectedModel] = useState("tts-1");
  const [exporting, setExporting] = useState(false);
  const [audioProgress, setAudioProgress] = useState(null);
  const [audioTaskId, setAudioTaskId] = useState(null);
  const [importedText, setImportedText] = useState("");

  useEffect(() => {
    loadStory();
    loadLanguages();
    loadTtsOptions();
  }, []);

  // Focus chapter name input when editing starts
  useEffect(() => {
    if (editingChapterId && chapterNameInputRef.current) {
      chapterNameInputRef.current.focus();
      chapterNameInputRef.current.select();
    }
  }, [editingChapterId]);
  
  const loadLanguages = async () => {
    try {
      const res = await storiesAPI.getLanguages();
      setLanguages(res.data.languages || []);
    } catch {
      setLanguages(["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Chinese", "Japanese", "Korean"]);
    }
  };

  const loadTtsOptions = async () => {
    try {
      const res = await storiesAPI.getTtsOptions();
      setTtsOptions(res.data);
    } catch {
      // Fallback options
      setTtsOptions({
        voices: [
          { id: "nova", name: "Nova", description: "Energetic, upbeat" },
          { id: "alloy", name: "Alloy", description: "Neutral, balanced" },
          { id: "echo", name: "Echo", description: "Smooth, calm" },
          { id: "fable", name: "Fable", description: "Expressive, storytelling" },
          { id: "onyx", name: "Onyx", description: "Deep, authoritative" },
          { id: "shimmer", name: "Shimmer", description: "Bright, cheerful" },
        ],
        models: [
          { id: "tts-1", name: "Standard", description: "Fast, good quality" },
          { id: "tts-1-hd", name: "HD", description: "High definition, slower" },
        ]
      });
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

  const saveStoryTitle = async () => {
    if (!editStoryName.trim()) {
      setEditingStoryTitle(false);
      return;
    }
    try {
      await storiesAPI.update(story.id, { name: editStoryName.trim() });
      setStory(prev => ({ ...prev, name: editStoryName.trim() }));
      setEditingStoryTitle(false);
      toast.success("Title updated");
    } catch {
      toast.error("Failed to update title");
    }
  };

  const saveChapterName = async (chapterId) => {
    const trimmedName = editChapterName.trim();
    const originalChapter = chapters.find(ch => ch.id === chapterId);
    
    // Don't save if empty or unchanged
    if (!trimmedName || trimmedName === originalChapter?.name) {
      setEditingChapterId(null);
      return;
    }
    try {
      await storiesAPI.updateChapter(story.id, chapterId, { name: trimmedName });
      setChapters(prev => prev.map(ch => 
        ch.id === chapterId ? { ...ch, name: trimmedName } : ch
      ));
      if (selectedChapter?.id === chapterId) {
        setSelectedChapter(prev => ({ ...prev, name: trimmedName }));
      }
      setEditingChapterId(null);
      toast.success("Chapter name updated");
    } catch {
      toast.error("Failed to update chapter name");
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
      setLibraryFiles((res.data.files || []).filter(f => f.has_content_text));
    } catch {
      setLibraryFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const importFromLibrary = async (fileId, file) => {
    if (!selectedChapter) return;
    try {
      // Get the file's text content
      const fileDetail = await filesAPI.getById(fileId);
      const textContent = fileDetail.data.content_text;
      
      if (!textContent) {
        toast.error("No text content found in this file");
        return;
      }
      
      // Add as a user message in the chat (truncate if very long for display)
      const displayText = textContent.length > 5000 
        ? textContent.substring(0, 5000) + "\n\n[... content truncated for display, full text will be used ...]"
        : textContent;
      
      // Store the imported text to be used in the chat
      setImportedText(textContent);
      toast.success(`Imported "${file.original_filename}" - text added to chat input. Use AI to process it.`);
      setShowImportDialog(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    }
  };

  const handleTranslate = async () => {
    if (!selectedLanguage) {
      toast.error("Please select a language");
      return;
    }
    setTranslating(true);
    setTranslationStatus("Starting translation...");
    setTranslationProgress(null);
    
    try {
      // Start translation (returns immediately with task_id)
      const res = await storiesAPI.translate(story.id, selectedLanguage);
      const taskId = res.data.task_id;
      
      setTranslationProgress({
        totalChapters: res.data.total_chapters,
        totalBlocks: res.data.total_blocks,
        currentChapter: 0,
        blocksTranslated: 0,
        currentChapterName: "Starting..."
      });
      
      // Poll for progress with retry on 502 errors
      const pollProgress = async (retryCount = 0) => {
        try {
          const progressRes = await storiesAPI.getTranslationProgress(taskId);
          const progress = progressRes.data;
          
          setTranslationProgress({
            totalChapters: progress.total_chapters,
            totalBlocks: progress.total_blocks,
            currentChapter: progress.current_chapter,
            blocksTranslated: progress.blocks_translated,
            currentChapterName: progress.current_chapter_name
          });
          
          if (progress.status === "completed") {
            setTranslationStatus("Translation complete!");
            toast.success(`Story translated to ${selectedLanguage}!`);
            // Reset all state
            setSelectedLanguage("");
            setTranslationStatus("");
            setTranslationProgress(null);
            setTranslating(false);
            // Close dialog after a brief delay to ensure state is updated
            setTimeout(() => {
              setShowTranslateDialog(false);
              // Navigate to the new translated story
              if (onTranslateSuccess && progress.new_story_id) {
                onTranslateSuccess(progress.new_story_id);
              }
            }, 500);
          } else if (progress.status === "failed") {
            // Make error message more user-friendly
            let errorMsg = progress.error || "Translation failed";
            if (errorMsg.includes("Budget has been exceeded") || errorMsg.includes("budget_exceeded")) {
              errorMsg = "API budget exceeded. Please add more credits to your Universal Key in Profile → Universal Key → Add Balance";
            }
            toast.error(errorMsg, { duration: 8000 });
            setTranslationStatus("");
            setTranslationProgress(null);
            setTranslating(false);
          } else {
            // Still running, poll again (reset retry count on success)
            setTimeout(() => pollProgress(0), 2000);
          }
        } catch (err) {
          // Silently retry on 502 errors (proxy timeout) - this is normal during heavy processing
          if (err.response?.status === 502 && retryCount < 60) {
            // Keep retrying silently for up to ~2 minutes of 502 errors
            setTimeout(() => pollProgress(retryCount + 1), 2000);
            return;
          }
          // Only show error after many consecutive failures or for non-502 errors
          console.error("Progress poll error:", err);
          const errorDetail = err.response?.data?.detail || err.message || "Translation failed";
          toast.error(errorDetail);
          setTranslationStatus("");
          setTranslationProgress(null);
          setTranslating(false);
        }
      };
      
      // Start polling after a short delay
      setTimeout(pollProgress, 1000);
      
    } catch (err) {
      console.error("Translation error:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Failed to start translation";
      toast.error(errorDetail);
      setTranslationStatus("");
      setTranslationProgress(null);
      setTranslating(false);
    }
  };

  const handleAudioExport = async () => {
    // Prevent starting a new export if one is already running
    if (exporting) {
      toast.info("Audio export already in progress");
      return;
    }
    
    setExporting(true);
    setAudioProgress(null);
    
    try {
      const res = await storiesAPI.exportAudio(story.id, selectedVoice, selectedModel);
      const taskId = res.data.task_id;
      setAudioTaskId(taskId);
      
      setAudioProgress({
        totalChapters: res.data.total_chapters,
        totalCharacters: res.data.total_characters,
        currentChapter: 0,
        charactersProcessed: 0,
        currentChapterName: "Starting..."
      });
      
      // Poll for progress with retry on 502
      const pollProgress = async (retryCount = 0) => {
        try {
          const progressRes = await storiesAPI.getAudioProgress(taskId);
          const progress = progressRes.data;
          
          // Reset retry count on success
          setAudioProgress({
            totalChapters: progress.total_chapters,
            totalCharacters: progress.total_characters,
            currentChapter: progress.current_chapter,
            charactersProcessed: progress.characters_processed,
            currentChapterName: progress.current_chapter_name
          });
          
          if (progress.status === "completed" && progress.has_audio) {
            // Download the audio
            const token = localStorage.getItem("archiva_token");
            const downloadUrl = storiesAPI.getAudioDownloadUrl(taskId, token);
            
            // Trigger download
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `${story.name}_${selectedVoice}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            toast.success("Audio exported successfully! Check your downloads.", { duration: 10000 });
            setShowAudioDialog(false);
            setAudioProgress(null);
            setAudioTaskId(null);
            setExporting(false);
          } else if (progress.status === "failed") {
            let errorMsg = progress.error || "Audio export failed";
            if (errorMsg.includes("Budget has been exceeded") || errorMsg.includes("budget_exceeded")) {
              errorMsg = "API budget exceeded. Please add more credits to your Universal Key.";
            }
            toast.error(errorMsg, { duration: 10000 });
            setAudioProgress(null);
            setAudioTaskId(null);
            setExporting(false);
          } else {
            // Still running, poll again
            setTimeout(() => pollProgress(0), 2000);
          }
        } catch (err) {
          // Silently retry on 502 errors (proxy timeout) - this is normal during heavy processing
          if (err.response?.status === 502 && retryCount < 60) {
            // Don't log every retry, just keep trying quietly for up to ~2 minutes
            setTimeout(() => pollProgress(retryCount + 1), 2000);
            return;
          }
          // Only show error after many retries or for non-502 errors
          console.error("Audio progress poll error:", err);
          const errorMsg = err.response?.data?.detail || err.message || "Audio export polling failed";
          toast.error(`Audio export error: ${errorMsg}`, { duration: 10000 });
          setAudioProgress(null);
          setAudioTaskId(null);
          setExporting(false);
        }
      };
      
      setTimeout(pollProgress, 1000);
      
    } catch (err) {
      console.error("Audio export error:", err);
      toast.error(err.response?.data?.detail || "Failed to start audio export", { duration: 8000 });
      setAudioProgress(null);
      setAudioTaskId(null);
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="story-detail">
      {/* Translation Progress Banner (shows when dialog is closed but translation is running) */}
      {translating && !showTranslateDialog && (
        <div 
          className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => setShowTranslateDialog(true)}
          data-testid="translation-progress-banner"
        >
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">
              Translating to {selectedLanguage}...
              {translationProgress && ` (Chapter ${translationProgress.currentChapter}/${translationProgress.totalChapters})`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Click to view progress</span>
        </div>
      )}

      {/* Audio Export Progress Banner (shows when dialog is closed but export is running) */}
      {exporting && !showAudioDialog && (
        <div 
          className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-orange-500/15 transition-colors"
          onClick={() => setShowAudioDialog(true)}
          data-testid="audio-progress-banner"
        >
          <Headphones className="w-4 h-4 text-orange-600 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-600">
              Generating audio...
              {audioProgress && ` (Chapter ${audioProgress.currentChapter}/${audioProgress.totalChapters})`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Click to view progress</span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="story-back-btn">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editingStoryTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editStoryName}
                onChange={(e) => setEditStoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveStoryTitle();
                  if (e.key === "Escape") setEditingStoryTitle(false);
                }}
                onBlur={saveStoryTitle}
                className="h-8 text-base font-semibold"
                autoFocus
                data-testid="edit-story-title-input"
              />
            </div>
          ) : (
            <h2 
              className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors" 
              onClick={() => { setEditStoryName(story.name); setEditingStoryTitle(true); }}
              title="Click to edit title"
              data-testid="story-title"
            >
              {story.name}
            </h2>
          )}
          {story.description && <p className="text-xs text-muted-foreground truncate">{story.description}</p>}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowAudioDialog(true)}
          data-testid="export-audio-btn"
        >
          <Headphones className="w-3.5 h-3.5" /> Audio
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowTranslateDialog(true)}
          data-testid="translate-story-btn"
        >
          <Languages className="w-3.5 h-3.5" /> Translate
        </Button>
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
                    {editingChapterId === ch.id ? (
                      <input
                        ref={chapterNameInputRef}
                        type="text"
                        value={editChapterName}
                        onChange={(e) => setEditChapterName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") { e.preventDefault(); saveChapterName(ch.id); }
                          if (e.key === "Escape") { e.preventDefault(); setEditingChapterId(null); }
                        }}
                        onBlur={() => setTimeout(() => saveChapterName(ch.id), 150)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 text-xs flex-1 px-1 border border-primary rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid={`edit-chapter-name-input-${i}`}
                      />
                    ) : (
                      <span 
                        className="flex-1 truncate" 
                        onDoubleClick={(e) => { 
                          e.stopPropagation(); 
                          setEditChapterName(ch.name); 
                          setEditingChapterId(ch.id); 
                        }}
                        title="Double-click to rename"
                      >
                        {ch.name}
                      </span>
                    )}
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
              {editingChapterId === selectedChapter.id ? (
                <input
                  ref={chapterNameInputRef}
                  type="text"
                  value={editChapterName}
                  onChange={(e) => setEditChapterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveChapterName(selectedChapter.id); }
                    if (e.key === "Escape") { e.preventDefault(); setEditingChapterId(null); }
                  }}
                  onBlur={() => setTimeout(() => saveChapterName(selectedChapter.id), 150)}
                  className="h-7 text-sm font-semibold flex-1 px-2 border border-primary rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="edit-chapter-header-input"
                />
              ) : (
                <h3 
                  className="text-sm font-semibold flex-1 cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => { setEditChapterName(selectedChapter.name); setEditingChapterId(selectedChapter.id); }}
                  title="Click to rename chapter"
                  data-testid="chapter-header-title"
                >
                  {selectedChapter.name}
                </h3>
              )}
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = storiesAPI.exportWordUrl(story.id);
                  a.download = `${story.name}.docx`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                data-testid="export-word-btn"
              >
                <FileText className="w-3 h-3" /> Word
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
                <ChapterChat 
                  story={story} 
                  chapter={selectedChapter} 
                  onContentUpdate={loadStory}
                  importedText={importedText}
                  onImportedTextUsed={() => setImportedText("")}
                  onImportClick={openImportDialog}
                />
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
                    onClick={() => importFromLibrary(f.id, f)}
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

      {/* Translate Story Dialog */}
      <Dialog open={showTranslateDialog} onOpenChange={setShowTranslateDialog}>
        <DialogContent className="max-w-md" data-testid="translate-dialog">
          <DialogHeader>
            <DialogTitle>Translate Story</DialogTitle>
            <DialogDescription>
              Create a new story with all content translated to your selected language.
            </DialogDescription>
          </DialogHeader>
          
          {translating ? (
            /* Progress View */
            <div className="py-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium">Translating to {selectedLanguage}...</p>
                  {translationProgress && (
                    <p className="text-sm text-muted-foreground">
                      Chapter {translationProgress.currentChapter} of {translationProgress.totalChapters}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500 ease-out" 
                    style={{
                      width: translationProgress 
                        ? `${Math.max(5, (translationProgress.currentChapter / translationProgress.totalChapters) * 100)}%`
                        : '5%'
                    }}
                  />
                </div>
                {translationProgress && (
                  <p className="text-xs text-muted-foreground text-center">
                    {translationProgress.currentChapterName 
                      ? `Translating: ${translationProgress.currentChapterName.substring(0, 40)}${translationProgress.currentChapterName.length > 40 ? '...' : ''}`
                      : 'Processing...'}
                  </p>
                )}
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground text-center">
                <p>Translation runs in the background.</p>
                <p>You can close this dialog - it will continue processing.</p>
              </div>
            </div>
          ) : (
            /* Selection View */
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Language</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger data-testid="language-select">
                    <SelectValue placeholder="Select a language..." />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang} value={lang} data-testid={`lang-option-${lang}`}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>What will be translated:</strong></p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Story title and description</li>
                  <li>All chapter names</li>
                  <li>All text content blocks ({chapters.reduce((acc, ch) => acc + (ch.content_blocks || []).filter(b => b.type === 'text').length, 0)} total)</li>
                </ul>
                <p className="mt-2">Media files (images, audio, video) will be kept as-is.</p>
              </div>
            </div>
          )}
          
          {!translating && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTranslateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTranslate} 
                disabled={!selectedLanguage}
                data-testid="confirm-translate-btn"
              >
                <Languages className="w-4 h-4 mr-2" />
                Translate Story
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Audio Export Dialog */}
      <Dialog open={showAudioDialog} onOpenChange={setShowAudioDialog}>
        <DialogContent className="max-w-md" data-testid="audio-export-dialog">
          <DialogHeader>
            <DialogTitle>Export as Audio</DialogTitle>
            <DialogDescription>
              Convert your story to an MP3 audiobook using AI voice narration.
            </DialogDescription>
          </DialogHeader>
          
          {exporting ? (
            /* Progress View */
            <div className="py-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Headphones className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium">Generating audio with {selectedVoice}...</p>
                  {audioProgress && (
                    <p className="text-sm text-muted-foreground">
                      {audioProgress.currentChapter > 0 
                        ? `Chapter ${audioProgress.currentChapter} of ${audioProgress.totalChapters}`
                        : "Preparing..."}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500 ease-out" 
                    style={{
                      width: audioProgress 
                        ? `${Math.max(5, (audioProgress.charactersProcessed / audioProgress.totalCharacters) * 100)}%`
                        : '5%'
                    }}
                  />
                </div>
                {audioProgress && (
                  <p className="text-xs text-muted-foreground text-center">
                    {audioProgress.currentChapterName 
                      ? `Processing: ${audioProgress.currentChapterName.substring(0, 35)}${audioProgress.currentChapterName.length > 35 ? '...' : ''}`
                      : 'Processing...'}
                  </p>
                )}
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 text-center space-y-1">
                <p className="font-medium">Please stay on this story page</p>
                <p>Navigating away will cancel the download.</p>
                <p className="text-muted-foreground">Generation takes 2-5 minutes for long stories.</p>
              </div>
            </div>
          ) : (
            /* Selection View */
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Voice</label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger data-testid="voice-select">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ttsOptions.voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id} data-testid={`voice-option-${voice.id}`}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
                          <span className="text-xs text-muted-foreground">{voice.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger data-testid="model-select">
                    <SelectValue placeholder="Select quality..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ttsOptions.models.map((model) => (
                      <SelectItem key={model.id} value={model.id} data-testid={`model-option-${model.id}`}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>What will be converted:</strong></p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>All {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</li>
                  <li>{chapters.reduce((acc, ch) => acc + (ch.content_blocks || []).filter(b => b.type === 'text').reduce((a, b) => a + (b.content?.length || 0), 0), 0).toLocaleString()} characters of text</li>
                </ul>
                <p className="mt-2">Images, videos, and existing audio will be skipped.</p>
              </div>
            </div>
          )}
          
          {!exporting && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAudioDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAudioExport} 
                disabled={!selectedVoice}
                data-testid="confirm-audio-export-btn"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Export Audio
              </Button>
            </DialogFooter>
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

  const handleTranslateSuccess = async (newStoryId) => {
    // Load the new translated story and navigate to it
    setLoading(true); // Show loading state during transition
    try {
      // First refresh the stories list
      await loadStories();
      // Then load and navigate to the new story
      const res = await storiesAPI.get(newStoryId);
      setSelectedStory(res.data);
      toast.success("Navigated to translated story");
    } catch {
      toast.error("Failed to load translated story");
    } finally {
      setLoading(false);
    }
  };

  // Story detail view
  if (selectedStory) {
    return (
      <StoryDetailView
        story={selectedStory}
        onBack={() => { setSelectedStory(null); loadStories(); }}
        onTranslateSuccess={handleTranslateSuccess}
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
