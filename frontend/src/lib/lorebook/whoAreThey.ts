/**
 * Who are they (doc 20): the character sheet's view of who a person is. The fields as the sheet
 * shows them, the suggestions each offers (a datalist: anything can be typed, D3), the areas of
 * Body and mind, and the few lines other places show (the compact sheet, the hover card, the arc).
 *
 * Wording rule for every label, hint and suggestion here: no "suffers from", "confined to",
 * "bound", "victim", "afflicted", "despite", and nothing called "normal" (whoAreThey.test.ts).
 */
import type { Character, Facet, FacetArea, Formative, Known } from "../../types";
import type { FieldSpec } from "./kinds";

/** Gender terms that belong to a people, offered with where they come from (Decision 8). */
const GENDERS: FieldSpec["options"] = [
  "woman",
  "man",
  "non-binary",
  "genderfluid",
  "genderqueer",
  "agender",
  "trans woman",
  "trans man",
  "questioning",
  { value: "two-spirit", note: "Indigenous North American" },
  { value: "hijra", note: "South Asia" },
  { value: "fa'afafine", note: "Samoa" },
  { value: "muxe", note: "Zapotec, Mexico" },
  { value: "burrnesha", note: "Albania" },
];

/** Identity (P1): one line each, then paragraphs. Gender, presentation, sex and pronouns are four things. */
export const IDENTITY_FIELDS: FieldSpec[] = [
  {
    key: "gender",
    label: "Gender",
    hint: "Who they are, in the words they'd use…",
    short: true,
    options: GENDERS,
  },
  {
    key: "presentation",
    label: "Presents as",
    hint: "How they present, and whether it changes…",
    short: true,
    options: ["feminine", "masculine", "androgynous", "it varies", "depends who's watching"],
  },
  {
    key: "sex",
    label: "Sex",
    hint: "Sex characteristics, if they matter to the story; not the same as gender…",
    short: true,
    options: ["female", "male", "intersex", "not known"],
  },
  { key: "age", label: "Age", hint: "A number, or how old they seem…", short: true },
  {
    key: "orientation",
    label: "Orientation",
    hint: "Who they're drawn to, if anyone, and who knows…",
    short: true,
    options: [
      "straight",
      "gay",
      "lesbian",
      "bisexual",
      "pansexual",
      "asexual",
      "aromantic",
      "queer",
      "questioning",
      "not sure",
    ],
  },
  {
    key: "languages",
    label: "Languages",
    hint: "What they speak, and which one they dream in…",
    short: true,
  },
  {
    key: "heritage",
    label: "Heritage",
    hint: "Where their people come from; what they carry of it, or left…",
  },
  { key: "faith", label: "Faith", hint: "What they believe in, practise, or walked away from…" },
  { key: "family", label: "Family", hint: "Who raised them, who they count as family, who they've lost…" },
  {
    key: "circumstances",
    label: "Money and class",
    hint: "What they grew up with, what they have now, what it lets them do…",
  },
];

/** How they think (P2): beside the scale, in words. */
export const THINKING_FIELDS: FieldSpec[] = [
  {
    key: "thinking",
    label: "How they think",
    hint: "How their mind works: in pictures, out loud, in lists…",
    short: true,
    options: [
      "in pictures",
      "in words",
      "out loud",
      "in lists",
      "by doing",
      "sideways, by association",
      "slowly and thoroughly",
      "in numbers",
      "in stories",
      "in arguments with themselves",
    ],
  },
];

/** How they take things (P2): what hurts and what they do with it. Temperament is how fast they boil. */
export const TAKES_FIELDS: FieldSpec[] = [
  { key: "sore_spots", label: "Gets under their skin", hint: "What stings, and why that, of all things…" },
  {
    key: "takes_personally",
    label: "How personally they take things",
    hint: "Criticism, a joke, a slight, being left out…",
  },
  {
    key: "shows_hurt",
    label: "How it shows",
    hint: "Goes quiet, gets sharp, laughs it off, apologises too much…",
  },
  {
    key: "copes",
    label: "How they cope",
    hint: "What they do with it: work, walk, drink, call someone, nothing…",
  },
  {
    key: "holds_on",
    label: "How long they hold on",
    hint: "Gone by morning, or still counting years later…",
  },
];

/** Every plain field of the view, for labels elsewhere (series comparisons). */
export const WHO_FIELDS: FieldSpec[] = [...IDENTITY_FIELDS, ...THINKING_FIELDS, ...TAKES_FIELDS];

export interface AreaSpec {
  label: string;
  suggestions: string[];
}

