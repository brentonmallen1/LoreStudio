import type { GlossaryEntry } from "./types";

/**
 * The craft words (doc 30 D1): what a writing course would teach, in plain words, each with an
 * example from The Last Lighthouse where one fits. No entry assumes you have read the others.
 */

export const PLANNING = [
  {
    id: "logline",
    term: "Logline",
    definition:
      "One sentence that says what your story is: who it's about, what they want, and what's in the way. It's for you as much as anyone else: a compass to check the draft against.",
    example:
      "When a mysterious historian arrives in a storm, a reclusive lighthouse keeper must choose between guarding her secrets and facing what she buried.",
    alsoCalled: ["pitch", "one-line summary", "one-sentence summary"],
  },
  {
    id: "premise",
    term: "Premise",
    definition: "The situation your story starts from, a little longer than a logline.",
    example:
      "A solitary lighthouse keeper on a dying island must confront her buried past when a mysterious stranger arrives seeking answers she's spent years avoiding.",
  },
  {
    id: "synopsis",
    term: "Synopsis",
    definition:
      "A short account of everything that happens, ending included. For you, an agent or an editor.",
  },
  {
    id: "point-of-view",
    term: "Point of view (POV)",
    definition: "Whose eyes the reader sees through in a scene.",
    example: "The story stays close on Eleanor: we only know what she notices.",
    alsoCalled: ["POV", "viewpoint"],
  },
  {
    id: "beat",
    term: "Beat",
    definition: "One moment that moves the story, often a change or a decision.",
    example: "Eleanor lets the Visitor in from the storm.",
  },
  {
    id: "beat-sheet",
    term: "Classic pattern",
    definition:
      "A list of moments many stories share, with roughly where each falls, such as Save the Cat or the hero's journey. Shown on your Outline, it tags the scenes that carry each moment. A map of what often works, not a rule.",
    example: "The Last Lighthouse follows Save the Cat: “The Gap” is its midpoint.",
    alsoCalled: ["beat sheet", "story structure"],
  },
  {
    id: "inciting-incident",
    term: "Inciting incident",
    definition: "The event that starts the story moving and can't be undone.",
    example: "The knock at the door, in “Knock at the Door”.",
    alsoCalled: ["catalyst"],
  },
  {
    id: "midpoint",
    term: "Midpoint",
    definition:
      "About halfway through, something shifts: the stakes go up and the main character starts acting instead of reacting.",
    example: "“The Gap”: six months of log entries are missing.",
  },
  {
    id: "climax",
    term: "Climax",
    definition: "The story's biggest moment, where the main question is answered.",
  },
  {
    id: "pinch-point",
    term: "Pinch point",
    definition:
      "A squeeze between the big turns: a reminder of how strong whatever stands in the way is, so the stakes feel real.",
  },
  {
    id: "turning-point",
    term: "Turning point",
    definition:
      "A moment that sends the story in a new direction, usually by a choice the main character can't take back. Three turning points split a story into its beginning, middle and end.",
    alsoCalled: ["plot point"],
  },
  {
    id: "b-story",
    term: "B story",
    definition:
      "A second story running beside the main one, often a friendship or a love, that carries what the story is about. The B just means second.",
    alsoCalled: ["subplot"],
  },
  {
    id: "try-fail",
    term: "Try/fail",
    definition:
      "A character tries to fix a problem and it gets worse, or works at a cost. Stories build by repeating this.",
    alsoCalled: ["try/fail cycle"],
  },
  {
    id: "arc",
    term: "Arc",
    definition: "How a character changes from start to end, or chooses not to.",
    example: "Eleanor moves from guarded self-sufficiency toward letting someone into her ordered world.",
    alsoCalled: ["character arc"],
  },
  {
    id: "mice",
    term: "MICE",
    definition:
      "Four kinds of story question: a place to explore (Milieu), a question to answer (Idea), a change in someone (Character), and a disruption to set right (Event). The one opened last is usually closed first.",
    example: "“The Missing Logs” is an Idea thread; “Eleanor's Father” is a Character thread.",
    alsoCalled: ["MICE quotient"],
  },
  {
    id: "act",
    term: "Act",
    definition:
      "One of the big parts of a story, usually three: beginning, middle and end. The strip marks each with a numeral: **I**, **II**, **III**.",
  },
  {
    id: "structure-template",
    term: "Structure template",
    definition:
      "Names for the big parts of your story, like Act, Chapter and Scene. Freeform is fine; you can add structure later.",
    alsoCalled: ["shape"],
  },
] as const satisfies readonly GlossaryEntry[];

