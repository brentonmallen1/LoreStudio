import { ShieldCheck } from "lucide-react";
import { IconButton } from "../common";
import { useAIAvailable } from "../../lib/mode";

interface Props {
  onClick: () => void;
  disabled?: boolean;
  /** Pass "sm" for panel headers, "md" for dialogs */
  size?: "sm" | "md";
}

/**
 * Small button for opening the LLM transparency modal.
 * Disabled until there's been at least one interaction.
 *
 * It gates itself: it only ever sits next to AI-generated content, so anywhere it could
 * render in writer mode is somewhere an AI surface leaked.
 */
export default function LLMTransparencyTrigger({ onClick, disabled = false, size = "sm" }: Props) {
  if (!useAIAvailable()) return null;

  return (
    <IconButton
      icon={<ShieldCheck size={size === "sm" ? 12 : 14} />}
      label={size === "sm" ? undefined : "AI context"}
      tooltip="View what was sent to the AI"
      onClick={onClick}
      disabled={disabled}
      size={size}
      variant="ghost"
    />
  );
}
