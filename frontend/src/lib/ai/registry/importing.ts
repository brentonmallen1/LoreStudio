import type { AIFeatureInfo } from "./types";

/** Document import — what the importer offers to extract. */
export const IMPORTING_FEATURES: Record<string, AIFeatureInfo> = {
  "import-ner-characters": {
    id: "import-ner-characters",
    label: "Find Character Names",
    type: "nlp",
    shortDescription: "Detect character names via named entity recognition",
    fullDescription:
      "Uses spaCy's named entity recognition to identify PERSON entities throughout your manuscript. Fast and fully local: no AI or internet required. Found names become character candidates you can review before adding to the Lorebook.",
    contextSources: ["Imported manuscript text (all paragraphs)"],
  },
  "import-ner-locations": {
    id: "import-ner-locations",
    label: "Find Location Names",
    type: "nlp",
    shortDescription: "Detect location names via named entity recognition",
    fullDescription:
      "Uses spaCy's named entity recognition to identify GPE (geopolitical places) and LOC (locations) entities in your manuscript. Fast and fully local: no AI required. Found names become location candidates you can review before adding to the Lorebook.",
    contextSources: ["Imported manuscript text (all paragraphs)"],
  },
  "import-ai-character-details": {
    id: "import-ai-character-details",
    label: "Extract Character Details",
    type: "ai",
    shortDescription: "AI extracts personality, appearance, and motivation from prose",
    fullDescription:
      "For each character candidate found by NLP, gathers surrounding prose excerpts and asks the AI to extract attributes like role, personality, motivation, appearance, and background. Only information explicitly present in the text is extracted.",
    contextSources: ["Character name", "Prose excerpts where the character appears"],
    backendFeatureId: "import-extraction",
  },
  "import-ai-location-details": {
    id: "import-ai-location-details",
    label: "Extract Location Details",
    type: "ai",
    shortDescription: "AI extracts description, atmosphere, and significance from prose",
    fullDescription:
      "For each location candidate found by NLP, gathers prose excerpts and asks the AI to extract type, physical description, atmosphere, and narrative significance. Only information explicitly present in the text is extracted.",
    contextSources: ["Location name", "Prose excerpts where the location appears"],
    backendFeatureId: "import-extraction",
  },
  "import-ai-relationships": {
    id: "import-ai-relationships",
    label: "Detect Relationships",
    type: "ai",
    shortDescription: "AI identifies relationships between character candidates",
    fullDescription:
      "Analyzes scenes where multiple character candidates appear together to detect and describe their relationships (family, romantic, professional, rival, etc.). Requires at least 2 shared scene appearances to attempt detection.",
    contextSources: ["Character candidate names", "Scenes where both characters appear together"],
    backendFeatureId: "import-extraction",
  },
  "import-structure": {
    id: "import-structure",
    label: "Detect Structure",
    type: "ai",
    shortDescription: "Propose the act/chapter/scene split of a document",
    fullDescription:
      "Reads an imported document's headings and breaks and proposes where acts, chapters and scenes divide. Shown as a preview tree you edit before anything is created.",
    contextSources: ["Imported document headings & paragraphs"],
    backendFeatureId: "import-structure",
  },
};
