# Search and replace

- **{{key:find}}** finds within the current scene (match case, whole word) and replaces one or all.
- **{{key:storySearch}}** searches the whole story and shows excerpts per scene; click one to jump.
- Story-wide **replace** edits the prose only: tags, attributes and `<Speaker>` tags are never touched, so renaming a character cannot break dialogue attribution. Use _whole word_ when a name is a prefix of another word.
- Characters have a dedicated **Rename** on their sheet that previews every occurrence, including mentions, before applying.

## Mentions and other names

- `@Name` mentions a character and `[[Name]]` a place, in any mix of capitals. A mention can also use one of the entry's **other names**: the _Also called_ line under the name on its sheet (add one from the sheet's ⋯ menu).
- A mention that names nobody is underlined in the warning colour. Point at it and the card offers to fix it:
  - **Same as…** picks someone, or somewhere, already in the Lorebook, and the mention's words become one of their names. The prose is not changed.
  - **Add as a character** or **Add to Places** creates them under those words.
  - **Unlink** keeps the words and drops the link, in this scene; {{key:undo}} brings it back.
- Renaming a character or place keeps the old name as another name while the prose still uses it, so no mention stops finding it. Remove it from _Also called_ once you no longer need it.
