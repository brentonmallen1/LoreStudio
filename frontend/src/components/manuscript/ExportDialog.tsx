import { Download } from "lucide-react";
import { Modal } from "../common";
import { useUIStore } from "../../stores/uiStore";
import ExportPanel from "./ExportPanel";

/** Export, from anywhere: the palette, the Overview, the Manuscript view. */
export default function ExportDialog({ storyId }: { storyId: string }) {
  const { exportOpen, setExportOpen } = useUIStore();
  return (
    <Modal
      isOpen={exportOpen}
      onClose={() => setExportOpen(false)}
      title="Export manuscript"
      icon={<Download size={15} />}
      size="md"
    >
      <ExportPanel storyId={storyId} />
    </Modal>
  );
}
