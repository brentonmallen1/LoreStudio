import styles from "./KeptText.module.css";

/** A kept answer that came as prose (a summary, a recap, guidance), paragraph by paragraph. */
export default function KeptText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={styles.text}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p.trim()}</p>
      ))}
    </div>
  );
}
