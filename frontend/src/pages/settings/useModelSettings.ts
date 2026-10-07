import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { ImageTokenBudget, LLMSettings } from "../../types";

export type ConnStatus =
  | null
  | "loading"
  | {
      connected: boolean;
      model: string;
      model_available: boolean;
      model_in_list: boolean;
      error: string | null;
      base_url: string;
    };

type Params = Pick<LLMSettings, "temperature" | "top_p" | "top_k" | "thinking_mode"> & {
  image_token_budget: ImageTokenBudget | 0;
};

const key = (value: object) => JSON.stringify(value);

/**
 * Settings › AI's connection and model parameters: loaded from the server, saved a moment
 * after the author changes one.
 *
 * Saving used to be an effect on the values themselves, so loading them was a change too:
 * opening Settings wrote the defaults back as the author's own choices, and a default the
 * server changed later never reached them. Now a save happens only when the values differ from
 * what was last loaded or saved. The image budget's "Default" clears the saved value rather
 * than leaving the last one in place, and a change saves only the value changed, so the
 * others keep following the defaults.
 */
export function useModelSettings() {
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaSaveState, setOllamaSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [connStatus, setConnStatus] = useState<ConnStatus>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [paramsSaved, setParamsSaved] = useState(false);
  // Server defaults, shown as placeholders.
  const [serverDefaults, setServerDefaults] = useState<{ url: string; model: string } | null>(null);
  const [paramDefaults, setParamDefaults] = useState<NonNullable<LLMSettings["server_defaults"]>>({});
  // What the server holds now: a value equal to it is not a change.
  const heldConnection = useRef<string | null>(null);
  const heldParams = useRef<Params | null>(null);

  function take(s: LLMSettings) {
    const loaded: Params = {
      temperature: s.temperature,
      top_p: s.top_p,
      top_k: s.top_k,
      thinking_mode: s.thinking_mode,
      image_token_budget: s.image_token_budget ?? 0,
    };
    heldParams.current = loaded;
    heldConnection.current = key([s.ollama_url ?? "", s.ollama_model ?? ""]);
    setParams(loaded);
    // The raw saved values: empty when the server default applies.
    setOllamaUrl(s.ollama_url ?? "");
    setOllamaModel(s.ollama_model ?? "");
    setServerDefaults({ url: s.effective_ollama_url, model: s.effective_ollama_model });
    setParamDefaults(s.server_defaults ?? {});
  }

  useEffect(() => {
    api
      .getLLMSettings()
      .then(take)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const now = key([ollamaUrl, ollamaModel]);
    if (heldConnection.current === null || now === heldConnection.current) return;
    const timer = setTimeout(async () => {
      setConnStatus(null); // a test of the old address no longer says anything
      setOllamaSaveState("saving");
      try {
        const updated = await api.updateLLMSettings({
          ollama_url: ollamaUrl.trim() || null,
          ollama_model: ollamaModel.trim() || null,
        });
        heldConnection.current = now;
        setServerDefaults({ url: updated.effective_ollama_url, model: updated.effective_ollama_model });
        setOllamaSaveState("saved");
        setTimeout(() => setOllamaSaveState("idle"), 2000);
      } catch {
        setOllamaSaveState("idle");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ollamaUrl, ollamaModel]);

  useEffect(() => {
    const held = heldParams.current;
    if (!params || !held) return;
    // Only what changed: a value left alone keeps following the default.
    const changed = (Object.keys(params) as (keyof Params)[]).filter((k) => params[k] !== held[k]);
    if (!changed.length) return;
    const timer = setTimeout(async () => {
      try {
        // The budget's 0 is "Default": null clears the saved one.
        const patch = Object.fromEntries(
          changed.map((k) => [k, k === "image_token_budget" ? params[k] || null : params[k]]),
        );
        await api.updateLLMSettings(patch);
        heldParams.current = params;
        setParamsSaved(true);
        setTimeout(() => setParamsSaved(false), 1500);
      } catch {
        /* the values stay on screen; the next change tries again */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [params]);

  async function reset() {
    take(await api.resetLLMSettings());
    setConnStatus(null);
  }

  async function testConnection() {
    setConnStatus("loading");
    try {
      setConnStatus(await api.ollamaStatus());
    } catch {
      setConnStatus({
        connected: false,
        model: "",
        model_available: false,
        model_in_list: false,
        error: null,
        base_url: ollamaUrl,
      });
    }
  }

  /** Google's recommendation beside this server's own default, which `.env` may change. */
  const defaultHint = (name: "temperature" | "top_p" | "top_k", google: number) => {
    const here = paramDefaults[name];
    // 1.0, 0.95, 0.8 and 64, as the model card writes them.
    const show = (n: unknown) => (name === "top_k" ? String(n) : Number(n).toFixed(2).replace(/0$/, ""));
    return here === undefined || here === google
      ? `Google recommends ${show(google)} for Gemma 4, the default here.`
      : `Google recommends ${show(google)} for Gemma 4; this server's default is ${show(here)} (set in .env).`;
  };

  const setParam = <K extends keyof Params>(name: K, value: Params[K]) =>
    setParams((p) => (p ? { ...p, [name]: value } : p));

  return {
    ollamaUrl,
    setOllamaUrl,
    ollamaModel,
    setOllamaModel,
    ollamaSaveState,
    connStatus,
    testConnection,
    serverDefaults,
    params,
    setParam,
    paramsSaved,
    defaultHint,
    reset,
  };
}
