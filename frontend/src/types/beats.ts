/** Beat sheets (moved out of types/index.ts, which is at its size lock). */
export interface Beat {
  id: string;
  name: string;
  position_pct: number;
  description: string;
}

export interface BeatSheet {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  user_id: string | null;
  beats: Beat[];
}
