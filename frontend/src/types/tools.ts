// Types for the non-AI manuscript tools (quote normalisation).

export interface QuoteStyleReport {
  total: { straight: number; curly: number };
  nodes: { node_id: string; title: string; straight: number; curly: number }[];
  mixed: boolean;
}
