import { useEffect } from "react";
import { needsAssistant, useAssistantReady } from "../../../lib/ai/assistantReady";
import { useAIAvailable } from "../../../lib/mode";
import {
  RECHECK_MS,
  RECHECK_READY_MS,
  requireAssistant,
  useAssistantSetup,
} from "../../../stores/assistantSetupStore";
import Modal from "../../common/Modal";
import SetupAssistantCard from "./SetupAssistantCard";

/**
 * The gate in front of every Assistant action (doc 30 D4), mounted once beside the toasts.
 *
 * In Studio it asks whether a model is there, and while none is, a click on an Assistant
 * action (`needsAssistant`: inside `AIOnly`, a menu row marked `ai`, or a button with the
 * one-shot icons) opens "Set up the Assistant" in a dialog instead of sending a request that
 * would fail. The Assistant tab shows the same card in its own place. Coming back to the
 * window asks again, so installing Ollama elsewhere and returning is enough.
 */
export default function AssistantSetupHost() {
  const ai = useAIAvailable();
  useAssistantReady();
  const { setupOpen, closeSetup } = useAssistantSetup();

  useEffect(() => {
    if (!ai) return;
    function onClick(e: MouseEvent) {
      if (!needsAssistant(e.target) || requireAssistant()) return;
      e.preventDefault();
      e.stopPropagation();
    }
    function onFocus() {
      const { status, checkedAt, recheck } = useAssistantSetup.getState();
      const age = Date.now() - checkedAt;
      if ((status === "not-ready" && age > RECHECK_MS) || (status === "ready" && age > RECHECK_READY_MS))
        void recheck();
    }
    // Capture, on the document: before React's own listeners on the root see the click.
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
    };
  }, [ai]);

  if (!ai) return null;
  return (
    <Modal isOpen={setupOpen} onClose={closeSetup} title="Set up the Assistant" size="lg">
      <SetupAssistantCard titled={false} onDone={closeSetup} />
    </Modal>
  );
}
