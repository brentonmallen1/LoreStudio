import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AICall } from "../../api/aiCalls";
import { readResponse } from "../../lib/ai/readableResponse";
import { resultSchema } from "../../lib/ai/resultSchemas";
import JsonValue from "../ai/JsonValue";
import StructuredResponseRenderer from "../ai/StructuredResponseRenderer";
import styles from "./ResponseView.module.css";

type View = "readable" | "raw";

/**
 * A call's response (Chronicle, the transparency view). Readable by default: JSON laid out in
 * the shape its feature shows it in, or field by field when the feature has none, and prose as
 * Markdown. Raw is the text exactly as it came back.
 */
export default function ResponseView({ call, raw }: { call: AICall; raw: string }) {
  const [view, setView] = useState<View>("readable");
  const read = readResponse(raw);
  const schema = resultSchema(call.feature, call.element_type);

  return (
    <div className={styles.wrap}>
      <div className={styles.seg} role="group" aria-label="Show the response">
        {(["readable", "raw"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            className={`${styles.segBtn} ${view === v ? styles.segOn : ""}`}
            onClick={() => setView(v)}
          >
            {v === "readable" ? "Readable" : "Raw"}
          </button>
        ))}
      </div>
      {view === "raw" || read.kind === "empty" ? (
        <pre className={styles.pre}>{raw || "(empty)"}</pre>
      ) : (
        <div className={styles.readable}>
          {read.kind === "text" ? (
            <div className={styles.markdown}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{read.text}</ReactMarkdown>
            </div>
          ) : schema && isRecord(read.data) ? (
            <StructuredResponseRenderer result={{ success: true, data: read.data }} schema={schema} />
          ) : (
            <JsonValue value={read.data} />
          )}
        </div>
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
