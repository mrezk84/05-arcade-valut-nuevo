export interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
  cover: string;
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  sort_order: number;
}

export interface ScoreRow {
  id: string;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
  user_id: string | null;
}
