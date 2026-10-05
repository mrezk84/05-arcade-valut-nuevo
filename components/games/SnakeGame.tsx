'use client';

import { useEffect, useRef } from 'react';
import {
  CELL,
  COLS,
  INPUT_QUEUE_MAX,
  ROWS,
  START_LENGTH,
  TICK_MIN,
  TICK_START,
  TICK_STEP,
} from './snake/constants';
import {
  FRUIT_NAMES,
  drawFruit,
  loadFruits,
  type FruitName,
} from './snake/sprites';

interface SnakeGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

const W = COLS * CELL;
const H = ROWS * CELL;
const BOARD_A = '#07100c';
const BOARD_B = '#0a1510';
const SEGMENT_INSET = 4;
const FALLBACK_GREEN = '#00ff88';
const MAX_DT = 100; // ms

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  KeyW: { dx: 0, dy: -1 },
  KeyS: { dx: 0, dy: 1 },
  KeyA: { dx: -1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
};
// Solo las flechas provocan scroll; WASD no se bloquea.
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function tickFor(level: number) {
  return Math.max(TICK_MIN, TICK_START - (level - 1) * TICK_STEP);
}

interface Cell {
  col: number;
  row: number;
}

interface Dir {
  dx: number;
  dy: number;
}

interface Fruit extends Cell {
  name: FruitName;
}

function drawBoard(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? BOARD_A : BOARD_B;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

// La cabeza es snake[0]. El cuerpo se atenúa hacia la cola.
function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Cell[],
  dir: Dir,
  green: string,
) {
  const size = CELL - SEGMENT_INSET * 2;

  ctx.save();
  ctx.shadowColor = green;
  ctx.shadowBlur = 14;
  ctx.fillStyle = green;
  for (let i = snake.length - 1; i >= 1; i--) {
    ctx.globalAlpha = 1 - 0.45 * (i / Math.max(1, snake.length - 1));
    ctx.beginPath();
    ctx.roundRect(
      snake[i].col * CELL + SEGMENT_INSET,
      snake[i].row * CELL + SEGMENT_INSET,
      size,
      size,
      6,
    );
    ctx.fill();
  }

  const head = snake[0];
  const hx = head.col * CELL;
  const hy = head.row * CELL;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c8ffe4';
  ctx.beginPath();
  ctx.roundRect(hx + 2, hy + 2, CELL - 4, CELL - 4, 8);
  ctx.fill();
  ctx.restore();

  // Dos ojos hacia el lado al que mira la cabeza.
  const cx = hx + CELL / 2;
  const cy = hy + CELL / 2;
  const forward = 8;
  const side = 8;
  const eye = 5;
  ctx.fillStyle = '#04110a';
  for (const s of [-1, 1]) {
    const ex = cx + dir.dx * forward + -dir.dy * side * s;
    const ey = cy + dir.dy * forward + dir.dx * side * s;
    ctx.fillRect(ex - eye / 2, ey - eye / 2, eye, eye);
  }
}

export default function SnakeGame({
  paused,
  onScoreChange,
  onLengthChange,
  onLevelChange,
  onGameOver,
}: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  const cbScore = useRef(onScoreChange);
  const cbLength = useRef(onLengthChange);
  const cbLevel = useRef(onLevelChange);
  const cbOver = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLength.current = onLengthChange;
  }, [onLengthChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let cancelled = false;

    const green =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--green')
        .trim() || FALLBACK_GREEN;

    // Estado inicial: cabeza en (5, 7), cuerpo a su izquierda, avanzando a la derecha.
    let dir: Dir = { dx: 1, dy: 0 };
    const snake: Cell[] = Array.from({ length: START_LENGTH }, (_, i) => ({
      col: 5 - i,
      row: 7,
    }));
    const fruit: Fruit = {
      col: 14,
      row: 7,
      name: FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)],
    };
    const level = 1;

    // Giros pendientes: cada uno se valida contra el último ya encolado, no contra la dirección actual.
    const queue: Dir[] = [];

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const next = KEY_DIRS[e.code];
      if (!next) return;
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      if (pausedRef.current) return;
      if (queue.length >= INPUT_QUEUE_MAX) return;

      const last = queue.length ? queue[queue.length - 1] : dir;
      const isOpposite = next.dx === -last.dx && next.dy === -last.dy;
      const isSame = next.dx === last.dx && next.dy === last.dy;
      if (isOpposite || isSame) return;
      queue.push(next);
    }

    function step() {
      if (queue.length) dir = queue.shift()!;
      const col = snake[0].col + dir.dx;
      const row = snake[0].row + dir.dy;
      // Provisional hasta el paso 6 (choques): la serpiente se detiene en el borde.
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      snake.unshift({ col, row });
      snake.pop();
    }

    let raf = 0;
    let removeKeys: (() => void) | undefined;

    loadFruits()
      .then((img) => {
        if (cancelled) return;

        let last = performance.now();
        let acc = 0;
        let wasPaused = pausedRef.current;

        const frame = (now: number) => {
          const dt = Math.min(MAX_DT, Math.max(0, now - last));
          last = now;

          if (pausedRef.current !== wasPaused) {
            // Al pausar y al reanudar: sin giros pendientes ni pasos acumulados.
            wasPaused = pausedRef.current;
            queue.length = 0;
            acc = 0;
          }

          if (!pausedRef.current) {
            acc += dt;
            const tick = tickFor(level);
            while (acc >= tick) {
              acc -= tick;
              step();
            }
          }

          drawBoard(ctx);
          drawFruit(ctx, img, fruit.name, fruit.col, fruit.row);
          drawSnake(ctx, snake, dir, green);
          raf = requestAnimationFrame(frame);
        };

        window.addEventListener('keydown', onKeyDown);
        removeKeys = () => window.removeEventListener('keydown', onKeyDown);
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      removeKeys?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}
