import { useEffect } from "react";
import { useAIAvailable } from "../mode";
import {
  useAssistantSetup,
  type AssistantCheck,
  type AssistantStatus,
} from "../../stores/assistantSetupStore";

/**
 * Whether the Assistant can answer here (doc 30 D4), for a surface that shows the "Set up the
 * Assistant" card in its own place (the Assistant tab). Asks once, the first time Studio needs
 * to know. `ready` is false only when a check found no working model.
 */
export function useAssistantReady(): {
  ready: boolean;
  status: AssistantStatus;
  check: AssistantCheck | null;
  recheck: () => Promise<AssistantStatus>;
} {
  const ai = useAIAvailable();
  const { status, check, checkedAt, recheck } = useAssistantSetup();
  useEffect(() => {
    if (ai && checkedAt === 0 && status === "unknown") void recheck();
  }, [ai, checkedAt, status, recheck]);
  return { ready: !ai || status !== "not-ready", status, check, recheck };
}

/**
 * What marks an Assistant action for the gate: anything inside `AIOnly` or a menu row marked
 * `ai`, and any button that carries the one-shot icons (Orbit, or the wand that suggests a
 * field: CLAUDE.md's icon rule), so the buttons outside a wrapper are covered too.
 */
export const ASSISTANT_MARK = "data-needs-assistant";
const MARKED = `[${ASSISTANT_MARK}]`;
const ICONS = "svg.lucide-orbit, svg.lucide-wand-sparkles, svg.lucide-wand-2";

/** True when a click on this element starts something that needs the model. */
export function needsAssistant(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  const control = el?.closest<HTMLElement>("button, a[href], [role=menuitem]");
  if (!control || control.closest("[data-assistant-setup]")) return false;
  if ((control as HTMLButtonElement).disabled) return false;
  return Boolean(control.closest(MARKED) || control.querySelector(ICONS));
}
