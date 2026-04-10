import type { ContextScope } from "../../lib/ai/sessionTypes";
import { SCOPE_LABELS } from "../../lib/ai/sessionTypes";
import styles from "./ContextScopeSelector.module.css";

interface Props {
  scope: ContextScope;
  allowedScopes: ContextScope[];
  onChange: (scope: ContextScope) => void;
}

export default function ContextScopeSelector({ scope, allowedScopes, onChange }: Props) {
  if (allowedScopes.length <= 1) return null;
  return (
    <div className={styles.wrapper} title="Context scope — how much of your story the AI sees">
      <select
        className={styles.select}
        value={scope}
        onChange={(e) => onChange(e.target.value as ContextScope)}
        aria-label="Context scope"
      >
        {allowedScopes.map((s) => (
          <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}
