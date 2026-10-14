import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileInput } from "lucide-react";
import { jobsApi } from "../../api/jobs";
import { getMode } from "../../lib/mode";
import { Modal } from "../common";
import UploadStep from "./UploadStep";
import StructureReviewStep from "./StructureReviewStep";
import EntityExtractionStep from "./EntityExtractionStep";
import ConfirmStep from "./ConfirmStep";
import WhatComesOverStep from "./WhatComesOverStep";
import { EMPTY_CHOICES } from "../../lib/import/novelcrafter";
import { sectionPath } from "../../lib/routes";
import type { ExtractionCandidate, ImportPreviewTree, ImportUploadResponse } from "../../types";
import type { NovelcrafterChoices } from "../../types/novelcrafter";
import styles from "./ImportWizard.module.css";

interface Props {
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

/** Where the wizard was (doc 21 R8): closing it mid-import, while the Assistant reads, does not
 *  lose the import. Kept while the server still has the import open (30 minutes). */
const WIZARD_KEY = "ls_import_wizard";
interface SavedWizard {
  step: Step;
  uploadResponse: ImportUploadResponse;
  preview: ImportPreviewTree;
  choices?: NovelcrafterChoices;
}

function readWizard(): SavedWizard | null {
  try {
    return JSON.parse(localStorage.getItem(WIZARD_KEY) ?? "null") as SavedWizard | null;
  } catch {
    return null;
  }
}

function writeWizard(saved: SavedWizard | null) {
  try {
    if (saved) localStorage.setItem(WIZARD_KEY, JSON.stringify(saved));
    else localStorage.removeItem(WIZARD_KEY);
  } catch {
    // Private window: the wizard just starts over next time.
  }
}

export default function ImportWizard({ onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [uploadResponse, setUploadResponse] = useState<ImportUploadResponse | null>(null);
  const [preview, setPreview] = useState<ImportPreviewTree | null>(null);
  // A Novelcrafter export (doc 28): what the author chose in What comes over.
  const [choices, setChoices] = useState<NovelcrafterChoices>(EMPTY_CHOICES);
  const novelcrafter = uploadResponse?.novelcrafter ?? null;

  // Pick up an import left open, if the server still has it.
  useEffect(() => {
    const saved = readWizard();
    if (!saved) return;
    void jobsApi.importAlive(saved.preview.session_id).then((alive) => {
      if (!alive) return writeWizard(null);
      setUploadResponse(saved.uploadResponse);
      setPreview(saved.preview);
      setChoices(saved.choices ?? EMPTY_CHOICES);
      setStep(saved.step);
    });
  }, []);
  useEffect(() => {
    if (uploadResponse && preview && step > 1) writeWizard({ step, uploadResponse, preview, choices });
  }, [step, uploadResponse, preview, choices]);
  const [extractionCandidates, setExtractionCandidates] = useState<ExtractionCandidate[]>([]);
  const [extractionSelected, setExtractionSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  function handleUploaded(resp: ImportUploadResponse) {
    setUploadResponse(resp);
    setPreview(resp.preview);
    // Writer mode shows no AI, so its conversations stay in the file (doc 28).
    setChoices({ ...EMPTY_CHOICES, chats: getMode() === "studio" });
    setStep(2);
  }

  function handlePreviewUpdated(updated: ImportPreviewTree) {
    setPreview(updated);
  }

  function handleExtractionComplete(candidates: ExtractionCandidate[], selectedIds: Set<string>) {
    setExtractionCandidates(candidates);
    setExtractionSelected(selectedIds);
    setStep(4);
  }

  function handleExtractionSkip() {
    setExtractionCandidates([]);
    setExtractionSelected(new Set());
    setStep(4);
  }

  function handleFinalized(storyId: string, recordId?: string | null) {
    writeWizard(null);
    onClose();
    // An export with a Lorebook opens on its report: what came over and what waits (doc 28).
    navigate(
      novelcrafter && recordId
        ? sectionPath(storyId, "chronicle", "imports", recordId)
        : `/stories/${storyId}`,
    );
  }

  const stepLabels: Record<Step, string> = {
    1: "Upload",
    2: "Review structure",
    3: novelcrafter ? "What comes over" : "Extract entities",
    4: "Confirm & create",
  };

  const title = `${novelcrafter ? "Import from Novelcrafter" : "Import document"}: ${stepLabels[step]}`;

  return (
    <Modal isOpen onClose={onClose} title={title} icon={<FileInput size={15} />} size="lg">
      <div className={styles.wizard}>
        <div className={styles.stepBar}>
          {([1, 2, 3, 4] as Step[]).map((s) => (
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
          {step === 1 && <UploadStep onUploaded={handleUploaded} />}
          {step === 2 && uploadResponse && preview && (
            <StructureReviewStep
              uploadResponse={uploadResponse}
              preview={preview}
              onPreviewUpdated={handlePreviewUpdated}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && novelcrafter && (
            <WhatComesOverStep
              preview={novelcrafter}
              choices={choices}
              onChange={setChoices}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 3 && !novelcrafter && uploadResponse && preview && (
            <EntityExtractionStep
              uploadResponse={uploadResponse}
              preview={preview}
              onComplete={handleExtractionComplete}
              onSkip={handleExtractionSkip}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && uploadResponse && preview && (
            <ConfirmStep
              uploadResponse={uploadResponse}
              preview={preview}
              extractionCandidates={extractionCandidates}
              extractionSelected={extractionSelected}
              novelcrafter={novelcrafter ? choices : undefined}
              onBack={() => setStep(3)}
              onFinalized={handleFinalized}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
