import type { AIFeatureInfo } from "./types";

/** AI panel — the session types the author starts from the panel itself. */
export const PANEL_FEATURES: Record<string, AIFeatureInfo> = {
  "session-interview": {
    id: "session-interview",
    label: "Character Interview",
    type: "ai",
    shortDescription: "Talk directly to your character as themselves",
    fullDescription:
      "The character's full profile becomes the AI's persona — you're talking to the character, not asking about them. Great for uncovering backstory and voice.",
    contextSources: [
      "Full character profile (name, personality, motivation, background, appearance, traits)",
      "Arc notes",
      "Prior interview messages",
    ],
    backendFeatureId: "interview",
  },
  "session-panel": {
    id: "session-panel",
    label: "Panel Interview",
    type: "ai",
    shortDescription: "Group interview with multiple characters at once",
    fullDescription:
      "Bring multiple characters into the same conversation to see how they interact, disagree, and react to each other.",
    contextSources: ["Full profiles for all selected characters"],
    backendFeatureId: "panel-character",
  },
  "session-scene-assistant": {
    id: "session-scene-assistant",
    label: "Scene Assistant",
    type: "ai",
    shortDescription: "Brainstorm and think through a specific scene",
    fullDescription:
      "A collaborator focused on the current scene. Answers questions, surfaces connections, and helps you think through the scene without writing it for you.",
    contextSources: [
      "Story metadata",
      "Scene title, synopsis & purpose",
      "Entry/exit state",
      "Characters in scene",
      "Plot threads in scene",
      "Settings mentioned",
      "Adjacent scenes",
    ],
    backendFeatureId: "scene-chat",
  },
  "session-story-assistant": {
    id: "session-story-assistant",
    label: "Story Assistant",
    type: "ai",
    shortDescription: "Broad story-level discussion with full context",
    fullDescription:
      "A collaborator with access to the whole story — for high-level questions about plot, structure, and themes.",
    contextSources: [
      "Full story structure",
      "All scene synopses",
      "Character profiles",
      "Plot threads",
      "Lorebook entries",
    ],
    backendFeatureId: "scene-chat",
  },
  "session-writing-coach": {
    id: "session-writing-coach",
    label: "Writing Coach",
    type: "ai",
    shortDescription: "Craft and prose feedback on a specific scene",
    fullDescription:
      "Reviews the scene's prose for craft — sentence-level feedback on voice, pacing, clarity, and style.",
    contextSources: ["Scene prose text", "Story tone & genre", "Scene context"],
    backendFeatureId: "writing-coach",
  },
  "session-cliche-coach": {
    id: "session-cliche-coach",
    label: "Cliche Coach",
    type: "ai",
    shortDescription: "Flag clichés and suggest fresher alternatives",
    fullDescription:
      "Identifies clichéd language, character beats, and plot moments in the scene and helps you find more original angles.",
    contextSources: ["Scene prose text", "Selected text (optional)"],
    backendFeatureId: "cliche-coach",
  },
  "session-whatif": {
    id: "session-whatif",
    label: "What-If Simulator",
    type: "ai",
    shortDescription: "Explore alternate plot directions and consequences",
    fullDescription:
      "Helps you explore 'what if X happened instead?' scenarios, tracing the downstream effects through your story's existing threads and characters.",
    contextSources: ["Story structure", "Plot threads", "Character motivations", "Lorebook"],
    backendFeatureId: "whatif",
  },
  "session-discovery-questions": {
    id: "session-discovery-questions",
    label: "Discovery Questions",
    type: "ai",
    shortDescription: "Generate questions to deepen your story understanding",
    fullDescription:
      "Generates targeted questions designed to surface gaps in your story's logic, motivation, and world — things an author should know but may not have articulated yet.",
    contextSources: ["Story intent & premise", "Character profiles", "Plot threads", "Lorebook"],
    backendFeatureId: "discovery-questions",
  },
  "session-show-dont-tell": {
    id: "session-show-dont-tell",
    label: "Show Don't Tell",
    type: "ai",
    shortDescription: "Find passages that tell instead of show",
    fullDescription:
      "Identifies passages where the prose tells the reader about emotions or qualities instead of demonstrating them, with concrete suggestions for showing instead.",
    contextSources: ["Scene prose text", "Story genre & tone"],
    backendFeatureId: "show-dont-tell",
  },
  "session-audience-adherence": {
    id: "session-audience-adherence",
    label: "Audience Fit",
    type: "ai",
    shortDescription: "Check content fits the target audience",
    fullDescription:
      "Analyzes how well the scene's vocabulary, content, tone, and pacing match the story's declared target audience.",
    contextSources: ["Scene prose text", "Story target audience", "Genre & tone"],
    backendFeatureId: "audience-adherence",
  },
  "session-book-description": {
    id: "session-book-description",
    label: "Book Description",
    type: "ai",
    shortDescription: "Draft back-cover copy for your book",
    fullDescription:
      "Helps draft a compelling back-cover description — the hook, character stakes, and tease — drawing from your story's existing metadata.",
    contextSources: ["Story title, genre, logline, premise", "Main characters", "Central conflict", "Themes"],
    backendFeatureId: "book-description",
  },
  "session-query-letter": {
    id: "session-query-letter",
    label: "Query Letter",
    type: "ai",
    shortDescription: "Draft an agent query letter",
    fullDescription:
      "Guides you through drafting a query letter for literary agents, using your story's key elements to build the hook, synopsis, and bio sections.",
    contextSources: [
      "Story title, genre, word count",
      "Logline & premise",
      "Main characters & conflict",
      "Comp titles",
    ],
    backendFeatureId: "query-letter",
  },
  "session-scene-atmosphere": {
    id: "session-scene-atmosphere",
    label: "Scene Atmosphere",
    type: "ai",
    shortDescription: "Analyze scene mood, setting, and sensory tone",
    fullDescription:
      "Examines the atmospheric qualities of a scene — lighting, sensory details, mood, and emotional tone — and offers suggestions for deepening the atmosphere.",
    contextSources: ["Scene prose text", "Scene purpose & setting", "Story tone"],
    backendFeatureId: "scene-atmosphere",
  },
  "interview-summary": {
    id: "interview-summary",
    label: "Interview Summary",
    type: "ai",
    shortDescription: "Condense an interview into what it revealed",
    fullDescription:
      "Summarises a character interview: new backstory, motivations uncovered, and contradictions with the profile. Compression only — nothing invented.",
    contextSources: ["The interview transcript"],
    backendFeatureId: "interview-summary",
  },
  "session-recap": {
    id: "session-recap",
    label: "Session Recap",
    type: "ai",
    shortDescription: "What changed in the story during this session",
    fullDescription:
      "Reads the activity log for your working session and reports what you actually changed, so you can pick the thread up tomorrow.",
    contextSources: ["Activity log for the session", "Scene synopses touched"],
    backendFeatureId: "session-recap",
  },
  "comp-titles": {
    id: "comp-titles",
    label: "Comparable Titles",
    type: "ai",
    shortDescription: "Published books your story sits beside, and why",
    fullDescription:
      "Suggests comparable titles for a query letter or pitch, each with the reason it is comparable. Suggestions to check, not facts — verify before you send them.",
    contextSources: ["Genre, audience & tone", "Logline & premise", "Themes"],
    backendFeatureId: "comp-titles",
  },
};
