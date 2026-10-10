# Writing a screenplay

A story is written as **prose** or as a **screenplay**. Choose under **Written as** when you make the story, or later in **Lorebook › Story identity**. Switching keeps every word: prose paragraphs read as action until you change them, and {{key:undo}} switches back.

## You write it the way you write prose

A screenplay is written with the same moves as prose. LoreStudio lays it out as a script.

| You do                                           | In prose                             | In a screenplay                                                   |
| ------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------- |
| Type a paragraph                                 | a paragraph                          | an action line: what we see                                       |
| Type `^` and pick who speaks                     | a quoted line tagged with their name | their name as a cue, and a line of dialogue under it to type into |
| Type a quote, then `<` and a name                | the quote is tagged                  | the quote becomes their dialogue, out of the action               |
| Select words and press {{key:attributeDialogue}} | the words are quoted and tagged      | the words become their dialogue                                   |
| Type `(` on an empty line of dialogue            |                                      | a parenthetical: _(quietly)_                                      |
| `@Name`, `[[Place]]`                             | a mention                            | the same                                                          |

If you write a line the prose way in the action, `"Run," Eleanor said.`, a quiet bar offers to make it Eleanor's line of dialogue. Nothing changes until you say so, and {{key:undo}} puts it back.

## Who speaks

In a script the character's name above a line says who speaks it, so there is nothing to tag. The **Dialogue** tool, each character's voice and the numbers read the lines from their cues: a parenthetical shows as the line's direction, and `(V.O.)` or `(O.S.)` as a voice-over or a line off screen. A character whose name is written in capitals in the action, the way a script introduces them, counts as named in that scene.

A cue for someone not in your Lorebook shows in **Findings**, with **Add to the Lorebook**. Renaming a character rewrites their cues too: ELEANOR becomes NELL.

## Elements

Every line of a script is one element: a **scene heading** (`INT. LIGHTHOUSE - NIGHT`), **action**, a **character** cue, a **parenthetical**, **dialogue**, or a **transition** (`CUT TO:`). The bottom right of the page shows the element the cursor is in and how long the scene runs, in eighths of a page, the way a script breakdown counts it.

You never have to set an element by hand. If you know Final Draft, these work too:

- **Enter** at the end of a line moves on to what usually comes next: dialogue after a cue, action after dialogue, a heading after a transition. On an empty cue or line of dialogue it goes back to action.
- **Tab** turns the line into the next element (action, character, transition, heading), and **Shift-Tab** goes back.
- **{{key:scriptHeading}}** to **{{key:scriptTransition}}** set the element directly: heading, action, character, parenthetical, dialogue, transition. The palette has them as _Script:_ commands.
- Typing `INT. ` or `EXT. ` at the start of a line starts a scene heading. A name in capitals followed by Enter becomes a cue (`BOOM!` stays action). A line in capitals ending `TO:` is a transition.
- Headings, cues and transitions are typed in capitals for you.
- In a cue, the characters in your Lorebook are offered as you type. A new name makes a new character: `MRS. HALE` becomes _Mrs. Hale_.
- Two more elements are in the palette: a **centred line** (_Script: Centred line_, for THE END or a title over black) and a **lyric** (_Script: Lyric_), which prints in italics where dialogue sits and counts as the singer's line.
- When two characters speak at once, put the cursor in the second speech and choose **Script: Speak at the same time** from the palette. The cue says "at the same time", and the printed page sets the two speeches side by side. Choose it again to undo it.
- Pasting Fountain text (the plain-text screenplay format) brings it in as elements. A whole script opens as a new story through **Import** on the dashboard.

## Scenes and their headings

Each scene in your structure opens on one heading, typed as its first line. LoreStudio reads it as you write: inside or out (`INT.`, `EXT.`, `INT./EXT.`), the place, and the time of day. The scene's glance and the Timeline show them, and a place your Lorebook already has becomes the scene's place, unless you have chosen one yourself.

A heading typed further down a scene starts another scene. A bar above the page offers **Start a new scene here**: everything from the heading on becomes the next scene, and its lines of dialogue and margin notes go with it. **Keep as a line** turns the heading into action instead. Splitting is one step, and {{key:undo}} puts the scene back together. Findings lists any scene with a second heading, with the same fix. Paste several scenes at once and the bar offers **Start each as a scene**, which makes a scene at every heading in one step.

A script may open on `FADE IN:` above the first heading; that heading is still the scene's own.

## The page

A screenplay is counted in pages, about a minute of screen time each: Courier 12 point, 55 lines to a page, each element in its place. The page count LoreStudio shows comes from the same layout the printed script uses.

Choose the script's form under **Intended length** in **Story identity**: a short film, a TV half-hour, a TV hour or a feature. Its length is counted in pages, and **Numbers** shows the pages against that form, each act's pages, how much of the script is speech, and any scene over three pages.

**Run checks** reads a script's action lines, which are written like prose: passive voice, adverbs, repeated words, and action that slips out of the present tense ("She opened the door" rather than "She opens the door"). A character's words are theirs to say however they say them, so dialogue is left alone, and the prose-only checks (tags other than said, point of view, sentence length) do not run.

**Publish** shows the script as its printed pages, and exports it as a screenplay PDF, a Final Draft file or Fountain, with a title page. See _Import and export_.

## The Assistant (Studio)

In Studio mode the Assistant knows it is reading a script. It sees each scene as a screenwriter would, with every heading, cue and line of dialogue in its place. It talks about pages rather than chapters, and like everywhere in LoreStudio it never writes a line of the script for you, dialogue included.

Some tools change for a script. **Unfilmables** takes the place of Show, Don't Tell and points at action a camera could not film: a thought, a feeling stated, backstory. **Pacing**, **First-pass editor** and **Story economy** measure in pages and eighths of a page. **Clichés** also looks for lines heard in a thousand films. The editorial pass judges the voice of the action lines and how distinct each character sounds, since a script has no narrator. Under **Publish**, **Logline & Synopsis** replaces the book description, the query is written for a manager or producer, and **Comparable Films** suggests films and series. Dialogue attribution is not offered, because the cue above each line already says who speaks.

The demo story _The Last Lighthouse: The Screenplay_ is the novel's first three scenes written for the screen.
