import { CELL, COLS, ROWS } from './constants';
import { FRUIT_NAMES, drawFruit, type FruitName } from './sprites';

export type SkinId = 'classic' | 'neon' | 'retro';

export interface SnakeCell {
  col: number;
  row: number;
}

export interface SnakeDir {
  dx: number;
  dy: number;
}

export interface SnakeSkin {
  name: string;
  /** Paints the whole canvas (it also clears the previous frame). */
  drawBoard(ctx: CanvasRenderingContext2D): void;
  /** `snake[0]` is the head; `platformGreen` is the resolved `--green`. */
  drawSnake(
    ctx: CanvasRenderingContext2D,
    snake: SnakeCell[],
    dir: SnakeDir,
    platformGreen: string,
  ): void;
  drawFruit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    name: FruitName,
    col: number,
    row: number,
  ): void;
  /** Drawn last, over everything (e.g. scanlines). */
  drawOverlay?(ctx: CanvasRenderingContext2D): void;
}

export const SKIN_STORAGE_KEY = 'snake-skin';
export const DEFAULT_SKIN: SkinId = 'classic';

const W = COLS * CELL;
const H = ROWS * CELL;

// Fades the body towards the tail (1 at the neck, 0.55 at the tail)
function bodyAlpha(i: number, length: number) {
  return 1 - 0.45 * (i / Math.max(1, length - 1));
}

// Two eye positions on the side the head is facing
function eyeCenters(hx: number, hy: number, dir: SnakeDir, offset: number) {
  const cx = hx + CELL / 2;
  const cy = hy + CELL / 2;
  return [-1, 1].map((s) => ({
    x: cx + dir.dx * offset + -dir.dy * offset * s,
    y: cy + dir.dy * offset + dir.dx * offset * s,
  }));
}

// ── classic: the original look (unchanged) ─────────────────────────────────
const CLASSIC_BOARD_A = '#07100c';
const CLASSIC_BOARD_B = '#0a1510';
const CLASSIC_INSET = 4;

const classic: SnakeSkin = {
  name: 'Clásico',
  drawBoard(ctx) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.fillStyle =
          (col + row) % 2 === 0 ? CLASSIC_BOARD_A : CLASSIC_BOARD_B;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
  },
  drawSnake(ctx, snake, dir, green) {
    const size = CELL - CLASSIC_INSET * 2;

    ctx.save();
    ctx.shadowColor = green;
    ctx.shadowBlur = 14;
    ctx.fillStyle = green;
    for (let i = snake.length - 1; i >= 1; i--) {
      ctx.globalAlpha = bodyAlpha(i, snake.length);
      ctx.beginPath();
      ctx.roundRect(
        snake[i].col * CELL + CLASSIC_INSET,
        snake[i].row * CELL + CLASSIC_INSET,
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

    const eye = 5;
    ctx.fillStyle = '#04110a';
    for (const e of eyeCenters(hx, hy, dir, 8)) {
      ctx.fillRect(e.x - eye / 2, e.y - eye / 2, eye, eye);
    }
  },
  drawFruit,
};

// ── neon: platform palette, strokes over translucent fills, glow ───────────
const NEON = {
  bg: '#000000',
  grid: 'rgba(0, 255, 136, 0.07)',
  body: '#00ff88',
  bodyFill: 'rgba(0, 255, 136, 0.14)',
  head: '#00f5ff',
  headFill: 'rgba(0, 245, 255, 0.18)',
  eyes: '#f5ff00',
  fruits: [
    { stroke: '#ff006e', fill: 'rgba(255, 0, 110, 0.16)' },
    { stroke: '#f5ff00', fill: 'rgba(245, 255, 0, 0.14)' },
  ],
};
const NEON_INSET = 5;

const neon: SnakeSkin = {
  name: 'Neon',
  drawBoard(ctx) {
    ctx.fillStyle = NEON.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = NEON.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = CELL; x < W; x += CELL) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = CELL; y < H; y += CELL) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  },
  drawSnake(ctx, snake, dir) {
    const size = CELL - NEON_INSET * 2;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = NEON.body;
    ctx.strokeStyle = NEON.body;
    ctx.fillStyle = NEON.bodyFill;
    for (let i = snake.length - 1; i >= 1; i--) {
      ctx.globalAlpha = bodyAlpha(i, snake.length);
      ctx.beginPath();
      ctx.roundRect(
        snake[i].col * CELL + NEON_INSET,
        snake[i].row * CELL + NEON_INSET,
        size,
        size,
        6,
      );
      ctx.fill();
      ctx.stroke();
    }

    const head = snake[0];
    const hx = head.col * CELL;
    const hy = head.row * CELL;
    ctx.globalAlpha = 1;
    ctx.shadowColor = NEON.head;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = NEON.head;
    ctx.fillStyle = NEON.headFill;
    ctx.beginPath();
    ctx.roundRect(hx + 3, hy + 3, CELL - 6, CELL - 6, 8);
    ctx.fill();
    ctx.stroke();

    const eye = 4;
    ctx.shadowColor = NEON.eyes;
    ctx.shadowBlur = 6;
    ctx.fillStyle = NEON.eyes;
    for (const e of eyeCenters(hx, hy, dir, 8)) {
      ctx.fillRect(e.x - eye / 2, e.y - eye / 2, eye, eye);
    }
    ctx.restore();
  },
  drawFruit(ctx, _img, name, col, row) {
    const c = NEON.fruits[FRUIT_NAMES.indexOf(name) % NEON.fruits.length];
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2 + 2;

    ctx.save();
    ctx.shadowColor = c.stroke;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.stroke;
    ctx.fillStyle = c.fill;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Stem
    ctx.shadowColor = NEON.body;
    ctx.strokeStyle = NEON.body;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx + 4, cy - 16);
    ctx.stroke();
    ctx.restore();
  },
};

