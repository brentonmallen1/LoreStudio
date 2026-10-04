/**
 * "My first story" (doc 18 C10): seven short steps from New story, each saying what it
 * becomes, each with how The Last Lighthouse does it and why it helps. Skip any; come back
 * any time.
 */
export type StepId = "idea" | "who" | "question" | "secret" | "scenes" | "write" | "tour";

export interface Step {
  id: StepId;
  title: string;
  /** What the answer turns into. */
  becomes: string;
  /** The page's heading, a question to the writer. */
  ask: string;
  explain: string;
  example: { label: string; quote?: string; text: string };
  why: string;
}

export const STEPS: Step[] = [
  {
    id: "idea",
    title: "Your idea in a sentence",
    becomes: "becomes your logline",
    ask: "What is your story, in one sentence?",
    explain:
      "Say who it's about, what they want and what stands in the way. It doesn't have to be good yet; it has to be yours. You'll come back to it as the story finds itself.",
    example: {
      label: "In The Last Lighthouse",
      quote:
        "When a mysterious historian arrives in a storm, a reclusive lighthouse keeper must choose between guarding her secrets and facing what she buried.",
      text: "Someone (a keeper), a pressure (a stranger in a storm), a choice (secrets or the truth).",
    },
    why: "One sentence is something to steer by. When a scene wanders, ask whether it serves this.",
  },
  {
    id: "who",
    title: "Who it's about, and what they want",
    becomes: "becomes your first character",
    ask: "Who is your story about, and what do they want?",
    explain:
      "A story follows someone who wants something. Give them a name, and say what they want, even if it isn't what they need.",
    example: {
      label: "In The Last Lighthouse",
      quote: "Eleanor Vance wants to keep her father's memory the way she remembers it.",
      text: "What she needs is the truth about him. The gap between the two is the story.",
    },
    why: "A want gives every scene a direction: closer to it, or further away.",
  },
  {
    id: "question",
    title: "What question your story asks",
    becomes: "becomes your first thread",
    ask: "What question does your story ask?",
    explain:
      "Most stories open with a question the reader wants answered: who did it, will she get home, what is he hiding. The story is a promise to answer it. Name yours here; it becomes your first thread, and you can say later which scenes move it on and where it's answered.",
    example: {
      label: "In The Last Lighthouse",
      quote:
        "Several entries from five years ago are missing. What was recorded there, and why were they removed?",
      text: "It opens in the first scene, when Eleanor writes in the log, and is answered in the last, when she writes an entry that names the gap. Every scene between moves it a step.",
    },
    why: "When you know the question, every scene has a job: move it on, complicate it, or answer it. LoreStudio will show you when it has gone quiet for too long.",
  },
  {
    id: "secret",
    title: "A secret, if you want one",
    becomes: "becomes a twist, with its truth",
    ask: "Is there something the reader won't know until late?",
    explain:
      "A twist is a truth hidden behind what the reader believes. Say what's really going on, and what the reader thinks is going on until it comes out. Not every story needs one; skip this if yours doesn't.",
    example: {
      label: "In The Last Lighthouse",
      quote:
        "Thomas Vance did not answer the Ardent's distress call, and destroyed the logs that would have shown it.",
      text: "Until the reveal, the reader believes the missing entries are a clerical gap, or his illness.",
    },
    why: "Knowing the truth early lets you plant clues on the way, so the reveal feels earned rather than sprung.",
  },
  {
    id: "scenes",
    title: "Three scenes: a start, a middle, an end",
    becomes: "becomes your scene list",
    ask: "Where does it start, what happens in the middle, and how does it end?",
    explain:
      "Three scenes are enough to begin: a line for what happens in each. They go into your story as planned scenes, with no prose yet. Your question opens in the first and is answered in the last.",
    example: {
      label: "In The Last Lighthouse",
      text: "The Light: Eleanor keeps the log as the storm comes in. What Thomas Knew: the Visitor tells her what her father did. The New Entry: Eleanor writes the truth into the log.",
    },
    why: "A start and an end tell you what the middle is for. You can add the rest as you go.",
  },
  {
    id: "write",
    title: "Write the first scene",
    becomes: "opens the editor",
    ask: "Ready to write?",
    explain:
      "Open your first scene and write. Don't edit as you go; a first draft is for finding out what happens. The side panel's This scene tab keeps your plan beside the page.",
    example: {
      label: "In The Last Lighthouse",
      quote: "The barometer had been falling since noon.",
      text: "Seven words: a place, a ritual and a storm on its way. The first line only has to make the reader want the second.",
    },
    why: "Everything else is planning. This is the story.",
  },
  {
    id: "tour",
    title: "What you've made, and where it lives",
    becomes: "a tour of your story",
    ask: "Here is what you've made, and where to find it.",
    explain: "Everything you answered is part of your story now. Change any of it, any time.",
    example: {
      label: "Find your way",
      text: "Search, in the header, finds any scene, character or page. Guides, under the compass beside it, explain each part.",
    },
    why: "The walkthrough ends here; your story doesn't. Come back to this page from the palette whenever you like.",
  },
];
