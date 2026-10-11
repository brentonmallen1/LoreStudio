# Screenplays and stage plays

A story is written as **prose**, a **screenplay** or a **stage play**. Choose under **Written as** when you make the story, or later in **Lorebook › Story identity**. Switching keeps every word: prose paragraphs read as action until you change them, and {{key:undo}} switches back.

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

Every line of a script is one element: a **scene heading** (`INT. LIGHTHOUSE - NIGHT`), **action**, a **character** cue, a **parenthetical**, **dialogue**, or a **transition** (`CUT TO:`). The bottom right of the page shows the element the cursor is in and how long the scene runs, in eighths of a page, the way a script breakdown counts it. Click it for the keys from the line you are on: where Enter, Tab and Shift-Tab take you from there.

**Element guides** help while the format is new. Each element's words have a colour of their own, like a code editor's syntax highlighting: headings, names, directions, dialogue and transitions each have their own, and action stays plain. The line you are writing has its element's name in the left margin, and an empty line says what it is for and where Tab takes it: _Who speaks, in capitals · Tab for transition_. Once you know the format, turn them off under the editor's **⋯ › Element guides** or in **Type and width**.

Type `/` for every element by name: `/heading`, `/action`, `/character`, `/parenthetical`, `/transition`, `/centred`, `/lyric`, and `/together` for two speaking at once. `/dialogue` gives someone a line, as `^` does. A word of what you want finds it too: `/slugline`, `/wryly`, `/cut`.

As you type, the set words of a script are offered faintly after the cursor, and Tab takes them: `INT.` and `EXT.`, the places in your Lorebook after them, the time of day after ` - `, transitions such as `CUT TO:` and `DISSOLVE TO:`, and a cue's `(V.O.)`, `(O.S.)` or `(CONT'D)`. In a play: `SCENE`, `ACT`, `BLACKOUT.`, `CURTAIN.`. When nothing is offered, Tab switches the element as below.

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

A screenplay is counted in pages, about a minute of screen time each: Courier 12 point, 55 lines to a page, each element in its place. The page count LoreStudio shows comes from the same layout the printed script uses. A character's name starts at the same place on every cue, about a third of the way across, rather than being centred on its own length: that is how a screenplay is printed, so a name lines up with every other. (A stage play centres it.)

Choose the script's form under **Intended length** in **Story identity**: a short film, a TV half-hour, a TV hour or a feature. Its length is counted in pages, and **Numbers** shows the pages against that form, each act's pages, how much of the script is speech, and any scene over three pages.

**Run checks** reads a script's action lines, which are written like prose: passive voice, adverbs, repeated words, and action that slips out of the present tense ("She opened the door" rather than "She opens the door"). A character's words are theirs to say however they say them, so dialogue is left alone, and the prose-only checks (tags other than said, point of view, sentence length) do not run.

**Publish** shows the script as its printed pages, and exports it as a screenplay PDF, a Final Draft file or Fountain, with a title page. See _Import and export_.

## The Assistant (Studio)

In Studio mode the Assistant knows it is reading a script. It sees each scene as a screenwriter would, with every heading, cue and line of dialogue in its place. It talks about pages rather than chapters, and like everywhere in LoreStudio it never writes a line of the script for you, dialogue included.

Some tools change for a script. **Unfilmables** takes the place of Show, Don't Tell and points at action a camera could not film: a thought, a feeling stated, backstory. **Pacing**, **First-pass editor** and **Story economy** measure in pages and eighths of a page. **Clichés** also looks for lines heard in a thousand films. The editorial pass judges the voice of the action lines and how distinct each character sounds, since a script has no narrator. Under **Publish**, **Logline & Synopsis** replaces the book description, the query is written for a manager or producer, and **Comparable Films** suggests films and series. Dialogue attribution is not offered, because the cue above each line already says who speaks.

## Stage plays

A stage play is written the same way, with the same elements, and laid out the way a play is printed. The character's name is centred above the speech, the speech runs the full width of the page, and stage directions are in italics from halfway across. Start a new story with **Written as: Stage play** and the **Stage Play** structure (acts of scenes; a one-act play keeps one act).

- Each scene opens on its marker. Type `SCENE 1` (or `ACT TWO`) at the start of a line and it becomes the scene's heading, the way `INT.` does in a screenplay.
- Type the act's marker above the first scene of each act, as in `ACT TWO` then `SCENE 1`. Each act after the first starts on a new page.
- The bottom right of the page calls the elements by their theatre names: a stage direction, a direction inside a speech, an act or scene.
- Its intended length is a ten-minute play, a one-act or a full-length play, counted in pages.
- The Assistant (Studio) reads it as a play: what an audience in the theatre can see and hear. **Unstageables** points at stage directions no audience could see, and **Comparable Plays** suggests plays it sits beside.
- **Publish** prints it as a stage play PDF, and exports Final Draft and Fountain files too.

## Adapting a novel

A novel you have written can be told again as a script, and the novel stays as it is. Choose **Adapt as a screenplay or a play** from the palette, or the link under **Written as** in the novel's **Story identity**.

- The script is a new story after the novel in its series (the two become a series if the novel is not in one yet), so the novel and the script keep one canon.
- Its Lorebook comes from the novel: everything is ticked, closed threads included, since the script tells the same story. Untick what the script leaves out.
- It starts with the novel's outline: every part, chapter and scene with its synopsis and plan, the places each scene is set in, and the threads and twists it carries. Each scene opens on its heading, made from its place (`INT. KEEPER'S COTTAGE`; check inside or out, which is a guess from the place's name). In a play, each scene opens on its number, and on its act's marker when a new act begins.
- Nothing of the novel is converted into the script. **The novel** on the side panel's rail shows the novel's version of the open scene, its prose whole, to write from. A scene you add or split can be paired with any scene of the novel there.
- The title page says it is based on the novel, and by whom.

The script is a whole new story, so {{key:undo}} does not unmake it; delete it from the dashboard if you change your mind.

The demo story _The Last Lighthouse: The Screenplay_ is the novel's first three scenes written for the screen, and _A Play in One Act_ tells the same night on stage. Open **The novel** beside either to read the novel's version of each scene.
