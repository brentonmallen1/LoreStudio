/**
 * Central registry of all AI and NLP features in LoreStudio.
 *
 * Each entry describes what the feature does, what data it uses,
 * and which page(s) it appears on — used by AIFeatureInfoModal to
 * explain features to the author before they run them.
 */

export type FeatureType = "ai" | "nlp";

export interface AIFeatureInfo {
  id: string;
  label: string;
  type: FeatureType;
  /** Short text for native title/tooltip (< 60 chars) */
  shortDescription: string;
  /** One-to-two sentence description for the info modal */
  fullDescription: string;
  /** Human-readable list of what data is sent */
  contextSources: string[];
  /** If set, maps to a backend feature_id for prompt preview */
  backendFeatureId?: string;
}

const FEATURES: Record<string, AIFeatureInfo> = {
  // ── Story Health — NLP ───────────────────────────────────────────────────────

  "prose-nlp": {
    id: "prose-nlp",
    label: "Prose Check",
    type: "nlp",
    shortDescription: "Passive voice, adverbs, said-bookisms, repeated words",
    fullDescription:
      "Scans every scene for passive voice, excessive adverbs, said-bookisms, repeated words, and sentence variety. Runs locally — no AI or internet required.",
    contextSources: ["Scene prose text (all scenes)"],
  },
  "entity-discovery": {
    id: "entity-discovery",
    label: "Lorebook Scan",
    type: "nlp",
    shortDescription: "Find character & location names not yet in Lorebook",
    fullDescription:
      "Uses named entity recognition to find characters and locations mentioned in your prose that aren't yet tracked in the Lorebook. Runs locally — no AI required.",
    contextSources: ["Scene prose text (all scenes)", "Existing Lorebook entries"],
  },
  "editorial-consistency": {
    id: "editorial-consistency",
    label: "Editorial Check",
    type: "nlp",
    shortDescription: "Tense consistency and POV drift, no AI required",
    fullDescription:
      "Detects tense shifts and point-of-view drift across scenes. Deterministic rule-based analysis — runs locally with no AI required.",
    contextSources: ["Scene prose text (all scenes)"],
  },

  // ── Story Health — AI ────────────────────────────────────────────────────────

  "economy-analysis": {
    id: "economy-analysis",
    label: "Story Economy",
    type: "ai",
    shortDescription: "Thread balance, scene economy, MICE tightness",
    fullDescription:
      "Analyzes MICE thread balance, scene economy, try/fail cycles, and whether word count is distributed effectively for the intended form.",
    contextSources: ["Story structure", "MICE thread data", "Scene synopses", "Word counts"],
    backendFeatureId: "economy-analysis",
  },
  "essential-questions": {
    id: "essential-questions",
    label: "Story Compass",
    type: "ai",
    shortDescription: "Are the 6 essential story questions answerable?",
    fullDescription:
      "Checks whether the six essential story questions (goal, motivation, conflict, stakes, change, resolution) are clearly answerable for the protagonist.",
    contextSources: ["Story intent & premise", "Character goals & motivation", "Plot threads", "Story structure"],
    backendFeatureId: "essential-questions",
  },
  "pacing-analysis": {
    id: "pacing-analysis",
    label: "Pacing Analysis",
    type: "ai",
    shortDescription: "Act balance, tension curve, structural rhythm",
    fullDescription:
      "Reviews act balance, tension curve, and scene rhythm to identify slow spots, rushed sections, and structural imbalances.",
    contextSources: ["Story structure", "Scene synopses", "Word counts", "MICE threads"],
    backendFeatureId: "pacing-analysis",
  },
  "continuity-check": {
    id: "continuity-check",
    label: "Continuity Check",
    type: "ai",
    shortDescription: "Character knowledge, timeline, and detail inconsistencies",
    fullDescription:
      "Flags inconsistencies in character knowledge, timeline, object details, and cause-and-effect across your scenes.",
    contextSources: ["Scene prose text", "Character profiles", "Story structure"],
    backendFeatureId: "continuity-check",
  },
  "theme-tracker": {
    id: "theme-tracker",
    label: "Theme Tracker",
    type: "ai",
    shortDescription: "Recurring themes, motifs, and their development",
    fullDescription:
      "Identifies recurring themes and motifs in the prose and assesses how they develop across the story arc.",
    contextSources: ["Scene prose text", "Story intent & premise", "Plot threads"],
    backendFeatureId: "theme-tracker",
  },
  "plot-holes": {
    id: "plot-holes",
    label: "Plot Holes",
    type: "ai",
    shortDescription: "Logical gaps, unanswered questions, inconsistencies",
    fullDescription:
      "Detects logical gaps, unresolved story questions, and cause-and-effect inconsistencies in the narrative.",
    contextSources: ["Scene prose text", "Story structure", "Plot threads", "Character motivations"],
    backendFeatureId: "plot-holes",
  },
  "first-pass": {
    id: "first-pass",
    label: "First-Pass Editor",
    type: "ai",
    shortDescription: "Compare prose against stated intent and arc milestones",
    fullDescription:
      "Compares the written scenes against your stated narrative intent, scene purposes, and character arc milestones to surface gaps between plan and execution.",
    contextSources: ["Scene prose text", "Scene purpose & intent", "Character arc milestones", "Narrative goals"],
    backendFeatureId: "first-pass",
  },
  "cliche-analysis": {
    id: "cliche-analysis",
    label: "Cliche Check",
    type: "ai",
    shortDescription: "Overused phrases, tropes, and tired descriptions",
    fullDescription:
      "Scans for overused phrases, character tropes, plot devices, and tired descriptions that could make the writing feel generic.",
    contextSources: ["Scene prose text"],
    backendFeatureId: "cliche-analysis",
  },
  "character-dimensionality": {
    id: "character-dimensionality",
    label: "Character Depth",
    type: "ai",
    shortDescription: "Dimensionality, contradictions, relationship complexity",
    fullDescription:
      "Assesses each character's dimensionality, internal contradictions, relationship complexity, and whether their role in the story is being used appropriately.",
    contextSources: ["Character profiles", "Scene prose text", "Relationship graph", "Plot thread involvement"],
    backendFeatureId: "character-dimensionality",
  },

  // ── AI Panel — Session Types ─────────────────────────────────────────────────

  "session-interview": {
    id: "session-interview",
    label: "Character Interview",
    type: "ai",
    shortDescription: "Talk directly to your character as themselves",
    fullDescription:
      "The character's full profile becomes the AI's persona — you're talking to the character, not asking about them. Great for uncovering backstory and voice.",
    contextSources: ["Full character profile (name, personality, motivation, background, appearance, traits)", "Arc notes", "Prior interview messages"],
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
    backendFeatureId: "panel-interview",
  },
  "session-scene-assistant": {
    id: "session-scene-assistant",
    label: "Scene Assistant",
    type: "ai",
    shortDescription: "Brainstorm and think through a specific scene",
    fullDescription:
      "A collaborator focused on the current scene. Answers questions, surfaces connections, and helps you think through the scene without writing it for you.",
    contextSources: ["Story metadata", "Scene title, synopsis & purpose", "Entry/exit state", "Characters in scene", "Plot threads in scene", "Settings mentioned", "Adjacent scenes"],
    backendFeatureId: "scene-chat",
  },
  "session-story-assistant": {
    id: "session-story-assistant",
    label: "Story Assistant",
    type: "ai",
    shortDescription: "Broad story-level discussion with full context",
    fullDescription:
      "A collaborator with access to the whole story — for high-level questions about plot, structure, and themes.",
    contextSources: ["Full story structure", "All scene synopses", "Character profiles", "Plot threads", "Lorebook entries"],
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
    backendFeatureId: "scene-chat",
  },
  "session-cliche-coach": {
    id: "session-cliche-coach",
    label: "Cliche Coach",
    type: "ai",
    shortDescription: "Flag clichés and suggest fresher alternatives",
    fullDescription:
      "Identifies clichéd language, character beats, and plot moments in the scene and helps you find more original angles.",
    contextSources: ["Scene prose text", "Selected text (optional)"],
    backendFeatureId: "cliche-analysis",
  },
  "session-whatif": {
    id: "session-whatif",
    label: "What-If Simulator",
    type: "ai",
    shortDescription: "Explore alternate plot directions and consequences",
    fullDescription:
      "Helps you explore 'what if X happened instead?' scenarios, tracing the downstream effects through your story's existing threads and characters.",
    contextSources: ["Story structure", "Plot threads", "Character motivations", "Lorebook"],
  },
  "session-discovery-questions": {
    id: "session-discovery-questions",
    label: "Discovery Questions",
    type: "ai",
    shortDescription: "Generate questions to deepen your story understanding",
    fullDescription:
      "Generates targeted questions designed to surface gaps in your story's logic, motivation, and world — things an author should know but may not have articulated yet.",
    contextSources: ["Story intent & premise", "Character profiles", "Plot threads", "Lorebook"],
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
  },
  "session-query-letter": {
    id: "session-query-letter",
    label: "Query Letter",
    type: "ai",
    shortDescription: "Draft an agent query letter",
    fullDescription:
      "Guides you through drafting a query letter for literary agents, using your story's key elements to build the hook, synopsis, and bio sections.",
    contextSources: ["Story title, genre, word count", "Logline & premise", "Main characters & conflict", "Comp titles"],
  },
  "session-scene-atmosphere": {
    id: "session-scene-atmosphere",
    label: "Scene Atmosphere",
    type: "ai",
    shortDescription: "Analyze scene mood, setting, and sensory tone",
    fullDescription:
      "Examines the atmospheric qualities of a scene — lighting, sensory details, mood, and emotional tone — and offers suggestions for deepening the atmosphere.",
    contextSources: ["Scene prose text", "Scene purpose & setting", "Story tone"],
  },

  // ── Character Sheet — Classification ────────────────────────────────────────

  "character-role": {
    id: "character-role",
    label: "Character Role",
    type: "nlp",
    shortDescription: "Structural position in the narrative",
    fullDescription:
      "Classifies a character by their structural position: Protagonist (main character), Deuteragonist (secondary lead), Antagonist (opposition), Love Interest, Confidant (trusted keeper of secrets), Foil (highlights the protagonist through contrast), or Tertiary (background). " +
      "Role affects health warnings — tertiary characters are not flagged for infrequent appearances.",
    contextSources: ["Character role field"],
  },
  "character-type-classification": {
    id: "character-type-classification",
    label: "Character Type",
    type: "nlp",
    shortDescription: "Development & complexity classification",
    fullDescription:
      "Classifies a character by how they're developed: Round (complex, multi-dimensional), Flat (defined by one or two consistent traits), Dynamic (changes throughout the story), Static (remains fundamentally unchanged), Stock (a recognizable conventional type), or Symbolic (represents an idea or theme more than a realistic individual). " +
      "These terms come from literary theory — Round/Flat from E.M. Forster, Dynamic/Static from standard narrative analysis.",
    contextSources: ["Character type field"],
  },
  "character-jungian-archetype": {
    id: "character-jungian-archetype",
    label: "Jungian Archetype",
    type: "ai",
    shortDescription: "Core identity from Carl Jung's 12 personality archetypes",
    fullDescription:
      "Assigns one of 12 Jungian archetypes that describes the character's core identity and psychological drives: Lover, Hero, Magician, Outlaw, Explorer, Sage, Innocent, Creator, Ruler, Caregiver, Everyman, or Jester. " +
      "Each archetype carries characteristic strengths and weaknesses that shape how the character is portrayed in AI interviews.",
    contextSources: ["Jungian archetype field", "Used in character interview persona"],
  },
  "character-narrative-archetype": {
    id: "character-narrative-archetype",
    label: "Narrative Archetype",
    type: "ai",
    shortDescription: "Story function from the Hero's Journey framework",
    fullDescription:
      "Assigns one of 8 narrative archetypes from Joseph Campbell's Hero's Journey: Hero (undergoing transformation), Mentor (wise guide), Threshold Guardian (tests the hero), Herald (signals change), Shapeshifter (uncertain loyalty), Shadow (dark mirror/antagonist), Trickster (disrupts through humor), or Ally (companion). " +
      "This describes the character's function in the plot structure and shapes how they present themselves in AI interviews.",
    contextSources: ["Narrative archetype field", "Used in character interview persona"],
  },

  // ── Character Sheet ──────────────────────────────────────────────────────────

  "character-attributes": {
    id: "character-attributes",
    label: "Attribute Generation",
    type: "ai",
    shortDescription: "Generate traits, backstory, quirks, or appearance",
    fullDescription:
      "Suggests specific traits, backstory details, quirks, or appearance notes grounded in the character's existing profile.",
    contextSources: ["Character name, role, personality", "Existing traits & background", "Story context"],
    backendFeatureId: "character-attributes",
  },
  "relationship-suggest": {
    id: "relationship-suggest",
    label: "Relationship Suggestions",
    type: "ai",
    shortDescription: "Suggest interesting dynamics between characters",
    fullDescription:
      "Analyzes all characters in the story and suggests relationship dynamics with narrative tension or interesting complexity.",
    contextSources: ["All character profiles", "Existing relationships"],
    backendFeatureId: "relationship-suggest",
  },
  "character-arc": {
    id: "character-arc",
    label: "Character Arc Analysis",
    type: "ai",
    shortDescription: "Where is this character in their arc right now?",
    fullDescription:
      "Reviews the character's profile, arc milestones, and scenes where they appear to assess where they currently stand in their arc and what still needs to happen.",
    contextSources: ["Character profile & arc notes", "Arc milestones (done/pending)", "Scenes mentioning the character"],
    backendFeatureId: "character-arc",
  },
  "dialogue-voice": {
    id: "dialogue-voice",
    label: "Voice Analysis",
    type: "nlp",
    shortDescription: "Analyze character voice distinctness in dialogue",
    fullDescription:
      "Uses NLP to assess how distinctive this character's dialogue voice is — vocabulary patterns, sentence rhythm, and how easily their lines could be mistaken for another character.",
    contextSources: ["Character's dialogue lines (extracted from all scenes)"],
  },
  "dialogue-prose": {
    id: "dialogue-prose",
    label: "Dialogue Prose Quality",
    type: "nlp",
    shortDescription: "Prose quality analysis for character dialogue",
    fullDescription:
      "Analyzes the prose quality of this character's dialogue — said-bookisms, adverbs, and other craft markers specific to their lines.",
    contextSources: ["Character's dialogue lines (extracted from all scenes)"],
  },
  "character-tag-dialogue": {
    id: "character-tag-dialogue",
    label: "Tag Dialogue",
    type: "ai",
    shortDescription: "Find scenes with unattributed dialogue to tag for this character",
    fullDescription:
      "Shows scenes containing untagged dialogue lines whose prose mentions this character, so you can navigate to the scene editor and use AI auto-tagging to assign speakers.",
    contextSources: ["Scene prose text", "Character name", "Unattributed dialogue blocks"],
  },

  // ── Worldbuilding ────────────────────────────────────────────────────────────

  "wb-what-exists": {
    id: "wb-what-exists",
    label: "Brainstorm What Exists",
    type: "ai",
    shortDescription: "What would logically exist at this location?",
    fullDescription:
      "Brainstorms what built structures, natural environment, and cultural presence would logically exist at a location given its established properties and world rules.",
    contextSources: ["Location details (climate, terrain, culture links)", "World systems", "Connected cultures"],
    backendFeatureId: "what-exists",
  },
  "wb-location-suggest": {
    id: "wb-location-suggest",
    label: "Suggest Location Elements",
    type: "ai",
    shortDescription: "Creature, flora, and naming ideas for this location",
    fullDescription:
      "Suggests directions for creature types, flora, and naming patterns appropriate to this location's established atmosphere and world rules.",
    contextSources: ["Location details", "World systems", "Connected cultures & eras"],
    backendFeatureId: "element-suggest",
  },
  "wb-culture-suggest": {
    id: "wb-culture-suggest",
    label: "Suggest Cultural Elements",
    type: "ai",
    shortDescription: "Naming, ritual, and aesthetic directions for this culture",
    fullDescription:
      "Brainstorms naming directions, ritual and custom ideas, and aesthetic/material culture directions grounded in this culture's existing profile.",
    contextSources: ["Culture details (values, traditions, language family)", "Associated world systems", "Locations"],
    backendFeatureId: "element-suggest",
  },
  "wb-implications": {
    id: "wb-implications",
    label: "Trace Present-Day Effects",
    type: "ai",
    shortDescription: "What are the present-day ripples of this historical event?",
    fullDescription:
      "Analyzes a historical event to surface its present-day effects — physical remnants, cultural legacy, political consequences, and inherited attitudes.",
    contextSources: ["Historical event details", "Era context", "Associated cultures and world systems"],
    backendFeatureId: "historical-implications",
  },
  "wb-system": {
    id: "wb-system",
    label: "Analyze Edge Cases",
    type: "ai",
    shortDescription: "Edge cases and story implications for a world system",
    fullDescription:
      "Analyzes a magic, technology, or social system to surface edge cases, story implications, and consistency questions the author should resolve.",
    contextSources: ["System rules and description", "Other world systems", "Cultures that use it"],
    backendFeatureId: "what-exists",
  },
  "wb-calendar": {
    id: "wb-calendar",
    label: "Suggest Special Days",
    type: "ai",
    shortDescription: "Festival, seasonal, and historical day ideas for a calendar",
    fullDescription:
      "Suggests culturally appropriate festivals, seasonal events, and historical observances for a calendar based on the associated culture and history.",
    contextSources: ["Calendar structure", "Associated cultures", "Historical events"],
    backendFeatureId: "element-suggest",
  },
  "wb-travel": {
    id: "wb-travel",
    label: "Analyze Travel Route",
    type: "ai",
    shortDescription: "Hazards, cultural tensions, and story potential of a route",
    fullDescription:
      "Analyzes a travel route between two locations for hazards, cultural tensions, terrain challenges, and narrative opportunities.",
    contextSources: ["Origin and destination locations", "World systems affecting the route", "Cultures along the way"],
  },

  // ── Scene Editor ─────────────────────────────────────────────────────────────

  "scene-plan": {
    id: "scene-plan",
    label: "Plan Scene",
    type: "ai",
    shortDescription: "AI-guided scene planning before you write",
    fullDescription:
      "Helps you plan a scene before writing it — proposing purpose, character goals, entry/exit states, and key beats based on your story context.",
    contextSources: ["Scene title & synopsis", "Adjacent scenes", "Characters in scene", "Active plot threads", "Story structure"],
    backendFeatureId: "scene-plan",
  },
  "brainstorm": {
    id: "brainstorm",
    label: "What's Next?",
    type: "ai",
    shortDescription: "Brainstorm directions for this scene or next scene",
    fullDescription:
      "A brainstorming partner that suggests narrative directions, complications, and next moves based on where the scene currently stands — without writing the prose for you.",
    contextSources: ["Scene synopsis & purpose", "Current scene prose", "Plot threads", "Character arcs", "Adjacent scenes"],
    backendFeatureId: "brainstorm",
  },
  "auto-tag-dialogue": {
    id: "auto-tag-dialogue",
    label: "Auto-Tag Dialogue",
    type: "ai",
    shortDescription: "Suggest speaker tags for untagged dialogue lines",
    fullDescription:
      "Analyzes the scene's dialogue to suggest speaker tags for lines that aren't yet attributed to a character.",
    contextSources: ["Scene prose text", "Character names in scene"],
  },
  "auto-link-entities": {
    id: "auto-link-entities",
    label: "Auto-Link Entities",
    type: "ai",
    shortDescription: "Find characters & locations in prose to link to Lorebook",
    fullDescription:
      "Scans the scene prose for character names and location names and suggests linking them to existing Lorebook entries.",
    contextSources: ["Scene prose text", "Lorebook character and location entries"],
  },

  // ── Outline ──────────────────────────────────────────────────────────────────

  "extract-outline": {
    id: "extract-outline",
    label: "Extract Outline from Prose",
    type: "ai",
    shortDescription: "Generate a structured outline from written scenes",
    fullDescription:
      "Analyzes the written prose to extract a structured outline — scene titles, synopses, and key events — helping authors who drafted first and want to build structure after.",
    contextSources: ["Scene prose text (all scenes)", "Story title & genre"],
  },
  "snowflake-guidance": {
    id: "snowflake-guidance",
    label: "Snowflake Guidance",
    type: "ai",
    shortDescription: "Guidance for the current Snowflake Method step",
    fullDescription:
      "Provides contextual guidance and questions for whichever step of the Snowflake Method you're currently working on.",
    contextSources: ["Current Snowflake step", "Existing outline content", "Story premise"],
    backendFeatureId: "scene-plan",
  },

  // ── Discovery Queue ──────────────────────────────────────────────────────────

  "discovery-queue": {
    id: "discovery-queue",
    label: "Entity Discovery",
    type: "nlp",
    shortDescription: "Suggested Lorebook entries from names found in prose",
    fullDescription:
      "Runs named entity recognition across all scenes and collects character and location names not yet in the Lorebook, queuing them for review.",
    contextSources: ["Scene prose text (all scenes)", "Existing Lorebook entries"],
  },

  // ── Twists & Misdirection ────────────────────────────────────────────────────

  "twist-analysis": {
    id: "twist-analysis",
    label: "Twist Analysis",
    type: "ai",
    shortDescription: "Review clue quality, distribution, and reveal effectiveness",
    fullDescription:
      "Reviews foreshadowing clue quality, clue distribution across the story, and how effectively the twist's reveal is set up — rating each dimension from needs-work to excellent.",
    contextSources: ["Twist name, description, and type", "Linked clues (scene, placement, subtlety)", "Scene synopses mentioning the twist"],
    backendFeatureId: "twist-analysis",
  },
  "twist-impact": {
    id: "twist-impact",
    label: "Twist Impact",
    type: "ai",
    shortDescription: "Trace downstream effects when this twist resolves",
    fullDescription:
      "Identifies which plot threads, character arcs, and scenes need revisiting once this twist resolves, plus any loose ends the reveal creates.",
    contextSources: ["Twist name and description", "All plot threads", "Character arcs", "Scene synopses"],
    backendFeatureId: "twist-impact",
  },
  "reader-knowledge-scan": {
    id: "reader-knowledge-scan",
    label: "Auto-detect Knowledge Events",
    type: "ai",
    shortDescription: "Detect truth reveals, misdirections, and clues from scene synopses",
    fullDescription:
      "Reads through scene synopses to automatically identify truth reveals, misdirections, planted clues, and moments where reader knowledge diverges from character knowledge.",
    contextSources: ["Scene synopses (all scenes)", "Existing knowledge events (to avoid duplicates)"],
    backendFeatureId: "reader-knowledge",
  },

  // ── Plot Threads ─────────────────────────────────────────────────────────────

  "thread-analysis": {
    id: "thread-analysis",
    label: "Thread Analysis",
    type: "ai",
    shortDescription: "Review thread progression, key moments, and narrative quality",
    fullDescription:
      "Reviews a plot thread's progression through the story — assessing try/fail cycles, key turning points, opening/closing balance, and overall narrative quality.",
    contextSources: ["Thread name, type, and description", "Scenes tagged to this thread", "Thread status and arc milestones"],
    backendFeatureId: "thread-analysis",
  },

  // ── Story Identity Workshop ──────────────────────────────────────────────────

  "identity-workshop": {
    id: "identity-workshop",
    label: "Story Identity Workshop",
    type: "ai",
    shortDescription: "Conversational guide to help you articulate your story's identity",
    fullDescription:
      "A Socratic dialogue tool that asks questions to help you discover and articulate your story's logline, premise, themes, narrative intent, and central conflict. The AI never writes content for you — it asks questions, surfaces observations, and prompts deeper thinking so the words remain entirely yours.",
    contextSources: ["Story title, genre, tone, and existing identity fields", "Character names, roles, and motivations", "Scene synopses and structure"],
    backendFeatureId: "identity-workshop",
  },

  // ── Lorebook / Story Summary ─────────────────────────────────────────────────

  "story-summary": {
    id: "story-summary",
    label: "Story Summary",
    type: "ai",
    shortDescription: "Generate a concise summary of everything written so far",
    fullDescription:
      "Reads all written scenes and generates a concise narrative summary — useful for catching up after a break or sharing story progress.",
    contextSources: ["All scene prose text", "Story title and narrative intent"],
    backendFeatureId: "story-summary",
  },
  "perspective-summary": {
    id: "perspective-summary",
    label: "Perspective Summary",
    type: "ai",
    shortDescription: "Summarize the story from a character or section's perspective",
    fullDescription:
      "Summarizes the story from the perspective of a specific character (what they've experienced) or a structural section (what has happened in that act/chapter).",
    contextSources: ["Scene prose text for the selected scope", "Character profile (for character perspective)", "Story intent"],
    backendFeatureId: "structure-summary",
  },

  // ── Import — NLP ───────────────────────────────────────────────────────────

  "import-ner-characters": {
    id: "import-ner-characters",
    label: "Find Character Names",
    type: "nlp",
    shortDescription: "Detect character names via named entity recognition",
    fullDescription:
      "Uses spaCy's named entity recognition to identify PERSON entities throughout your manuscript. Fast and fully local — no AI or internet required. Found names become character candidates you can review before adding to the Lorebook.",
    contextSources: ["Imported manuscript text (all paragraphs)"],
  },
  "import-ner-locations": {
    id: "import-ner-locations",
    label: "Find Location Names",
    type: "nlp",
    shortDescription: "Detect location names via named entity recognition",
    fullDescription:
      "Uses spaCy's named entity recognition to identify GPE (geopolitical places) and LOC (locations) entities in your manuscript. Fast and fully local — no AI required. Found names become location candidates you can review before adding to the Lorebook.",
    contextSources: ["Imported manuscript text (all paragraphs)"],
  },

  // ── Import — AI ────────────────────────────────────────────────────────────

  "import-ai-character-details": {
    id: "import-ai-character-details",
    label: "Extract Character Details",
    type: "ai",
    shortDescription: "AI extracts personality, appearance, and motivation from prose",
    fullDescription:
      "For each character candidate found by NLP, gathers surrounding prose excerpts and asks the AI to extract attributes like role, personality, motivation, appearance, and background. Only information explicitly present in the text is extracted.",
    contextSources: ["Character name", "Prose excerpts where the character appears"],
    backendFeatureId: "import-character-extraction",
  },
  "import-ai-location-details": {
    id: "import-ai-location-details",
    label: "Extract Location Details",
    type: "ai",
    shortDescription: "AI extracts description, atmosphere, and significance from prose",
    fullDescription:
      "For each location candidate found by NLP, gathers prose excerpts and asks the AI to extract type, physical description, atmosphere, and narrative significance. Only information explicitly present in the text is extracted.",
    contextSources: ["Location name", "Prose excerpts where the location appears"],
    backendFeatureId: "import-location-extraction",
  },
  "import-ai-relationships": {
    id: "import-ai-relationships",
    label: "Detect Relationships",
    type: "ai",
    shortDescription: "AI identifies relationships between character candidates",
    fullDescription:
      "Analyzes scenes where multiple character candidates appear together to detect and describe their relationships (family, romantic, professional, rival, etc.). Requires at least 2 shared scene appearances to attempt detection.",
    contextSources: ["Character candidate names", "Scenes where both characters appear together"],
    backendFeatureId: "import-relationship-extraction",
  },
};

