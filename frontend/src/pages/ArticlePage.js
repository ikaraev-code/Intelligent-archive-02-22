import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { ArrowLeft, BookOpen, FileText, Sparkles, FolderPlus, Loader2, Check, FolderOpen, Plus } from "lucide-react";
import { projectsAPI } from "../lib/api";
import { toast } from "sonner";

function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/### (.*?)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
    .replace(/## (.*?)$/gm, '<h2 class="text-2xl font-semibold mt-8 mb-4">$1</h2>')
    .replace(/# (.*?)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '<li class="ml-4 mb-1">$1</li>')
    .replace(/(<li.*<\/li>)/s, '<ul class="list-disc pl-4 my-4">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mb-4 leading-relaxed">')
    .replace(/\n/g, '<br/>');
  return `<p class="mb-4 leading-relaxed">${html}</p>`;
}

function buildSummaryText(article, query) {
  const parts = [];
  if (query) parts.push(`Search query: "${query}"\n`);
  if (article.key_points?.length > 0) {
    parts.push("Key Points:");
    article.key_points.forEach((p, i) => parts.push(`${i + 1}. ${p}`));
    parts.push("");
  }
  if (article.content) parts.push(article.content);
  if (article.sources?.length > 0) {
    parts.push(`\nSources: ${article.sources.join(", ")}`);
  }
  return parts.join("\n");
}

export default function ArticlePage({ article, query, fileIds, onNavigate }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogTab, setDialogTab] = useState("new");
  const [projectName, setProjectName] = useState("");

  // Existing projects state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const openSaveDialog = () => {
    setProjectName(article?.title || "Search Summary");
    setDialogTab("new");
    setSelectedProjectId(null);
    setShowDialog(true);
    loadProjects();
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await projectsAPI.list();
      setProjects(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    setSaving(true);
    try {
      const summaryText = buildSummaryText(article, query);
      await projectsAPI.create({
        name: projectName.trim(),
        description: query ? `Summary from search: "${query}"` : "AI-generated summary",
        file_ids: fileIds || [],
        summary: summaryText,
      });
      setSaved(true);
      setShowDialog(false);
      toast.success("Project created with summary!");
    } catch (err) {
      toast.error("Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleAppendToExisting = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    setSaving(true);
    try {
      const summaryText = buildSummaryText(article, query);
      const res = await projectsAPI.append(selectedProjectId, {
        file_ids: fileIds || [],
        summary: summaryText,
      });
      const added = res.data.files_added || 0;
      setSaved(true);
      setShowDialog(false);
      toast.success(`Added ${added} new file${added !== 1 ? "s" : ""} and summary to project!`);
    } catch (err) {
      toast.error("Failed to add to project");
    } finally {
      setSaving(false);
    }
  };

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No article to display. Go to Search and summarize some files.</p>
        <Button className="mt-4" onClick={() => onNavigate("search")} data-testid="go-to-search-btn">Go to Search</Button>
      </div>
    );
  }

  return (
    <div className="fade-in" data-testid="article-page">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => onNavigate("search")} data-testid="back-to-search">
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Button>

        {saved ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 py-1 px-3">
              <Check className="w-3.5 h-3.5" /> Saved
            </Badge>
            <Button onClick={() => onNavigate("projects")} className="gap-2" data-testid="go-to-project-btn">
              <FolderPlus className="w-4 h-4" /> Open Projects
            </Button>
          </div>
        ) : (
          <Button onClick={openSaveDialog} className="gap-2" data-testid="save-as-project-btn">
            <FolderPlus className="w-4 h-4" /> Save to Project
          </Button>
        )}
      </div>

      <article className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-accent font-medium uppercase tracking-wider">AI-Generated Summary</span>
          </div>
          <h1 className="font-article text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4" data-testid="article-title">
            {article.title}
          </h1>
          {query && (
            <p className="text-muted-foreground text-base">
              Based on search: <span className="text-foreground font-medium">"{query}"</span>
            </p>
          )}
          {fileIds?.length > 0 && (
            <p className="text-muted-foreground text-sm mt-1">
              {fileIds.length} file{fileIds.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {article.key_points?.length > 0 && (
          <Card className="border border-border shadow-none mb-8 bg-[#FAFAF9]" data-testid="key-points">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Key Points
              </h3>
              <ul className="space-y-2">
                {article.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs font-medium">
                      {i + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div
          className="font-article text-lg leading-relaxed text-[#333333] prose-headings:font-sans"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          data-testid="article-content"
        />

        {article.sources?.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border" data-testid="article-sources">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sources</h3>
            <div className="flex flex-wrap gap-2">
              {article.sources.map((source, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5">
                  <FileText className="w-3 h-3" /> {source}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Save CTA */}
        {!saved && fileIds?.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <Card className="border-dashed border-2 border-primary/20 bg-primary/5 shadow-none" data-testid="save-project-cta">
              <CardContent className="p-6 text-center">
                <FolderPlus className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Save this research</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Save the {fileIds.length} selected file{fileIds.length !== 1 ? "s" : ""} and this summary to a new or existing project.
                </p>
                <Button onClick={openSaveDialog} className="gap-2" data-testid="save-as-project-bottom-btn">
                  <FolderPlus className="w-4 h-4" /> Save to Project
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {saved && (
          <div className="mt-12 pt-8 border-t border-border">
            <Card className="border border-green-200 bg-green-50 shadow-none" data-testid="saved-confirmation">
              <CardContent className="p-6 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-1">Saved to project!</h3>
                <p className="text-sm text-green-700 mb-4">
                  Your files and summary have been saved. Continue your research anytime from Projects.
                </p>
                <Button onClick={() => onNavigate("projects")} className="gap-2" data-testid="open-projects-btn">
                  <FolderPlus className="w-4 h-4" /> Open Projects
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </article>

      {/* Save to Project Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md !max-h-[80vh] flex flex-col" data-testid="save-project-dialog">
          <DialogHeader>
            <DialogTitle>Save to Project</DialogTitle>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab} className="w-full flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
              <TabsTrigger value="new" data-testid="tab-new-project">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Project
              </TabsTrigger>
              <TabsTrigger value="existing" data-testid="tab-existing-project">
                <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Existing Project
              </TabsTrigger>
            </TabsList>

            {/* New Project Tab */}
            <TabsContent value="new" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Project Name</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name..."
                  data-testid="project-name-input"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAsNew()}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">What will be saved:</p>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>{fileIds?.length || 0} file{(fileIds?.length || 0) !== 1 ? "s" : ""} from your search</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>AI summary with key points</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveAsNew} disabled={saving} className="gap-2" data-testid="confirm-save-project-btn">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  Create Project
                </Button>
              </div>
            </TabsContent>

            {/* Existing Project Tab */}
            <TabsContent value="existing" className="space-y-4">
              {loadingProjects ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-6">
                  <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No projects yet. Create one first.</p>
                  <Button variant="outline" size="sm" onClick={() => setDialogTab("new")}>
                    Create New Project
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Select a project</label>
                    <ScrollArea className="h-[160px] border rounded-md bg-white">
                      <div className="p-1 space-y-0.5">
                        {projects.map((p) => (
                          <div
                            key={p.id}
                            className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-all ${
                              selectedProjectId === p.id
                                ? "bg-primary/10 border border-primary/30"
                                : "hover:bg-muted border border-transparent"
                            }`}
                            onClick={() => setSelectedProjectId(p.id)}
                            data-testid={`select-project-${p.id}`}
                          >
                            <FolderOpen className={`w-4 h-4 flex-shrink-0 ${selectedProjectId === p.id ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.file_count} file{p.file_count !== 1 ? "s" : ""} &middot; {p.message_count} msg{p.message_count !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {selectedProjectId === p.id && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">What will be added:</p>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>{fileIds?.length || 0} file{(fileIds?.length || 0) !== 1 ? "s" : ""} (duplicates skipped)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>New summary appended to chat</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                    <Button
                      onClick={handleAppendToExisting}
                      disabled={saving || !selectedProjectId}
                      className="gap-2"
                      data-testid="confirm-append-project-btn"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add to Project
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
