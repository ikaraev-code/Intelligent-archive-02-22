import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { chatAPI, filesAPI } from "../lib/api";
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Bot, 
  User, 
  Trash2,
  Play,
  Pause,
  Square,
  FileText,
  Image,
  Music,
  Video,
  File,
  ChevronDown,
  ChevronUp,
  Paperclip,
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
  Cpu
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

const sourceTypeIcons = {
  image: Image,
  document: FileText,
  audio: Music,
  video: Video,
  other: File
};

function SourcesCitation({ sources, expanded, onToggle }) {
  if (!sources || sources.length === 0) return null;
  
  // Deduplicate sources by file_id
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
      <button 
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="w-3 h-3" />
        <span>{uniqueSources.length} source{uniqueSources.length !== 1 ? 's' : ''} cited</span>
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
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
                  {src.passage}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  
  // Voice playback state
  const [playingMessageIdx, setPlayingMessageIdx] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // {id, name, uploadStatus, embeddingStatus}
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const pollIntervalRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with a welcome message
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "Hello! I'm Archiva AI, your intelligent archive assistant. I can help you:\n\n- Search and find files in your archive\n- Summarize document content\n- Create abstracts and insights\n- Answer questions about your stored files\n\nYou can type your questions or use the microphone button to speak. How can I help you today?"
    }]);
  }, []);

  // Poll embedding status for pending files
  useEffect(() => {
    const pendingIds = pendingFiles
      .filter(f => f.id && f.embeddingStatus !== "completed" && f.embeddingStatus !== "failed" && f.embeddingStatus !== "skipped" && f.embeddingStatus !== "disabled" && f.uploadStatus !== "error")
      .map(f => f.id);
    
    if (pendingIds.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await filesAPI.batchStatus(pendingIds);
        const statusMap = {};
        for (const s of res.data.statuses) {
          statusMap[s.id] = s.embedding_status;
        }
        setPendingFiles(prev => prev.map(f => {
          if (f.id && statusMap[f.id]) {
            return { ...f, embeddingStatus: statusMap[f.id] };
          }
          return f;
        }));
      } catch {}
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pendingFiles.map(f => `${f.id}:${f.embeddingStatus}`).join(",")]);

  // Auto-dismiss fully completed files after 5s
  useEffect(() => {
    const allDone = pendingFiles.length > 0 && pendingFiles.every(f =>
      f.uploadStatus === "error" || f.embeddingStatus === "completed" || f.embeddingStatus === "failed" || f.embeddingStatus === "skipped" || f.embeddingStatus === "disabled"
    );
    if (allDone) {
      const timer = setTimeout(() => setPendingFiles([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingFiles]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";
    
    setUploading(true);
    const initialPending = files.map(f => ({ id: null, name: f.name, uploadStatus: "uploading", embeddingStatus: null }));
    setPendingFiles(prev => [...prev, ...initialPending]);
    const offset = pendingFiles.length; // offset for indexing into the new batch
    
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await filesAPI.upload(formData);
        const fileId = res.data.id;
        uploaded.push({ id: fileId, name: files[i].name });
        setPendingFiles(prev => prev.map((pf, idx) => 
          idx === offset + i ? { ...pf, id: fileId, uploadStatus: "done", embeddingStatus: res.data.embedding_status || "pending" } : pf
        ));
      } catch {
        setPendingFiles(prev => prev.map((pf, idx) => 
          idx === offset + i ? { ...pf, uploadStatus: "error" } : pf
        ));
      }
    }
    
    setUploading(false);
    
    if (uploaded.length > 0) {
      const names = uploaded.map(u => u.name).join(", ");
      toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I've added ${uploaded.length} new file${uploaded.length > 1 ? "s" : ""} to your archive: ${names}. They are now being indexed for search — watch the status chips below.`
      }]);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = e.dataTransfer.files;
    if (files?.length) handleFileUpload({ target: { files, value: "" } });
  };

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;
    
    const userMessage = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatAPI.send(text.trim(), sessionId);
      const assistantMessage = { 
        role: "assistant", 
        content: res.data.response,
        sources: res.data.sources || []
      };
      setMessages(prev => [...prev, assistantMessage]);
      setSessionId(res.data.session_id);

      // Auto-speak response if enabled
      if (autoSpeak) {
        // Get the index of the new message (current messages + user message + this message)
        const newMsgIdx = messages.length + 1;
        setTimeout(() => speakText(res.data.response, newMsgIdx), 100);
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Failed to get response");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
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

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Recording... Click again to stop");
    } catch (err) {
      console.error("Recording error:", err);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const transcribeAudio = async (audioBlob) => {
    setTranscribing(true);
    try {
      const res = await chatAPI.speechToText(audioBlob);
      const transcribedText = res.data.text;
      if (transcribedText) {
        setInput(transcribedText);
        // Auto-send after transcription
        sendMessage(transcribedText);
      } else {
        toast.warning("Could not transcribe audio");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast.error("Failed to transcribe audio");
    } finally {
      setTranscribing(false);
    }
  };

  // Text-to-Speech with better controls
  const speakText = async (text, messageIdx) => {
    // If clicking on a different message while one is playing, stop current and start new
    if (playingMessageIdx !== null && playingMessageIdx !== messageIdx) {
      stopSpeaking();
    }
    
    // If this message is already playing, toggle pause/resume
    if (playingMessageIdx === messageIdx && audioRef.current) {
      if (isPaused) {
        audioRef.current.play();
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
      return;
    }

    setIsLoadingAudio(true);
    setPlayingMessageIdx(messageIdx);
    setIsPaused(false);
    
    try {
      const res = await chatAPI.textToSpeech(text.substring(0, 4096), "nova", 1.0);
      const audioData = res.data.audio_base64;
      
      // Create audio element and play
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingMessageIdx(null);
        setIsPaused(false);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setPlayingMessageIdx(null);
        setIsPaused(false);
        audioRef.current = null;
        toast.error("Failed to play audio");
      };
      
      setIsLoadingAudio(false);
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      toast.error("Failed to generate speech");
      setPlayingMessageIdx(null);
      setIsPaused(false);
      setIsLoadingAudio(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingMessageIdx(null);
    setIsPaused(false);
  };

  const stopAllAudio = () => {
    stopSpeaking();
    toast.info("Audio stopped");
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([{
      role: "assistant",
      content: "Chat cleared. How can I help you?"
    }]);
    if (sessionId) {
      chatAPI.clearSession(sessionId).catch(() => {});
    }
    setSessionId(null);
  };

  return (
    <div
      className="space-y-4 fade-in h-[calc(100vh-120px)] flex flex-col relative"
      data-testid="ai-chat-page"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <Paperclip className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-lg font-semibold text-primary">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">Files will be embedded for AI search</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">AI Archivist</h1>
          <p className="text-muted-foreground text-base">Chat with AI about your archived files</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Global Stop Button - shown when any audio is playing */}
          {playingMessageIdx !== null && (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopAllAudio}
              className="gap-2"
              data-testid="stop-all-audio-btn"
            >
              <Square className="w-4 h-4" />
              Stop Audio
            </Button>
          )}
          <Button
            variant={autoSpeak ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className="gap-2"
            data-testid="auto-speak-toggle"
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Auto-speak
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="gap-2"
            data-testid="clear-chat-btn"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 overflow-hidden border border-border">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${idx}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  } ${playingMessageIdx === idx ? "ring-2 ring-primary/50" : ""}`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-2">
                      {/* Play/Pause Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs ${playingMessageIdx === idx ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                        onClick={() => speakText(msg.content, idx)}
                        disabled={isLoadingAudio && playingMessageIdx === idx}
                        data-testid={`speak-message-${idx}`}
                      >
                        {isLoadingAudio && playingMessageIdx === idx ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Loading...
                          </>
                        ) : playingMessageIdx === idx ? (
                          isPaused ? (
                            <>
                              <Play className="w-3 h-3 mr-1" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 mr-1" />
                              Pause
                            </>
                          )
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Listen
                          </>
                        )}
                      </Button>
                      {/* Stop Button - only shown for the playing message */}
                      {playingMessageIdx === idx && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={stopSpeaking}
                          data-testid={`stop-message-${idx}`}
                        >
                          <Square className="w-3 h-3 mr-1" />
                          Stop
                        </Button>
                      )}
                    </div>
                  )}
                  {/* Sources Citation */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <SourcesCitation 
                      sources={msg.sources} 
                      expanded={!!expandedSources[idx]}
                      onToggle={() => setExpandedSources(prev => ({...prev, [idx]: !prev[idx]}))}
                    />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map((f, i) => (
            <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              f.status === "done" ? "bg-green-100 text-green-700" :
              f.status === "error" ? "bg-red-100 text-red-700" :
              "bg-blue-100 text-blue-700"
            }`}>
              {f.status === "uploading" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {f.status === "done" && <FileText className="w-2.5 h-2.5" />}
              {f.name}
            </span>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          data-testid="chat-file-input"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || loading}
          className="flex-shrink-0"
          title="Attach files for embedding"
          data-testid="chat-attach-btn"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </Button>
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          onClick={toggleRecording}
          disabled={transcribing || loading}
          className="flex-shrink-0"
          data-testid="voice-input-btn"
        >
          {transcribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={transcribing ? "Transcribing..." : "Type your message or use voice..."}
          disabled={loading || transcribing}
          className="flex-1"
          data-testid="chat-input"
        />
        <Button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="flex-shrink-0"
          data-testid="send-message-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
