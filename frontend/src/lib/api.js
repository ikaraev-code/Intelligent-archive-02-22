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
  reindex: () => api.post("/files/reindex"),
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
  send: (message, sessionId = null, includeFileContext = true) => 
    api.post("/chat", { message, session_id: sessionId, include_file_context: includeFileContext }),
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

export default api;
