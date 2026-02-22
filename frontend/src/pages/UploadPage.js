import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { filesAPI } from "../lib/api";
import { Upload, X, FileText, Image, Music, Video, File, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const typeIcons = {
  image: { icon: Image, color: "text-emerald-600" },
  document: { icon: FileText, color: "text-blue-600" },
  audio: { icon: Music, color: "text-purple-600" },
  video: { icon: Video, color: "text-orange-600" },
};

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", bmp: "image", svg: "image",
    pdf: "document", docx: "document", doc: "document", txt: "document", md: "document", csv: "document", xlsx: "document", pptx: "document",
    mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", aac: "audio", m4a: "audio",
    mp4: "video", avi: "video", mov: "video", wmv: "video", mkv: "video", webm: "video", flv: "video",
  };
  return map[ext] || "other";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function UploadPage() {
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const newItems = acceptedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).slice(2),
      tags: "",
      status: "pending",
      progress: 0,
      result: null,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxSize: 100 * 1024 * 1024 });

  const removeFromQueue = (id) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const updateTags = (id, tags) => setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, tags } : item)));

  const uploadAll = async () => {
    setUploading(true);
    const pending = queue.filter((item) => item.status === "pending");
    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 30 } : q)));
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("tags", item.tags);
        const res = await filesAPI.upload(formData);
        setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "done", progress: 100, result: res.data } : q));
        toast.success(`${item.file.name} uploaded successfully`);
      } catch (err) {
        setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error", progress: 0 } : q));
        toast.error(`Failed to upload ${item.file.name}`);
      }
    }
    setUploading(false);
  };

  const clearCompleted = () => setQueue((prev) => prev.filter((item) => item.status !== "done"));

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const doneCount = queue.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-8 fade-in" data-testid="upload-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Upload Files</h1>
        <p className="text-muted-foreground text-base">Drag & drop or browse files. AI will auto-tag them for you.</p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
        data-testid="file-dropzone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-lg font-medium mb-1">{isDragActive ? "Drop files here" : "Drag & drop files here"}</p>
        <p className="text-sm text-muted-foreground">or <span className="text-primary font-medium">browse</span> to choose files. Max 100MB each.</p>
        <p className="text-xs text-muted-foreground mt-2">Images, Documents, Audio, Video supported</p>
      </div>

      {queue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upload Queue <span className="ml-2 text-sm font-normal text-muted-foreground">({queue.length} files)</span></h2>
            <div className="flex gap-2">
              {doneCount > 0 && <Button variant="outline" size="sm" onClick={clearCompleted} data-testid="clear-completed-btn">Clear Completed</Button>}
              {pendingCount > 0 && (
                <Button size="sm" onClick={uploadAll} disabled={uploading} data-testid="upload-all-btn">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload {pendingCount} File{pendingCount > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {queue.map((item) => {
              const fType = getFileType(item.file.name);
              const tInfo = typeIcons[fType] || { icon: File, color: "text-gray-600" };
              const Icon = tInfo.icon;
              return (
                <Card key={item.id} className="border border-border shadow-none" data-testid={`queue-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Icon className={`w-8 h-8 ${tInfo.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">{item.file.name}</p>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{formatSize(item.file.size)}</span>
                            {item.status === "done" && <Check className="w-4 h-4 text-emerald-600" />}
                            {item.status === "error" && <span className="text-xs text-destructive">Failed</span>}
                            {item.status === "pending" && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromQueue(item.id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {item.status === "pending" && (
                          <Input placeholder="Add tags (comma-separated)" value={item.tags} onChange={(e) => updateTags(item.id, e.target.value)} className="h-8 text-sm mt-1" data-testid={`tag-input-${item.id}`} />
                        )}
                        {item.status === "uploading" && (
                          <div className="mt-2">
                            <Progress value={item.progress} className="h-1.5" />
                            <p className="text-xs text-muted-foreground mt-1">Uploading & generating AI tags...</p>
                          </div>
                        )}
                        {item.status === "done" && item.result?.tags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.result.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
