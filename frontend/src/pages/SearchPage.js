import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { FileCard } from "../components/FileCard";
import { ObjectViewer } from "../components/ObjectViewer";
import { filesAPI } from "../lib/api";
import { Search, Loader2, Sparkles, Brain, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SearchPage({ onNavigate, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileType, setFileType] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [smartSearch, setSmartSearch] = useState(true);
  const [searchInfo, setSearchInfo] = useState(null);

  useEffect(() => {
    loadTags();
    if (initialQuery) handleSearch();
  }, []);

  const loadTags = async () => {
    try {
      const res = await filesAPI.tags();
      setAllTags(res.data);
    } catch (err) { /* ignore */ }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSelectedIds([]);
    setSearchInfo(null);
    try {
      const searchFn = smartSearch ? filesAPI.smartSearch : filesAPI.search;
      const res = await searchFn({ q: query, file_type: fileType !== "all" ? fileType : undefined });
      setResults(res.data.files || []);
      setTotal(res.data.total || 0);
      if (smartSearch) {
        setSearchInfo({
          searchType: res.data.search_type,
          semanticEnabled: res.data.semantic_enabled
        });
      }
    } catch (err) {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const selectAll = () => {
    if (selectedIds.length === results.length) setSelectedIds([]);
    else setSelectedIds(results.map((f) => f.id));
  };

  const handleSummarize = async () => {
    if (selectedIds.length === 0) { toast.error("Select files to summarize"); return; }
    setSummarizing(true);
    try {
      const res = await filesAPI.summarize({ file_ids: selectedIds, query });
      onNavigate("article", { article: res.data, query, fileIds: selectedIds });
    } catch (err) {
      toast.error("Summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const handleView = (file) => onNavigate("file-detail", { fileId: file.id });
  const handlePreview = (file) => setPreviewFile(file);
  const handleDownload = (file) => {
    // Use hidden iframe to trigger download
    const url = filesAPI.downloadUrl(file.id);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 5000);
  };

  const getMatchTypeBadge = (file) => {
    if (!file._search_info) return null;
    const { match_types, score } = file._search_info;
    if (match_types.includes("keyword") && match_types.includes("semantic")) {
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200 text-xs">Keyword + Semantic</Badge>;
    } else if (match_types.includes("semantic")) {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">Semantic Match</Badge>;
    } else if (match_types.includes("keyword")) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">Keyword Match</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-6 fade-in" data-testid="search-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Search Archive</h1>
        <p className="text-muted-foreground text-base">Find files by tags, content, or filename. Summarize results with AI.</p>
      </div>

      <form onSubmit={handleSearch} className="space-y-3" data-testid="search-form">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by tags, content, or filename..." className="pl-10 h-11" data-testid="search-input" />
          </div>
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="w-36 h-11" data-testid="search-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="h-11 px-6" disabled={loading} data-testid="search-submit-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        
        {/* Smart Search Toggle */}
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Smart Search</span>
          </div>
          <Switch 
            checked={smartSearch} 
            onCheckedChange={setSmartSearch}
            data-testid="smart-search-toggle"
          />
          <span className="text-xs text-muted-foreground flex-1">
            {smartSearch 
              ? "Combines keywords + semantic AI understanding for better results" 
              : "Traditional keyword-only search"}
          </span>
          {smartSearch && <Zap className="w-4 h-4 text-yellow-500" />}
        </div>
      </form>

      {allTags.length > 0 && !results.length && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Popular tags:</p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.slice(0, 20).map((t) => (
              <Badge key={t.tag} variant="outline" className="cursor-pointer text-xs px-2.5 py-1 hover:bg-primary/10 transition-colors" onClick={() => setQuery(t.tag)} data-testid={`search-tag-${t.tag}`}>
                {t.tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" data-testid="search-results-count">{total} result{total !== 1 ? "s" : ""}</span>
              {searchInfo && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Brain className="w-3 h-3" />
                  Smart Search
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={selectAll} data-testid="select-all-btn">
                {selectedIds.length === results.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <Button onClick={handleSummarize} disabled={selectedIds.length === 0 || summarizing} className="gap-2" data-testid="summarize-btn">
              {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Summarize {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {results.map((file) => (
              <div key={file.id} className="relative">
                <div className="absolute top-0.5 left-0.5 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.includes(file.id)} 
                    onCheckedChange={() => toggleSelect(file.id)} 
                    className="h-4 w-4 bg-white/90 border-gray-400 shadow-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                    data-testid={`select-file-${file.id}`} 
                  />
                </div>
                <div className={`rounded-md transition-all ${selectedIds.includes(file.id) ? "ring-2 ring-primary" : ""}`}>
                  <FileCard file={file} onView={handleView} onPreview={handlePreview} onDelete={() => {}} onDownload={handleDownload} onEditTags={() => {}} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && query && (
        <Card className="border border-border shadow-none">
          <CardContent className="p-12 text-center">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">No results found</p>
            <p className="text-sm text-muted-foreground">Try different keywords or tags</p>
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
