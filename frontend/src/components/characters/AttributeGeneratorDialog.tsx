import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Modal } from "../common";
import { useAIStore } from "../../stores/aiStore";
import type { Character } from "../../types";
import styles from "./AttributeGeneratorDialog.module.css";

const ATTRIBUTE_TYPES = [
  {
    value: "traits",
    label: "Traits",
    description: "Personality quirks, values, and defining characteristics",
  },
  {
    value: "backstory",
    label: "Backstory elements",
    description: "History, formative experiences, and origin details",
  },
  {
    value: "quirks",
    label: "Quirks & mannerisms",
    description: "Speech patterns, habits, and distinctive behaviours",
  },
  {
    value: "appearance",
    label: "Appearance",
    description: "Physical description, clothing style, and notable features",
  },
];

interface Props {
  character: Character;
  onClose: () => void;
}

export default function AttributeGeneratorDialog({ character, onClose }: Props) {
  const { createSession } = useAIStore();
  const [type, setType] = useState("traits");
  const [starting, setStarting] = useState(false);

  async function handleGenerate() {
    setStarting(true);
    try {
      await createSession("attribute-generator", {
        characterId: character.id,
        attributeType: type,
      });
      onClose();
    } finally {
      setStarting(false);
    }
  }

  const footer = (
    <>
      <button onClick={onClose} className={styles.cancelBtn}>
        Cancel
      </button>
      <button onClick={handleGenerate} disabled={starting} className={styles.generateBtn}>
        <Wand2 size={13} />
        {starting ? "Opening…" : "Generate Suggestions"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Suggest Attributes — ${character.name}`}
      icon={<Wand2 size={15} />}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>What to generate</label>
          <p className={styles.hint}>
            AI will analyse {character.name}'s existing profile and suggest new{" "}
            {ATTRIBUTE_TYPES.find((t) => t.value === type)?.label.toLowerCase()} grounded in what's already
            established.
          </p>
          <div className={styles.typeGrid}>
            {ATTRIBUTE_TYPES.map((t) => (
              <button
                key={t.value}
                className={`${styles.typeBtn} ${type === t.value ? styles.typeBtnActive : ""}`}
                onClick={() => setType(t.value)}
                type="button"
              >
                <span className={styles.typeLabel}>{t.label}</span>
                <span className={styles.typeDesc}>{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
