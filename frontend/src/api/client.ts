import { aiChatApi } from "./aiChat";
import { chronicleApi } from "./chronicle";
import { BASE, getToken, request } from "./request";
export { ApiError } from "./request";

export const api = {
  ...aiChatApi,
  // Auth
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<import("../types").User>("/auth/me"),

  // Stories
  listStories: () => request<import("../types").Story[]>("/stories"),
  createStory: (data: {
    title: string;
    description?: string;
    intent?: string;
    structure_template_id?: string;
    scaffold?: boolean;
  }) =>
    request<import("../types").Story & { start_node_id: string | null }>("/stories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
  reorderGoals: (storyId: string, goalIds: string[]) =>
    request<import("../types").Story>(`/stories/${storyId}/goals/reorder`, {
      method: "PATCH",
      body: JSON.stringify(goalIds),
    }),

  // Story AI
  summarizeStory: (
    storyId: string,
    upToNodeId?: string,
    style?: string,
    signal?: AbortSignal,
  ): Promise<Response> => {
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
  analyzeEconomy: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/economy`, {
      method: "POST",
      signal,
    }),
  analyzeEssentialQuestions: (storyId: string, characterId?: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/essential-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: characterId ?? null }),
      signal,
    }),
  suggestRelationships: (storyId: string, characterId?: string) =>
    request<import("../types").RelationshipSuggestionsResult>(`/stories/${storyId}/suggest-relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: characterId ?? null }),
    }),
  analyzeShowDontTell: (storyId: string, nodeId?: string, text?: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/show-dont-tell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId ?? null, text: text ?? null }),
    }),
  analyzeAudienceAdherence: (storyId: string, nodeId?: string, text?: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/audience-adherence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId ?? null, text: text ?? null }),
    }),

  analyzePacing: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/pacing`, {
      method: "POST",
      signal,
    }),

  analyzeContinuity: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/continuity`, {
      method: "POST",
      signal,
    }),

  analyzeThemes: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/themes`, {
      method: "POST",
      signal,
    }),

  analyzePlotHoles: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/plot-holes`, {
      method: "POST",
      signal,
    }),

  analyzeFirstPass: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/first-pass`, {
      method: "POST",
      signal,
    }),

  analyzeCliches: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/cliches`, {
      method: "POST",
      signal,
    }),

  analyzeCharacterDimensionality: (storyId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/analyze/character-dimensionality`, {
      method: "POST",
      signal,
    }),

  generateDiscoveryQuestions: (storyId: string, focusArea: string, entityId?: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/discovery-questions`, {
      method: "POST",
      body: JSON.stringify({ focus_area: focusArea, entity_id: entityId ?? null }),
    }),

  // Analysis history
  getLatestAnalysis: (storyId: string, feature: string) =>
    request<import("../types").ActivityLog | null>(
      `/stories/${storyId}/analysis/latest?feature=${encodeURIComponent(feature)}`,
    ),

  // Editorial pass
  runEditorialPass: (
    storyId: string,
    contextLevel: "full" | "summaries" | "section",
    scopeType: "story" | "chapters" | "scenes",
    scopeIds: string[],
    signal?: AbortSignal,
  ) =>
    request<import("../types").ActivityLog>(`/stories/${storyId}/editorial/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_level: contextLevel, scope_type: scopeType, scope_ids: scopeIds }),
      signal,
    }),

  deleteEditorialReport: (storyId: string, reportId: string) =>
    request<void>(`/stories/${storyId}/editorial/reports/${reportId}`, { method: "DELETE" }),

  clearAllEditorialNotes: (storyId: string) =>
    request<void>(`/stories/${storyId}/editorial/notes`, { method: "DELETE" }),

  // Structure
  getStructure: (storyId: string) =>
    request<import("../types").StructureNode[]>(`/stories/${storyId}/structure`),
  createNode: (storyId: string, data: Partial<import("../types").StructureNode>) =>
    request<import("../types").StructureNode>(`/stories/${storyId}/structure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNode: (nodeId: string) => request<import("../types").StructureNode>(`/structure/${nodeId}`),
  updateNode: (
    nodeId: string,
    data: Partial<import("../types").StructureNode> & { expected_updated_at?: string },
  ) =>
    request<import("../types").StructureNode>(`/structure/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNode: (nodeId: string) => request<void>(`/structure/${nodeId}`, { method: "DELETE" }),
  reorderStructure: (
    storyId: string,
    operations: { node_id: string; parent_id: string | null; position: number }[],
  ) =>
    request<void>(`/stories/${storyId}/structure/reorder`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    }),
  summarizeNode: (nodeId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/structure/${nodeId}/summarize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  },

  listCharacters: (storyId: string) =>
    request<import("../types").Character[]>(`/stories/${storyId}/characters`),
  createCharacter: (storyId: string, data: Partial<import("../types").Character>) =>
    request<import("../types").Character>(`/stories/${storyId}/characters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
  updateMilestone: (
    characterId: string,
    milestoneId: string,
    data: { text?: string; completed?: boolean; scene_id?: string | null; scene_title?: string | null },
  ) =>
    request<import("../types").Character>(`/characters/${characterId}/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify({
        id: milestoneId,
        text: data.text ?? "",
        completed: data.completed ?? false,
        scene_id: data.scene_id,
        scene_title: data.scene_title,
      }),
    }),
  deleteMilestone: (characterId: string, milestoneId: string) =>
    request<import("../types").Character>(`/characters/${characterId}/milestones/${milestoneId}`, {
      method: "DELETE",
    }),

  // Discovery notes
  addDiscoveryNote: (
    characterId: string,
    data: { text: string; scene_id?: string | null; scene_title?: string | null },
  ) =>
    request<import("../types").Character>(`/characters/${characterId}/discovery-notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDiscoveryNote: (characterId: string, noteId: string, data: { text?: string; confirmed?: boolean }) =>
    request<import("../types").Character>(`/characters/${characterId}/discovery-notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteDiscoveryNote: (characterId: string, noteId: string) =>
    request<import("../types").Character>(`/characters/${characterId}/discovery-notes/${noteId}`, {
      method: "DELETE",
    }),

  getArcTimeline: (characterId: string) =>
    request<import("../types").ArcTimelineData>(`/characters/${characterId}/arc-timeline`),
  getCharacterUnlinkedMentions: (characterId: string) =>
    request<import("../types").CharacterUnlinkedMentionsResponse>(
      `/characters/${characterId}/unlinked-mentions`,
    ),
  applyCharacterMentions: (characterId: string, scenes: import("../types").ApplyMentionsForScene[]) =>
    request<{ updated_scenes: number }>(`/characters/${characterId}/apply-mentions`, {
      method: "POST",
      body: JSON.stringify({ scenes }),
    }),
  analyzeCharacterVoice: (characterId: string) =>
    request<import("../types").VoiceDistinctnessResult>(`/characters/${characterId}/analyze-voice`, {
      method: "POST",
    }),
  analyzeCharacterDialogueProse: (characterId: string) =>
    request<import("../types").CharacterDialogueProseResult>(`/characters/${characterId}/analyze-dialogue`, {
      method: "POST",
    }),
  analyzeCharacterVoiceFidelity: (characterId: string, signal?: AbortSignal) =>
    request<import("../types").StructuredResult>(`/characters/${characterId}/analyze-voice-fidelity`, {
      method: "POST",
      signal,
    }),
  analyzeCharacterArc: (characterId: string) =>
    request<import("../types").StructuredResult>(`/characters/${characterId}/analyze-arc`, {
      method: "POST",
    }),
  assessCharacterDimensionality: (characterId: string) =>
    request<import("../types").StructuredResult>(`/characters/${characterId}/assess-dimensionality`, {
      method: "POST",
    }),

  // Character AI generation
  generateAttributes: (
    characterId: string,
    attributeType: string,
  ): Promise<import("../types").StructuredResult> =>
    request<import("../types").StructuredResult>(`/characters/${characterId}/generate-attributes`, {
      method: "POST",
      body: JSON.stringify({ attribute_type: attributeType }),
    }),

  // Story-level relationships (all relationships for all characters in a story)
  listStoryRelationships: (storyId: string) =>
    request<import("../types").CharacterRelationship[]>(`/stories/${storyId}/relationships`),

  // Relationships
  listRelationships: (characterId: string) =>
    request<import("../types").CharacterRelationship[]>(`/characters/${characterId}/relationships`),
  createRelationship: (characterId: string, data: Partial<import("../types").CharacterRelationship>) =>
    request<import("../types").CharacterRelationship>(`/characters/${characterId}/relationships`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRelationship: (relationshipId: string, data: Partial<import("../types").CharacterRelationship>) =>
    request<import("../types").CharacterRelationship>(`/characters/relationships/${relationshipId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteRelationship: (relationshipId: string) =>
    request<void>(`/characters/relationships/${relationshipId}`, { method: "DELETE" }),
  acceptRelationshipSuggestion: (relationshipId: string) =>
    request<import("../types").CharacterRelationship>(
      `/characters/relationships/${relationshipId}/accept-suggestion`,
      {
        method: "POST",
      },
    ),
  getRelationshipTemplates: () =>
    request<import("../types").RelationshipTemplate[]>(`/characters/relationships/templates`),

  // Settings (deprecated — use listLocationsFlat instead)

  // Interviews
  startInterview: (
    characterId: string,
    title?: string,
    node?: string,
    scope?: import("../types").KnowledgeScope,
  ) =>
    request<import("../types").Interview>(`/interviews/characters/${characterId}`, {
      method: "POST",
      body: JSON.stringify({
        title: title ?? "",
        context_node_id: node ?? null,
        knowledge_scope: scope ?? "profile",
      }),
    }),

  // Interview notes
  updateInterview: (id: string, data: import("../types").InterviewUpdate) =>
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
    request<import("../types").CharacterJourney>(
      `/characters/${characterId}/journey?up_to_node=${upToNodeId}`,
    ),
  refreshCharacterJourney: (
    characterId: string,
    upToNodeId: string,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/characters/${characterId}/journey/refresh?up_to_node=${upToNodeId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  },

  // Plot Threads
  listThreads: (storyId: string) => request<import("../types").PlotThread[]>(`/stories/${storyId}/threads`),
  createThread: (
    storyId: string,
    data: { name: string } & Partial<Omit<import("../types").PlotThread, "id" | "appearances">>,
  ) =>
    request<import("../types").PlotThread>(`/stories/${storyId}/threads`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateThread: (
    threadId: string,
    data: Partial<Omit<import("../types").PlotThread, "id" | "appearances" | "status">> & { status?: string },
  ) =>
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
  analyzeThread: (threadId: string) =>
    request<import("../types").StructuredResult>(`/threads/${threadId}/analyze`, { method: "POST" }),

  // Twists
  listTwists: (storyId: string) => request<import("../types").Twist[]>(`/stories/${storyId}/twists`),
  createTwist: (storyId: string, data: { name: string; twist_type?: string }) =>
    request<import("../types").Twist>(`/stories/${storyId}/twists`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTwist: (twistId: string, data: Partial<import("../types").Twist>) =>
    request<import("../types").Twist>(`/twists/${twistId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTwist: (twistId: string) => request<void>(`/twists/${twistId}`, { method: "DELETE" }),
  getTwistsForScene: (nodeId: string) => request<import("../types").Twist[]>(`/structure/${nodeId}/twists`),
  analyzeTwist: (twistId: string) =>
    request<import("../types").StructuredResult>(`/twists/${twistId}/analyze`, { method: "POST" }),
  linkClueToScene: (twistId: string, clueId: string, sceneId: string) =>
    request<import("../types").Twist>(`/twists/${twistId}/clues/${clueId}/link`, {
      method: "PATCH",
      body: JSON.stringify({ scene_id: sceneId }),
    }),

  // Reader Knowledge
  listReaderKnowledgeEvents: (storyId: string) =>
    request<import("../types").ReaderKnowledgeEvent[]>(`/stories/${storyId}/reader-knowledge`),
  createReaderKnowledgeEvent: (storyId: string, data: Partial<import("../types").ReaderKnowledgeEvent>) =>
    request<import("../types").ReaderKnowledgeEvent>(`/stories/${storyId}/reader-knowledge`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteReaderKnowledgeEvent: (eventId: string) =>
    request<void>(`/reader-knowledge/${eventId}`, { method: "DELETE" }),
  scanReaderKnowledgeEvents: (storyId: string) =>
    request<import("../types").ReaderKnowledgeEvent[]>(`/stories/${storyId}/reader-knowledge/scan`, {
      method: "POST",
    }),
  analyzeTwistImpact: (twistId: string) =>
    request<import("../types").StructuredResult>(`/twists/${twistId}/analyze-impact`, { method: "POST" }),

  // Todos
  listTodos: (storyId: string) => request<import("../types").StoryTodo[]>(`/stories/${storyId}/todos`),
  getTodosForScene: (nodeId: string) => request<import("../types").StoryTodo[]>(`/structure/${nodeId}/todos`),
  createTodo: (
    storyId: string,
    data: {
      content: string;
      node_id?: string | null;
      done?: boolean;
      doc_from?: number | null;
      doc_to?: number | null;
    },
  ) =>
    request<import("../types").StoryTodo>(`/stories/${storyId}/todos`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTodo: (
    todoId: string,
    data: {
      content?: string;
      node_id?: string | null;
      done?: boolean;
      position?: number;
      doc_from?: number | null;
      doc_to?: number | null;
    },
  ) =>
    request<import("../types").StoryTodo>(`/todos/${todoId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTodo: (todoId: string) => request<void>(`/todos/${todoId}`, { method: "DELETE" }),
  deleteDoneTodos: (storyId: string) => request<void>(`/stories/${storyId}/todos/done`, { method: "DELETE" }),

  // Outlines
  listOutlines: (storyId: string) => request<import("../types").Outline[]>(`/stories/${storyId}/outlines`),
  createOutline: (storyId: string, name: string) =>
    request<import("../types").Outline>(`/stories/${storyId}/outlines`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  injectBeatSheet: (storyId: string, beatSheetId: string) =>
    request<import("../types").OutlineWithItems>(`/stories/${storyId}/outlines/inject`, {
      method: "POST",
      body: JSON.stringify({ beat_sheet_id: beatSheetId }),
    }),
  getOutlineWithItems: (outlineId: string) =>
    request<import("../types").OutlineWithItems>(`/outlines/${outlineId}`),
  updateOutline: (outlineId: string, data: { name?: string; position?: number }) =>
    request<import("../types").Outline>(`/outlines/${outlineId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOutline: (outlineId: string) => request<void>(`/outlines/${outlineId}`, { method: "DELETE" }),
  createOutlineItem: (
    outlineId: string,
    data: {
      text: string;
      parent_id?: string | null;
      position?: number;
      beat_type?: string | null;
      notes?: string;
    },
  ) =>
    request<import("../types").OutlineItem>(`/outlines/${outlineId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOutlineItem: (itemId: string, data: Partial<import("../types").OutlineItem>) =>
    request<import("../types").OutlineItem>(`/outline-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOutlineItem: (itemId: string) => request<void>(`/outline-items/${itemId}`, { method: "DELETE" }),
  bulkReorderOutline: (
    outlineId: string,
    operations: { item_id: string; parent_id: string | null; position: number }[],
  ) =>
    request<void>(`/outlines/${outlineId}/bulk-reorder`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    }),
  extractOutlineFromProse: (storyId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/outlines/extract-from-prose`, {
      method: "POST",
    }),
  analyzeOutlineAlignment: (outlineId: string) =>
    request<import("../types").StructuredResult>(`/outlines/${outlineId}/analyze-alignment`, {
      method: "POST",
    }),

  // Panel Interviews
  createPanel: (storyId: string, data: { title?: string; character_ids: string[] }) =>
    request<import("../types").PanelInterview>(`/stories/${storyId}/panels`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPanel: (panelId: string) => request<import("../types").PanelInterview>(`/panels/${panelId}`),

  // Scene Links
  getSceneLinks: (params: { story_id?: string; node_id?: string }) =>
    request<import("../types").SceneLink[]>(
      `/scene-links?${new URLSearchParams(params as Record<string, string>)}`,
    ),
  createSceneLink: (data: {
    story_id: string;
    source_node_id: string;
    target_node_id: string;
    link_type: string;
    note?: string;
  }) => request<import("../types").SceneLink>("/scene-links", { method: "POST", body: JSON.stringify(data) }),
  updateSceneLink: (id: string, data: { link_type?: string; note?: string }) =>
    request<import("../types").SceneLink>(`/scene-links/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSceneLink: (id: string) => request<void>(`/scene-links/${id}`, { method: "DELETE" }),

  // Beat Sheets
  listBeatSheets: () => request<import("../types").BeatSheet[]>("/beat-sheets"),
  createBeatSheet: (body: { name: string; description?: string; beats?: import("../types").Beat[] }) =>
    request<import("../types").BeatSheet>("/beat-sheets", { method: "POST", body: JSON.stringify(body) }),
  updateBeatSheet: (
    id: string,
    body: { name?: string; description?: string; beats?: import("../types").Beat[] },
  ) =>
    request<import("../types").BeatSheet>(`/beat-sheets/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteBeatSheet: (id: string) => request<void>(`/beat-sheets/${id}`, { method: "DELETE" }),

  // Snowflake Method
  getSnowflakeGuidance: (
    storyId: string,
    layer: string,
    content: string,
    characterId?: string | null,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/snowflake/guidance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ layer, content, character_id: characterId ?? null }),
      signal,
    });
  },

  // Global search
  search: (query: string) =>
    request<import("../types").SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),

  // Story-wide search & replace
  storySearch: (storyId: string, query: string, caseSensitive = false) =>
    request<{
      matches: Array<{
        node_id: string;
        node_title: string;
        excerpt: string;
        match_count: number;
        level_type: string;
      }>;
    }>(`/stories/${storyId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, case_sensitive: caseSensitive }),
    }),

  storyReplace: (
    storyId: string,
    query: string,
    replacement: string,
    caseSensitive = false,
    nodeIds?: string[],
  ) =>
    request<{ replaced_count: number; scenes_affected: number; node_ids: string[] }>(
      `/stories/${storyId}/replace`,
      {
        method: "POST",
        body: JSON.stringify({
          query,
          replacement,
          case_sensitive: caseSensitive,
          node_ids: nodeIds ?? null,
        }),
      },
    ),

  // Scene Chat
  getChatContext: (storyId: string, nodeId: string) =>
    request<import("../types").ChatContextPreview>(`/stories/${storyId}/chat/context?node_id=${nodeId}`),

  // Conversation Summarize
  summarizeConversation: (
    messages: import("../types").ChatMessage[],
    storyId?: string,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/chat/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, story_id: storyId ?? null }),
      signal,
    });
  },

  // Cliche Coach

  // Scene Planner
  sendScenePlanMessage: (
    storyId: string,
    nodeId: string,
    messages: import("../types").ChatMessage[],
    initialNotes?: string,
    llmParams?: import("../types").LLMParams,
  ) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/scene-plan`, {
      method: "POST",
      body: JSON.stringify({
        node_id: nodeId,
        messages,
        initial_notes: initialNotes ?? null,
        llm_params: llmParams ?? null,
      }),
    }),

  // Brainstorm ("What's Next?")

  sendBrainstormMessage: (
    storyId: string,
    nodeId: string,
    messages: import("../types").ChatMessage[],
    authorIntent?: import("../types").BrainstormIntent,
    signal?: AbortSignal,
    llmParams?: import("../types").LLMParams,
  ): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/brainstorm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        node_id: nodeId,
        messages,
        author_intent: authorIntent ?? null,
        llm_params: llmParams ?? null,
      }),
      signal,
    });
  },

  // World Building AI
  analyzeLocationExistence: (storyId: string, locationId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/worldbuilding/what-exists`, {
      method: "POST",
      body: JSON.stringify({ location_id: locationId }),
    }),

  suggestWorldElements: (storyId: string, elementType: string, elementId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/worldbuilding/suggest-elements`, {
      method: "POST",
      body: JSON.stringify({ element_type: elementType, element_id: elementId }),
    }),

  analyzeHistoricalImplications: (storyId: string, eventId: string) =>
    request<import("../types").StructuredResult>(
      `/stories/${storyId}/worldbuilding/historical-implications`,
      {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
      },
    ),

  analyzeWorldSystem: (storyId: string, systemId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/worldbuilding/system-analysis`, {
      method: "POST",
      body: JSON.stringify({ system_id: systemId }),
    }),

  suggestCalendarEvents: (storyId: string, calendarId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/worldbuilding/calendar-suggestions`, {
      method: "POST",
      body: JSON.stringify({ calendar_id: calendarId }),
    }),

  analyzeTravelRoute: (storyId: string, travelId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/worldbuilding/travel-analysis`, {
      method: "POST",
      body: JSON.stringify({ travel_id: travelId }),
    }),

  // Story Overview
  getStoryOverview: (storyId: string) =>
    request<import("../types").StoryOverview>(`/stories/${storyId}/overview`),

  // Manuscript & Export
  getManuscript: (storyId: string, statusFilter?: string) =>
    request<import("../types").Manuscript>(
      `/stories/${storyId}/manuscript${statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : ""}`,
    ),
  exportStory: (storyId: string, options: import("../types").ExportOptions): Promise<Response> => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${BASE}/stories/${storyId}/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(options),
    });
  },

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
  listAssets: (storyId: string) => request<import("../types").StoryAsset[]>(`/stories/${storyId}/media`),
  assetFileUrl: (assetId: string) => {
    const token = getToken();
    // Returns URL for use in <img src> — must include token as query param since we can't set headers on img src
    return `${BASE}/media/${assetId}/file?token=${token ?? ""}`;
  },
  updateAsset: (assetId: string, data: { alt_text?: string; description?: string }) =>
    request<import("../types").StoryAsset>(`/media/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
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
  analyzeImageForCharacter: (assetId: string): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/media/${assetId}/analyze/character`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  analyzeSceneAtmosphere: (
    storyId: string,
    assetIds: string[],
    nodeId?: string,
    userQuery?: string,
  ): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/analyze/scene-atmosphere`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ asset_ids: assetIds, node_id: nodeId ?? null, user_query: userQuery ?? null }),
    });
  },

  // Diagrams
  listDiagrams: (storyId: string) =>
    request<import("../types").DiagramSummary[]>(`/stories/${storyId}/diagrams`),
  createDiagram: (
    storyId: string,
    data: { title: string; description?: string; diagram_type?: string; attached_node_id?: string },
  ) =>
    request<import("../types").Diagram>(`/stories/${storyId}/diagrams`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDiagram: (diagramId: string) => request<import("../types").Diagram>(`/diagrams/${diagramId}`),
  updateDiagram: (diagramId: string, data: Partial<import("../types").Diagram>) =>
    request<import("../types").Diagram>(`/diagrams/${diagramId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteDiagram: (diagramId: string) => request<void>(`/diagrams/${diagramId}`, { method: "DELETE" }),

  // Templates
  listStructureTemplates: () => request<import("../types").StoryStructureTemplate[]>("/templates/structures"),
  createStructureTemplate: (data: {
    name: string;
    description?: string;
    levels: { name: string; plural: string }[];
  }) =>
    request<import("../types").StoryStructureTemplate>("/templates/structures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStructureTemplate: (
    id: string,
    data: { name?: string; description?: string; levels?: { name: string; plural: string }[] },
  ) =>
    request<import("../types").StoryStructureTemplate>(`/templates/structures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteStructureTemplate: (id: string) => request<void>(`/templates/structures/${id}`, { method: "DELETE" }),

  // Compendium
  listCompendiumEntries: (
    storyId: string,
    params?: { entry_type?: string; category?: string; tag?: string; q?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.entry_type) qs.set("entry_type", params.entry_type);
    if (params?.category) qs.set("category", params.category);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return request<import("../types").CompendiumEntrySummary[]>(
      `/stories/${storyId}/compendium${query ? `?${query}` : ""}`,
    );
  },
  createCompendiumNote: (
    storyId: string,
    data: { title: string; content?: string; tags?: string[]; category?: string; notes?: string },
  ) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createCompendiumUrl: (
    storyId: string,
    data: {
      title?: string;
      url: string;
      tags?: string[];
      category?: string;
      notes?: string;
      fetch_metadata?: boolean;
    },
  ) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/urls`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createCompendiumDocument: (
    storyId: string,
    data: { title?: string; asset_id: string; tags?: string[]; category?: string; notes?: string },
  ) =>
    request<import("../types").CompendiumEntry>(`/stories/${storyId}/compendium/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCompendiumEntry: (entryId: string) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}`),
  updateCompendiumEntry: (
    entryId: string,
    data: {
      title?: string;
      content?: string;
      url?: string;
      tags?: string[];
      category?: string;
      notes?: string;
    },
  ) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCompendiumEntry: (entryId: string) => request<void>(`/compendium/${entryId}`, { method: "DELETE" }),
  refreshCompendiumUrl: (entryId: string) =>
    request<import("../types").CompendiumEntry>(`/compendium/${entryId}/refresh-url`, { method: "POST" }),

  // LLM Transparency
  getPromptPreview: (body: import("../types").PromptPreviewRequest) =>
    request<import("../types").PromptPreview>("/llm/prompt-preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  ...chronicleApi,

  // AI Settings
  getAISettings: () => request<import("../types").AISettings>("/ai-settings"),
  getAISettingsDefaults: () => request<import("../types").AISettingsDefaults>("/ai-settings/defaults"),
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
  getLLMSettings: () => request<import("../types").LLMSettings>("/llm-settings"),
  updateLLMSettings: (data: import("../types").LLMParams) =>
    request<import("../types").LLMSettings>("/llm-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  resetLLMSettings: () => request<import("../types").LLMSettings>("/llm-settings", { method: "DELETE" }),

  // Ollama connectivity
  ollamaStatus: () =>
    request<{
      connected: boolean;
      model: string;
      model_available: boolean;
      model_in_list: boolean;
      error: string | null;
      base_url: string;
    }>("/ollama/status"),
  ollamaModels: () =>
    request<{ models: Array<{ name: string; size: number; details?: { parameter_size?: string } }> }>(
      "/ollama/models",
    ),
  ollamaModelInfo: () => request<{ model: string; context_length: number | null }>("/ollama/model-info"),

  // System (Settings › Backups / System)
  systemStatus: () => request<import("../types/system").SystemStatus>("/system/status"),
  runDbBackupNow: () =>
    request<import("../types/system").SystemStatus["backups"]>("/system/backups", { method: "POST" }),

  // World Building — Locations
  listLocationsFlat: (storyId: string) =>
    request<import("../types").Location[]>(`/stories/${storyId}/locations/flat`),
  createLocation: (storyId: string, data: Partial<import("../types").Location>) =>
    request<import("../types").Location>(`/stories/${storyId}/locations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLocation: (id: string, data: Partial<import("../types").Location>) =>
    request<import("../types").Location>(`/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteLocation: (id: string) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  // World Building — Scene Settings
  getSceneSettingsForNode: (nodeId: string) =>
    request<import("../types").SceneSetting[]>(`/structure/${nodeId}/scene-settings`),
  addSceneSetting: (data: { location_id: string; node_id: string; role?: string; notes?: string }) =>
    request<import("../types").SceneSetting>("/scene-settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeSceneSetting: (id: string) => request<void>(`/scene-settings/${id}`, { method: "DELETE" }),

  // World Building — World Systems
  listWorldSystems: (storyId: string) =>
    request<import("../types").WorldSystem[]>(`/stories/${storyId}/world-systems`),
  createWorldSystem: (storyId: string, data: Partial<import("../types").WorldSystem>) =>
    request<import("../types").WorldSystem>(`/stories/${storyId}/world-systems`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWorldSystem: (id: string, data: Partial<import("../types").WorldSystem>) =>
    request<import("../types").WorldSystem>(`/world-systems/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteWorldSystem: (id: string) => request<void>(`/world-systems/${id}`, { method: "DELETE" }),

  // World Building — Cultures
  listCultures: (storyId: string) => request<import("../types").Culture[]>(`/stories/${storyId}/cultures`),
  createCulture: (storyId: string, data: Partial<import("../types").Culture>) =>
    request<import("../types").Culture>(`/stories/${storyId}/cultures`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCulture: (id: string, data: Partial<import("../types").Culture>) =>
    request<import("../types").Culture>(`/cultures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCulture: (id: string) => request<void>(`/cultures/${id}`, { method: "DELETE" }),

  // World Building — Eras
  listEras: (storyId: string) => request<import("../types").Era[]>(`/stories/${storyId}/eras`),
  createEra: (storyId: string, data: Partial<import("../types").Era>) =>
    request<import("../types").Era>(`/stories/${storyId}/eras`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
  updateHistoricalEvent: (id: string, data: Partial<import("../types").HistoricalEvent>) =>
    request<import("../types").HistoricalEvent>(`/historical-events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteHistoricalEvent: (id: string) => request<void>(`/historical-events/${id}`, { method: "DELETE" }),

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
  deleteLocationTravel: (id: string) => request<void>(`/location-travel/${id}`, { method: "DELETE" }),

  // World Building — Calendars
  listCalendars: (storyId: string) => request<import("../types").Calendar[]>(`/stories/${storyId}/calendars`),
  createCalendar: (storyId: string, data: Partial<import("../types").Calendar>) =>
    request<import("../types").Calendar>(`/stories/${storyId}/calendars`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCalendar: (id: string, data: Partial<import("../types").Calendar>) =>
    request<import("../types").Calendar>(`/calendars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCalendar: (id: string) => request<void>(`/calendars/${id}`, { method: "DELETE" }),

  // Discovery
  runDiscovery: (storyId: string, nodeId?: string) =>
    request<import("../types").DiscoveredElement[]>(`/stories/${storyId}/discover`, {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId ?? null }),
    }),

  // Dialogue
  listDialogue: (sceneId: string) =>
    request<import("../types").DialogueBlock[]>(`/scenes/${sceneId}/dialogue`),
  patchDialogueBlock: (
    blockId: string,
    data: { speaker_name?: string; character_id?: string | null; subtext?: string },
  ) =>
    request<import("../types").DialogueBlock>(`/dialogue/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getCharacterDialogue: (characterId: string) =>
    request<import("../types").DialogueBlockWithScene[]>(`/characters/${characterId}/dialogue`),
  suggestDialogueTags: (sceneId: string) =>
    request<import("../types").ProposedDialogueTag[]>(`/scenes/${sceneId}/dialogue/suggest-tags`, {
      method: "POST",
    }),
  aiSuggestDialogueSpeakers: (sceneId: string, signal?: AbortSignal) =>
    request<import("../types").ProposedDialogueTag[]>(`/scenes/${sceneId}/dialogue/ai-suggest`, {
      method: "POST",
      signal,
    }),
  applyDialogueTags: (sceneId: string, tags: import("../types").ApplyTagRequest[]) =>
    request<import("../types").StructureNode>(`/scenes/${sceneId}/dialogue/apply-tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    }),
  suggestDialogueTagsStoryWide: (storyId: string) =>
    request<import("../types").BatchSuggestResponse>(`/stories/${storyId}/dialogue/suggest-tags-batch`, {
      method: "POST",
    }),
  suggestDialogueTagsForCharacter: (characterId: string) =>
    request<import("../types").BatchSuggestResponse>(
      `/characters/${characterId}/dialogue/suggest-tags-batch`,
      { method: "POST" },
    ),
  applyDialogueTagsBatch: (
    storyId: string,
    scenes: { scene_id: string; tags: import("../types").ApplyTagRequest[] }[],
  ) =>
    request<{ updated_count: number }>(`/stories/${storyId}/dialogue/apply-tags-batch`, {
      method: "POST",
      body: JSON.stringify({ scenes }),
    }),
  suggestEntityLinks: (nodeId: string) =>
    request<import("../types").ProposedEntityLink[]>(`/structure/${nodeId}/suggest-links`, {
      method: "POST",
    }),
  applyEntityLinks: (nodeId: string, links: import("../types").ApplyLinkRequest[]) =>
    request<import("../types").StructureNode>(`/structure/${nodeId}/apply-links`, {
      method: "POST",
      body: JSON.stringify({ links }),
    }),

  // Entity rename
  previewCharacterRename: (characterId: string, newName: string) =>
    request<import("../types").RenamePreviewResponse>(`/characters/${characterId}/preview-rename`, {
      method: "POST",
      body: JSON.stringify({ new_name: newName }),
    }),
  applyCharacterRename: (characterId: string, oldName: string, newName: string, nodeIds: string[]) =>
    request<import("../types").Character>(`/characters/${characterId}/apply-rename`, {
      method: "POST",
      body: JSON.stringify({ old_name: oldName, new_name: newName, node_ids: nodeIds }),
    }),

  // Pronoun refactoring
  previewPronounRefactor: (characterId: string, newPronouns: string, nodeIds: string[] = []) =>
    request<import("../types").PronounRefactorPreviewResponse>(
      `/characters/${characterId}/preview-pronoun-refactor`,
      {
        method: "POST",
        body: JSON.stringify({ new_pronouns: newPronouns, node_ids: nodeIds }),
      },
    ),
  applyPronounRefactor: (
    characterId: string,
    newPronouns: string,
    rewrites: { node_id: string; original: string; rewritten: string }[],
  ) =>
    request<import("../types").Character>(`/characters/${characterId}/apply-pronoun-refactor`, {
      method: "POST",
      body: JSON.stringify({ new_pronouns: newPronouns, rewrites }),
    }),

  // Snapshots
  listSnapshots: (storyId: string) =>
    request<import("../types").StorySnapshot[]>(`/stories/${storyId}/snapshots`),
  createSnapshot: (storyId: string, name?: string) =>
    request<import("../types").StorySnapshot>(`/stories/${storyId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ name: name ?? null }),
    }),
  renameSnapshot: (storyId: string, snapshotId: string, name: string | null) =>
    request<import("../types").StorySnapshot>(`/stories/${storyId}/snapshots/${snapshotId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteSnapshot: (storyId: string, snapshotId: string) =>
    request<void>(`/stories/${storyId}/snapshots/${snapshotId}`, { method: "DELETE" }),
  restoreSnapshot: (storyId: string, snapshotId: string, createSafetyBackup = true) =>
    request<{ restored: boolean; snapshot_id: string }>(
      `/stories/${storyId}/snapshots/${snapshotId}/restore`,
      { method: "POST", body: JSON.stringify({ create_safety_backup: createSafetyBackup }) },
    ),
  diffSnapshots: (storyId: string, aId: string, bId: string) =>
    request<import("../types").SnapshotDiff>(`/stories/${storyId}/snapshots/diff?a_id=${aId}&b_id=${bId}`),
  checkAutoBackup: (storyId: string) =>
    request<{ created: boolean; snapshot?: import("../types").StorySnapshot }>(
      `/stories/${storyId}/snapshots/check-auto`,
      { method: "POST" },
    ),
  getBackupStatus: (storyId: string) =>
    request<import("../types").BackupStatus>(`/stories/${storyId}/snapshots/status`),
  exportSnapshot: (storyId: string, snapshotId: string): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/stories/${storyId}/snapshots/${snapshotId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  importIntoStory: (storyId: string, file: File, createSafetyBackup = true): Promise<Response> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/stories/${storyId}/snapshots/import?create_safety_backup=${createSafetyBackup}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  },

  // Backup settings
  getBackupSettings: (storyId: string) =>
    request<import("../types").BackupSettings>(`/stories/${storyId}/backup-settings`),
  updateBackupSettings: (storyId: string, data: Partial<import("../types").BackupSettings>) =>
    request<import("../types").BackupSettings>(`/stories/${storyId}/backup-settings`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // User backup defaults
  getUserBackupDefaults: () => request<import("../types").UserBackupDefaults>(`/user/backup-defaults`),
  updateUserBackupDefaults: (data: Partial<import("../types").UserBackupDefaults>) =>
    request<import("../types").UserBackupDefaults>(`/user/backup-defaults`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Document import wizard
  importUpload: (file: File, templateId = "freeform"): Promise<import("../types").ImportUploadResponse> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/import/upload?template_id=${encodeURIComponent(templateId)}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Upload failed");
      }
      return res.json();
    });
  },
  importAiAnalyze: (sessionId: string) =>
    request<import("../types").ImportAIAnalyzeResponse>(`/import/${sessionId}/ai-analyze`, {
      method: "POST",
    }),
  importAdjust: (sessionId: string, adjustments: import("../types").ImportNodeAdjustment[]) =>
    request<import("../types").ImportPreviewTree>(`/import/${sessionId}/adjust`, {
      method: "POST",
      body: JSON.stringify({ adjustments }),
    }),
  importExtractPreview: (sessionId: string, options: import("../types").ExtractionOptions) =>
    request<import("../types").ExtractionPreview>(`/import/${sessionId}/extract-preview`, {
      method: "POST",
      body: JSON.stringify(options),
    }),
  importEnrichCandidates: (
    sessionId: string,
    candidates: import("../types").ExtractionCandidate[],
    options: import("../types").AIEnrichOptions,
  ) =>
    request<import("../types").ExtractionPreview>(`/import/${sessionId}/enrich-candidates`, {
      method: "POST",
      body: JSON.stringify({ candidates, options }),
    }),
  importFinalize: (sessionId: string, data: import("../types").ImportFinalizeRequest) =>
    request<{ id: string; title: string }>(`/import/${sessionId}/finalize`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Publication Prep

  suggestCompTitles: (storyId: string) =>
    request<import("../types").StructuredResult>(`/stories/${storyId}/publication/comp-titles`, {
      method: "POST",
    }),
};
