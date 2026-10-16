import styles from "./JsonValue.module.css";

/**
 * Renders whatever shape a model returned, without a schema per feature: lists as lists,
 * objects as labelled fields, empty values left out. Used where no `SectionConfig` fits
 * (an analysis session, a Chronicle response with no schema).
 */
export default function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    return (
      <ul className={styles.list}>
        {value.map((item, i) => (
          <li key={i}>
            <JsonValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={styles.object}>
        {Object.entries(value as Record<string, unknown>).map(([key, v]) => {
          if (v === null || v === undefined || v === "") return null;
          return (
            <div key={key} className={styles.field}>
              <span className={styles.key}>{key.replace(/_/g, " ")}</span>
              <JsonValue value={v} />
            </div>
          );
        })}
      </div>
    );
  }
  return <span className={styles.scalar}>{String(value)}</span>;
}