export const PEOPLE = [
  {
    id: "protagonist",
    term: "Protagonist",
    definition: "The main character, whose wants drive the story.",
    example: "Eleanor Vance.",
  },
  {
    id: "antagonist",
    term: "Antagonist",
    definition: "Whoever or whatever stands most in the protagonist's way. It doesn't have to be a villain.",
  },
  {
    id: "deuteragonist",
    term: "Deuteragonist",
    definition: "The second most important character, often with a story of their own.",
    example: "Calder, the Visitor.",
  },
  {
    id: "foil",
    term: "Foil",
    definition: "A character whose differences make another's traits stand out.",
  },
  {
    id: "mentor",
    term: "Mentor",
    definition: "A character who teaches or guides the protagonist.",
  },
  {
    id: "character-role",
    term: "Role",
    definition:
      "The part a character plays in the story: the protagonist, the antagonist, a foil, a confidant. A lens, not a box.",
  },
  {
    id: "archetype",
    term: "Archetype",
    definition:
      "A familiar role characters play across many stories, like the mentor or the trickster. A lens, not a box.",
    example: "Calder's narrative archetype is the shapeshifter: she is not who she says she is.",
  },
  {
    id: "character-type",
    term: "Character type",
    definition:
      "Round characters are complex and surprising; flat ones have a trait or two. A dynamic character changes over the story; a static one doesn't. All are useful.",
    example: "Eleanor is dynamic; Calder is round.",
    alsoCalled: ["round", "flat", "dynamic", "static"],
  },
  {
    id: "goal-motivation-conflict",
    term: "Goal, motivation, conflict",
    definition: "What a character wants, why they want it, and what stops them.",
    alsoCalled: ["GMC", "the three questions"],
  },
  {
    id: "epiphany",
    term: "Epiphany",
    definition: "What a character finally understands by the end, or refuses to.",
    example: "Eleanor sees she has been confusing loyalty with silence.",
  },
  {
    id: "craft-lenses",
    term: "Craft lenses",
    definition:
      "Optional ways of looking at a character that writing books use: their character type, two kinds of archetype, and what they're for in the story. Take any that help; none of them is a box to fill.",
    example: "Eleanor is dynamic, a Ruler at heart, and the story's hero.",
  },
  {
    id: "narrative-intent",
    term: "What they're for",
    definition:
      "The part a character plays in your story: what their arc does, the moments they matter, what they stand for. Writing it down keeps them from drifting into a role you didn't mean.",
    example: "Calder is there to bring the past to Eleanor's door, and to mirror her.",
    alsoCalled: ["narrative intent", "narrative purpose", "story function"],
  },
  {
    id: "relationship-purpose",
    term: "What a relationship is for",
    definition:
      "What a bond between two characters does for the story: it drives conflict, steadies someone, carries information, or shows a contrast. A relationship can do several of these, or none you need to name.",
    example: "Eleanor and Margaret: an emotional anchor, and a way for the island's history to be told.",
    alsoCalled: ["narrative purpose"],
  },
] as const satisfies readonly GlossaryEntry[];

export const DEVICES = [
  {
    id: "thread",
    term: "Thread",
    definition:
      "A question your story opens and must close: a question, a place, a change in someone or a disruption to their world.",
    example: "“The Missing Logs”: what happened to six months of entries?",
    alsoCalled: ["plot thread"],
  },
  {
    id: "twist",
    term: "Twist",
    definition:
      "A surprise that changes how earlier events read: a truth hidden behind what the reader is led to believe. It is fair if the clues were there.",
  },
  {
    id: "clue",
    term: "Clue",
    definition: "A detail planted for a twist, pointing toward the truth or away from it.",
    example: "The Visitor is oddly calm for someone stranded in a storm.",
  },
  {
    id: "red-herring",
    term: "Red herring",
    definition: "A clue that points the wrong way on purpose.",
    example:
      "Thomas always said “the glass doesn't lie”, so the missing pages look like a clerical gap, not a lie.",
  },
  {
    id: "setup-and-payoff",
    term: "Setup and payoff",
    definition:
      "Something planted early (the setup) that matters later (the payoff), so the later moment lands.",
    example:
      "Eleanor's careful log-keeping in “The Light” sets up the shock of the missing entries in “The Gap”.",
  },
  {
    id: "foreshadowing",
    term: "Foreshadowing",
    definition: "A hint early on of something that happens later.",
  },
  {
    id: "dramatic-irony",
    term: "Dramatic irony",
    definition: "The reader knows something a character doesn't.",
    example:
      "In “Knock at the Door” the Visitor already knows Eleanor's name. The reader notices; Eleanor lets it pass.",
  },
  {
    id: "reader-knows",
    term: "What the reader knows",
    definition: "What the reader has learned, and believes, at each point in the book.",
  },
  {
    id: "trope",
    term: "Trope",
    definition: "A familiar story element readers recognize, played straight or turned on its head.",
    example: "The Mysterious Stranger, subverted: Calder is grieving, not dangerous.",
  },
] as const satisfies readonly GlossaryEntry[];

export const PROSE = [
  {
    id: "dialogue-tag",
    term: "Dialogue tag",
    definition: "The words that say who's speaking: “she said”.",
  },
  {
    id: "said-bookism",
    term: "Said-bookism",
    definition: "A fancy dialogue tag (“hissed”, “retorted”) where “said” would let the line do the work.",
  },
  {
    id: "passive-voice",
    term: "Passive voice",
    definition:
      "A sentence where things happen to the subject: “The log was torn” instead of “Thomas tore the log”. Fine sometimes; tiring in bulk.",
  },
  {
    id: "adverb",
    term: "Adverb",
    definition: "A word that changes a verb (“quickly”, “softly”). Often a stronger verb does it better.",
  },
  {
    id: "tense-slip",
    term: "Tense slip",
    definition: "Prose that moves from past to present (or back) by accident.",
  },
  {
    id: "pov-slip",
    term: "POV slip",
    definition: "A scene in one character's eyes that dips into another's head.",
    alsoCalled: ["head-hopping", "POV drift"],
  },
  {
    id: "show-dont-tell",
    term: "Show, don't tell",
    definition: "Let the reader see a feeling in action instead of naming it.",
  },
] as const satisfies readonly GlossaryEntry[];

export const SCRIPTS = [
  {
    id: "scene-heading",
    term: "Scene heading",
    definition:
      "The line that starts a script scene: INT. or EXT. (inside or outside), the place and the time.",
    alsoCalled: ["slug line", "slugline"],
  },
  {
    id: "parenthetical",
    term: "Parenthetical",
    definition: "A short note under a character's name about how a line is said.",
  },
] as const satisfies readonly GlossaryEntry[];
