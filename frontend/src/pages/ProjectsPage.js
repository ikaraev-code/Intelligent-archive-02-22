import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { projectsAPI, filesAPI, chatAPI } from "../lib/api";
import {
  FolderPlus,
  FolderOpen,
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  ArrowLeft,
  FileText,
  Image,
  Music,
  Video,
  File,
  ChevronDown,
  ChevronUp,
  Plus,
  Settings,
  Clock,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Grid3X3,
  List,
  Download,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

const sourceTypeIcons = {
  image: Image,
  document: FileText,
  audio: Music,
  video: Video,
  other: File,
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// ========== Source Citation Component ==========
function SourcesCitation({ sources, expanded, onToggle }) {
  if (!sources || sources.length === 0) return null;
  const uniqueSources = [];
  const seenFiles = new Set();
  for (const src of sources) {
    if (!seenFiles.has(src.file_id)) {
      seenFiles.add(src.file_id);
      uniqueSources.push(src);
    }
  }
  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <button onClick={onToggle} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <FileText className="w-3 h-3" />
        <span>{uniqueSources.length} source{uniqueSources.length !== 1 ? "s" : ""} cited</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {sources.map((src, i) => {
            const IconComp = sourceTypeIcons[src.file_type] || sourceTypeIcons.other;
            return (
              <div key={i} className="bg-white/60 rounded border border-gray-200 p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <IconComp className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-foreground truncate">{src.filename}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
                    {Math.round(src.relevance * 100)}% match
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">{src.passage}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== File Picker Component ==========
function FilePicker({ selectedIds, onSelectionChange, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await filesAPI.list({ limit: 200 });
      setFiles(res.data.files || []);
    } catch (err) {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const filtered = files.filter((f) =>
    !search || f.original_filename.toLowerCase().includes(search.toLowerCase()) ||
    (f.tags && f.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
  );

  const typeIcon = (type) => {
    const icons = { image: Image, document: FileText, audio: Music, video: Video };
    const Icon = icons[type] || File;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search files..."
        className="h-9"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selectedIds.length} file{selectedIds.length !== 1 ? "s" : ""} selected</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onSelectionChange([])}>Clear</Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {filtered.map((file) => (
              <div
                key={file.id}
                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedIds.includes(file.id) ? "bg-primary/5 border border-primary/20" : "border border-transparent"
                }`}
                onClick={() => toggle(file.id)}
              >
                <Checkbox checked={selectedIds.includes(file.id)} className="h-4 w-4" />
                <div className="text-muted-foreground">{typeIcon(file.file_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.original_filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.file_type} · {formatSize(file.file_size)}
                    {file.embedding_status === "completed" && " · indexed"}
                  </p>
                </div>
                {file.tags && file.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No files found</p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ========== Project Chat View ==========
function ProjectChatView({ project, onBack, onManageFiles }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedSources, setExpandedSources] = useState({});
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playingMessageIdx, setPlayingMessageIdx] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    setLoadingHistory(true);
    try {
      const res = await projectsAPI.getMessages(project.id);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text.trim(), sources: [] };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await projectsAPI.chat(project.id, text.trim());
      const assistantMsg = { role: "assistant", content: res.data.response, sources: res.data.sources || [] };
      setMessages((prev) => [...prev, assistantMsg]);
      
      if (autoSpeak) {
        const newIdx = messages.length + 1;
        setTimeout(() => speakText(res.data.response, newIdx), 100);
      }
    } catch (err) {
      toast.error("Failed to get response");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", sources: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await transcribeAudio(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Recording...");
    } catch (err) { toast.error("Could not access microphone"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const toggleRecording = () => { isRecording ? stopRecording() : startRecording(); };

  const transcribeAudio = async (blob) => {
    setTranscribing(true);
    try {
      const res = await chatAPI.speechToText(blob);
      if (res.data.text) { setInput(res.data.text); sendMessage(res.data.text); }
      else { toast.warning("Could not transcribe audio"); }
    } catch (err) { toast.error("Transcription failed"); }
    finally { setTranscribing(false); }
  };

  // TTS
  const speakText = async (text, messageIdx) => {
    if (playingMessageIdx !== null && playingMessageIdx !== messageIdx) stopSpeaking();
    if (playingMessageIdx === messageIdx && audioRef.current) {
      if (isPaused) { audioRef.current.play(); setIsPaused(false); }
      else { audioRef.current.pause(); setIsPaused(true); }
      return;
    }
    setIsLoadingAudio(true); setPlayingMessageIdx(messageIdx); setIsPaused(false);
    try {
      const res = await chatAPI.textToSpeech(text.substring(0, 4096), "nova", 1.0);
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => { setPlayingMessageIdx(null); setIsPaused(false); audioRef.current = null; };
      audio.onerror = () => { setPlayingMessageIdx(null); setIsPaused(false); audioRef.current = null; };
      setIsLoadingAudio(false);
      await audio.play();
    } catch (err) { toast.error("TTS failed"); setPlayingMessageIdx(null); setIsPaused(false); setIsLoadingAudio(false); }
  };

  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
    setPlayingMessageIdx(null); setIsPaused(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col" data-testid="project-chat">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} data-testid="project-back-btn">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{project.name}</h2>
          <p className="text-xs text-muted-foreground">
            {project.file_count || project.file_ids?.length || 0} files · {messages.length} messages
          </p>
        </div>
        <div className="flex items-center gap-2">
          {playingMessageIdx !== null && (
            <Button variant="destructive" size="sm" onClick={() => { stopSpeaking(); }} className="gap-1 h-7 text-xs">
              <Square className="w-3 h-3" /> Stop
            </Button>
          )}
          <Button
            variant={autoSpeak ? "default" : "outline"} size="sm"
            onClick={() => setAutoSpeak(!autoSpeak)} className="gap-1 h-7 text-xs"
          >
            {autoSpeak ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            Auto-speak
          </Button>
          <Button variant="outline" size="sm" onClick={onManageFiles} className="gap-1 h-7 text-xs" data-testid="manage-files-btn">
            <Settings className="w-3 h-3" /> Files
          </Button>
          <Button
            variant="outline" size="sm"
            className="gap-1 h-7 text-xs"
            data-testid="export-pdf-btn"
            onClick={async () => {
              try {
                toast.info("Generating PDF...");
                const token = localStorage.getItem("archiva_token");
                const res = await fetch(`${BACKEND_URL}/api/projects/${project.id}/export-pdf`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              } catch (err) {
                toast.error("Failed to export PDF");
              }
            }}
          >
            <Download className="w-3 h-3" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Chat */}
      <Card className="flex-1 overflow-hidden border border-border">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4 pb-4">
            {loadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                  <p className="text-sm whitespace-pre-wrap">
                    Welcome to <strong>{project.name}</strong>! I have access to {project.file_ids?.length || 0} file(s) in this project. Ask me anything about them — I'll search through the content and cite my sources.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"} ${playingMessageIdx === idx ? "ring-2 ring-primary/50" : ""}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1 mt-2">
                        <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${playingMessageIdx === idx ? "opacity-100" : "opacity-60 hover:opacity-100"}`} onClick={() => speakText(msg.content, idx)} disabled={isLoadingAudio && playingMessageIdx === idx}>
                          {isLoadingAudio && playingMessageIdx === idx ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Loading...</>) : playingMessageIdx === idx ? (isPaused ? (<><Play className="w-3 h-3 mr-1" />Resume</>) : (<><Pause className="w-3 h-3 mr-1" />Pause</>)) : (<><Play className="w-3 h-3 mr-1" />Listen</>)}
                        </Button>
                        {playingMessageIdx === idx && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={stopSpeaking}>
                            <Square className="w-3 h-3 mr-1" /> Stop
                          </Button>
                        )}
                      </div>
                    )}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <SourcesCitation sources={msg.sources} expanded={!!expandedSources[idx]} onToggle={() => setExpandedSources((prev) => ({ ...prev, [idx]: !prev[idx] }))} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div>
                <div className="bg-muted rounded-lg px-4 py-3"><Loader2 className="w-4 h-4 animate-spin" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <div className="flex gap-2 mt-3">
        <Button variant={isRecording ? "destructive" : "outline"} size="icon" onClick={toggleRecording} disabled={transcribing || loading} className="flex-shrink-0">
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder={transcribing ? "Transcribing..." : "Ask about your project files..."} disabled={loading || transcribing} className="flex-1" data-testid="project-chat-input" />
        <Button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="flex-shrink-0" data-testid="project-send-btn">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ========== Main Projects Page ==========
export default function ProjectsPage() {
  const [view, setView] = useState("list"); // "list" | "create" | "chat"
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  
  // Create wizard state
  const [createStep, setCreateStep] = useState(1); // 1: name, 2: select files
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  
  // Manage files dialog
  const [showManageFiles, setShowManageFiles] = useState(false);
  const [manageFileIds, setManageFileIds] = useState([]);
  
  // Delete dialog
  const [deletingProject, setDeletingProject] = useState(null);
  
  // View mode for project list
  const [listMode, setListMode] = useState("grid"); // "grid" | "list"

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await projectsAPI.list();
      setProjects(res.data || []);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setNewName("");
    setNewDescription("");
    setSelectedFileIds([]);
    setCreateStep(1);
    setView("create");
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Please enter a project name"); return; }
    try {
      const res = await projectsAPI.create({ name: newName.trim(), description: newDescription.trim(), file_ids: selectedFileIds });
      toast.success("Project created!");
      setActiveProject(res.data);
      setView("chat");
      loadProjects();
    } catch (err) {
      toast.error("Failed to create project");
    }
  };

  const openProject = async (project) => {
    try {
      const res = await projectsAPI.get(project.id);
      setActiveProject(res.data);
      setView("chat");
    } catch (err) {
      toast.error("Failed to load project");
    }
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      await projectsAPI.delete(deletingProject.id);
      toast.success("Project deleted");
      setDeletingProject(null);
      loadProjects();
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  const openManageFiles = () => {
    if (activeProject) {
      setManageFileIds(activeProject.file_ids || []);
      setShowManageFiles(true);
    }
  };

  const saveManageFiles = async () => {
    if (!activeProject) return;
    try {
      const res = await projectsAPI.update(activeProject.id, { file_ids: manageFileIds });
      setActiveProject({ ...activeProject, file_ids: res.data.file_ids });
      setShowManageFiles(false);
      toast.success("Project files updated");
    } catch (err) {
      toast.error("Failed to update files");
    }
  };

  // ========== LIST VIEW ==========
  if (view === "list") {
    return (
      <div className="space-y-5 fade-in" data-testid="projects-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Projects</h1>
            <p className="text-muted-foreground text-base">Organize AI conversations around curated file collections</p>
          </div>
          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <div className="flex items-center border rounded-md">
                <Button variant={listMode === "grid" ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-r-none" onClick={() => setListMode("grid")} data-testid="grid-view-btn">
                  <Grid3X3 className="w-3.5 h-3.5" />
                </Button>
                <Button variant={listMode === "list" ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-l-none" onClick={() => setListMode("list")} data-testid="list-view-btn">
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <Button onClick={startCreate} className="gap-2" data-testid="new-project-btn">
              <FolderPlus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : projects.length === 0 ? (
          <Card className="border border-border shadow-none">
            <CardContent className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Create a project to organize files and have focused AI conversations
              </p>
              <Button onClick={startCreate} className="gap-2">
                <FolderPlus className="w-4 h-4" /> Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : listMode === "grid" ? (
          /* ===== GRID VIEW ===== */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border border-border shadow-none hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => openProject(project)}
                data-testid={`project-card-${project.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                        title="Export as PDF"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const token = localStorage.getItem("archiva_token");
                            const res = await fetch(`${BACKEND_URL}/api/projects/${project.id}/export-pdf`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (!res.ok) throw new Error();
                            const blob = await res.blob();
                            window.open(URL.createObjectURL(blob), "_blank");
                          } catch { toast.error("Failed to export PDF"); }
                        }}
                        data-testid={`export-pdf-card-${project.id}`}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeletingProject(project); }}
                        data-testid={`delete-project-${project.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5 truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">{project.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <File className="w-2.5 h-2.5" /> {project.file_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="w-2.5 h-2.5" /> {project.message_count}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* ===== LIST VIEW ===== */
          <div className="space-y-1.5">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border border-border shadow-none hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => openProject(project)}
                data-testid={`project-card-${project.id}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <File className="w-3 h-3" /> {project.file_count} file{project.file_count !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {project.message_count} msg{project.message_count !== 1 ? "s" : ""}
                    </span>
                    {project.last_message_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(project.last_message_at)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      title="Export as PDF"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const token = localStorage.getItem("archiva_token");
                          const res = await fetch(`${BACKEND_URL}/api/projects/${project.id}/export-pdf`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (!res.ok) throw new Error();
                          const blob = await res.blob();
                          window.open(URL.createObjectURL(blob), "_blank");
                        } catch { toast.error("Failed to export PDF"); }
                      }}
                      data-testid={`export-pdf-list-${project.id}`}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeletingProject(project); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete dialog */}
        <Dialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Project</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Delete <strong>{deletingProject?.name}</strong>? This will remove all chat history for this project. Your archive files will not be affected.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ========== CREATE WIZARD ==========
  if (view === "create") {
    return (
      <div className="space-y-6 fade-in max-w-2xl" data-testid="create-project">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Project</h1>
            <p className="text-sm text-muted-foreground">Step {createStep} of 2</p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${createStep >= 1 ? "bg-primary" : "bg-gray-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${createStep >= 2 ? "bg-primary" : "bg-gray-200"}`} />
        </div>

        {createStep === 1 && (
          <Card className="border border-border shadow-none">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Project Name *</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Q4 Financial Analysis"
                  className="h-11"
                  autoFocus
                  data-testid="project-name-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description of this project..."
                  rows={3}
                  data-testid="project-description-input"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { if (!newName.trim()) { toast.error("Enter a project name"); return; } setCreateStep(2); }} className="gap-2" data-testid="next-step-btn">
                  Next: Select Files <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {createStep === 2 && (
          <Card className="border border-border shadow-none">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Select Files for "{newName}"</label>
                <p className="text-xs text-muted-foreground mb-3">Choose files the AI Archivist will have access to in this project. You can add more later.</p>
              </div>
              <FilePicker selectedIds={selectedFileIds} onSelectionChange={setSelectedFileIds} />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCreateStep(1)}>Back</Button>
                <Button onClick={handleCreate} className="gap-2" data-testid="create-project-submit">
                  <FolderPlus className="w-4 h-4" /> Create Project ({selectedFileIds.length} files)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ========== CHAT VIEW ==========
  if (view === "chat" && activeProject) {
    return (
      <>
        <ProjectChatView
          project={activeProject}
          onBack={() => { setView("list"); setActiveProject(null); loadProjects(); }}
          onManageFiles={openManageFiles}
        />
        {/* Manage Files Dialog */}
        <Dialog open={showManageFiles} onOpenChange={setShowManageFiles}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader><DialogTitle>Manage Project Files</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-hidden">
              <FilePicker selectedIds={manageFileIds} onSelectionChange={setManageFileIds} />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-2">
              <Button variant="outline" onClick={() => setShowManageFiles(false)}>Cancel</Button>
              <Button onClick={saveManageFiles}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
