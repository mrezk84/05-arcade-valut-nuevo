'use client';

import { useEffect, useRef } from 'react';
import { CELL, COLS, ROWS, START_LENGTH } from './snake/constants';
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
    const dir: Dir = { dx: 1, dy: 0 };
    const snake: Cell[] = Array.from({ length: START_LENGTH }, (_, i) => ({
      col: 5 - i,
      row: 7,
    }));
    const fruit: Fruit = {
      col: 14,
      row: 7,
      name: FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)],
    };

    loadFruits()
      .then((img) => {
        if (cancelled) return;
        drawBoard(ctx);
        drawFruit(ctx, img, fruit.name, fruit.col, fruit.row);
        drawSnake(ctx, snake, dir, green);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
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
