import { useState } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ArrowLeft, BookOpen, FileText, Sparkles, FolderPlus, Loader2, Check } from "lucide-react";
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

export default function ArticlePage({ article, query, fileIds, onNavigate }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [projectName, setProjectName] = useState(article?.title || "");

  const handleSaveAsProject = async () => {
    if (!showNameInput) {
      setProjectName(article?.title || "Search Summary");
      setShowNameInput(true);
      return;
    }

    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    setSaving(true);
    try {
      const description = [
        query ? `Search query: "${query}"` : "",
        "",
        article.key_points?.length > 0
          ? "Key Points:\n" + article.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")
          : "",
        "",
        article.content || "",
      ].filter(Boolean).join("\n");

      const res = await projectsAPI.create({
        name: projectName.trim(),
        description,
        file_ids: fileIds || [],
      });

      setSaved(true);
      setSavedProjectId(res.data.id);
      setShowNameInput(false);
      toast.success("Project created successfully!");
    } catch (err) {
      toast.error("Failed to save project");
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

        <div className="flex items-center gap-2">
          {showNameInput && !saved && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name..."
                className="h-9 w-64"
                data-testid="project-name-input"
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsProject()}
                autoFocus
              />
            </div>
          )}
          {saved ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2 text-green-600 border-green-200 bg-green-50" disabled data-testid="saved-indicator">
                <Check className="w-4 h-4" /> Saved
              </Button>
              <Button className="gap-2" onClick={() => onNavigate("projects")} data-testid="go-to-project-btn">
                <FolderPlus className="w-4 h-4" /> Open Projects
              </Button>
            </div>
          ) : (
            <Button onClick={handleSaveAsProject} disabled={saving} className="gap-2" data-testid="save-as-project-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {showNameInput ? "Save" : "Save as Project"}
            </Button>
          )}
        </div>
      </div>

      <article className="max-w-2xl mx-auto">
        {/* Header */}
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

        {/* Key Points */}
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

        {/* Content */}
        <div
          className="font-article text-lg leading-relaxed text-[#333333] prose-headings:font-sans"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          data-testid="article-content"
        />

        {/* Sources */}
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
                  Save the {fileIds.length} selected file{fileIds.length !== 1 ? "s" : ""} and this summary as a project so you don't lose it.
                </p>
                <Button onClick={handleSaveAsProject} disabled={saving} className="gap-2" data-testid="save-as-project-bottom-btn">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  {showNameInput ? "Save" : "Save as Project"}
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
                <h3 className="font-semibold text-green-800 mb-1">Project saved!</h3>
                <p className="text-sm text-green-700 mb-4">
                  Your files and summary have been saved. You can continue your research anytime from Projects.
                </p>
                <Button onClick={() => onNavigate("projects")} className="gap-2" data-testid="open-projects-btn">
                  <FolderPlus className="w-4 h-4" /> Open Projects
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </article>
    </div>
  );
}
