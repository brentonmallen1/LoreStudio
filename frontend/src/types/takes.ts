/** Scene takes (doc 29 D7): whole-scene versions of one scene's prose, one of which counts. */
export interface SceneTake {
  id: string;
  node_id: string;
  /** Its place among the scene's takes, from 1: "Take 2". */
  number: number;
  /** The writer's name for it ("first draft"), shown after "Take 2 · ". */
  label: string;
  /** Its prose; for the take that counts, the scene's own. */
  content: string;
  word_count: number;
  /** The take that counts: the scene's prose in the manuscript, exports, counts and checks. */
  counts: boolean;
  /** The take the editor shows, and autosave writes to. */
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface TakesOut {
  node_id: string;
  /** Empty while the scene has one take. */
  takes: SceneTake[];
}
