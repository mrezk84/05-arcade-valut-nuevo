// Layout shared by the game loop (FroggerGame.tsx) and the skins (skins.ts).
// Kept in its own module so skins.ts does not import the component.

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
export const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

export const GOAL_COLS = [1, 4, 7, 10, 13]; // columna inicial de cada boca (2 celdas)
export const GOAL_WIDTH = 2;

export interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
  phase?: number; // solo tortugas: ms transcurridos dentro del ciclo de inmersión
}
