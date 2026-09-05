// Types for the non-AI manuscript tools (consistency checks, quote normalisation).

export interface ConsistencyFinding {
  kind: "name_drift" | "unknown_speaker" | "pov_drift" | string;
  node_id: string;
  node_title: string;
  text: string;
  suggestion: string;
  excerpt: string;
  severity: "info" | "warn";
}

export interface QuoteStyleReport {
  total: { straight: number; curly: number };
  nodes: { node_id: string; title: string; straight: number; curly: number }[];
  mixed: boolean;
}
