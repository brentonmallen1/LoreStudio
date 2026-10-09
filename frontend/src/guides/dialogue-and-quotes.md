# Dialogue and quotes

LoreStudio keeps track of who says what, without changing how you write.

## Attributing a line

A tagged line is `"…"<Name>`: straight, curly or single quotes, with or without a space before the tag. The name can be the full one, another name from the character's sheet, or a short one only they go by (`<Calder>` for The Visitor (Calder)). Three ways to write one:

1. Type `^` (or `/dialogue`) and pick the speaker: an empty line in the scene's quote marks appears with the cursor inside.
2. Select spoken words and press **{{key:attributeDialogue}}** (or _Attribute_ in the selection toolbar): they are quoted and tagged, italics kept.
3. After a closing quote type `<`: the picker offers the likeliest speaker first. On an existing tag it replaces the name.

In every picker **Tab** or **Enter** takes the highlighted name, the rest of the top one shows faintly as you type, and **Esc** closes it.

Untagged lines are worked out from the prose: a speech tag (`"…," Maya said`), the one character acting in the paragraph, an `@mention` nearby, or two speakers taking turns. **Highlight dialogue** (the ⋯ menu, under _Type and width_) shows it in the prose: tagged lines tinted, worked-out lines dashed, lines nobody could be found for in amber; the prose and the side panel's **Dialogue** tool agree, and a new line is coloured once the scene saves. A tag that names nobody is amber too: point at it to correct it, add the character, or take the tag off. _Tag the dialogue_ in the top bar's ⋯ menu fixes them in bulk (heuristic, no AI).

## Quote style

Straight `"…"` and curly `“…”` quotes mixed in one manuscript is the most common copy-edit note. **Quote style**, under _Tidy-ups_ on the Scene sheet's **Findings** page, counts both across the story and converts everything with one click, after showing you how many characters change. Markup, speaker tags and the names in mentions are never touched, and a quote after italics stays a closing one. The same command is in the palette: _Normalize quotes_.

## Voice

**Numbers › Dialogue** shows who talks and how much: each speaker's share of the words, how evenly the talking is shared, which characters talk to each other, and the scenes where one voice takes over.

## Checks

The **Checks** field flags dialogue attributed to someone who is not in the Lorebook (a typo, or a character you have not added yet).
