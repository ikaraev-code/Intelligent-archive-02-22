import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2,
  FileText,
  Image,
  Music,
  Video,
  File,
  Loader2,
  ExternalLink
} from "lucide-react";
import { filesAPI } from "../lib/api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const typeIcons = {
  image: { icon: Image, color: "text-emerald-600", bg: "bg-emerald-50" },
  document: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  audio: { icon: Music, color: "text-purple-600", bg: "bg-purple-50" },
  video: { icon: Video, color: "text-orange-600", bg: "bg-orange-50" },
  other: { icon: File, color: "text-gray-600", bg: "bg-gray-50" },
};

// MS Office extensions that can be viewed via Office Online
const OFFICE_EXTENSIONS = ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];

// Check if file is an Office document
const isOfficeFile = (extension) => {
  return OFFICE_EXTENSIONS.includes(extension?.toLowerCase());
};

// Check if file is a PDF
const isPdfFile = (extension) => {
  return extension?.toLowerCase() === '.pdf';
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function ObjectViewer({ file: initialFile, open, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [file, setFile] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // State for blob-based PDF preview (moved here so it's available in useEffect)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  // Reset state and fetch full file data when file changes
  useEffect(() => {
    let currentBlobUrl = null;
    
    if (open && initialFile) {
      setZoom(1);
      setRotation(0);
      setLoading(true);
      setError(false);
      setPdfBlobUrl(null);
      
      // Fetch full file data if content_text might be needed
      const fetchFullFile = async () => {
        setLoadingFile(true);
        try {
          const res = await filesAPI.get(initialFile.id);
          setFile(res.data);
        } catch (err) {
          // If fetch fails, use the initial file data
          setFile(initialFile);
        } finally {
          setLoadingFile(false);
        }
      };
      
      // Only fetch if we might need content_text (for text files)
      const ext = initialFile.file_extension?.toLowerCase();
      if (ext && ['.txt', '.md', '.csv', '.json'].includes(ext)) {
        fetchFullFile();
      } else {
        setFile(initialFile);
      }
    }
    
    // Cleanup blob URL on unmount or when file changes
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile, open]);

  // Effect to fetch PDF blob when file is a PDF
  useEffect(() => {
    if (!file) return;
    const ext = file.file_extension?.toLowerCase();
    if (open && isPdfFile(ext) && !pdfBlobUrl) {
      const fetchPdf = async () => {
        try {
          const token = localStorage.getItem("archiva_token");
          const url = `${BACKEND_URL}/api/files/download/${file.id}?token=${token}&inline=true`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch PDF');
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(blobUrl);
          setLoading(false);
        } catch (err) {
          console.error('PDF fetch error:', err);
          setError(true);
          setLoading(false);
        }
      };
      fetchPdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.id, pdfBlobUrl]);

  if (!file) return null;

  const typeInfo = typeIcons[file.file_type] || typeIcons.other;
  const IconComponent = typeInfo.icon;
  const token = localStorage.getItem("archiva_token");
  
  // URL for downloading (forces download with attachment disposition)
  const downloadUrl = `${BACKEND_URL}/api/files/download/${file.id}?token=${token}`;
  
  // URL for inline preview (allows browser to display content)
  const previewUrl = `${BACKEND_URL}/api/files/download/${file.id}?token=${token}&inline=true`;
  
  // For Office Online viewer, we need the public URL
  const publicFileUrl = downloadUrl;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  // Download file using hidden iframe (most reliable cross-browser method)
  const handleDownload = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 5000);
  };

  const renderContent = () => {
    const ext = file.file_extension?.toLowerCase();

    // Image preview
    if (file.file_type === "image") {
      return (
        <div className="relative flex items-center justify-center w-full h-full overflow-auto bg-black/5 rounded-lg">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <img
            src={previewUrl}
            alt={file.original_filename}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            data-testid="viewer-image"
          />
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
              <IconComponent className={`w-16 h-16 ${typeInfo.color} mb-4`} />
              <p className="text-muted-foreground">Failed to load image</p>
            </div>
          )}
        </div>
      );
    }

    // PDF preview - use blob-based approach to avoid Chrome blocking
    if (isPdfFile(ext)) {
      return (
        <div className="relative w-full h-full min-h-[500px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
              <FileText className="w-16 h-16 text-blue-600 mb-4" />
              <p className="text-gray-700 mb-4">Unable to preview PDF</p>
              <button 
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          )}
          {pdfBlobUrl && (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-lg border-0"
              title={file.original_filename}
              data-testid="viewer-pdf"
            />
          )}
        </div>
      );
    }

    // MS Office preview using Office Online Viewer
    if (isOfficeFile(ext)) {
      // Office Online viewer requires a publicly accessible URL
      // For now, we'll show a fallback with download option
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-lg p-8">
          <div className={`w-20 h-20 rounded-xl ${typeInfo.bg} flex items-center justify-center mb-6`}>
            <IconComponent className={`w-10 h-10 ${typeInfo.color}`} />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-gray-900">{file.original_filename}</h3>
          <p className="text-gray-500 mb-1 text-sm">
            {ext === '.docx' || ext === '.doc' ? 'Microsoft Word Document' :
             ext === '.xlsx' || ext === '.xls' ? 'Microsoft Excel Spreadsheet' :
             ext === '.pptx' || ext === '.ppt' ? 'Microsoft PowerPoint Presentation' : 
             'Office Document'}
          </p>
          <p className="text-gray-500 mb-6 text-sm">{formatSize(file.file_size)}</p>
          
          <div className="flex gap-3">
            {/* Fetch-based download button */}
            <button 
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              data-testid="viewer-office-download"
            >
              <Download className="w-4 h-4" /> Download to View
            </button>
            {/* Open in Office Online (for publicly accessible files) */}
            <button 
              type="button"
              onClick={() => {
                const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicFileUrl)}`;
                window.open(officeViewerUrl, "_blank");
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              data-testid="viewer-office-online"
            >
              <ExternalLink className="w-4 h-4" /> Open in Office Online
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4 max-w-md text-center">
            Office Online viewer requires the file to be publicly accessible. 
            Download the file to view it locally.
          </p>
          {/* Debug: Direct link - if this works, the download URL is correct */}
          <p className="text-xs text-blue-500 mt-2">
            <a 
              href={downloadUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-700"
            >
              Direct link (open in new tab)
            </a>
          </p>
        </div>
      );
    }

    // Video preview
    if (file.file_type === "video") {
      return (
        <div className="relative w-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <video
            controls
            autoPlay={false}
            className="max-w-full max-h-[70vh] rounded-lg"
            onLoadedData={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            data-testid="viewer-video"
          >
            <source src={previewUrl} type={file.mime_type} />
            Your browser does not support video playback.
          </video>
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
              <Video className="w-16 h-16 text-orange-600 mb-4" />
              <p className="text-muted-foreground">Failed to load video</p>
            </div>
          )}
        </div>
      );
    }

    // Audio preview
    if (file.file_type === "audio") {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-8">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-8 shadow-lg">
            <Music className="w-16 h-16 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-center text-gray-900">{file.original_filename}</h3>
          <p className="text-gray-500 mb-6">{formatSize(file.file_size)}</p>
          <audio
            controls
            className="w-full max-w-md"
            onLoadedData={() => setLoading(false)}
            data-testid="viewer-audio"
          >
            <source src={previewUrl} type={file.mime_type} />
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    // Text/Document preview (for txt, md, csv files with content)
    if (file.content_text) {
      return (
        <div className="w-full h-full min-h-[400px] bg-white rounded-lg p-6 overflow-auto">
          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-gray-800" data-testid="viewer-text">
            {file.content_text}
          </pre>
        </div>
      );
    }

    // Default fallback for unsupported file types
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-lg p-8">
        <div className={`w-20 h-20 rounded-xl ${typeInfo.bg} flex items-center justify-center mb-6`}>
          <IconComponent className={`w-10 h-10 ${typeInfo.color}`} />
        </div>
        <h3 className="text-xl font-semibold mb-2 text-gray-900">{file.original_filename}</h3>
        <p className="text-gray-500 mb-6">{formatSize(file.file_size)}</p>
        <p className="text-sm text-gray-400 mb-4">Preview not available for this file type</p>
        <button 
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          data-testid="viewer-download-fallback"
        >
          <Download className="w-4 h-4" /> Download File
        </button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden"
        data-testid="object-viewer-dialog"
        aria-describedby="object-viewer-description"
        hideCloseButton={true}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          File Preview: {file.original_filename}
        </DialogTitle>
        <span id="object-viewer-description" className="sr-only">
          Viewing {file.file_type} file: {file.original_filename}
        </span>
        
        {/* Header - solid white background for visibility */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg ${typeInfo.bg} flex items-center justify-center flex-shrink-0`}>
              <IconComponent className={`w-5 h-5 ${typeInfo.color}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate text-sm text-gray-900" data-testid="viewer-filename">
                {file.original_filename}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{formatSize(file.file_size)}</span>
                <span>•</span>
                <span className="capitalize">{file.file_type}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Image-specific controls */}
            {file.file_type === "image" && (
              <>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 bg-white hover:bg-gray-100" 
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  data-testid="viewer-zoom-out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs w-12 text-center text-gray-700 font-medium">{Math.round(zoom * 100)}%</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 bg-white hover:bg-gray-100" 
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  data-testid="viewer-zoom-in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 bg-white hover:bg-gray-100" 
                  onClick={handleRotate}
                  data-testid="viewer-rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-2" />
              </>
            )}
            
            {/* Download button - test with handleDownload */}
            <Button 
              type="button"
              variant="default" 
              size="icon" 
              className="h-9 w-9 bg-blue-500 hover:bg-blue-600 text-white border-0" 
              onClick={handleDownload}
              data-testid="viewer-download"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button 
              type="button"
              variant="default" 
              size="icon" 
              className="h-9 w-9 ml-2 bg-red-500 hover:bg-red-600 text-white border-0" 
              onClick={onClose}
              data-testid="viewer-close"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto bg-gray-900 relative">
          {renderContent()}
          
          {/* Floating close button for mobile/touch */}
          <Button 
            variant="default"
            size="sm"
            className="fixed bottom-20 right-6 z-50 shadow-lg gap-2 md:hidden bg-red-500 hover:bg-red-600 text-white"
            onClick={onClose}
            data-testid="viewer-close-mobile"
          >
            <X className="w-4 h-4" /> Close
          </Button>
        </div>

        {/* Footer with tags and close button - solid white */}
        <div className="p-3 border-t bg-white flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {file.tags && file.tags.length > 0 && file.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs bg-gray-100 text-gray-700" data-testid={`viewer-tag-${tag}`}>
                {tag}
              </Badge>
            ))}
          </div>
          <Button 
            variant="default"
            size="sm"
            className="shrink-0 gap-2 bg-red-500 hover:bg-red-600 text-white"
            onClick={onClose}
            data-testid="viewer-close-footer"
          >
            <X className="w-4 h-4" /> Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
