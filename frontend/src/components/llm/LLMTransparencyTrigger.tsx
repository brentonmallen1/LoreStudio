import { ShieldCheck } from "lucide-react";
import { IconButton } from "../common";

interface Props {
  onClick: () => void;
  disabled?: boolean;
  /** Pass "sm" for panel headers, "md" for dialogs */
  size?: "sm" | "md";
}

/**
 * Small button for opening the LLM transparency modal.
 * Disabled until there's been at least one interaction.
 */
export default function LLMTransparencyTrigger({ onClick, disabled = false, size = "sm" }: Props) {
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
