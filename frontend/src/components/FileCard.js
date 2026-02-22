import { useState } from "react";
import { FileText, Image, Music, Video, File, MoreVertical, Download, Trash2, Tags, Eye, Play, Globe, Lock } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { filesAPI } from "../lib/api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

const typeIcons = {
  image: { icon: Image, color: "text-emerald-600", bg: "bg-emerald-50", gradient: "from-emerald-500 to-teal-500" },
  document: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50", gradient: "from-blue-500 to-indigo-500" },
  audio: { icon: Music, color: "text-purple-600", bg: "bg-purple-50", gradient: "from-purple-500 to-pink-500" },
  video: { icon: Video, color: "text-orange-600", bg: "bg-orange-50", gradient: "from-orange-500 to-red-500" },
  other: { icon: File, color: "text-gray-600", bg: "bg-gray-50", gradient: "from-gray-500 to-slate-500" },
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Thumbnail component that shows image preview or icon
function FileThumbnail({ file, size = "md" }) {
  const [imgError, setImgError] = useState(false);
  const typeInfo = typeIcons[file.file_type] || typeIcons.other;
  const IconComponent = typeInfo.icon;
  const token = localStorage.getItem("archiva_token");
  
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-full h-full",
    lg: "w-16 h-16"
  };

  // For images, show actual thumbnail
  if (file.file_type === "image" && !imgError) {
    const thumbUrl = `${BACKEND_URL}/api/files/download/${file.id}?token=${token}&inline=true`;
    return (
      <img
        src={thumbUrl}
        alt={file.original_filename}
        className={`${sizeClasses[size]} object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  // For other types, show gradient background with icon
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center`}>
      <IconComponent className="w-1/3 h-1/3 text-white/90" />
    </div>
  );
}

// Grid view card - compact tile with hover overlay
function GridCard({ file, onView, onPreview, onDelete, onDownload, onEditTags, onToggleVisibility, currentUserId }) {
  const [isHovered, setIsHovered] = useState(false);
  const typeInfo = typeIcons[file.file_type] || typeIcons.other;
  const IconComponent = typeInfo.icon;
  const downloadUrl = filesAPI.downloadUrl(file.id);
  const isOwner = file.user_id === currentUserId;
  const isPublic = file.is_public;

  return (
    <div
      className="group relative aspect-square rounded-md overflow-hidden cursor-pointer bg-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`file-card-${file.id}`}
      onClick={() => onPreview ? onPreview(file) : onView(file)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <FileThumbnail file={file} size="md" />
      
      {/* File type badge - always visible, smaller */}
      <div className="absolute top-1 left-1 flex gap-0.5">
        <div className={`w-5 h-5 rounded ${typeInfo.bg} flex items-center justify-center shadow-sm`}>
          <IconComponent className={`w-3 h-3 ${typeInfo.color}`} />
        </div>
        {/* Public indicator */}
        {isPublic && (
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center shadow-sm" title="Public">
            <Globe className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Menu button - always accessible, smaller */}
      <div className="absolute top-1 right-1 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-5 w-5 bg-white/90 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`file-menu-${file.id}`}
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(file); }} data-testid={`file-preview-${file.id}`}>
                <Play className="w-4 h-4 mr-2" /> Quick Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(file); }} data-testid={`file-view-${file.id}`}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { 
                e.stopPropagation(); 
                window.location.href = downloadUrl;
              }} 
              data-testid={`file-download-${file.id}`}
            >
              <Download className="w-4 h-4 mr-2" /> Download
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditTags(file); }} data-testid={`file-edit-tags-${file.id}`}>
                  <Tags className="w-4 h-4 mr-2" /> Edit Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleVisibility && onToggleVisibility(file); }} data-testid={`file-toggle-visibility-${file.id}`}>
                  {isPublic ? <Lock className="w-4 h-4 mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                  {isPublic ? "Make Private" : "Make Public"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(file); }} data-testid={`file-delete-${file.id}`}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hover overlay with file info */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-1.5 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <h3 className="font-medium text-[10px] text-white truncate leading-tight" title={file.original_filename}>
          {file.original_filename}
        </h3>
        <p className="text-[9px] text-white/70">
          {formatSize(file.file_size)}
          {!isOwner && file.owner_name && ` · by ${file.owner_name}`}
        </p>
      </div>

      {/* Bottom filename strip - visible when not hovered, smaller */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 transition-opacity duration-200 ${isHovered ? 'opacity-0' : 'opacity-100'}`}
      >
        <p className="text-[9px] text-white truncate leading-tight">{file.original_filename}</p>
      </div>
    </div>
  );
}

// List view card - compact horizontal row
function ListCard({ file, onView, onPreview, onDelete, onDownload, onEditTags, onToggleVisibility, currentUserId }) {
  const typeInfo = typeIcons[file.file_type] || typeIcons.other;
  const IconComponent = typeInfo.icon;
  const downloadUrl = filesAPI.downloadUrl(file.id);
  const isOwner = file.user_id === currentUserId;
  const isPublic = file.is_public;

  return (
    <div
      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
      data-testid={`file-card-${file.id}`}
      onClick={() => onPreview ? onPreview(file) : onView(file)}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
        <FileThumbnail file={file} size="md" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm truncate" title={file.original_filename} data-testid={`file-name-${file.id}`}>
            {file.original_filename}
          </h3>
          {isPublic && (
            <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Public" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconComponent className={`w-3 h-3 ${typeInfo.color}`} />
            {file.file_type}
          </span>
          <span>·</span>
          <span>{formatSize(file.file_size)}</span>
          <span>·</span>
          <span>{formatDate(file.upload_date)}</span>
          {!isOwner && file.owner_name && (
            <>
              <span>·</span>
              <span>by {file.owner_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="hidden md:flex items-center gap-1 flex-shrink-0 max-w-[200px]">
        {file.tags && file.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs font-normal px-1.5 py-0">
            {tag}
          </Badge>
        ))}
        {file.tags && file.tags.length > 2 && (
          <span className="text-xs text-muted-foreground">+{file.tags.length - 2}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); window.location.href = downloadUrl; }}
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`file-menu-${file.id}`}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(file); }} data-testid={`file-preview-${file.id}`}>
                <Play className="w-4 h-4 mr-2" /> Quick Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(file); }} data-testid={`file-view-${file.id}`}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isOwner && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditTags(file); }} data-testid={`file-edit-tags-${file.id}`}>
                  <Tags className="w-4 h-4 mr-2" /> Edit Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleVisibility && onToggleVisibility(file); }} data-testid={`file-toggle-visibility-${file.id}`}>
                  {isPublic ? <Lock className="w-4 h-4 mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                  {isPublic ? "Make Private" : "Make Public"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(file); }} data-testid={`file-delete-${file.id}`}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Main FileCard component that switches between views
export function FileCard({ file, viewMode = "grid", onView, onPreview, onDelete, onDownload, onEditTags, onToggleVisibility, currentUserId }) {
  if (viewMode === "list") {
    return <ListCard file={file} onView={onView} onPreview={onPreview} onDelete={onDelete} onDownload={onDownload} onEditTags={onEditTags} onToggleVisibility={onToggleVisibility} currentUserId={currentUserId} />;
  }
  return <GridCard file={file} onView={onView} onPreview={onPreview} onDelete={onDelete} onDownload={onDownload} onEditTags={onEditTags} onToggleVisibility={onToggleVisibility} currentUserId={currentUserId} />;
}
