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

## Elements

Every line of a script is one element: a **scene heading** (`INT. LIGHTHOUSE - NIGHT`), **action**, a **character** cue, a **parenthetical**, **dialogue**, or a **transition** (`CUT TO:`). The bottom right of the page shows the element the cursor is in and how long the scene runs, in eighths of a page, the way a script breakdown counts it.

You never have to set an element by hand. If you know Final Draft, these work too:

- **Enter** at the end of a line moves on to what usually comes next: dialogue after a cue, action after dialogue, a heading after a transition. On an empty cue or line of dialogue it goes back to action.
- **Tab** turns the line into the next element (action, character, transition, heading), and **Shift-Tab** goes back.
- **{{key:scriptHeading}}** to **{{key:scriptTransition}}** set the element directly: heading, action, character, parenthetical, dialogue, transition. The palette has them as _Script:_ commands.
- Typing `INT. ` or `EXT. ` at the start of a line starts a scene heading. A name in capitals followed by Enter becomes a cue (`BOOM!` stays action). A line in capitals ending `TO:` is a transition.
- Headings, cues and transitions are typed in capitals for you.
- In a cue, the characters in your Lorebook are offered as you type. A new name makes a new character: `MRS. HALE` becomes _Mrs. Hale_.
- Pasting Fountain text (the plain-text screenplay format) brings it in as elements.

## Scenes and their headings

Each scene in your structure opens on one heading, typed as its first line. LoreStudio reads it as you write: inside or out (`INT.`, `EXT.`, `INT./EXT.`), the place, and the time of day. The scene's glance and the Timeline show them, and a place your Lorebook already has becomes the scene's place, unless you have chosen one yourself.

A heading typed further down a scene starts another scene. A bar above the page offers **Start a new scene here**: everything from the heading on becomes the next scene, and its lines of dialogue and margin notes go with it. **Keep as a line** turns the heading into action instead. Splitting is one step, and {{key:undo}} puts the scene back together. Findings lists any scene with a second heading, with the same fix.

## The page

A screenplay is counted in pages, about a minute of screen time each: Courier 12 point, 55 lines to a page, each element in its place. The page count LoreStudio shows comes from the same layout the printed script uses.

Exporting in script layout (a screenplay PDF, Fountain and Final Draft) is on its way. Until then, exports read the script as prose.

The demo story _The Last Lighthouse: The Screenplay_ is the novel's first three scenes written for the screen.
