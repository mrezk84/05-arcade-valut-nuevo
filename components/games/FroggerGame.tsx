'use client';

interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

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

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
  phase?: number; // solo tortugas: ms transcurridos dentro del ciclo de inmersión
}

export interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

export const SPEED_LEVEL_FACTOR = 1.15; // +15 % de velocidad por nivel
export const TURTLE_VISIBLE_MS = 3000;
export const TURTLE_SUBMERGED_MS = 1500;
export const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

interface LaneDef {
  row: number;
  type: Entity['type'];
  width: number; // celdas, igual para todas las entidades del carril
  count: number;
  speed: number; // px/frame (a 60 fps) en el nivel 1
  dir: 1 | -1;
}

const LANE_DEFS: LaneDef[] = [
  // Río (filas 1–6)
  { row: 1, type: 'log', width: 3, count: 3, speed: 3, dir: -1 },
  { row: 2, type: 'turtle', width: 3, count: 3, speed: 2.5, dir: -1 },
  { row: 3, type: 'log', width: 2, count: 4, speed: 1.8, dir: 1 },
  { row: 4, type: 'log', width: 4, count: 2, speed: 2, dir: 1 },
  { row: 5, type: 'turtle', width: 2, count: 4, speed: 1.5, dir: -1 },
  { row: 6, type: 'log', width: 3, count: 3, speed: 1, dir: 1 },
  // Carretera (filas 8–12)
  { row: 8, type: 'truck', width: 3, count: 2, speed: 4, dir: 1 },
  { row: 9, type: 'car', width: 1, count: 5, speed: 3, dir: -1 },
  { row: 10, type: 'car', width: 2, count: 3, speed: 2.5, dir: 1 },
  { row: 11, type: 'truck', width: 3, count: 3, speed: 2, dir: -1 },
  { row: 12, type: 'car', width: 1, count: 4, speed: 1.5, dir: 1 },
];

/**
 * Todas las entidades de un carril comparten anchura y se reparten a
 * intervalos iguales sobre un recorrido de `COLS + width` celdas (el mismo
 * que recorren al salir por un borde y reentrar por el otro), así los huecos
 * se conservan en el loop y siempre son de al menos 1 celda.
 */
export function buildLanes(level: number): Lane[] {
  const factor = Math.pow(SPEED_LEVEL_FACTOR, level - 1);
  return LANE_DEFS.map((def) => {
    const spacing = (COLS + def.width) / def.count;
    const entities: Entity[] = Array.from({ length: def.count }, (_, i) => {
      const entity: Entity = {
        col: -def.width + i * spacing,
        width: def.width,
        type: def.type,
      };
      if (def.type === 'turtle') {
        // Cada grupo arranca desfasado para que no se sumerjan todos a la vez.
        entity.phase = (i * (TURTLE_CYCLE_MS / def.count)) % TURTLE_CYCLE_MS;
        entity.submerged = entity.phase >= TURTLE_VISIBLE_MS;
      }
      return entity;
    });
    return { row: def.row, speed: def.speed * factor, dir: def.dir, entities };
  });
}

// Esqueleto mínimo para que el módulo compile; el game loop llega en el Paso 4.
export default function FroggerGame(props: FroggerGameProps) {
  void props;
  return null;
}
