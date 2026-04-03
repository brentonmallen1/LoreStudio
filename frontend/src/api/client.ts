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

  // Story goals
  addGoal: (storyId: string, text: string) =>
    request<import("../types").Story>(`/stories/${storyId}/goals`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  updateGoal: (storyId: string, goalId: string, data: { text?: string; completed?: boolean }) =>
    request<import("../types").Story>(`/stories/${storyId}/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteGoal: (storyId: string, goalId: string) =>
    request<import("../types").Story>(`/stories/${storyId}/goals/${goalId}`, { method: "DELETE" }),

  // Story AI
  summarizeStory: (storyId: string, upToNodeId?: string, style?: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ up_to_node_id: upToNodeId ?? null, style: style ?? "brief" }),
      signal,
    });
  },
  summarizeStructureSection: (storyId: string, nodeId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/summarize/structure`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ node_id: nodeId }),
      signal,
    });
  },
  summarizeCharacterArc: (storyId: string, characterId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/summarize/character`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ character_id: characterId }),
      signal,
    });
  },
  suggestRelationships: (storyId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/suggest-relationships`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  },

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
  summarizeNode: (nodeId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/structure/${nodeId}/summarize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  },

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

  // Arc milestones
  addMilestone: (characterId: string, text: string) =>
    request<import("../types").Character>(`/characters/${characterId}/milestones`, {
      method: "POST",
      body: JSON.stringify({ id: "", text, completed: false }),
    }),
  updateMilestone: (characterId: string, milestoneId: string, data: { text?: string; completed?: boolean }) =>
    request<import("../types").Character>(`/characters/${characterId}/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify({ id: milestoneId, text: data.text ?? "", completed: data.completed ?? false }),
    }),
  deleteMilestone: (characterId: string, milestoneId: string) =>
    request<import("../types").Character>(`/characters/${characterId}/milestones/${milestoneId}`, { method: "DELETE" }),

  // Character AI generation (returns Response for streaming)
  generateAttributes: (characterId: string, attributeType: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/characters/${characterId}/generate-attributes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ attribute_type: attributeType }),
      signal,
    });
  },

  // Story-level relationships (all relationships for all characters in a story)
  listStoryRelationships: (storyId: string) =>
    request<import("../types").CharacterRelationship[]>(`/stories/${storyId}/relationships`),

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
  startInterview: (characterId: string, title?: string, contextNodeId?: string) =>
    request<import("../types").Interview>(`/interviews/characters/${characterId}`, {
      method: "POST",
      body: JSON.stringify({ title: title ?? "", context_node_id: contextNodeId ?? null }),
    }),
  getInterview: (id: string) => request<import("../types").Interview>(`/interviews/${id}`),
  deleteInterview: (id: string) => request<void>(`/interviews/${id}`, { method: "DELETE" }),

  // Interview notes
  updateInterview: (id: string, data: { interview_notes?: string; title?: string }) =>
    request<import("../types").Interview>(`/interviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  applyInterviewToCharacter: (interviewId: string, fields: string[], content: Record<string, string>) =>
    request<import("../types").Character>(`/interviews/${interviewId}/apply-to-character`, {
      method: "POST",
      body: JSON.stringify({ fields, content }),
    }),

  // Interview streaming (returns Response, not parsed JSON)
  sendInterviewMessage: (interviewId: string, content: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/interviews/${interviewId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal,
    });
  },

  summarizeInterview: (interviewId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/interviews/${interviewId}/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  },

  // Character Journey
  getCharacterJourney: (characterId: string, upToNodeId: string) =>
    request<import("../types").CharacterJourney>(`/characters/${characterId}/journey?up_to_node=${upToNodeId}`),
  refreshCharacterJourney: (characterId: string, upToNodeId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/characters/${characterId}/journey/refresh?up_to_node=${upToNodeId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  },

  // Plot Threads
  listThreads: (storyId: string) =>
    request<import("../types").PlotThread[]>(`/stories/${storyId}/threads`),
  createThread: (storyId: string, data: { name: string; description?: string; status?: string; color?: string }) =>
    request<import("../types").PlotThread>(`/stories/${storyId}/threads`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateThread: (threadId: string, data: { name?: string; description?: string; status?: string; color?: string }) =>
    request<import("../types").PlotThread>(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteThread: (threadId: string) => request<void>(`/threads/${threadId}`, { method: "DELETE" }),
  addThreadAppearance: (threadId: string, nodeId: string, note?: string) =>
    request<import("../types").PlotThreadAppearance>(`/threads/${threadId}/appearances`, {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId, note: note ?? "" }),
    }),
  removeThreadAppearance: (threadId: string, nodeId: string) =>
    request<void>(`/threads/${threadId}/appearances/${nodeId}`, { method: "DELETE" }),

  // Panel Interviews
  listPanels: (storyId: string) =>
    request<import("../types").PanelInterviewSummary[]>(`/stories/${storyId}/panels`),
  createPanel: (storyId: string, data: { title?: string; character_ids: string[] }) =>
    request<import("../types").PanelInterview>(`/stories/${storyId}/panels`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPanel: (panelId: string) =>
    request<import("../types").PanelInterview>(`/panels/${panelId}`),
  deletePanel: (panelId: string) => request<void>(`/panels/${panelId}`, { method: "DELETE" }),
  sendPanelMessage: (panelId: string, content: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/panels/${panelId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal,
    });
  },

  // Scene Links
  getSceneLinks: (params: { story_id?: string; node_id?: string }) =>
    request<import("../types").SceneLink[]>(`/scene-links?${new URLSearchParams(params as Record<string, string>)}`),
  createSceneLink: (data: { story_id: string; source_node_id: string; target_node_id: string; link_type: string; note?: string }) =>
    request<import("../types").SceneLink>("/scene-links", { method: "POST", body: JSON.stringify(data) }),
  updateSceneLink: (id: string, data: { link_type?: string; note?: string }) =>
    request<import("../types").SceneLink>(`/scene-links/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSceneLink: (id: string) => request<void>(`/scene-links/${id}`, { method: "DELETE" }),

  // Global search
  search: (query: string) =>
    request<import("../types").SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),

  // Scene Chat
  getChatContext: (storyId: string, nodeId: string) =>
    request<import("../types").ChatContextPreview>(`/stories/${storyId}/chat/context?node_id=${nodeId}`),
  sendChatMessage: (storyId: string, nodeId: string, messages: import("../types").ChatMessage[], signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ node_id: nodeId, messages }),
      signal,
    });
  },

  // Story Health
  getStoryHealth: (storyId: string) =>
    request<import("../types").StoryHealth>(`/stories/${storyId}/health`),

  // Media / Assets
  uploadAsset: (storyId: string, file: File): Promise<import("../types").StoryAsset> => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${BASE}/stories/${storyId}/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Upload failed");
      }
      return res.json();
    });
  },
  listAssets: (storyId: string) =>
    request<import("../types").StoryAsset[]>(`/stories/${storyId}/media`),
  getAsset: (assetId: string) =>
    request<import("../types").StoryAsset>(`/media/${assetId}`),
  assetFileUrl: (assetId: string) => {
    const token = getToken();
    // Returns URL for use in <img src> — must include token as query param since we can't set headers on img src
    return `${BASE}/media/${assetId}/file?token=${token ?? ""}`;
  },
  updateAsset: (assetId: string, data: { alt_text?: string; description?: string }) =>
    request<import("../types").StoryAsset>(`/media/${assetId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAsset: (assetId: string) => request<void>(`/media/${assetId}`, { method: "DELETE" }),
  listAttachments: (objectType: string, objectId: string) =>
    request<import("../types").AssetAttachment[]>(`/media/attachments/${objectType}/${objectId}`),
  attachAsset: (assetId: string, objectType: string, objectId: string, role = "reference") =>
    request<import("../types").AssetAttachment>(`/media/${assetId}/attach`, {
      method: "POST",
      body: JSON.stringify({ object_type: objectType, object_id: objectId, role }),
    }),
  detachAsset: (attachmentId: string) =>
    request<void>(`/media/attachments/${attachmentId}`, { method: "DELETE" }),
  analyzeImage: (assetId: string): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/media/${assetId}/analyze`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  // Diagrams
  listDiagrams: (storyId: string) =>
    request<import("../types").DiagramSummary[]>(`/stories/${storyId}/diagrams`),
  createDiagram: (storyId: string, data: { title: string; description?: string; diagram_type?: string; attached_node_id?: string }) =>
    request<import("../types").Diagram>(`/stories/${storyId}/diagrams`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDiagram: (diagramId: string) =>
    request<import("../types").Diagram>(`/diagrams/${diagramId}`),
  updateDiagram: (diagramId: string, data: Partial<import("../types").Diagram>) =>
    request<import("../types").Diagram>(`/diagrams/${diagramId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteDiagram: (diagramId: string) => request<void>(`/diagrams/${diagramId}`, { method: "DELETE" }),

  // Templates
  listStructureTemplates: () =>
    request<import("../types").StoryStructureTemplate[]>("/templates/structures"),
  createStructureTemplate: (data: { name: string; description?: string; levels: { name: string; plural: string }[] }) =>
    request<import("../types").StoryStructureTemplate>("/templates/structures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStructureTemplate: (id: string, data: { name?: string; description?: string; levels?: { name: string; plural: string }[] }) =>
    request<import("../types").StoryStructureTemplate>(`/templates/structures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteStructureTemplate: (id: string) =>
    request<void>(`/templates/structures/${id}`, { method: "DELETE" }),

  // LLM Transparency
  getPromptPreview: (body: import("../types").PromptPreviewRequest) =>
    request<import("../types").PromptPreview>("/llm/prompt-preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
