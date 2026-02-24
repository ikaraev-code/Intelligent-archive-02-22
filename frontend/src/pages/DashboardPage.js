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

function DonutChart({ completed, failed, pending, skipped, total }) {
  const size = 100;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const pctCompleted = total > 0 ? completed / total : 0;
  const pctFailed = total > 0 ? failed / total : 0;
  const pctPending = total > 0 ? pending / total : 0;
  const pctSkipped = total > 0 ? skipped / total : 0;
  
  const segments = [
    { pct: pctCompleted, color: "#22c55e" },
    { pct: pctFailed, color: "#ef4444" },
    { pct: pctPending, color: "#f59e0b" },
    { pct: pctSkipped, color: "#d1d5db" },
  ];
  
  let offset = 0;
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const dashLength = seg.pct * circumference;
        const dashOffset = -offset * circumference;
        offset += seg.pct;
        if (seg.pct === 0) return null;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        );
      })}
    </svg>
  );
}

function EmbeddingHealthWidget({ stats, embeddingStatus, onNavigate }) {
  const { total, completed, failed, pending, processing, skipped, none } = stats;
  const totalPending = pending + processing;
  const totalSkipped = skipped + (none || 0);
  const healthPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  let statusColor = "text-green-600";
  let statusBg = "bg-green-50 border-green-100";
  let statusLabel = "Fully Indexed";
  let statusIcon = <CheckCircle2 className="w-4 h-4" />;
  
  if (healthPct < 50) {
    statusColor = "text-red-600";
    statusBg = "bg-red-50 border-red-100";
    statusLabel = "Needs Attention";
    statusIcon = <AlertCircle className="w-4 h-4" />;
  } else if (healthPct < 100) {
    statusColor = "text-amber-600";
    statusBg = "bg-amber-50 border-amber-100";
    statusLabel = failed > 0 ? `${failed} Failed` : "In Progress";
    statusIcon = failed > 0 ? <AlertCircle className="w-4 h-4" /> : <Brain className="w-4 h-4" />;
  }
  
  return (
    <Card className="border border-border shadow-none overflow-hidden" data-testid="embedding-health">
      <CardContent className="p-5">
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative flex-shrink-0">
            <DonutChart completed={completed} failed={failed} pending={totalPending} skipped={totalSkipped} total={total} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{healthPct}%</span>
              <span className="text-[10px] text-muted-foreground">indexed</span>
            </div>
          </div>
          
          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  Smart Search Health
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{completed} of {total} files ready for AI search</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusBg} ${statusColor}`}>
                {statusIcon}
                {statusLabel}
              </span>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Indexed: {completed}
              </span>
              {failed > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Failed: {failed}
                </span>
              )}
              {totalPending > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending: {totalPending}
                </span>
              )}
              {totalSkipped > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-300" /> Skipped: {totalSkipped}
                </span>
              )}
            </div>
            
            {/* Action link if issues exist */}
            {(failed > 0 || totalPending > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2 -ml-2"
                onClick={() => onNavigate("library")}
                data-testid="embedding-health-action"
              >
                {failed > 0 ? "Fix in Library" : "View progress"} <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [embeddingStats, setEmbeddingStats] = useState(null);
  const [embeddingStatus, setEmbeddingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadStats();
    loadEmbeddingStats();
    loadEmbeddingStatus();
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

  const loadEmbeddingStatus = async () => {
    try {
      const res = await filesAPI.embeddingStatus();
      setEmbeddingStatus(res.data);
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

      {/* Embedding Health */}
      {embeddingStats && embeddingStats.total > 0 && (
        <EmbeddingHealthWidget stats={embeddingStats} embeddingStatus={embeddingStatus} onNavigate={onNavigate} />
      )}
      {embeddingStatus && embeddingStatus.status === "disabled" && (
        <Card className="border border-red-200 shadow-none bg-red-50/50" data-testid="embedding-disabled-warning">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-800">AI Search Unavailable</h3>
              <p className="text-xs text-red-600 mt-0.5">OpenAI API key is not configured. File embeddings, semantic search, and AI chat will not work. Please check your environment configuration.</p>
            </div>
          </CardContent>
        </Card>
      )}

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
