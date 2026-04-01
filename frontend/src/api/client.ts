const BASE = "/api";

function getToken() {
  return localStorage.getItem("ls_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    localStorage.removeItem("ls_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<import("../types").User>("/auth/me"),

  // Stories
  listStories: () => request<import("../types").Story[]>("/stories"),
  createStory: (data: { title: string; description?: string; intent?: string; structure_template_id?: string }) =>
    request<import("../types").Story>("/stories", { method: "POST", body: JSON.stringify(data) }),
  getStory: (id: string) => request<import("../types").Story>(`/stories/${id}`),
  updateStory: (id: string, data: Partial<import("../types").Story>) =>
    request<import("../types").Story>(`/stories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStory: (id: string) => request<void>(`/stories/${id}`, { method: "DELETE" }),

  // Structure
  getStructure: (storyId: string) =>
    request<import("../types").StructureNode[]>(`/stories/${storyId}/structure`),
  createNode: (storyId: string, data: Partial<import("../types").StructureNode>) =>
    request<import("../types").StructureNode>(`/stories/${storyId}/structure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNode: (nodeId: string, data: Partial<import("../types").StructureNode>) =>
    request<import("../types").StructureNode>(`/structure/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNode: (nodeId: string) => request<void>(`/structure/${nodeId}`, { method: "DELETE" }),

  // Characters
  listCharacters: (storyId: string) =>
    request<import("../types").Character[]>(`/stories/${storyId}/characters`),
  createCharacter: (storyId: string, data: Partial<import("../types").Character>) =>
    request<import("../types").Character>(`/stories/${storyId}/characters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCharacter: (id: string) => request<import("../types").Character>(`/characters/${id}`),
  updateCharacter: (id: string, data: Partial<import("../types").Character>) =>
    request<import("../types").Character>(`/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCharacter: (id: string) => request<void>(`/characters/${id}`, { method: "DELETE" }),

  // Relationships
  listRelationships: (characterId: string) =>
    request<import("../types").CharacterRelationship[]>(`/characters/${characterId}/relationships`),
  createRelationship: (
    characterId: string,
    data: { related_character_id: string; relationship_type: string; description: string }
  ) =>
    request<import("../types").CharacterRelationship>(`/characters/${characterId}/relationships`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Settings (locations)
  listSettings: (storyId: string) =>
    request<import("../types").Setting[]>(`/stories/${storyId}/settings`),

  // Interviews
  listInterviews: (characterId: string) =>
    request<import("../types").InterviewSummary[]>(`/interviews/characters/${characterId}`),
  startInterview: (characterId: string, title?: string) =>
    request<import("../types").Interview>(`/interviews/characters/${characterId}`, {
      method: "POST",
      body: JSON.stringify({ title: title ?? "" }),
    }),
  getInterview: (id: string) => request<import("../types").Interview>(`/interviews/${id}`),
  deleteInterview: (id: string) => request<void>(`/interviews/${id}`, { method: "DELETE" }),

  // Interview streaming (returns Response, not parsed JSON)
  sendInterviewMessage: (interviewId: string, content: string): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/interviews/${interviewId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });
  },

  // Templates
  listStructureTemplates: () =>
    request<import("../types").StoryStructureTemplate[]>("/templates/structures"),
};
