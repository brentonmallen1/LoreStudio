# Search and replace

- **{{key:find}}** finds within the current scene (match case, whole word) and replaces one or all. It finds words across italics, and never matches or replaces a speaker tag (`<Maya>`), a mention's `@` or a place's `[[ ]]`; their words are still found.
- **{{key:storySearch}}** searches the whole story and shows excerpts per scene; click one to jump.
- Story-wide **replace** edits the prose only: markup and `<Speaker>` tags are never touched, so renaming a character cannot break dialogue attribution. Use _whole word_ when a name is a prefix of another word.
- Renaming a character from their sheet (⋯ › _Edit name, role, pronouns…_) previews every mention and speaker tag that uses the old name and updates the ones you choose.

## Mentions and other names

- `@Name` mentions a character and `[[Name]]` a place, in any mix of capitals. A mention can also use one of the entry's **other names** (the _Also called_ line under the name on its sheet; add one from the sheet's ⋯ menu), or a short name only one character goes by (`@Eleanor`, `@Calder`).
- Typing `@` (after a space, a line start or an opening quote or bracket) or `[[` opens a picker; **Tab** or **Enter** takes a name, and other names are offered as you type them ("Tom → Thomas Vance" writes `@Tom`).
- _Link mentions_ (the top bar's ⋯ menu) finds names written plainly and makes them mentions, keeping your words.
- A mention that names nobody is underlined in the warning colour. Point at it and the card offers to fix it:
  - **Same as…** picks someone, or somewhere, already in the Lorebook, and the mention's words become one of their names. The prose is not changed.
  - **Add as a character** or **Add to Places** creates them under those words.
  - **Unlink** keeps the words and drops the link, in this scene; {{key:undo}} brings it back.
- Renaming a character or place keeps the old name as another name while the prose still uses it, so no mention stops finding it. Remove it from _Also called_ once you no longer need it.
