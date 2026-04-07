/**
 * StructuredResponseRenderer — renders a StructuredResult from a one-shot AI feature.
 *
 * Handles three states:
 *   success=true   → renders structured section cards
 *   success=false, raw_data present → renders what we can + fallback warning
 *   success=false, only raw_text   → renders raw text as plain markdown (original behavior)
 */
import type { ComponentType } from "react";
import type { StructuredResult } from "../../types";
import styles from "./StructuredResponseRenderer.module.css";

export interface SectionConfig {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** CSS variable name or literal color for the left border, e.g. "var(--color-accent)" */
  color: string;
  /** How to render the value */
  type: "text" | "list" | "sublist";
  /** For type=sublist, the field within each item to use as the label */
  labelField?: string;
  /** For type=sublist, the field within each item to use as the description */
  descField?: string;
  /** If true, show an Apply button — caller gets onApply callback */
  applyable?: boolean;
}

interface Props {
  result: StructuredResult;
  schema: SectionConfig[];
  /** Called when user clicks Apply on a section. key is the section key, value is the raw data. */
  onApply?: (key: string, value: unknown) => void;
  /** Optional label for the Apply button (defaults to "Apply") */
  applyLabel?: string | ((key: string) => string);
}

function FallbackWarning({ message }: { message: string }) {
  return (
    <div className={styles.fallbackWarning}>
      <span className={styles.fallbackIcon}>⚠</span>
      {message}
    </div>
  );
}

function renderValue(
  value: unknown,
  config: SectionConfig,
  onApply?: Props["onApply"],
  applyLabel?: Props["applyLabel"],
) {
  if (value === undefined || value === null) return null;

  const applyBtn = config.applyable && onApply ? (
    <button
      className={styles.applyBtn}
      onClick={() => onApply(config.key, value)}
    >
      {typeof applyLabel === "function" ? applyLabel(config.key) : (applyLabel ?? "Apply")}
    </button>
  ) : null;

  if (config.type === "text") {
    return (
      <div className={styles.sectionBody}>
        <p className={styles.textValue}>{String(value)}</p>
        {applyBtn}
      </div>
    );
  }

  if (config.type === "list") {
    const items = Array.isArray(value) ? value : [value];
    return (
      <div className={styles.sectionBody}>
        <ul className={styles.listValue}>
          {items.map((item, i) => (
            <li key={i} className={styles.listItem}>{String(item)}</li>
          ))}
        </ul>
        {applyBtn}
      </div>
    );
  }

  if (config.type === "sublist") {
    const items = Array.isArray(value) ? value : [value];
    const lf = config.labelField ?? "name";
    const df = config.descField ?? "description";
    return (
      <div className={styles.sectionBody}>
        <div className={styles.sublistValue}>
          {items.map((item, i) => {
            const label = typeof item === "object" && item !== null ? (item as Record<string, unknown>)[lf] : item;
            const desc = typeof item === "object" && item !== null ? (item as Record<string, unknown>)[df] : null;
            return (
              <div key={i} className={styles.sublistItem}>
                <span className={styles.sublistLabel}>{String(label ?? "")}</span>
                {desc != null && <span className={styles.sublistDesc}>{String(desc)}</span>}
              </div>
            );
          })}
        </div>
        {applyBtn}
      </div>
    );
  }

  return null;
}

function renderSection(
  config: SectionConfig,
  data: Record<string, unknown>,
  onApply?: Props["onApply"],
  applyLabel?: Props["applyLabel"],
) {
  const value = data[config.key];
  if (value === undefined || value === null) return null;

  // Skip empty arrays / empty strings
  if (Array.isArray(value) && value.length === 0) return null;
  if (value === "") return null;

  // For sublist items that may have a "summary" + "details" structure (economy analysis)
  let displayValue: unknown = value;
  if (
    config.type === "text" &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value !== null &&
    "summary" in (value as object)
  ) {
    // It's an AnalysisSection — show summary as text
    displayValue = (value as Record<string, unknown>).summary as unknown;
  }

  const Icon = config.icon;

  return (
    <div key={config.key} className={styles.section} style={{ "--section-color": config.color } as React.CSSProperties}>
      <div className={styles.sectionHeader}>
        <Icon size={13} className={styles.sectionIcon} />
        <span className={styles.sectionLabel}>{config.label}</span>
      </div>
      {renderValue(displayValue, config, onApply, applyLabel)}

      {/* For AnalysisSection type: also show details as a list below summary */}
      {config.type === "text" &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value !== null &&
        "details" in (value as object) &&
        Array.isArray((value as Record<string, unknown>).details) &&
        ((value as Record<string, unknown>).details as unknown[]).length > 0 && (
          <ul className={styles.detailsList}>
            {((value as Record<string, unknown>).details as unknown[]).map((d, i) => (
              <li key={i} className={styles.detailsItem}>{String(d)}</li>
            ))}
          </ul>
        )}
    </div>
  );
}

export default function StructuredResponseRenderer({ result, schema, onApply, applyLabel }: Props) {
  // Full success — render structured cards
  if (result.success && result.data) {
    return (
      <div className={styles.root}>
        {schema.map((config) => renderSection(config, result.data!, onApply, applyLabel))}
      </div>
    );
  }

  // Partial: JSON parsed but schema validation failed — render what we can
  if (!result.success && result.raw_data) {
    return (
      <div className={styles.root}>
        <FallbackWarning message="Some sections couldn't be validated — showing partial results." />
        {schema.map((config) => renderSection(config, result.raw_data!, onApply, applyLabel))}
      </div>
    );
  }

  // Full fallback: render raw text
  return (
    <div className={styles.root}>
      <FallbackWarning message="Response couldn't be parsed as structured output." />
      {result.raw_text && (
        <div className={styles.rawText}>{result.raw_text}</div>
      )}
    </div>
  );
}
