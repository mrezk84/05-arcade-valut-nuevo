'use client';

import { useEffect, useRef } from 'react';
import { createPerfProbe } from './perf/probe';
import {
  CELL,
  COLS,
  FRUITS_PER_LEVEL,
  INPUT_QUEUE_MAX,
  POINTS_PER_FRUIT,
  ROWS,
  START_LENGTH,
  TICK_MIN,
  TICK_START,
  TICK_STEP,
} from './snake/constants';
import { FRUIT_NAMES, loadFruits, type FruitName } from './snake/sprites';
import { SKINS, type SkinId } from './snake/skins';

interface SnakeGameProps {
  paused: boolean;
  skin: SkinId;
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

const W = COLS * CELL;
const H = ROWS * CELL;
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

export default function SnakeGame({
  paused,
  skin,
  onScoreChange,
  onLengthChange,
  onLevelChange,
  onGameOver,
}: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  // Read inside the loop so switching skins never restarts the game
  const skinRef = useRef(skin);
  const cbScore = useRef(onScoreChange);
  const cbLength = useRef(onLengthChange);
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
    const probe = createPerfProbe('snake', skinRef.current);
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
    let score = 0;
    let eaten = 0;
    let level = 1;

    // Elige entre las celdas libres, sin reintentar al azar. Sin celdas libres devuelve null (victoria, paso 6).
    function spawnFruit(): Fruit | null {
      const taken = new Set(snake.map((c) => c.row * COLS + c.col));
      const free: number[] = [];
      for (let i = 0; i < COLS * ROWS; i++) {
        if (!taken.has(i)) free.push(i);
      }
      if (!free.length) return null;
      const idx = free[Math.floor(Math.random() * free.length)];
      return {
        col: idx % COLS,
        row: Math.floor(idx / COLS),
        name: FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)],
      };
    }

    let fruit = spawnFruit();

    // Giros pendientes: cada uno se valida contra el último ya encolado, no contra la dirección actual.
    const queue: Dir[] = [];

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const next = KEY_DIRS[e.code];
      if (!next) return;
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      if (pausedRef.current || gameOver) return;
      if (queue.length >= INPUT_QUEUE_MAX) return;

      const last = queue.length ? queue[queue.length - 1] : dir;
      const isOpposite = next.dx === -last.dx && next.dy === -last.dy;
      const isSame = next.dx === last.dx && next.dy === last.dy;
      if (isOpposite || isSame) return;
      queue.push(next);
    }

    // Cada callback solo se dispara cuando su valor cambia. Al montar se emite el estado inicial.
    let gameOver = false;
    let lastScore = -1;
    let lastLength = -1;
    let lastLevel = -1;

    function emit() {
      if (score !== lastScore) {
        lastScore = score;
        cbScore.current(score);
      }
      if (snake.length !== lastLength) {
        lastLength = snake.length;
        cbLength.current(snake.length);
      }
      if (level !== lastLevel) {
        lastLevel = level;
        cbLevel.current(level);
      }
    }

    function endGame() {
      if (gameOver) return;
      gameOver = true;
      cbOver.current(score);
    }

    emit();

    function step() {
      if (queue.length) dir = queue.shift()!;
      const col = snake[0].col + dir.dx;
      const row = snake[0].row + dir.dy;

      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
        endGame();
        return;
      }

      const eats = fruit !== null && fruit.col === col && fruit.row === row;

      // Si no come, la cola se retira en este mismo tick, así que su celda queda libre para la cabeza.
      const body = eats ? snake : snake.slice(0, -1);
      if (body.some((c) => c.col === col && c.row === row)) {
        endGame();
        return;
      }

      snake.unshift({ col, row });

      if (eats) {
        // Comer: la cola no se retira, así que la serpiente crece 1 segmento.
        eaten += 1;
        score += POINTS_PER_FRUIT;
        level = Math.floor(eaten / FRUITS_PER_LEVEL) + 1;
        fruit = spawnFruit();
        emit();
        if (!fruit) endGame(); // tablero lleno: victoria
      } else {
        snake.pop();
      }
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
          probe.frame(now);
          const dt = Math.min(MAX_DT, Math.max(0, now - last));
          last = now;

          if (pausedRef.current !== wasPaused) {
            // Al pausar y al reanudar: sin giros pendientes ni pasos acumulados.
            wasPaused = pausedRef.current;
            queue.length = 0;
            acc = 0;
          }

          if (!pausedRef.current && !gameOver) {
            acc += dt;
            const tick = tickFor(level);
            while (!gameOver && acc >= tick) {
              acc -= tick;
              step();
            }
          }

          // Visual only: the skin never touches the game state
          const S = SKINS[skinRef.current] ?? SKINS.classic;
          S.drawBoard(ctx);
          if (fruit) S.drawFruit(ctx, img, fruit.name, fruit.col, fruit.row);
          S.drawSnake(ctx, snake, dir, green);
          S.drawOverlay?.(ctx);
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