/** Body and mind (P4), in the order the sheet shows them. */
export const AREAS: Record<FacetArea, AreaSpec> = {
  moving: {
    label: "Moving",
    suggestions: [
      "wheelchair user",
      "uses a cane",
      "uses crutches",
      "uses a mobility scooter",
      "prosthetic leg",
      "limb difference",
      "amputee",
      "limited mobility",
      "arthritis",
    ],
  },
  senses: {
    label: "Senses",
    suggestions: [
      "Deaf",
      "deaf",
      "hard of hearing",
      "hearing aids",
      "cochlear implant",
      "blind",
      "low vision",
      "uses a white cane",
      "guide dog",
      "DeafBlind",
      "colour blind",
    ],
  },
  communicating: {
    label: "Communicating",
    suggestions: [
      "signs (BSL, ASL…)",
      "uses AAC",
      "nonspeaking",
      "stammers",
      "aphasia",
      "situational mutism",
    ],
  },
  health: {
    label: "Long-term health and pain",
    suggestions: [
      "chronic pain",
      "epilepsy",
      "diabetes",
      "Parkinson's",
      "MS",
      "migraine",
      "ME/CFS",
      "long COVID",
      "Crohn's",
      "HIV",
      "in cancer treatment",
      "cancer survivor",
    ],
  },
  neurodivergence: {
    label: "Neurodivergence",
    suggestions: ["autistic", "ADHD", "dyslexic", "dyspraxic", "Tourette's", "learning disability"],
  },
  mental_health: {
    label: "Mental health",
    suggestions: [
      "anxiety",
      "panic attacks",
      "depression",
      "PTSD",
      "bipolar",
      "OCD",
      "eating disorder",
      "psychosis",
      "grief that hasn't moved",
      "in recovery",
    ],
  },
  other: { label: "Something else", suggestions: [] },
};

export const AREA_ORDER = Object.keys(AREAS) as FacetArea[];

/** An entry's paragraphs, each empty until written (the same "empty is quiet" as the sheet). */
export const FACET_FIELDS: FieldSpec[] = [
  {
    key: "since",
    label: "Since",
    hint: "Born with it, since an accident, diagnosed last year…",
    short: true,
  },
  {
    key: "days",
    label: "How it shapes their days",
    hint: "What they plan around, what it costs, what they're good at because of it…",
  },
  {
    key: "impact",
    label: "What it does to them",
    hint: "In how they think, in what they do, in how they are with people…",
  },
  { key: "page", label: "How it shows on the page", hint: "What a reader notices, and what they wouldn't…" },
  { key: "understood", label: "What they'd want understood", hint: "In their words, if they'd say it…" },
];

export const FORMATIVE_FIELDS: FieldSpec[] = [
  { key: "when", label: "When", hint: "Five years before the story, at nine, last winter…", short: true },
  { key: "what", label: "What happened", hint: "As much or as little as you want written down…" },
  {
    key: "impact",
    label: "What it did to them",
    hint: "How they think, what they do, how they love and trust…",
  },
  { key: "page", label: "How it shows", hint: "What sets it off, what they avoid, what a reader sees…" },
];

export const KNOWN_LABELS: Record<Known, string> = {
  everyone: "Everyone knows",
  some: "Some know",
  only_them: "Only they know",
};

export function newFacet(area: FacetArea): Facet {
  return {
    id: crypto.randomUUID(),
    area,
    name: "",
    since: "",
    days: "",
    impact: "",
    page: "",
    understood: "",
    known: "everyone",
    known_to: [],
    known_note: "",
    revealed_in: null,
    assistant: true,
    research: [],
  };
}

export function newFormative(): Formative {
  return {
    id: crypto.randomUUID(),
    title: "",
    when: "",
    what: "",
    impact: "",
    page: "",
    wound: false,
    notes: [],
    known: "only_them",
    known_to: [],
    known_note: "",
    revealed_in: null,
    assistant: true,
  };
}

/** The quiet line the compact sheet shows: "woman · she/her · Parkinson's". */
export function whoLine(c: Pick<Character, "gender" | "pronouns" | "age" | "facets">): string {
  return [c.gender, c.pronouns, c.age, ...(c.facets ?? []).map((f) => f.name)]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * What everyone in the story can see: the "on the page" lines of entries everyone knows about.
 * The hover card shows these, so a card never shows something hidden (Decision 11).
 */
export function seenByEveryone(c: Pick<Character, "facets">): { name: string; page: string }[] {
  return (c.facets ?? [])
    .filter((f) => f.known === "everyone" && f.name.trim())
    .map((f) => ({ name: f.name.trim(), page: f.page.trim() }));
}

/** The arc in one line (P5): formed by → believes → wants → needs → against → learns. */
export function arcLine(c: Character): { label: string; value: string }[] {
  const wound = (c.formative ?? []).find((f) => f.wound && f.title.trim());
  return [
    { label: "formed by", value: wound?.title ?? "" },
    { label: "believes", value: c.lie },
    { label: "wants", value: c.mission_statement },
    { label: "needs", value: c.need },
    { label: "against", value: c.conflict },
    { label: "learns", value: c.epiphany },
  ].map((s) => ({ ...s, value: (s.value ?? "").trim() }));
}

/**
 * How someone's body and mind show on the page, for the scene panel's Who is here (doc 20 P7):
 * the author's own words beside the prose while it is written, never advice.
 */
export function pageLine(c: Pick<Character, "facets">, areas?: FacetArea[]): string {
  return (c.facets ?? [])
    .filter((f) => f.name.trim() && f.page.trim() && (!areas || areas.includes(f.area)))
    .map((f) => `${f.name.trim()}: ${f.page.trim()}`)
    .join(" · ");
}

/** The areas a point of view is told through: what they perceive, how they move, how they feel. */
export const POV_AREAS: FacetArea[] = ["senses", "moving", "mental_health"];
