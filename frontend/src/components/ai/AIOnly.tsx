import type { ReactNode } from "react";
import { useAIAvailable } from "../../lib/mode";

/**
 * Renders its children only where AI belongs.
 *
 * Two separate promises, one gate. Writer mode renders no AI affordance at all — not even
 * a disabled one — because the mode has no use for it. And the AI master switch renders
 * none because the author said no. `useAIAvailable()` is both; wrapping a surface in this
 * is how a component keeps them without having to remember either.
 *
 * Use it for anything that would call a model: buttons, tool cards, whole panels. Non-AI
 * tools (consistency checks, quote normalisation, NLP analyses) stay in both modes and
 * must not be wrapped.
 */
export default function AIOnly({ children }: { children: ReactNode }) {
  return useAIAvailable() ? <>{children}</> : null;
}
