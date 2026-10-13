'use client';

import { useEffect, useRef } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  GOAL_COLS,
  GOAL_WIDTH,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
  type Entity,
} from './frogger/constants';
import { SKINS, type SkinId } from './frogger/skins';

export {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  GOAL_COLS,
  GOAL_WIDTH,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
};
export { ROWS, ROW_SAFE_MID } from './frogger/constants';
export type { Entity } from './frogger/constants';

interface FroggerGameProps {
  paused: boolean;
  skin: SkinId;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

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
  speed: number; // px/frame (a 60 fps) en el nivel 1 (≈ 0,75–3 celdas/s)
  dir: 1 | -1;
}

const LANE_DEFS: LaneDef[] = [
  // Río (filas 1–6)
  { row: 1, type: 'log', width: 3, count: 3, speed: 1.5, dir: -1 },
  { row: 2, type: 'turtle', width: 3, count: 3, speed: 1.25, dir: -1 },
  { row: 3, type: 'log', width: 2, count: 4, speed: 0.9, dir: 1 },
  { row: 4, type: 'log', width: 4, count: 2, speed: 1, dir: 1 },
  { row: 5, type: 'turtle', width: 2, count: 4, speed: 0.75, dir: -1 },
  { row: 6, type: 'log', width: 3, count: 3, speed: 0.5, dir: 1 },
  // Carretera (filas 8–12)
  { row: 8, type: 'truck', width: 3, count: 2, speed: 2, dir: 1 },
  { row: 9, type: 'car', width: 1, count: 5, speed: 1.5, dir: -1 },
  { row: 10, type: 'car', width: 2, count: 3, speed: 1.25, dir: 1 },
  { row: 11, type: 'truck', width: 3, count: 3, speed: 1, dir: -1 },
  { row: 12, type: 'car', width: 1, count: 4, speed: 0.75, dir: 1 },
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

export const JUMP_MS = 120;
export const MAX_DT = 100; // ms
export const START_LIVES = 3;
export const ROUND_TIME_MS = 15000;
export const ROUND_TIME_MIN_MS = 8000;
export const ROUND_TIME_STEP_MS = 1000; // se resta por nivel superado
export const COLLISION_MARGIN = 0.15; // celdas
export const POINTS_ROW = 10;
export const POINTS_GOAL = 50;
export const POINTS_ROUND = 200;
export const POINTS_TIME_PER_SEC = 10;

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};
// Solo las flechas provocan scroll; WASD no se bloquea.
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export function roundTimeFor(level: number) {
  return Math.max(
    ROUND_TIME_MIN_MS,
    ROUND_TIME_MS - (level - 1) * ROUND_TIME_STEP_MS,
  );
}

/** Entidad de río que cubre el centro de la rana, o null (agua o tortuga sumergida). */
export function getSupport(
  frog: Frog,
  lanes: Lane[],
): { lane: Lane; entity: Entity } | null {
  const center = frog.col + 0.5;
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    for (const entity of lane.entities) {
      if (center >= entity.col && center < entity.col + entity.width) {
        return entity.type === 'turtle' && entity.submerged
          ? null
          : { lane, entity };
      }
    }
  }
  return null;
}

/** true si la rana comparte carril con un vehículo que la solapa. */
export function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  if (frog.row < ROW_ROAD_TOP || frog.row > ROW_ROAD_BOT) return false;
  // La rana ocupa [col, col + 1); se deja un margen para no penalizar roces.
  const left = frog.col + COLLISION_MARGIN;
  const right = frog.col + 1 - COLLISION_MARGIN;
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    for (const e of lane.entities) {
      if (right > e.col && left < e.col + e.width) return true;
    }
  }
  return false;
}

/**
 * Índice de la boca libre que corresponde a la columna de la rana, que queda
 * marcada como ocupada. Devuelve null (muerte) si no hay boca o ya estaba ocupada.
 */
export function checkGoal(frog: Frog, goals: boolean[]): number | null {
  if (frog.row !== ROW_GOALS) return null;
  const col = Math.round(frog.col);
  const i = GOAL_COLS.findIndex((c) => col >= c && col < c + GOAL_WIDTH);
  if (i === -1 || goals[i]) return null;
  goals[i] = true;
  return i;
}

const START_COL = COLS / 2 - 1; // columna central (7)

function newFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
}

