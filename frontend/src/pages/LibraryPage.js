import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { FileCard } from "../components/FileCard";
import { ObjectViewer } from "../components/ObjectViewer";
import { filesAPI } from "../lib/api";
import { Loader2, Grid3X3, List, ChevronLeft, ChevronRight, Globe, Lock, Users, Brain, RefreshCw, AlertCircle, CheckCircle2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function LibraryPage({ onNavigate, initialTag }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(initialTag || "");
  const [viewMode, setViewMode] = useState("grid");
  const [visibility, setVisibility] = useState("all"); // "all", "public", "private"
  const [allTags, setAllTags] = useState([]);

  // Tag edit dialog
  const [editingFile, setEditingFile] = useState(null);
  const [editTags, setEditTags] = useState("");

  // Delete dialog
  const [deletingFile, setDeletingFile] = useState(null);

  // Object viewer
  const [previewFile, setPreviewFile] = useState(null);

  // Embedding reindex state
  const [embeddingStatus, setEmbeddingStatus] = useState(null);
  const [embeddingStats, setEmbeddingStats] = useState(null);
  const [showReindexPanel, setShowReindexPanel] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(null);
  const reindexIntervalRef = useRef(null);

  useEffect(() => {
    loadFiles();
    loadTags();
    loadEmbeddingStatus();
  }, [page, filter, tagFilter, visibility]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (reindexIntervalRef.current) clearInterval(reindexIntervalRef.current);
    };
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, visibility };
      if (filter !== "all") params.file_type = filter;
      if (tagFilter) params.tag = tagFilter;
      const res = await filesAPI.list(params);
      setFiles(res.data.files);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const res = await filesAPI.tags();
      setAllTags(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadEmbeddingStatus = async () => {
    try {
      const res = await filesAPI.embeddingStatus();
      setEmbeddingStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const startReindex = async () => {
    setReindexing(true);
    try {
      const res = await filesAPI.reindex();
      const taskId = res.data.task_id;
      if (!taskId) {
        toast.info(res.data.message || "No files to reindex");
        setReindexing(false);
        return;
      }
      toast.success("Reindexing started...");
      setReindexProgress({ processed: 0, total: res.data.total, status: "running" });
      
      // Poll for progress
      reindexIntervalRef.current = setInterval(async () => {
        try {
          const prog = await filesAPI.reindexProgress(taskId);
          setReindexProgress(prog.data);
          if (prog.data.status === "completed" || prog.data.status === "failed") {
            clearInterval(reindexIntervalRef.current);
            reindexIntervalRef.current = null;
            setReindexing(false);
            loadEmbeddingStatus();
            if (prog.data.status === "completed") {
              toast.success(`Reindex complete! ${prog.data.processed}/${prog.data.total} files processed`);
            } else {
              toast.error("Reindex failed");
            }
            setTimeout(() => setReindexProgress(null), 3000);
          }
        } catch (err) {
          clearInterval(reindexIntervalRef.current);
          reindexIntervalRef.current = null;
          setReindexing(false);
        }
      }, 1500);
    } catch (err) {
      toast.error("Failed to start reindex");
      setReindexing(false);
    }
  };

  // Get current user ID from token
  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("archiva_token");
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id;
      }
    } catch (e) {}
    return null;
  };
  const currentUserId = getCurrentUserId();

  const handleView = (file) => {
    onNavigate("file-detail", { fileId: file.id });
  };

  const handlePreview = (file) => {
    setPreviewFile(file);
  };

  const handleDownload = (file) => {
    // Use hidden iframe to trigger download - most reliable cross-browser method
    const url = filesAPI.downloadUrl(file.id);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    
    // Remove iframe after download starts
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 5000);
    
    toast.success("Download started");
  };

  const handleToggleVisibility = async (file) => {
    try {
      const newVisibility = !file.is_public;
      await filesAPI.updateVisibility(file.id, newVisibility);
      toast.success(newVisibility ? "File is now public" : "File is now private");
      loadFiles(); // Refresh the list
    } catch (err) {
      toast.error("Failed to update visibility");
    }
  };

  const handleEditTags = (file) => {
    setEditingFile(file);
    setEditTags(file.tags?.join(", ") || "");
  };

  const saveTags = async () => {
    if (!editingFile) return;
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await filesAPI.updateTags(editingFile.id, tags);
      toast.success("Tags updated");
      setEditingFile(null);
      loadFiles();
    } catch (err) {
      toast.error("Failed to update tags");
    }
  };

  const handleDelete = (file) => {
    setDeletingFile(file);
  };

  const confirmDelete = async () => {
    if (!deletingFile) return;
    try {
      const res = await filesAPI.delete(deletingFile.id);
      const affected = res.data.affected_projects || [];
      if (affected.length > 0) {
        const inactiveProjects = affected.filter(p => p.became_inactive);
        const updatedProjects = affected.filter(p => !p.became_inactive);
        let msg = "File deleted.";
        if (updatedProjects.length > 0) {
          msg += ` Removed from ${updatedProjects.length} project${updatedProjects.length > 1 ? "s" : ""}: ${updatedProjects.map(p => p.name).join(", ")}.`;
        }
        if (inactiveProjects.length > 0) {
          msg += ` ${inactiveProjects.length} project${inactiveProjects.length > 1 ? "s" : ""} now inactive: ${inactiveProjects.map(p => p.name).join(", ")}.`;
        }
        toast.info(msg, { duration: 6000 });
      } else {
        toast.success("File deleted");
      }
      setDeletingFile(null);
      loadFiles();
    } catch (err) {
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6 fade-in" data-testid="library-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Library</h1>
        <p className="text-muted-foreground text-base">Browse and manage your archived files</p>
      </div>

      {/* Embedding Status & Reindex */}
      {embeddingStatus && embeddingStatus.status === "enabled" && (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
          <Brain className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {reindexProgress ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {reindexProgress.status === "completed" ? "Reindex complete!" : 
                     `Indexing${reindexProgress.current_file ? `: ${reindexProgress.current_file}` : '...'}`}
                  </span>
                  <span className="text-muted-foreground">
                    {reindexProgress.processed}/{reindexProgress.total}
                  </span>
                </div>
                <Progress 
                  value={reindexProgress.total > 0 ? (reindexProgress.processed / reindexProgress.total) * 100 : 0} 
                  className="h-2"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  Smart Search: <span className="font-medium text-foreground">{embeddingStatus.files_with_embeddings}/{embeddingStatus.total_files}</span> files indexed
                  {embeddingStatus.total_embeddings > 0 && ` · ${embeddingStatus.total_embeddings} embeddings`}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-shrink-0 h-8 text-xs"
            onClick={startReindex}
            disabled={reindexing}
            data-testid="reindex-btn"
          >
            {reindexing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {reindexing ? "Indexing..." : "Reindex All"}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Visibility Filter */}
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          <Button 
            variant={visibility === "all" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 gap-1.5 px-3" 
            onClick={() => { setVisibility("all"); setPage(1); }}
            data-testid="visibility-all-btn"
          >
            <Users className="w-4 h-4" />
            All
          </Button>
          <Button 
            variant={visibility === "public" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 gap-1.5 px-3" 
            onClick={() => { setVisibility("public"); setPage(1); }}
            data-testid="visibility-public-btn"
          >
            <Globe className="w-4 h-4" />
            Public
          </Button>
          <Button 
            variant={visibility === "private" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 gap-1.5 px-3" 
            onClick={() => { setVisibility("private"); setPage(1); }}
            data-testid="visibility-private-btn"
          >
            <Lock className="w-4 h-4" />
            My Files
          </Button>
        </div>

        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>

        {tagFilter && (
          <Badge variant="secondary" className="cursor-pointer gap-1 px-3 py-1.5" onClick={() => { setTagFilter(""); setPage(1); }} data-testid="active-tag-filter">
            Tag: {tagFilter} &times;
          </Badge>
        )}

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground" data-testid="file-count">{total} file{total !== 1 ? "s" : ""}</span>

        <div className="flex gap-1 border border-border rounded-md p-0.5">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("grid")} data-testid="grid-view-btn">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")} data-testid="list-view-btn">
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tag Chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.slice(0, 15).map((t) => (
            <Badge
              key={t.tag}
              variant={tagFilter === t.tag ? "default" : "outline"}
              className="cursor-pointer text-xs px-2.5 py-1 hover:bg-primary/10 transition-colors"
              onClick={() => { setTagFilter(tagFilter === t.tag ? "" : t.tag); setPage(1); }}
              data-testid={`library-tag-${t.tag}`}
            >
              {t.tag} ({t.count})
            </Badge>
          ))}
        </div>
      )}

      {/* Files Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No files found. Upload some files to get started!</p>
            <Button onClick={() => onNavigate("upload")} data-testid="upload-cta">Upload Files</Button>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" 
          ? "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2" 
          : "space-y-1 bg-white rounded-lg border border-gray-200 p-2"
        }>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              viewMode={viewMode}
              onView={handleView}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onEditTags={handleEditTags}
              onToggleVisibility={handleToggleVisibility}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Edit Tags Dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent data-testid="edit-tags-dialog">
          <DialogHeader>
            <DialogTitle>Edit Tags</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">{editingFile?.original_filename}</p>
          <Input
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="Enter tags separated by commas"
            data-testid="edit-tags-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>Cancel</Button>
            <Button onClick={saveTags} data-testid="save-tags-btn">Save Tags</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingFile} onOpenChange={() => setDeletingFile(null)}>
        <DialogContent data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Are you sure you want to delete <strong>{deletingFile?.original_filename}</strong>? This will also remove it from any projects and delete its embeddings. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="confirm-delete-btn">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Object Viewer Modal */}
      <ObjectViewer 
        file={previewFile} 
        open={!!previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>
  );
}
