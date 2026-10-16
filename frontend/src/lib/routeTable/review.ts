import { BarChart3, Clock, FileInput, History, MessageSquareMore, ScanEye, Send, Undo2 } from "lucide-react";
import type { UIMode } from "../mode";
import type { StoryRoute } from "../routes";

const BOTH: UIMode[] = ["writer", "studio"];
const STUDIO: UIMode[] = ["studio"];

/** The Review group: what needs a second look, the figures, the history and the finished book. Part of `STORY_ROUTES` (lib/routes.ts). */
export const REVIEW_ROUTES: StoryRoute[] = [
  {
    id: "findings",
    path: "/findings",
    label: "Findings",
    purpose: "Things in the prose worth a second look; none of them are rules",
    guide: "findings",
    icon: ScanEye,
    domain: "system",
    modes: BOTH,
    // Story Health was this page's name until doc 12 P4; people will still look for it.
    keywords: ["story health", "what needs my eye", "issues", "problems", "report", "analysis", "checks"],
  },
  {
    // What Story Health measured, back on a page of its own (doc 13 P3, D5).
    id: "numbers",
    path: "/numbers",
    label: "Numbers",
    purpose: "Counts about your prose, to compare the book with itself",
    guide: "numbers",
    icon: BarChart3,
    domain: "system",
    modes: BOTH,
    keywords: [
      "stats",
      "statistics",
      "metrics",
      "pacing",
      "screen time",
      "dialogue",
      "word count",
      "progress",
    ],
  },
  {
    id: "chronicle",
    path: "/chronicle",
    label: "Chronicle",
    purpose: "Everything that happened to this story, and its saved versions",
    guide: "chronicle",
    icon: Clock,
    domain: "chronicle",
    modes: BOTH,
    keywords: ["history", "log", "ai log"],
    sections: [
      {
        id: "activity",
        path: "",
        label: "Activity",
        purpose: "What LoreStudio did for this story, and when",
        guide: "chronicle",
        icon: Clock,
        keywords: ["jobs", "calls", "analyses", "runs", "what happened"],
      },
      {
        id: "conversations",
        path: "/conversations",
        label: "Conversations",
        purpose: "Your talks with the Assistant and your characters",
        guide: "chronicle",
        icon: MessageSquareMore,
        ai: true,
        keywords: ["chats", "sessions", "interviews", "transcripts"],
      },
      {
        id: "changes",
        path: "/changes",
        label: "Changes",
        purpose: "Every change to the story, so you can undo any of them",
        guide: "snapshots-and-backups",
        icon: Undo2,
        keywords: ["edits", "undo", "change log"],
      },
      {
        id: "versions",
        path: "/versions",
        label: "Versions",
        purpose: "Saved copies of the whole story to come back to",
        guide: "snapshots-and-backups",
        icon: History,
        keywords: [
          "snapshots",
          "snapshot",
          "auto backups",
          "backups",
          "restore",
          "backup",
          "version history",
          "save a version",
        ],
      },
      // What each import brought and where it went (doc 28).
      {
        id: "imports",
        path: "/imports",
        label: "Imports",
        purpose: "What came in from other apps, and what's still waiting",
        guide: "import-and-export",
        icon: FileInput,
        detailParam: "recordId",
      },
    ],
  },
  {
    id: "publish",
    path: "/publish",
    label: "Publish",
    purpose: "The story laid out as a book, ready to share",
    guide: "import-and-export",
    icon: Send,
    domain: "system",
    modes: STUDIO,
    keywords: ["export", "query letter", "synopsis", "share"],
  },
];
