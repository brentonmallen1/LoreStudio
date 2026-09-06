import type { AIFeatureInfo } from "./types";

/** Character sheet — profile fields, arc work and voice. */
export const CHARACTERS_FEATURES: Record<string, AIFeatureInfo> = {
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
  "character-attributes": {
    id: "character-attributes",
    label: "Attribute Suggestions",
    type: "ai",
    shortDescription: "Three short options for traits, backstory, quirks or appearance",
    fullDescription:
      "Offers three short options for one profile field, each with the reason it fits, grounded in what the profile already says. Nothing is written to the character until you apply it.",
    contextSources: ["Character name, role, personality", "Existing traits & background", "Story context"],
    backendFeatureId: "character-attributes",
  },
  "character-arc": {
    id: "character-arc",
    label: "Character Arc Analysis",
    type: "ai",
    shortDescription: "Where is this character in their arc right now?",
    fullDescription:
      "Reviews the character's profile, arc milestones, and scenes where they appear to assess where they currently stand in their arc and what still needs to happen.",
    contextSources: [
      "Character profile & arc notes",
      "Arc milestones (done/pending)",
      "Scenes mentioning the character",
    ],
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
  "character-journey": {
    id: "character-journey",
    label: "Character Journey",
    type: "ai",
    shortDescription: "A running account of what this character has been through",
    fullDescription:
      "Summarises the character's path through the scenes they appear in, with their arc milestones. Used as interview context, so accuracy matters more than colour.",
    contextSources: ["Scenes the character appears in", "Arc milestones", "Interview history"],
    backendFeatureId: "character-journey",
  },
  "voice-fidelity": {
    id: "voice-fidelity",
    label: "Voice Fidelity",
    type: "ai",
    shortDescription: "Does their dialogue stay in their own voice?",
    fullDescription:
      "Compares the character's dialogue lines against the voice you described and flags lines that drift toward the narrator or another character.",
    contextSources: ["The character's dialogue lines", "Voice notes on the profile"],
    backendFeatureId: "voice-fidelity",
  },
  "character-from-image": {
    id: "character-from-image",
    label: "Character from Image",
    type: "ai",
    shortDescription: "Read a reference image into suggested profile fields",
    fullDescription:
      "Describes what is visible in a reference image and offers appearance attributes as suggestions. It reports what it sees; it does not invent backstory.",
    contextSources: ["The reference image", "Existing character fields"],
    backendFeatureId: "character-from-image",
  },
  "pronoun-identification": {
    id: "pronoun-identification",
    label: "Pronoun Identification",
    type: "ai",
    shortDescription: "Find the pronouns that refer to this character",
    fullDescription:
      "Identifies which pronouns in the prose refer to this character so the pronoun change itself can run deterministically. You confirm the list before anything is edited.",
    contextSources: ["Scene prose text", "Character names & aliases"],
    backendFeatureId: "pronoun-identification",
  },
};
