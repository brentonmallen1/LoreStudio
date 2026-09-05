import { useState } from "react";
import { Copy, Check } from "lucide-react";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  content: string;
  maxHeight?: string;
  copyable?: boolean;
  placeholder?: string;
}

export default function CodeBlock({
  content,
  maxHeight = "200px",
  copyable = false,
  placeholder = "—",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.wrapper}>
      {copyable && content && (
        <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      )}
      <pre className={styles.pre} style={{ maxHeight }}>
        {content || <span className={styles.empty}>{placeholder}</span>}
      </pre>
    </div>
  );
}
