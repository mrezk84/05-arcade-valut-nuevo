'use client';

import { useEffect, useRef } from 'react';
import {
  type Piece,
  createBoard,
  randomPiece,
  collide,
  tryRotate,
  merge,
  clearLines,
  ghostY,
  fallInterval,
} from './tetris/board';
import { LINE_SCORES } from './tetris/constants';
import { draw, drawNext } from './tetris/draw';

interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function TetrisGame({
  paused,
  onScoreChange,
  onLinesChange,
  onLevelChange,
  onLivesChange,
  onGameOver,
}: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  const cbScore = useRef(onScoreChange);
  const cbLines = useRef(onLinesChange);
  const cbLevel = useRef(onLevelChange);
  const cbLives = useRef(onLivesChange);
  const cbOver = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLines.current = onLinesChange;
  }, [onLinesChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbLives.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const nextCtx = nextCanvasRef.current!.getContext('2d')!;

    let board!: number[][], current!: Piece, next!: Piece;
    let score!: number, lines!: number, level!: number, lives!: number;
    // Last values emitted to the platform HUD; a callback fires only on change
    let hudScore: number | undefined,
      hudLines: number | undefined,
      hudLevel: number | undefined,
      hudLives: number | undefined;
    let gameOver!: boolean;
    let lastTime!: number,
      dropAccum!: number,
      dropInterval!: number,
      animId!: number;

    function clearFullLines() {
      const cleared = clearLines(board);
      if (cleared) {
        lines += cleared;
        score += (LINE_SCORES[cleared] || 0) * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = fallInterval(level);
        updateHUD();
      }
    }

    function hardDrop() {
      const gy = ghostY(board, current);
      score += (gy - current.y) * 2;
      current.y = gy;
      lockPiece();
    }

    function softDrop() {
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
        score += 1;
        updateHUD();
      } else {
        lockPiece();
      }
    }

    function lockPiece() {
      merge(board, current);
      clearFullLines();
      spawn();
    }

    function spawn() {
      current = next;
      next = randomPiece();
      if (collide(board, current.shape, current.x, current.y)) {
        endGame();
      }
      drawNext(nextCtx, next);
    }

    function updateHUD() {
      if (score !== hudScore) {
        hudScore = score;
        cbScore.current(score);
      }
      if (lines !== hudLines) {
        hudLines = lines;
        cbLines.current(lines);
      }
      if (level !== hudLevel) {
        hudLevel = level;
        cbLevel.current(level);
      }
      if (lives !== hudLives) {
        hudLives = lives;
        cbLives.current(lives);
      }
    }

    function endGame() {
      if (gameOver) return;
      gameOver = true;
      cancelAnimationFrame(animId);
      lives = 0;
      updateHUD();
      cbOver.current(score);
    }

    function loop(ts: number) {
      // Platform pause: the loop keeps running, but no fall accumulates.
      // lastTime is refreshed every frame and dt is capped, so resuming
      // (or returning to the tab) never releases several drops at once.
      const dt = Math.min(ts - lastTime, 100);
      lastTime = ts;
      if (!pausedRef.current) {
        dropAccum += dt;
        if (dropAccum >= dropInterval) {
          dropAccum = 0;
          if (!collide(board, current.shape, current.x, current.y + 1)) {
            current.y++;
          } else {
            lockPiece();
          }
        }
      }
      if (gameOver) return;
      draw(ctx, board, current);
      animId = requestAnimationFrame(loop);
    }

    function init() {
      board = createBoard();
      score = 0;
      lines = 0;
      level = 1;
      lives = 1;
      gameOver = false;
      dropInterval = fallInterval(level);
      dropAccum = 0;
      lastTime = performance.now();
      hudScore = hudLines = hudLevel = hudLives = undefined;
      next = randomPiece();
      spawn();
      updateHUD();
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(loop);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (pausedRef.current || gameOver) return;
      switch (e.code) {
        case 'ArrowLeft':
          if (!collide(board, current.shape, current.x - 1, current.y))
            current.x--;
          break;
        case 'ArrowRight':
          if (!collide(board, current.shape, current.x + 1, current.y))
            current.x++;
          break;
        case 'ArrowDown':
          softDrop();
          break;
        case 'ArrowUp':
        case 'KeyX':
          tryRotate(board, current);
          break;
        case 'Space':
          hardDrop();
          break;
      }
      updateHUD();
    }

    window.addEventListener('keydown', onKeyDown);

    init();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="tetris-stage">
      <div className="tetris-board">
        <canvas
          ref={canvasRef}
          width={300}
          height={600}
          className="tetris-canvas"
        />
        <div className="tetris-next">
          <div className="tetris-next-label">Siguiente</div>
          <canvas
            ref={nextCanvasRef}
            width={120}
            height={120}
            className="tetris-next-canvas"
          />
        </div>
      </div>
    </div>
  );
}
