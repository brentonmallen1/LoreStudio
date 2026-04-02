System:
- need good logging, especially with the interview process (and all llm interactions), so I can see what goes to the model and what gets returned.
- light and dark mode toggle should be accessible at all times
- navigating between characters and story pages is weird. it flickers and seems to reload things. If I click on a piece of the story in the tree, it should just load that page
- auto save with indication of current status
- clicking on a section should take the user to that section even if they're currently looking at a character. I'm also not sure if the characters should be in a different tab like they are or just a different section in the tree on the left
  - Maybe we should look into using https://headless-tree.lukasbach.com? with different sections / top levels for the different tabs/page types
- If there's nothing written on the story page, clicking anywhere in the text editor window should put the focus on the text so the user can just start typing. they should have to hunt and click on the exact line

Libraries:
- reachat? ai chat components
- 

Characters:
- should have options for additional fields like quirks, flaws, speech patterns, etc. things that would further refine the character to help make them a bit more unique
- AI button to generate things to put in the different sections in case the user can't come up with one. maybe give a list of 3 or so suggestions to help inspire them

Interview System:
- The responses should be narrative, or embelished, it should just be like I'm talking to the character. they should just respond. it's not a story, it's a conversation. I think the prompt needs to be updated to reflect this. some notes about the character's actions like [puts head in hands] or something like that can be given but should be in brackets like that
- I want to be able to ask how the character would act 'in this situation' meaning if I'm on a story page, it should either pull in the page as context or it should ask the user if they want to, or I should be able to highlight a segment of the text and send that in as context 
- 


Readme:
- state that this is meant to be self hosted, local ai supported, data privacy focused. AI usage is completely voluntary, without it you still get a well organized data structure for story management.
- intent is to help people tell their story, not to have ai write their story for them. 

Philosophy:
- put in blockers to prevent the ai from writing the story for them 
  - a system prompt that's always there saying that they are story writing guide, not a story writer
  - 

Fixes:
- need to be able to cancel out all of the AI generation processes
- 