export default FEATURES;

/**
 * Maps page IDs to the feature IDs available on that page.
 * Used by AIFeatureInfoModal to know which features to show.
 */
export const PAGE_FEATURES: Record<string, string[]> = {
  "story-health": [
    "prose-nlp",
    "entity-discovery",
    "editorial-consistency",
    "economy-analysis",
    "essential-questions",
    "pacing-analysis",
    "continuity-check",
    "theme-tracker",
    "plot-holes",
    "first-pass",
    "cliche-analysis",
    "character-dimensionality",
  ],
  "ai-panel": [
    "session-interview",
    "session-panel",
    "session-scene-assistant",
    "session-story-assistant",
    "session-writing-coach",
    "session-cliche-coach",
    "session-whatif",
    "session-discovery-questions",
    "session-show-dont-tell",
    "session-audience-adherence",
    "session-book-description",
    "session-query-letter",
    "session-scene-atmosphere",
  ],
  "character-sheet": [
    "session-interview",
    "character-role",
    "character-type-classification",
    "character-jungian-archetype",
    "character-narrative-archetype",
    "character-attributes",
    "character-dimensionality",
    "character-arc",
    "dialogue-voice",
    "dialogue-prose",
    "character-tag-dialogue",
  ],
  "worldbuilding": [
    "wb-what-exists",
    "wb-location-suggest",
    "wb-culture-suggest",
    "wb-implications",
    "wb-system",
    "wb-calendar",
    "wb-travel",
  ],
  "scene-editor": [
    "story-summary",
    "scene-plan",
    "brainstorm",
    "auto-tag-dialogue",
    "auto-link-entities",
  ],
  "outline": [
    "extract-outline",
    "snowflake-guidance",
  ],
  "discovery-queue": [
    "discovery-queue",
  ],
  "twists": [
    "twist-analysis",
    "twist-impact",
    "reader-knowledge-scan",
  ],
  "plot-threads": [
    "thread-analysis",
  ],
  "story-identity": [
    "identity-workshop",
    "story-summary",
    "perspective-summary",
  ],
  "import": [
    "import-ner-characters",
    "import-ner-locations",
    "import-ai-character-details",
    "import-ai-location-details",
    "import-ai-relationships",
  ],
};

/**
 * Human-readable page labels shown in the modal title.
 */
export const PAGE_LABELS: Record<string, string> = {
  "story-health": "Story Health",
  "ai-panel": "AI Assistant",
  "character-sheet": "Character Sheet",
  "worldbuilding": "World Building",
  "scene-editor": "Scene Editor",
  "outline": "Outline",
  "discovery-queue": "Discovery Queue",
  "twists": "Twists & Misdirection",
  "plot-threads": "Plot Threads",
  "story-identity": "Story Identity",
  "import": "Document Import",
};
