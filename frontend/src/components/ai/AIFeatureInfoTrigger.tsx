import { useState } from "react";
import { Cpu, Info } from "lucide-react";
import { IconButton } from "../common";
import { useAIAvailable, useMode } from "../../lib/mode";
import { visibleFeatures } from "../../lib/ai/featureRegistry";
import AIFeatureInfoModal from "./AIFeatureInfoModal";

interface Props {
  pageId: string;
  /** "sm" for panel headers, "md" for page headers */
  size?: "sm" | "md";
}

/**
 * A small Cpu icon button that opens the AI/NLP feature info modal
 * for the given page. Drop this into any page or panel header that
 * has AI or NLP features.
 *
 * It disappears in writer mode only when there is nothing left to describe. The modal
 * covers NLP tools too, and those stay in both modes — hiding their documentation because
 * the page also happens to have AI features would be hiding the wrong thing.
 */
export default function AIFeatureInfoTrigger({ pageId, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const mode = useMode();
  const aiAvailable = useAIAvailable();

  if (visibleFeatures(pageId, mode).length === 0) return null;

  // Without AI it describes only the analysis tools: no AI chip, no "AI" in the words.
  const Icon = aiAvailable ? Cpu : Info;
  return (
    <>
      <IconButton
        icon={<Icon size={size === "sm" ? 12 : 14} />}
        tooltip={
          aiAvailable ? "About AI & NLP features on this page" : "About the analysis tools on this page"
        }
        onClick={() => setOpen(true)}
        size={size}
        variant="ghost"
      />
      <AIFeatureInfoModal isOpen={open} onClose={() => setOpen(false)} pageId={pageId} />
    </>
  );
}
