'use client';

import { useEffect, useRef } from 'react';

type Shape = number[][];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

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
    const COLS = 10;
    const ROWS = 20;
    const BLOCK = 30;
    const BOARD_BG = '#1a1a25';
    const GRID_LINE = '#22222e';

    const COLORS: (string | null)[] = [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
      '#9e9e9e', // N - tuerca (gris metálico)
    ];

    const PIECES: (Shape | null)[] = [
      null,
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ], // I
      [
        [2, 2],
        [2, 2],
      ], // O
      [
        [0, 3, 0],
        [3, 3, 3],
        [0, 0, 0],
      ], // T
      [
        [0, 4, 4],
        [4, 4, 0],
        [0, 0, 0],
      ], // S
      [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0],
      ], // Z
      [
        [6, 0, 0],
        [6, 6, 6],
        [0, 0, 0],
      ], // J
      [
        [0, 0, 7],
        [7, 7, 7],
        [0, 0, 0],
      ], // L
      [
        [8, 8, 8],
        [8, 0, 8],
        [8, 8, 8],
      ], // N (tuerca)
    ];

    const LINE_SCORES = [0, 100, 300, 500, 800];

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const nextCanvas = nextCanvasRef.current!;
    const nextCtx = nextCanvas.getContext('2d')!;

    let board!: number[][], current!: Piece, next!: Piece;
    let score!: number, lines!: number, level!: number;
    let gameOver!: boolean;
    let lastTime: number,
      dropAccum: number,
      dropInterval: number,
      animId: number;
    const startLevel = 1;
    let maxCombo!: number, currentCombo!: number, lastClearWasCombo!: boolean;

    function createBoard() {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    function randomPiece() {
      const type = Math.floor(Math.random() * 8) + 1;
      const shape = PIECES[type]!.map((row) => [...row]);
      return {
        type,
        shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
      };
    }

    function collide(shape: Shape, ox: number, oy: number) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const nx = ox + c;
          const ny = oy + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    }

    function rotateCW(shape: Shape) {
      const rows = shape.length,
        cols = shape[0].length;
      const result = Array.from({ length: cols }, () =>
        new Array(rows).fill(0),
      );
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
      return result;
    }

    function tryRotate() {
      const rotated = rotateCW(current.shape);
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        if (!collide(rotated, current.x + kick, current.y)) {
          current.shape = rotated;
          current.x += kick;
          return;
        }
      }
    }

    function merge() {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            board[current.y + r][current.x + c] = current.shape[r][c];
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every((v) => v !== 0)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += (LINE_SCORES[cleared] || 0) * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 90);
        if (lastClearWasCombo) {
          currentCombo++;
        } else {
          currentCombo = 1;
        }
        lastClearWasCombo = true;
        if (currentCombo > maxCombo) maxCombo = currentCombo;
        updateHUD();
      } else {
        lastClearWasCombo = false;
      }
    }

    function ghostY() {
      let gy = current.y;
      while (!collide(current.shape, current.x, gy + 1)) gy++;
      return gy;
    }

    function hardDrop() {
      const gy = ghostY();
      score += (gy - current.y) * 2;
      current.y = gy;
      lockPiece();
    }

    function softDrop() {
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
        score += 1;
        updateHUD();
      } else {
        lockPiece();
      }
    }

    function lockPiece() {
      merge();
      clearLines();
      spawn();
    }

    function spawn() {
      current = next;
      next = randomPiece();
      if (collide(current.shape, current.x, current.y)) {
        endGame();
      }
      drawNext();
    }

    // Provisional: the body arrives in step 6
    function updateHUD() {}

    function drawBlock(
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      colorIndex: number,
      size: number,
      alpha?: number,
    ) {
      if (!colorIndex) return;
      const color = COLORS[colorIndex]!;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    }

    function drawGrid() {
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 0.5;
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK, 0);
        ctx.lineTo(c * BLOCK, ROWS * BLOCK);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK);
        ctx.lineTo(COLS * BLOCK, r * BLOCK);
        ctx.stroke();
      }
    }

    function draw() {
      ctx.fillStyle = BOARD_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid();

      // board
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

      // ghost
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx,
              current.x + c,
              gy + r,
              current.shape[r][c],
              BLOCK,
              0.2,
            );

      // current piece
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK,
          );
    }

    function drawNext() {
      const NB = 30;
      nextCtx.fillStyle = BOARD_BG;
      nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
      const shape = next.shape;
      const offX = Math.floor((4 - shape[0].length) / 2);
      const offY = Math.floor((4 - shape.length) / 2);
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
    }

    // Provisional: the body arrives in step 6
    function endGame() {
      gameOver = true;
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
          if (!collide(current.shape, current.x, current.y + 1)) {
            current.y++;
          } else {
            lockPiece();
          }
        }
      }
      if (gameOver) return;
      draw();
      animId = requestAnimationFrame(loop);
    }

    function init() {
      board = createBoard();
      score = 0;
      lines = 0;
      level = startLevel;
      gameOver = false;
      dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
      dropAccum = 0;
      maxCombo = 0;
      currentCombo = 0;
      lastClearWasCombo = false;
      lastTime = performance.now();
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
          if (!collide(current.shape, current.x - 1, current.y)) current.x--;
          break;
        case 'ArrowRight':
          if (!collide(current.shape, current.x + 1, current.y)) current.x++;
          break;
        case 'ArrowDown':
          softDrop();
          break;
        case 'ArrowUp':
        case 'KeyX':
          tryRotate();
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
