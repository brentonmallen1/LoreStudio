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
  recapLastSession: (storyId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/recap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  },
  analyzeEconomy: (storyId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/analyze/economy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
  sendInterviewMessage: (interviewId: string, content: string, signal?: AbortSignal, llmParams?: import("../types").LLMParams): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/interviews/${interviewId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, llm_params: llmParams ?? null }),
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
  sendPanelMessage: (panelId: string, content: string, signal?: AbortSignal, llmParams?: import("../types").LLMParams): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/panels/${panelId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, llm_params: llmParams ?? null }),
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
  sendChatMessage: (storyId: string, nodeId: string, messages: import("../types").ChatMessage[], signal?: AbortSignal, llmParams?: import("../types").LLMParams): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ node_id: nodeId, messages, llm_params: llmParams ?? null }),
      signal,
    });
  },

  // Story Health
  getStoryHealth: (storyId: string) =>
    request<import("../types").StoryHealth>(`/stories/${storyId}/health`),

  // Story Overview
  getStoryOverview: (storyId: string) =>
    request<import("../types").StoryOverview>(`/stories/${storyId}/overview`),

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

  // Compendium
  listCompendiumEntries: (storyId: string, params?: { entry_type?: string; category?: string; tag?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.entry_type) qs.set("entry_type", params.entry_type);
    if (params?.category) qs.set("category", params.category);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return request<import("../types").CompendiumEntrySummary[]>(`/stories/${storyId}/compendium${query ? `?${query}` : ""}`);
  },
  createCompendiumNote: (storyId: string, data: { title: string; content?: string; tags?: string[]; category?: string; notes?: string }) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createCompendiumUrl: (storyId: string, data: { title?: string; url: string; tags?: string[]; category?: string; notes?: string; fetch_metadata?: boolean }) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/urls`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createCompendiumDocument: (storyId: string, data: { title?: string; asset_id: string; tags?: string[]; category?: string; notes?: string }) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCompendiumEntry: (entryId: string) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}`),
  updateCompendiumEntry: (entryId: string, data: { title?: string; content?: string; url?: string; tags?: string[]; category?: string; notes?: string }) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCompendiumEntry: (entryId: string) =>
    request<void>(`/compendium/${entryId}`, { method: "DELETE" }),
  refreshCompendiumUrl: (entryId: string) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}/refresh-url`, { method: "POST" }),
  attachCompendiumEntry: (entryId: string, objectType: string, objectId: string, note = "") =>
    request<import("../types").CompendiumAttachment>(`/compendium/${entryId}/attach`, {
      method: "POST",
      body: JSON.stringify({ object_type: objectType, object_id: objectId, note }),
    }),
  listCompendiumAttachments: (objectType: string, objectId: string) =>
    request<import("../types").CompendiumAttachment[]>(`/compendium/attachments/${objectType}/${objectId}`),
  detachCompendiumEntry: (attachmentId: string) =>
    request<void>(`/compendium/attachments/${attachmentId}`, { method: "DELETE" }),

  // LLM Transparency
  getPromptPreview: (body: import("../types").PromptPreviewRequest) =>
    request<import("../types").PromptPreview>("/llm/prompt-preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Chronicle — sessions
  listChronicleSessions: (params: {
    story_id?: string; context_type?: string; archived?: boolean; page?: number; page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.story_id) q.set("story_id", params.story_id);
    if (params.context_type) q.set("context_type", params.context_type);
    if (params.archived !== undefined) q.set("archived", String(params.archived));
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return request<{ sessions: import("../types").ChronicleSession[]; total: number; page: number; page_size: number }>(
      `/chronicle/sessions?${q}`
    );
  },
  createChronicleSession: (data: {
    story_id: string; context_type: string; context_id?: string; context_label?: string; title?: string;
  }) =>
    request<import("../types").ChronicleSession>("/chronicle/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getChronicleSession: (sessionId: string) =>
    request<import("../types").ChronicleSessionDetail>(`/chronicle/sessions/${sessionId}`),
  updateChronicleSession: (sessionId: string, data: { title?: string; archived?: boolean }) =>
    request<import("../types").ChronicleSession>(`/chronicle/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteChronicleSession: (sessionId: string) =>
    request<void>(`/chronicle/sessions/${sessionId}`, { method: "DELETE" }),
  addChronicleMessage: (sessionId: string, data: {
    role: string; content: string; model?: string; tokens_in?: number; tokens_out?: number;
  }) =>
    request<import("../types").ChronicleMessage>(`/chronicle/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Chronicle — activity logs
  listActivityLogs: (params: {
    story_id?: string; category?: string; event_type?: string; page?: number; page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.story_id) q.set("story_id", params.story_id);
    if (params.category) q.set("category", params.category);
    if (params.event_type) q.set("event_type", params.event_type);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return request<{ logs: import("../types").ActivityLog[]; total: number; page: number; page_size: number }>(
      `/chronicle/activity?${q}`
    );
  },

  // Chronicle — search & stats
  searchChronicle: (params: { q: string; story_id?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams({ q: params.q });
    if (params.story_id) qs.set("story_id", params.story_id);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    return request<{ results: import("../types").ChronicleSearchResult[]; total: number; query: string }>(
      `/chronicle/search?${qs}`
    );
  },
  getChronicleStats: (storyId?: string) => {
    const q = storyId ? `?story_id=${storyId}` : "";
    return request<import("../types").ChronicleStats>(`/chronicle/stats${q}`);
  },

  // AI Settings
  getAISettings: () =>
    request<import("../types").AISettings>("/ai-settings"),
  getAISettingsDefaults: () =>
    request<import("../types").AISettingsDefaults>("/ai-settings/defaults"),
  updateAISettings: (data: import("../types").AISettingsUpdate) =>
    request<import("../types").AISettings>("/ai-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  resetCorePrompt: () =>
    request<import("../types").AISettings>("/ai-settings/core-prompt", { method: "DELETE" }),
  resetFeaturePrompt: (featureId: string) =>
    request<import("../types").AISettings>(`/ai-settings/feature-prompts/${featureId}`, { method: "DELETE" }),

  // LLM Settings (sampling parameters)
  getLLMSettings: () =>
    request<import("../types").LLMSettings>("/llm-settings"),
  updateLLMSettings: (data: import("../types").LLMParams) =>
    request<import("../types").LLMSettings>("/llm-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  resetLLMSettings: () =>
    request<import("../types").LLMSettings>("/llm-settings", { method: "DELETE" }),

  // World Building — Locations
  listLocations: (storyId: string) =>
    request<import("../types").Location[]>(`/stories/${storyId}/locations`),
  listLocationsFlat: (storyId: string) =>
    request<import("../types").Location[]>(`/stories/${storyId}/locations/flat`),
  getLocationTypes: (storyId: string) =>
    request<string[]>(`/stories/${storyId}/location-types`),
  createLocation: (storyId: string, data: Partial<import("../types").Location>) =>
    request<import("../types").Location>(`/stories/${storyId}/locations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLocation: (id: string) =>
    request<import("../types").Location>(`/locations/${id}`),
  updateLocation: (id: string, data: Partial<import("../types").Location>) =>
    request<import("../types").Location>(`/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteLocation: (id: string) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  // World Building — Scene Settings
  getSceneSettingsForNode: (nodeId: string) =>
    request<import("../types").SceneSetting[]>(`/structure/${nodeId}/scene-settings`),
  getSceneSettingsForLocation: (locationId: string) =>
    request<import("../types").SceneSetting[]>(`/locations/${locationId}/scene-settings`),
  addSceneSetting: (data: { location_id: string; node_id: string; role?: string; notes?: string }) =>
    request<import("../types").SceneSetting>("/scene-settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeSceneSetting: (id: string) => request<void>(`/scene-settings/${id}`, { method: "DELETE" }),

  // World Building — World Systems
  listWorldSystems: (storyId: string) =>
    request<import("../types").WorldSystem[]>(`/stories/${storyId}/world-systems`),
  getSystemTypes: (storyId: string) =>
    request<string[]>(`/stories/${storyId}/world-system-types`),
  createWorldSystem: (storyId: string, data: Partial<import("../types").WorldSystem>) =>
    request<import("../types").WorldSystem>(`/stories/${storyId}/world-systems`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWorldSystem: (id: string) =>
    request<import("../types").WorldSystem>(`/world-systems/${id}`),
  updateWorldSystem: (id: string, data: Partial<import("../types").WorldSystem>) =>
    request<import("../types").WorldSystem>(`/world-systems/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteWorldSystem: (id: string) => request<void>(`/world-systems/${id}`, { method: "DELETE" }),

  // World Building — Cultures
  listCultures: (storyId: string) =>
    request<import("../types").Culture[]>(`/stories/${storyId}/cultures`),
  createCulture: (storyId: string, data: Partial<import("../types").Culture>) =>
    request<import("../types").Culture>(`/stories/${storyId}/cultures`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCulture: (id: string) =>
    request<import("../types").Culture>(`/cultures/${id}`),
  updateCulture: (id: string, data: Partial<import("../types").Culture>) =>
    request<import("../types").Culture>(`/cultures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCulture: (id: string) => request<void>(`/cultures/${id}`, { method: "DELETE" }),

  // World Building — Eras
  listEras: (storyId: string) =>
    request<import("../types").Era[]>(`/stories/${storyId}/eras`),
  createEra: (storyId: string, data: Partial<import("../types").Era>) =>
    request<import("../types").Era>(`/stories/${storyId}/eras`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getEra: (id: string) => request<import("../types").Era>(`/eras/${id}`),
  updateEra: (id: string, data: Partial<import("../types").Era>) =>
    request<import("../types").Era>(`/eras/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteEra: (id: string) => request<void>(`/eras/${id}`, { method: "DELETE" }),

  // World Building — Historical Events
  listHistoricalEvents: (storyId: string) =>
    request<import("../types").HistoricalEvent[]>(`/stories/${storyId}/historical-events`),
  createHistoricalEvent: (storyId: string, data: Partial<import("../types").HistoricalEvent>) =>
    request<import("../types").HistoricalEvent>(`/stories/${storyId}/historical-events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHistoricalEvent: (id: string) =>
    request<import("../types").HistoricalEvent>(`/historical-events/${id}`),
  updateHistoricalEvent: (id: string, data: Partial<import("../types").HistoricalEvent>) =>
    request<import("../types").HistoricalEvent>(`/historical-events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteHistoricalEvent: (id: string) =>
    request<void>(`/historical-events/${id}`, { method: "DELETE" }),

  // World Building — Location Travel
  listLocationTravel: (storyId: string) =>
    request<import("../types").LocationTravel[]>(`/stories/${storyId}/location-travel`),
  createLocationTravel: (data: Partial<import("../types").LocationTravel>) =>
    request<import("../types").LocationTravel>("/location-travel", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLocationTravel: (id: string, data: Partial<import("../types").LocationTravel>) =>
    request<import("../types").LocationTravel>(`/location-travel/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteLocationTravel: (id: string) =>
    request<void>(`/location-travel/${id}`, { method: "DELETE" }),

  // World Building — Calendars
  listCalendars: (storyId: string) =>
    request<import("../types").Calendar[]>(`/stories/${storyId}/calendars`),
  createCalendar: (storyId: string, data: Partial<import("../types").Calendar>) =>
    request<import("../types").Calendar>(`/stories/${storyId}/calendars`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCalendar: (id: string) =>
    request<import("../types").Calendar>(`/calendars/${id}`),
  updateCalendar: (id: string, data: Partial<import("../types").Calendar>) =>
    request<import("../types").Calendar>(`/calendars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCalendar: (id: string) => request<void>(`/calendars/${id}`, { method: "DELETE" }),
};
