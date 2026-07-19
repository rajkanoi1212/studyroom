import { API_BASE } from "../config";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body, isMultipart = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isMultipart) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isMultipart ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body, e.g. file download */ }

  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),

  listGroups: (token) => request("/groups", { token }),
  createGroup: (token, name, subject) => request("/groups", { method: "POST", token, body: { name, subject } }),
  joinGroup: (token, inviteCode) => request("/groups/join", { method: "POST", token, body: { invite_code: inviteCode } }),
  groupMembers: (token, groupId) => request(`/groups/${groupId}/members`, { token }),

  listMaterials: (token, groupId) => request(`/groups/${groupId}/materials`, { token }),
  materialDownloadUrl: (groupId, materialId) => `${API_BASE}/groups/${groupId}/materials/${materialId}/download`,
  uploadMaterial: (token, groupId, file) => {
    // `file` is the result of expo-document-picker: { uri, name, mimeType }
    const formData = new FormData();
    formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType || "application/pdf" });
    return request(`/groups/${groupId}/materials`, { method: "POST", token, body: formData, isMultipart: true });
  },

  messageHistory: (token, groupId, room, peerId) =>
    request(`/groups/${groupId}/messages?room=${room}${peerId ? `&peer=${peerId}` : ""}`, { token }),
};

export { ApiError, API_BASE };
