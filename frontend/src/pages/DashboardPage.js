import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { filesAPI } from "../lib/api";
import { ObjectViewer } from "../components/ObjectViewer";
import { FileText, Image, Music, Video, HardDrive, Upload, Tags, TrendingUp, Loader2, Play, Brain, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

const typeConfig = {
  image: { icon: Image, color: "text-emerald-600", bg: "bg-emerald-50", label: "Images" },
  document: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50", label: "Documents" },
  audio: { icon: Music, color: "text-purple-600", bg: "bg-purple-50", label: "Audio" },
  video: { icon: Video, color: "text-orange-600", bg: "bg-orange-50", label: "Videos" },
};

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [embeddingStats, setEmbeddingStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadStats();
    loadEmbeddingStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await filesAPI.stats();
      setStats(res.data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmbeddingStats = async () => {
    try {
      const res = await filesAPI.embeddingStats();
      setEmbeddingStats(res.data);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const typeBreakdown = stats?.type_breakdown || {};

  return (
    <div className="space-y-8 fade-in" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground text-base">Overview of your multimedia archive</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border shadow-none hover:border-primary/30 transition-colors" data-testid="stat-total-files">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Files</p>
                <p className="text-3xl font-bold">{stats?.total_files || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none hover:border-primary/30 transition-colors" data-testid="stat-storage">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-3xl font-bold">{formatSize(stats?.total_size || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none hover:border-primary/30 transition-colors" data-testid="stat-tags">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                <Tags className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Tags</p>
                <p className="text-3xl font-bold">{stats?.top_tags?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onNavigate("upload")} data-testid="stat-upload-cta">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Upload className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quick Action</p>
                <p className="text-lg font-semibold text-primary">Upload Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Type Breakdown + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border shadow-none" data-testid="type-breakdown">
          <CardHeader>
            <CardTitle className="text-lg">File Types</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(typeBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No files uploaded yet. Start by uploading some files!</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(typeConfig).map(([type, config]) => {
                  const data = typeBreakdown[type];
                  if (!data) return null;
                  const Icon = config.icon;
                  return (
                    <div key={type} className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{config.label}</span>
                          <span className="text-sm text-muted-foreground">{data.count} files</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min((data.count / (stats?.total_files || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none" data-testid="top-tags">
          <CardHeader>
            <CardTitle className="text-lg">Popular Tags</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.top_tags?.length ? (
              <p className="text-sm text-muted-foreground py-4">Tags will appear here once you upload files.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.top_tags.map((t) => (
                  <Badge
                    key={t.tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors px-3 py-1.5"
                    onClick={() => onNavigate("search", { query: t.tag })}
                    data-testid={`dashboard-tag-${t.tag}`}
                  >
                    {t.tag}
                    <span className="ml-1.5 text-muted-foreground">({t.count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Files */}
      {stats?.recent_files?.length > 0 && (
        <Card className="border border-border shadow-none" data-testid="recent-files">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Uploads</CardTitle>
            <Button variant="ghost" className="text-sm text-primary" onClick={() => onNavigate("library")} data-testid="view-all-files">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_files.map((file) => {
                const tConfig = typeConfig[file.file_type] || { icon: FileText, color: "text-gray-600", bg: "bg-gray-50" };
                const Icon = tConfig.icon;
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" 
                    onClick={() => setPreviewFile(file)}
                    data-testid={`recent-file-${file.id}`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${tConfig.bg} flex items-center justify-center relative`}>
                      <Icon className={`w-4 h-4 ${tConfig.color}`} />
                      <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.original_filename}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.file_size)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {file.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Object Viewer Modal */}
      <ObjectViewer 
        file={previewFile} 
        open={!!previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>
  );
}
