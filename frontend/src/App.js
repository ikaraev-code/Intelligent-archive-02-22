import { useState, useEffect } from "react";
import "@/App.css";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import LibraryPage from "./pages/LibraryPage";
import SearchPage from "./pages/SearchPage";
import ArticlePage from "./pages/ArticlePage";
import FileDetailPage from "./pages/FileDetailPage";
import AIChatPage from "./pages/AIChatPage";
import ProjectsPage from "./pages/ProjectsPage";
import StoriesPage from "./pages/StoriesPage";
import { Sidebar } from "./components/Sidebar";
import { InstallPrompt } from "./components/InstallPrompt";
import { Toaster } from "./components/ui/sonner";
import { authAPI } from "./lib/api";

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.log('SW registration failed:', err));
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [pageData, setPageData] = useState({});
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("archiva_token");
    const storedUser = localStorage.getItem("archiva_user");
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("archiva_token");
        localStorage.removeItem("archiva_user");
      }
    }
    setAuthChecked(true);
  }, []);

  const handleAuth = (userData) => {
    setUser(userData);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("archiva_token");
    localStorage.removeItem("archiva_user");
    setUser(null);
    setCurrentPage("dashboard");
    setPageData({});
  };

  const handleNavigate = (page, data = {}) => {
    if (page === currentPage) {
      data._resetKey = Date.now();
    }
    setCurrentPage(page);
    setPageData(data);
    window.scrollTo(0, 0);
  };

  if (!authChecked) return null;

  if (!user) {
    return (
      <>
        <AuthPage onAuth={handleAuth} />
        <InstallPrompt />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={handleNavigate} />;
      case "upload":
        return <UploadPage />;
      case "library":
        return <LibraryPage onNavigate={handleNavigate} initialTag={pageData.tag} />;
      case "search":
        return <SearchPage onNavigate={handleNavigate} initialQuery={pageData.query} />;
      case "article":
        return <ArticlePage article={pageData.article} query={pageData.query} fileIds={pageData.fileIds} onNavigate={handleNavigate} />;
      case "file-detail":
        return <FileDetailPage fileId={pageData.fileId} onNavigate={handleNavigate} />;
      case "ai-chat":
        return <AIChatPage />;
      case "projects":
        return <ProjectsPage key={pageData._resetKey || 'projects'} />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background" data-testid="app-container">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      />
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 p-4 md:p-8 max-w-7xl">
        {renderPage()}
      </main>
      <InstallPrompt />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
