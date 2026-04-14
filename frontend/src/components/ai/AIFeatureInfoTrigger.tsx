import { useState } from "react";
import { Cpu } from "lucide-react";
import { IconButton } from "../common";
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
 */
export default function AIFeatureInfoTrigger({ pageId, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        icon={<Cpu size={size === "sm" ? 12 : 14} />}
        tooltip="About AI & NLP features on this page"
        onClick={() => setOpen(true)}
        size={size}
        variant="ghost"
      />
      <AIFeatureInfoModal
        isOpen={open}
        onClose={() => setOpen(false)}
        pageId={pageId}
      />
    </>
  );
}