// ── retro: CRT / 8-bit, 8-colour palette, solid shapes, no glow ────────────
const RETRO = {
  bgA: '#0c140e',
  bgB: '#13221a',
  body: '#008751',
  head: '#00e436',
  fruits: ['#ff004d', '#ffa300', '#ffec27'],
  shine: '#fff1e8',
};
const RETRO_INSET = 3;
const RETRO_PX = 4;
// 7×7 pixel-art fruit: f = fruit colour, w = shine, g = leaf
const RETRO_FRUIT = [
  '...g...',
  '..g....',
  '.fffff.',
  'ffwffff',
  'fffffff',
  'fffffff',
  '.fffff.',
];

const retro: SnakeSkin = {
  name: 'Retro',
  drawBoard(ctx) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? RETRO.bgA : RETRO.bgB;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
  },
  drawSnake(ctx, snake, dir) {
    const size = CELL - RETRO_INSET * 2;

    for (let i = snake.length - 1; i >= 1; i--) {
      const x = snake[i].col * CELL + RETRO_INSET;
      const y = snake[i].row * CELL + RETRO_INSET;
      ctx.fillStyle = RETRO.body;
      ctx.fillRect(x, y, size, size);
      // One-pixel-block highlight for the 8-bit look
      ctx.fillStyle = RETRO.head;
      ctx.fillRect(x + RETRO_PX, y + RETRO_PX, RETRO_PX * 2, RETRO_PX);
    }

    const head = snake[0];
    const hx = head.col * CELL;
    const hy = head.row * CELL;
    ctx.fillStyle = RETRO.head;
    ctx.fillRect(hx + 2, hy + 2, CELL - 4, CELL - 4);

    const eye = 6;
    ctx.fillStyle = RETRO.bgA;
    for (const e of eyeCenters(hx, hy, dir, 8)) {
      ctx.fillRect(
        Math.round(e.x - eye / 2),
        Math.round(e.y - eye / 2),
        eye,
        eye,
      );
    }
  },
  drawFruit(ctx, _img, name, col, row) {
    const fruit = RETRO.fruits[FRUIT_NAMES.indexOf(name) % RETRO.fruits.length];
    const size = RETRO_FRUIT.length * RETRO_PX;
    const ox = col * CELL + (CELL - size) / 2;
    const oy = row * CELL + (CELL - size) / 2;
    const colours: Record<string, string> = {
      f: fruit,
      w: RETRO.shine,
      g: RETRO.head,
    };

    RETRO_FRUIT.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const c = colours[line[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * RETRO_PX, oy + y * RETRO_PX, RETRO_PX, RETRO_PX);
      }
    });
  },
  drawOverlay(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  },
};

export const SKINS: Record<SkinId, SnakeSkin> = { classic, neon, retro };

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const SKIN_OPTIONS = SKIN_IDS.map((id) => ({
  id,
  name: SKINS[id].name,
}));

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKINS;
}
