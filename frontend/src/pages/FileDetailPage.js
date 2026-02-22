import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { filesAPI } from "../lib/api";
import { ArrowLeft, Download, Trash2, Edit2, Check, X, FileText, Image, Music, Video, File, Loader2, Calendar, HardDrive, Tag } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const typeIcons = {
  image: { icon: Image, color: "text-emerald-600", bg: "bg-emerald-50" },
  document: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  audio: { icon: Music, color: "text-purple-600", bg: "bg-purple-50" },
  video: { icon: Video, color: "text-orange-600", bg: "bg-orange-50" },
  other: { icon: File, color: "text-gray-600", bg: "bg-gray-50" },
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function FileDetailPage({ fileId, onNavigate }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);

  useEffect(() => { loadFile(); }, [fileId]);

  const loadFile = async () => {
    try {
      const res = await filesAPI.get(fileId);
      setFile(res.data);
      setTagInput(res.data.tags?.join(", ") || "");
    } catch (err) {
      toast.error("File not found");
      onNavigate("library");
    } finally {
      setLoading(false);
    }
  };

  const saveTags = async () => {
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const res = await filesAPI.updateTags(fileId, tags);
      setFile(res.data);
      setEditingTags(false);
      toast.success("Tags updated");
    } catch (err) { toast.error("Failed to update tags"); }
  };

  const handleDelete = async () => {
    try {
      await filesAPI.delete(fileId);
      toast.success("File deleted");
      onNavigate("library");
    } catch (err) { toast.error("Failed to delete file"); }
  };

  const handleDownload = () => {
    // Use hidden iframe to trigger download
    const url = filesAPI.downloadUrl(fileId);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 5000);
    toast.success("Download started");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!file) return null;

  const typeInfo = typeIcons[file.file_type] || typeIcons.other;
  const IconComponent = typeInfo.icon;
  const previewUrl = `${BACKEND_URL}/api/files/download/${fileId}`;

  const renderPreview = () => {
    if (file.file_type === "image") {
      return (
        <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
          <img src={previewUrl} alt={file.original_filename} className="max-w-full max-h-[500px] object-contain mx-auto" data-testid="file-preview-image" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      );
    }
    if (file.file_type === "audio") {
      return <audio controls className="w-full" data-testid="file-preview-audio"><source src={previewUrl} type={file.mime_type} /></audio>;
    }
    if (file.file_type === "video") {
      return <video controls className="w-full max-h-[500px] rounded-lg" data-testid="file-preview-video"><source src={previewUrl} type={file.mime_type} /></video>;
    }
    if (file.content_text) {
      return (
        <Card className="border border-border shadow-none bg-muted/30" data-testid="file-preview-text">
          <CardContent className="p-6"><pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-auto">{file.content_text}</pre></CardContent>
        </Card>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-lg border border-border">
        <IconComponent className={`w-16 h-16 ${typeInfo.color} mb-4`} />
        <p className="text-muted-foreground">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 fade-in" data-testid="file-detail-page">
      <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => onNavigate("library")} data-testid="back-to-library">
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">{renderPreview()}</div>
        <div className="space-y-4">
          <Card className="border border-border shadow-none" data-testid="file-info-card">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg ${typeInfo.bg} flex items-center justify-center`}>
                  <IconComponent className={`w-6 h-6 ${typeInfo.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold truncate text-lg" data-testid="file-detail-name">{file.original_filename}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{file.file_type} file</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm"><HardDrive className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Size:</span><span className="font-medium">{formatSize(file.file_size)}</span></div>
                <div className="flex items-center gap-3 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Uploaded:</span><span className="font-medium">{new Date(file.upload_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
                <div className="flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Extension:</span><span className="font-medium">{file.file_extension}</span></div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2"><Tag className="w-4 h-4" /> Tags</span>
                  {!editingTags && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingTags(true)} data-testid="edit-tags-btn"><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>}
                </div>
                {editingTags ? (
                  <div className="space-y-2">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Comma-separated tags" className="h-9 text-sm" data-testid="detail-tag-input" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveTags} className="h-7" data-testid="save-detail-tags"><Check className="w-3 h-3 mr-1" /> Save</Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingTags(false)} className="h-7"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {file.tags?.length > 0 ? file.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs" data-testid={`detail-tag-${tag}`}>{tag}</Badge>) : <p className="text-sm text-muted-foreground">No tags</p>}
                  </div>
                )}
                {file.ai_tags?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">AI-generated tags:</p>
                    <div className="flex flex-wrap gap-1">{file.ai_tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}</div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handleDownload} data-testid="download-file-btn"><Download className="w-4 h-4" /> Download</Button>
                <Button variant="destructive" size="icon" onClick={() => setDeleteDialog(true)} data-testid="delete-file-btn"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent data-testid="file-delete-dialog">
          <DialogHeader><DialogTitle>Delete File</DialogTitle></DialogHeader>
          <p className="text-sm">Are you sure you want to delete <strong>{file.original_filename}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} data-testid="confirm-file-delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
