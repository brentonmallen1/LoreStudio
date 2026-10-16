import {
  Book,
  BookOpenText,
  FileText,
  Footprints,
  LayoutGrid,
  ListTree,
  MapIcon,
  NotebookPen,
  PenLine,
} from "lucide-react";
import type { UIMode } from "../mode";
import type { StoryRoute } from "../routes";

const BOTH: UIMode[] = ["writer", "studio"];

/** The Write group of the logo menu: the overview, the prose and the ways to plan and see it. Part of `STORY_ROUTES` (lib/routes.ts). */
export const WRITE_ROUTES: StoryRoute[] = [
  {
    id: "overview",
    path: "",
    label: "Overview",
    purpose: "Where your story stands, and what to do next",
    guide: "getting-started",
    icon: Book,
    domain: "home",
    modes: BOTH,
    keywords: ["home", "dashboard", "summary"],
  },
  {
    id: "write",
    path: "/write",
    label: "Write",
    purpose: "The prose, scene by scene",
    guide: "typing",
    icon: PenLine,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["editor", "scene", "manuscript", "prose"],
  },
  // The acts, chapters and scenes to add, rename and reorder: the strip, opened out on Write.
  {
    id: "outline",
    path: "/outline",
    label: "Outline",
    purpose: "What happens, part by part",
    guide: "structure",
    icon: ListTree,
    domain: "manuscript",
    modes: BOTH,
  },
  {
    id: "plan",
    path: "/plan",
    label: "Plan",
    purpose: "Guided questions that fill your Outline",
    guide: "planning",
    icon: MapIcon,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["beats", "snowflake", "synopsis", "logline", "method", "scene list", "beat board"],
  },
  {
    // The book as cards on a board (doc 24 D12): a page of its own, no longer a view of Write.
    id: "storyboard",
    path: "/storyboard",
    label: "Storyboard",
    purpose: "Your scenes as cards you can move around",
    guide: "structure",
    icon: LayoutGrid,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["board", "cards", "index cards", "corkboard", "canvas", "scene cards", "view"],
  },
  {
    // Every scene's summary down one page, written or drafted by the Assistant (doc 24 D12).
    id: "summaries",
    path: "/summaries",
    label: "Summaries",
    purpose: "Each scene in a few lines, to see the story at a glance",
    guide: "structure",
    icon: FileText,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["scene summaries", "synopsis", "recap", "what happens", "view"],
  },
  {
    // The book read straight through, and exported from there (doc 24 D12).
    id: "manuscript",
    path: "/manuscript",
    label: "Manuscript",
    purpose: "The whole story as one document, to read through or export",
    guide: "import-and-export",
    icon: BookOpenText,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["read through", "read it through", "whole book", "full text", "export", "print", "view"],
  },
  {
    // Loose writing, a heading for each day; words made into notes and characters (doc 15 N3).
    id: "freewrite",
    path: "/freewrite",
    label: "Freewrite",
    purpose: "Empty your head; sort it out later",
    guide: "notes-and-freewrite",
    icon: NotebookPen,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["ideas", "brain dump", "stream of consciousness", "journal", "loose", "capture"],
  },
  {
    // Seven short steps for a new writer, from New story, the logo menu or the palette (doc 18
    // C10). Always in the logo menu, finished or not (A2).
    id: "first-story",
    path: "/first-story",
    label: "First story guide",
    guide: "getting-started",
    purpose: "Seven guided steps from an idea to a first scene",
    icon: Footprints,
    domain: "home",
    modes: BOTH,
    keywords: [
      "my first story",
      "walkthrough",
      "tutorial",
      "first steps",
      "new writer",
      "guide me",
      "onboarding",
      "start here",
    ],
  },
];
