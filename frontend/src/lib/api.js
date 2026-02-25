import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("archiva_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("archiva_token");
      localStorage.removeItem("archiva_user");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// Files
export const filesAPI = {
  upload: (formData) => api.post("/files/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  list: (params) => api.get("/files", { params }),
  get: (id) => api.get(`/files/${id}`),
  delete: (id) => api.delete(`/files/${id}`),
  updateTags: (id, tags) => api.put(`/files/${id}/tags`, { tags }),
  updateVisibility: (id, isPublic) => api.put(`/files/${id}/visibility`, { is_public: isPublic }),
  search: (params) => api.get("/files/search", { params }),
  smartSearch: (params) => api.get("/files/smart-search", { params }),
  embeddingStatus: () => api.get("/files/embedding-status"),
  embeddingStats: () => api.get("/files/embedding-stats"),
  batchStatus: (ids) => api.get("/files/batch-status", { params: { ids: ids.join(",") } }),
  retryEmbedding: (id) => api.post(`/files/${id}/retry-embedding`),
  reindex: (filter = "all") => api.post(`/files/reindex?filter=${filter}`),
  reindexProgress: (taskId) => api.get(`/files/reindex-progress/${taskId}`),
  stats: () => api.get("/files/stats"),
  tags: () => api.get("/files/tags"),
  summarize: (data) => api.post("/files/summarize", data),
  downloadUrl: (id) => {
    const token = localStorage.getItem("archiva_token");
    return `${API_BASE}/files/download/${id}?token=${token}`;
  },
};

// AI Archivist
export const chatAPI = {
  send: (message, sessionId = null, includeFileContext = true, priorityFileIds = null) => 
    api.post("/chat", { message, session_id: sessionId, include_file_context: includeFileContext, priority_file_ids: priorityFileIds }),
  getSession: (sessionId) => api.get("/chat/sessions", { params: { session_id: sessionId } }),
  clearSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
  speechToText: (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    return api.post("/chat/speech-to-text", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  textToSpeech: (text, voice = "nova", speed = 1.0) => 
    api.post("/chat/text-to-speech", { text, voice, speed }),
};

// Projects
export const projectsAPI = {
  create: (data) => api.post("/projects", data),
  list: () => api.get("/projects"),
  get: (id) => api.get(`/projects/${id}`),
  update: (id, data) => api.put(`/projects/${id}`, data),
  append: (id, data) => api.post(`/projects/${id}/append`, data),
  exportPdf: (id) => `${BACKEND_URL}/api/projects/${id}/export-pdf`,
  delete: (id) => api.delete(`/projects/${id}`),
  getMessages: (id) => api.get(`/projects/${id}/messages`),
  chat: (id, message, includeFileContext = true) => 
    api.post(`/projects/${id}/chat`, { message, include_file_context: includeFileContext }),
};

// Stories
export const storiesAPI = {
  create: (data) => api.post("/stories", data),
  list: () => api.get("/stories"),
  get: (id) => api.get(`/stories/${id}`),
  update: (id, data) => api.put(`/stories/${id}`, data),
  delete: (id) => api.delete(`/stories/${id}`),
  createChapter: (storyId, data) => api.post(`/stories/${storyId}/chapters`, data),
  getChapter: (storyId, chapterId) => api.get(`/stories/${storyId}/chapters/${chapterId}`),
  updateChapter: (storyId, chapterId, data) => api.put(`/stories/${storyId}/chapters/${chapterId}`, data),
  deleteChapter: (storyId, chapterId) => api.delete(`/stories/${storyId}/chapters/${chapterId}`),
  reorderChapters: (storyId, chapterIds) => api.put(`/stories/${storyId}/chapters/reorder`, { chapter_ids: chapterIds }),
  uploadMedia: (storyId, chapterId, formData) => 
    api.post(`/stories/${storyId}/chapters/${chapterId}/media`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  importFile: (storyId, chapterId, fileId) => 
    api.post(`/stories/${storyId}/chapters/${chapterId}/import-file?file_id=${fileId}`),
  updateBlock: (storyId, chapterId, blockIndex, block) =>
    api.put(`/stories/${storyId}/chapters/${chapterId}/blocks/${blockIndex}`, block),
  deleteBlock: (storyId, chapterId, blockIndex) =>
    api.delete(`/stories/${storyId}/chapters/${chapterId}/blocks/${blockIndex}`),
  appendContentBlock: (storyId, chapterId, block) =>
    api.post(`/stories/${storyId}/chapters/${chapterId}/append-blocks`, { blocks: [block] }),
  getLanguages: () => api.get("/stories/languages"),
  translate: (storyId, targetLanguage) =>
    api.post(`/stories/${storyId}/translate`, { target_language: targetLanguage }),
  previewPdfUrl: (storyId, chapterId = null) => {
    const token = localStorage.getItem("archiva_token");
    let url = `${BACKEND_URL}/api/stories/${storyId}/preview-pdf?token=${token}`;
    if (chapterId) url += `&chapter_id=${chapterId}`;
    return url;
  },
  getMessages: (storyId, chapterId = null) => 
    api.get(`/stories/${storyId}/messages`, { params: chapterId ? { chapter_id: chapterId } : {} }),
  chat: (storyId, message, mode = "coauthor", chapterId = null) => 
    api.post(`/stories/${storyId}/chat`, { message, mode, chapter_id: chapterId }),
};

export default api;
