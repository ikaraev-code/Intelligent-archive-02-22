import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { ArrowLeft, BookOpen, FileText, Sparkles } from "lucide-react";

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

export default function ArticlePage({ article, query, onNavigate }) {
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
      <Button variant="ghost" className="mb-6 gap-2 text-muted-foreground hover:text-foreground" onClick={() => onNavigate("search")} data-testid="back-to-search">
        <ArrowLeft className="w-4 h-4" /> Back to Search
      </Button>

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
      </article>
    </div>
  );
}