export default function FroggerGame({
  paused,
  skin,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  // Read inside the loop so switching skins never restarts the game
  const skinRef = useRef(skin);
  const cbScore = useRef(onScoreChange);
  const cbLives = useRef(onLivesChange);
  const cbLevel = useRef(onLevelChange);
  const cbOver = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLives.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let lanes = buildLanes(1);
    const frog = newFrog();
    const goals: boolean[] = GOAL_COLS.map(() => false);
    let score = 0;
    let lives = START_LIVES;
    let level = 1;
    let timeLeft = roundTimeFor(level);
    let bestRow = ROW_START; // fila más alta alcanzada en esta ronda
    let pendingDir: Direction | null = null;
    let gameOver = false;

    // Últimos valores notificados: los callbacks solo se disparan si cambian.
    let sentScore = score;
    let sentLives = lives;
    let sentLevel = level;

    // Devuelve la rana al inicio y reinicia el temporizador.
    function respawn() {
      Object.assign(frog, newFrog());
      timeLeft = roundTimeFor(level);
      pendingDir = null;
    }

    // Ronda completa: +200, nivel siguiente, carriles más rápidos y bocas vacías.
    function completeRound() {
      score += POINTS_ROUND;
      goals.fill(false);
      bestRow = ROW_START; // las filas vuelven a puntuar en la ronda nueva
      level += 1;
      lanes = buildLanes(level);
      respawn(); // rana al inicio y temporizador del nuevo nivel
      // onLevelChange se dispara en notify()
    }

    // Pierde una vida; sin vidas, avisa (vidas 0 y luego game over) y detiene la partida.
    function killFrog() {
      if (gameOver) return;
      lives -= 1;
      notify(); // onLivesChange(lives), y de paso el score pendiente
      if (lives === 0) {
        gameOver = true;
        cbOver.current(score);
        return;
      }
      respawn();
    }

    // Puntos y meta al completar un salto.
    function resolveLanding() {
      if (frog.row < bestRow) {
        score += (bestRow - frog.row) * POINTS_ROW;
        bestRow = frog.row;
      }
      if (frog.row === ROW_GOALS) {
        if (checkGoal(frog, goals) === null) {
          killFrog();
          return;
        }
        score += POINTS_GOAL + Math.ceil(timeLeft / 1000) * POINTS_TIME_PER_SEC;
        if (goals.every(Boolean)) completeRound();
        else respawn();
      }
    }

    // Muerte por vehículo, agua, tortuga sumergida o borde del río.
    function isFrogDead() {
      if (checkRoadCollision(frog, lanes)) return true;
      if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        return (
          getSupport(frog, lanes) === null ||
          frog.col < -0.5 ||
          frog.col > COLS - 0.5
        );
      }
      return false;
    }

    function notify() {
      if (score !== sentScore) {
        sentScore = score;
        cbScore.current(score);
      }
      if (lives !== sentLives) {
        sentLives = lives;
        cbLives.current(lives);
      }
      if (level !== sentLevel) {
        sentLevel = level;
        cbLevel.current(level);
      }
    }

    function update(dt: number) {
      // Entidades: avance en loop. Se reintroducen por el lado opuesto
      // conservando el desbordamiento, así los huecos no se desfasan.
      for (const lane of lanes) {
        const dx = ((lane.speed / CELL) * lane.dir * dt) / 16;
        for (const e of lane.entities) {
          e.col += dx;
          if (lane.dir === 1 && e.col >= COLS) e.col -= COLS + e.width;
          else if (lane.dir === -1 && e.col < -e.width) e.col += COLS + e.width;
          if (e.type === 'turtle') {
            e.phase = ((e.phase ?? 0) + dt) % TURTLE_CYCLE_MS;
            e.submerged = e.phase >= TURTLE_VISIBLE_MS;
          }
        }
      }

      if (!frog.animating) {
        if (pendingDir) {
          const { dc, dr } = DIR_DELTA[pendingDir];
          const targetCol = frog.col + dc;
          const targetRow = frog.row + dr;
          if (
            targetCol >= 0 &&
            targetCol <= COLS - 1 &&
            targetRow >= 0 &&
            targetRow <= ROW_START
          ) {
            frog.animating = true;
            frog.animT = 0;
            frog.targetCol = targetCol;
            frog.targetRow = targetRow;
          }
          pendingDir = null;
        } else if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
          // En el río, la rana viaja con la entidad que la soporta.
          const support = getSupport(frog, lanes);
          if (support) {
            frog.col +=
              ((support.lane.speed / CELL) * support.lane.dir * dt) / 16;
          }
        }
      }

      if (frog.animating) {
        frog.animT += dt;
        if (frog.animT >= JUMP_MS) {
          frog.col = frog.targetCol;
          frog.row = frog.targetRow;
          frog.animating = false;
          frog.animT = 0;
          // Fuera del río la rana vuelve a la cuadrícula (en el río viaja con el tronco).
          if (frog.row < ROW_RIVER_TOP || frog.row > ROW_RIVER_BOT) {
            frog.col = Math.min(COLS - 1, Math.max(0, Math.round(frog.col)));
          }
          resolveLanding();
        }
      }

      if (!frog.animating && isFrogDead()) killFrog();

      timeLeft -= dt;
      if (timeLeft <= 0) killFrog();

      notify();
    }

    function draw() {
      // Visual only: the skin never touches the game state
      const S = SKINS[skinRef.current] ?? SKINS.classic;
      S.drawBackground(ctx);
      for (const lane of lanes) {
        for (const e of lane.entities) S.drawEntity(ctx, e, lane.row);
      }
      S.drawGoals(ctx, goals);

      let fx = frog.col;
      let fy = frog.row;
      if (frog.animating) {
        const t = Math.min(1, frog.animT / JUMP_MS);
        fx += (frog.targetCol - frog.col) * t;
        fy += (frog.targetRow - frog.row) * t;
      }
      S.drawFrog(
        ctx,
        fx * CELL + CELL / 2,
        fy * CELL + CELL / 2,
        1,
        frog.animating,
      );
      S.drawHud(ctx, {
        score,
        level,
        lives,
        timeRatio: Math.max(0, Math.min(1, timeLeft / roundTimeFor(level))),
      });
      S.drawOverlay?.(ctx);
    }

    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIRS[e.code];
      if (!dir) return;
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat || pausedRef.current || gameOver) return;
      pendingDir = dir;
    }

    let raf = 0;
    let last = performance.now();
    let wasPaused = pausedRef.current;

    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, now - last));
      last = now;

      if (pausedRef.current !== wasPaused) {
        // Al pausar y al reanudar: sin saltos pendientes.
        wasPaused = pausedRef.current;
        pendingDir = null;
      }

      if (!pausedRef.current && !gameOver) update(dt);
      draw();
      if (gameOver) return; // fin de partida: el loop se detiene tras el último frame
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener('keydown', onKeyDown);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}
