<!-- studio -->

# Setting up the Assistant

Get the Assistant working: install a free app called Ollama, give it a model, and tell LoreStudio where to find it. You do this once.

## What Ollama is

Ollama is a free app that runs a language model on your own computer. When you ask the Assistant something, LoreStudio sends the question to Ollama, and Ollama answers. Nothing you write leaves your machine.

LoreStudio is built around **Gemma 4**, a model Ollama can download for you.

## Install Ollama and a model

1. Download Ollama from [ollama.com](https://ollama.com) and install it like any other app. It runs quietly in the background.
2. Open a terminal and run `ollama pull gemma4`. It is a large download, so give it time; you only do it once.
3. Leave Ollama running whenever you want the Assistant.

> **Tip:** The index the Assistant searches your prose with uses a second, small model: `ollama pull nomic-embed-text`. Settings › **Codex** › **Embedding model** names it.

## Tell LoreStudio where it is

1. Switch to Studio: at the bottom of the logo menu, or Settings › **Mode** › **With an Assistant to ask**.
2. Open Settings › **AI / LLM** and check that **Use AI features** is ticked.
3. **Ollama URL**: leave it empty to use the default, `http://localhost:11434`, which is where Ollama listens on the same computer. If LoreStudio runs in Docker and Ollama runs on the same computer outside it, use `http://host.docker.internal:11434`. If Ollama is on another machine, put that machine's address here.
4. **Model**: leave it empty to use `gemma4`, or type another model's name. The button beside it lists the models Ollama has.
5. Choose **Test connection**. **Connected · gemma4 ready** means you are done.

Each field saves by itself. **Reset to defaults** empties both again.

## If the test fails

- **Cannot reach Ollama at …**: Ollama is not running, or the URL is wrong. Start Ollama and test again.
- **Model 'gemma4' not found**, or another message about the model: Ollama is running but does not have that model yet. Run `ollama pull gemma4`, or check the name in **Model**.
- **Model 'gemma4' did not respond**: the model is there but did not answer. It may still be loading; wait a moment and test again.

Until the Assistant can answer, its buttons show a **Set up the Assistant** card instead of failing: the same steps, what is missing, and **Check again**. Coming back to LoreStudio after installing checks again by itself.

## Advanced

Settings › **Advanced** keeps the rest folded away. You can leave all of it alone.

- **Temperature**, **Top-p**, **Top-k**, **Image token budget** and **Thinking** are tuned for Gemma 4; **Reset to defaults** puts them back if you change one.
- **Context window ceiling** caps how much text goes to the model at once. Leave it at **No ceiling** unless your computer runs short of memory, then pick a smaller one.
- **After a reply, jobs wait** and **My model answers several requests at once** decide how your conversations and longer jobs share the model. See [Jobs: work that runs while you write](/guides/jobs).

## Without it

Everything else works without Ollama: writing, the Lorebook, Promises, Findings, Numbers, import and export. Writer mode shows no Assistant and needs none of this. In Studio, untick **Use AI features** to hide every part of the Assistant until you are ready.
<!-- /studio -->
