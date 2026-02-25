import { useState } from "react";
import { Archive, LayoutDashboard, Upload, FolderOpen, Search, LogOut, Menu, X, MessageSquare, FolderKanban, BookOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

export function Sidebar({ currentPage, onNavigate, onLogout, user }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "library", label: "Library", icon: FolderOpen },
    { id: "search", label: "Search", icon: Search },
    { id: "ai-chat", label: "AI Archivist", icon: MessageSquare },
    { id: "projects", label: "Projects", icon: FolderKanban },
  ];

  const handleNav = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const renderSidebarContent = (prefix) => (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Archive className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" data-testid={`${prefix}-sidebar-title`}>Archiva</h1>
        </div>
        <p className="text-xs text-muted-foreground ml-12">Multimedia Archive</p>
      </div>

      <Separator />

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={currentPage === item.id ? "secondary" : "ghost"}
            className={`w-full justify-start gap-3 h-10 font-medium transition-all ${
              currentPage === item.id
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleNav(item.id)}
            data-testid={`${prefix}-nav-${item.id}`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid={`${prefix}-user-name`}>{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={onLogout} data-testid={`${prefix}-logout-button`}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-border flex items-center px-4 z-40" data-testid="mobile-header">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Archive className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base">Archiva</span>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} data-testid="mobile-overlay" />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-screen w-72 bg-[#F8FAFC] border-r border-border flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="mobile-sidebar"
      >
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)} data-testid="close-mobile-menu">
            <X className="w-5 h-5" />
          </Button>
        </div>
        {renderSidebarContent("mobile")}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-[#F8FAFC] border-r border-border flex-col fixed left-0 top-0 z-30" data-testid="desktop-sidebar">
        {renderSidebarContent("desktop")}
      </aside>
    </>
  );
}
