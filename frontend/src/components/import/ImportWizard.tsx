import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileInput } from "lucide-react";
import { Modal } from "../common";
import UploadStep from "./UploadStep";
import StructureReviewStep from "./StructureReviewStep";
import ConfirmStep from "./ConfirmStep";
import type { ImportPreviewTree, ImportUploadResponse } from "../../types";
import styles from "./ImportWizard.module.css";

interface Props {
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export default function ImportWizard({ onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [uploadResponse, setUploadResponse] = useState<ImportUploadResponse | null>(null);
  const [preview, setPreview] = useState<ImportPreviewTree | null>(null);
  const navigate = useNavigate();

  function handleUploaded(resp: ImportUploadResponse) {
    setUploadResponse(resp);
    setPreview(resp.preview);
    setStep(2);
  }

  function handlePreviewUpdated(updated: ImportPreviewTree) {
    setPreview(updated);
  }

  function handleFinalized(storyId: string) {
    onClose();
    navigate(`/stories/${storyId}`);
  }

  const stepLabels: Record<Step, string> = {
    1: "Upload",
    2: "Review Structure",
    3: "Confirm & Create",
  };

  const title = `Import Document — ${stepLabels[step]}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      icon={<FileInput size={15} />}
      size="lg"
    >
      <div className={styles.wizard}>
        <div className={styles.stepBar}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`${styles.stepDot} ${step === s ? styles.active : ""} ${step > s ? styles.done : ""}`}
            >
              <span className={styles.stepNum}>{step > s ? "✓" : s}</span>
              <span className={styles.stepLabel}>{stepLabels[s]}</span>
            </div>
          ))}
        </div>

        <div className={styles.stepContent}>
          {step === 1 && (
            <UploadStep onUploaded={handleUploaded} />
          )}
          {step === 2 && uploadResponse && preview && (
            <StructureReviewStep
              uploadResponse={uploadResponse}
              preview={preview}
              onPreviewUpdated={handlePreviewUpdated}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && uploadResponse && preview && (
            <ConfirmStep
              uploadResponse={uploadResponse}
              preview={preview}
              onBack={() => setStep(2)}
              onFinalized={handleFinalized}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
