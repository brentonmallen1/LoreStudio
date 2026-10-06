/**
 * What each section of the Numbers page measures, why it is there and how to read it, for the
 * ⓘ beside its heading. Description, not advice: every line says what a number is or what it
 * can and cannot show, never what the author ought to do about it. Keep the definitions in step
 * with the code that computes them (services/numbers.py, lib/numbers/charts.ts and pov.ts,
 * routers/scene_cast.py, the prose checks in services/nlp_analysis_service.py).
 */

export type NumbersSection =
  "words" | "pacing" | "threads" | "cast" | "pov" | "dialogue" | "prose" | "summaries";

export interface AboutSection {
  measures: string[];
  why: string[];
  reading: string[];
  /** How the section draws a comparison with an earlier reading (doc 19). */
  compared: string[];
}

export const ABOUT: Record<NumbersSection, AboutSection> = {
  words: {
    measures: [
      "Every word in the book's scenes, counted the way the editor counts as you type: a speaker tag is not a word, the name in a mention is.",
      "The bar divides that total by each scene's state (planned, draft, revised, final), as set on the scene. “About so many a scene” is the mean across the scenes that have any words; the median is the length half the written scenes run longer than and half shorter. The median is not the scene in the middle of the book; it can be any scene's length, the first or the last included.",
      "When the story has an intended length, the second bar sets the total against the upper end of that form's usual range: flash fiction 1,000 words, short story 7,500, novelette 17,500, novella 40,000, novel 100,000. The tick sits at 85% of it.",
    ],
    why: [
      "Length and progress are the plainest facts about a draft. Dividing the words by state shows how much of the book is settled and how much is still a first pass, which a single total hides.",
    ],
    reading: [
      "The form ranges are the common conventions of the trade, not rules, and many books sit outside them.",
      "When the mean is well above the median, a few long scenes carry much of the length; when it is well below, a few short ones pull the average down.",
      "The states are only as current as the scenes' own settings: a scene revised but still marked draft counts as draft.",
    ],
    compared: [
      "The earlier total is an outline on the state bar, on the same scale, and the total says what it was. Each state in the legend says its change (+412, −120).",
    ],
  },

  pacing: {
    measures: [
      "One column for each scene in reading order, numbered by chapter along the top. Its height is the scene's word count, on a scale from 0 to a round number just above the longest scene; its colour is the scene's state. The line across is the median length: half the written scenes are longer and half shorter. It is a length, not a position, so it can line up with any scene, the last included.",
      "With a beat sheet chosen for the story, the row of dots above sits where the sheet places each beat, as a share of the book's words. A filled dot has a scene assigned to that beat; a hollow one has none.",
    ],
    why: [
      "How much room each scene takes is one measure of pace that can be read off the page without interpretation. Laid end to end, the proportions of the whole book are visible at once.",
    ],
    reading: [
      "Length is not speed: a long scene can move quickly and a short one slowly. The chart shows where the book spends its words, not how they read.",
      "A beat's dot is where the sheet expects it, not where its scene is. A dot some way from the scene assigned to it means this book's proportions differ from the sheet's at that point.",
      "A scene with no words yet is a dashed mark on the baseline, so a planned stretch shows as a run of them until it is drafted. Choose a column to open its scene.",
    ],
    compared: [
      "Each column's earlier height is an outline behind it; a scene new since then is ringed and has no outline. The earlier median is a fainter line with its value beside it. Scenes removed or moved since then are listed under the chart.",
      "Scenes are matched by identity, not title or place: a renamed scene is the same scene, and a moved one is drawn where it is now.",
    ],
  },

  threads: {
    measures: [
      "A lane for each plot thread, with a mark for each scene the thread is linked to and a line from its first scene to its last. Lanes are ordered by where each thread first appears.",
      "Each mark's shape is what that scene does to the thread, as set on the thread: opens it, moves it on, turns or complicates it, a try that fails, a try that succeeds, closes it. They are the tapestry's marks, and the legend names the ones in use.",
      "The word on the right is the thread's status (planned, open, resolved, set aside). It follows from the scenes that open and close it, and is not read from the prose.",
    ],
    why: [
      "Threads are what a reader is following. Their spans show how many are in play at any point in the book, and for how long each is carried.",
    ],
    reading: [
      "Reading straight down from a scene gives how many threads touch it. A long line with few marks is a thread carried a long way with little time on the page; the shapes along it show whether it moves, turns or is tried along the way.",
      "A thread only appears in the scenes it has been linked to, so an unlinked scene where the thread still matters will not show here.",
      "The lanes share the pacing chart's columns, so a thread can be read against the length of the scenes it runs through.",
    ],
    compared: [
      "A mark new since then is ringed; a mark there then and gone now is drawn faint where its scene is. A changed status says what it was (“Resolved · was Open”); a thread that did not exist then says “new”.",
    ],
  },

  cast: {
    measures: [
      "A row for each character who appears, with a square for every scene they are in. A character is in a scene when it is seen through them, when the prose names them (by name, by what they are known as, or in a speaker tag on their line), or when the scene has them placed in it by hand. Marked absent by hand, they are out even if named.",
      "A cell is filled in the character's colour where the scene is seen through them, in a lighter step of it where they are only on the page, and left empty where they are not in it. The page shows the six characters in the most scenes; Open the full grid shows every character, with each scene named. Rows are ordered by how many scenes each character is in. “Quiet lately” marks a character who was on the page earlier and is in none of the last three scenes that have words. “Arc 2/5” counts their arc milestones checked off.",
      "Characters in no scene yet are listed underneath.",
    ],
    why: [
      "Presence is how a reader comes to know a character. The grid shows how often each one is seen and where in the book, in the same columns as the pacing and threads above.",
    ],
    reading: [
      "Being named counts as presence, so a passing mention fills a square just as a scene of their own does, and a character who is there but never named and never tagged as speaking does not, unless placed by hand.",
      "“Quiet lately” is a fixed count of three written scenes, whatever the character's part in the book. It says only that they have not been on the page recently.",
    ],
    compared: [
      "A cell gained since then has a dot; a cell lost is a faint outline in the character's colour. Each count says its change. Only scenes that existed then can gain or lose someone: a scene new since then is marked in Pacing.",
    ],
  },

  pov: {
    measures: [
      "Drawn only when the book has two or more point-of-view characters. One strip, a square for each scene in the colour of the character it is seen through: the scene's own point of view, or the book's when the scene has none. A grey square has no point of view set. Planned scenes count, since a viewpoint is often chosen before a scene is written.",
      "The book's usual turn is the average number of scenes it takes for the same eyes to come round again. “Away a while” marks a viewpoint whose last scene is at least three scenes back and more than twice that turn.",
    ],
    why: [
      "In a book with several viewpoints, the rotation is part of its structure: how the reader's time is divided among the people they see through.",
    ],
    reading: [
      "An even rotation and an uneven one are both shapes a book can have; the chart shows which this one has.",
      "“Away a while” is measured against this book's own rhythm, not a standard, so the same gap can be marked in one book and not in another. Choose a square to open its scene.",
    ],
    compared: [
      "A scene whose point of view changed has a thin band under it in the colour of whose eyes it was seen through then. Each viewpoint's count says what it was.",
    ],
  },

  dialogue: {
    measures: [
      "Lines spoken aloud, in quotation marks, across every scene; thoughts are not counted. A line has a speaker when it is tagged with one, when a name or a “she said” sits beside it, or when it is the next turn of a back-and-forth between two speakers. Lines with no speaker count toward the total and are left out of everything else.",
      "Each bar is a speaker's share of all the words spoken by everyone with a speaker: the full track is the whole, the fill is theirs. The tick across the bars is an even share, 100% divided by the number of speakers. Past eight speakers, all but the first seven share one row. Balance runs from 0 to 100: 100 when every speaker says the same number of words, near 0 when one says nearly all of them (it is 100 less the Gini coefficient of words spoken, as a percentage). From 75 it reads “shared fairly evenly”, from 50 “led by a few voices”, below that “dominated by one or two voices”.",
      "The pairs are characters who both speak in the same scene, by number of scenes. A scene is listed when, among two or more speakers, one has 80% or more of the words spoken.",
    ],
    why: [
      "Who speaks, and how much, measures whose voice the book gives room to. The pairs show which relationships are carried in conversation.",
    ],
    reading: [
      "A fill past the tick is more than an even share; short of it, less. The shares always add up to 100%, so one voice's room is always another's.",
      "Balance depends on how many people speak: a book with two speakers and one with twenty can score alike for different reasons.",
      "A scene listed for one voice may be a confession, an interrogation or a lecture. The figure says only that one speaker held the floor.",
      "Speakers are found by reading the text around each line, so some will be wrong or missing until confirmed; untagged lines leave the shares short until they have a speaker.",
    ],
    compared: [
      "A firmer tick on each speaker's track is their share then, and the row reads “47%, was 52%”. The balance says what it was.",
    ],
  },

  prose: {
    measures: [
      "Measured on this machine by a grammar parser, with no AI model, as of the last time it was run (shown beside the figures). The figures do not change as you write; Measure again to update them.",
      "Passive: the share of sentences containing a passive construction (“the door was opened”), found from each sentence's grammar. Adverbs: adverbs ending in -ly that modify a verb (“closed it quietly”), as a share of all words; other adverbs are not counted. Sentence length: the average number of words a sentence runs to.",
      "The histogram is the share of all measured sentences in each length band, in words: 1–5, 6–10, 11–20, 21–35 and 36 or more.",
    ],
    why: [
      "These are habits that are hard to see from inside the prose and easy to count. A figure for the whole book gives a baseline for its own voice.",
    ],
    reading: [
      "None of these is a fault on its own: the passive is often the right construction, and a style built on long sentences will lean the histogram to the right.",
      "The figures are most informative against themselves, this book at an earlier measure, or another of yours, rather than against a general norm.",
      "The parser makes mistakes, more often in dialogue and fragments. The passages these checks flag, scene by scene, are in Findings.",
    ],
    compared: [
      "Each figure says what it was, and the earlier run's shares are outlines beside the columns. A reading taken before the prose was ever measured is said to be so, not drawn as zero; a run not repeated since is said to be the same run.",
    ],
  },

  summaries: {
    measures: [
      "How many written scenes have a short summary from the Assistant: up to date, written before the scene last changed, or not written yet.",
    ],
    why: [
      "The Assistant works from these summaries when it needs scenes it is not reading in full, so they are part of what it knows about the book.",
    ],
    reading: [
      "A summary counts as out of date as soon as its scene's text changes, however small the change, so it may still be accurate.",
      "Write summaries writes only the ones missing or out of date, one scene at a time, and can be stopped between scenes. Each call to the model is logged in the Chronicle. Findings' ⋯ menu starts the same job.",
    ],
    compared: [
      "The counts then follow the counts now. While two earlier readings are compared, the button that writes summaries is hidden: it acts on the book as it is.",
    ],
  },
};
