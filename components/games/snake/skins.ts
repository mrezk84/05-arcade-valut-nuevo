import { bakeSprite, getBaked } from '../perf/spriteCache';
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

// Two eyes on the side the head is facing (no allocations: called per frame)
function fillEyes(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  dx: number,
  dy: number,
  offset: number,
  eye: number,
  round: boolean,
) {
  const cx = hx + CELL / 2;
  const cy = hy + CELL / 2;
  for (let s = -1; s <= 1; s += 2) {
    const x = cx + dx * offset + -dy * offset * s - eye / 2;
    const y = cy + dy * offset + dx * offset * s - eye / 2;
    ctx.fillRect(
      round ? Math.round(x) : x,
      round ? Math.round(y) : y,
      eye,
      eye,
    );
  }
}

// ── Caché de dibujado (SPEC 12) ─────────────────────────────────────────────
// Tablero, scanlines y sprites con glow o de píxeles se pintan una vez en un
// canvas offscreen; cada frame hace `drawImage`. Los segmentos del cuerpo se
// dibujan con `globalAlpha` < 1, así que su sombra y su forma se cachean en
// capas separadas y se componen en el mismo orden que el dibujado en vivo
// (sombra → relleno → sombra → trazo), cada una con el alpha del segmento.

const BAKE_PAD = CELL; // margen para que el halo del glow no se recorte
const SPRITE = CELL + BAKE_PAD * 2;
const SHADOW_SHIFT = 4096; // desplaza la forma fuera del canvas: solo queda su sombra

const FRUIT_INDEX = {} as Record<FruitName, number>;
for (let i = 0; i < FRUIT_NAMES.length; i++) FRUIT_INDEX[FRUIT_NAMES[i]] = i;

// 0..8 para las 4 direcciones posibles
function dirCode(dir: SnakeDir) {
  return (dir.dx + 1) * 3 + dir.dy + 1;
}
const codeDx = (code: number) => Math.floor(code / 3) - 1;
const codeDy = (code: number) => (code % 3) - 1;

type SpriteMap = Map<number, HTMLCanvasElement>;

// Búsqueda rápida por código numérico; la clave de texto solo se arma al construir
function sprite(
  fast: SpriteMap,
  prefix: string,
  code: number,
  build: (code: number) => HTMLCanvasElement,
): HTMLCanvasElement {
  let s = fast.get(code);
  if (!s) {
    s = getBaked(prefix + code, () => build(code));
    fast.set(code, s);
  }
  return s;
}

// Solo la sombra de `paint` (sin la forma), igual que la dibuja el contexto
function shadowOnly(
  b: CanvasRenderingContext2D,
  color: string,
  blur: number,
  paint: (b: CanvasRenderingContext2D) => void,
) {
  b.save();
  b.shadowColor = color;
  b.shadowBlur = blur;
  b.shadowOffsetX = SHADOW_SHIFT;
  b.translate(-SHADOW_SHIFT, 0);
  paint(b);
  b.restore();
}

// Sprite de celda con margen: se pinta en (col, row) desplazado por BAKE_PAD
function drawCell(
  ctx: CanvasRenderingContext2D,
  s: HTMLCanvasElement,
  col: number,
  row: number,
) {
  ctx.drawImage(s, col * CELL - BAKE_PAD, row * CELL - BAKE_PAD);
}

function bakedBoard(
  id: SkinId,
  paint: (ctx: CanvasRenderingContext2D) => void,
): (ctx: CanvasRenderingContext2D) => void {
  let baked: HTMLCanvasElement | null = null;
  return (ctx) => {
    baked ??= getBaked(`snake:${id}:bg`, () => bakeSprite(W, H, paint));
    ctx.drawImage(baked, 0, 0);
  };
}

// ── classic: the original look (unchanged) ─────────────────────────────────
const CLASSIC_BOARD_A = '#07100c';
const CLASSIC_BOARD_B = '#0a1510';
const CLASSIC_INSET = 4;
const CLASSIC_SIZE = CELL - CLASSIC_INSET * 2;

function paintClassicBoard(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? CLASSIC_BOARD_A : CLASSIC_BOARD_B;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

const CLASSIC_BODY_SHADOW = 0;
const CLASSIC_BODY = 1;
const CLASSIC_HEAD = 10; // + dirCode

// El glow usa el `--green` de la plataforma: la caché se invalida si cambia
let classicGreen = '';
let classicPrefix = '';
const classicFast: SpriteMap = new Map();
const classicFruitFast: SpriteMap = new Map();

function classicBodyPath(b: CanvasRenderingContext2D) {
  b.fillStyle = classicGreen;
  b.beginPath();
  b.roundRect(
    BAKE_PAD + CLASSIC_INSET,
    BAKE_PAD + CLASSIC_INSET,
    CLASSIC_SIZE,
    CLASSIC_SIZE,
    6,
  );
  b.fill();
}

function buildClassic(code: number): HTMLCanvasElement {
  return bakeSprite(SPRITE, SPRITE, (b) => {
    if (code === CLASSIC_BODY_SHADOW) {
      shadowOnly(b, classicGreen, 14, classicBodyPath);
    } else if (code === CLASSIC_BODY) {
      classicBodyPath(b);
    } else {
      const d = code - CLASSIC_HEAD;
      b.save();
      b.shadowColor = classicGreen;
      b.shadowBlur = 14;
      b.fillStyle = '#c8ffe4';
      b.beginPath();
      b.roundRect(BAKE_PAD + 2, BAKE_PAD + 2, CELL - 4, CELL - 4, 8);
      b.fill();
      b.restore();
      b.fillStyle = '#04110a';
      fillEyes(b, BAKE_PAD, BAKE_PAD, codeDx(d), codeDy(d), 8, 5, false);
    }
  });
}

const classic: SnakeSkin = {
  name: 'Clásico',
  drawBoard: bakedBoard('classic', paintClassicBoard),
  drawSnake(ctx, snake, dir, green) {
    if (green !== classicGreen) {
      classicGreen = green;
      classicPrefix = `snake:classic:${green}:`;
      classicFast.clear();
    }
    const shadow = sprite(
      classicFast,
      classicPrefix,
      CLASSIC_BODY_SHADOW,
      buildClassic,
    );
    const body = sprite(classicFast, classicPrefix, CLASSIC_BODY, buildClassic);
    for (let i = snake.length - 1; i >= 1; i--) {
      ctx.globalAlpha = bodyAlpha(i, snake.length);
      drawCell(ctx, shadow, snake[i].col, snake[i].row);
      drawCell(ctx, body, snake[i].col, snake[i].row);
    }
    ctx.globalAlpha = 1;
    drawCell(
      ctx,
      sprite(
        classicFast,
        classicPrefix,
        CLASSIC_HEAD + dirCode(dir),
        buildClassic,
      ),
      snake[0].col,
      snake[0].row,
    );
  },
  // Recorte de fruits.png pre-escalado a una celda (mismo desplazamiento sub-píxel)
  drawFruit(ctx, img, name, col, row) {
    const i = FRUIT_INDEX[name];
    let s = classicFruitFast.get(i);
    if (!s) {
      s = getBaked(`snake:classic:fruit:${name}`, () =>
        bakeSprite(CELL, CELL, (b) => drawFruit(b, img, name, 0, 0)),
      );
      classicFruitFast.set(i, s);
    }
    ctx.drawImage(s, col * CELL, row * CELL);
  },
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
const NEON_SIZE = CELL - NEON_INSET * 2;

function paintNeonBoard(ctx: CanvasRenderingContext2D) {
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
}

// Capas de un segmento, en el orden en que el contexto las compone
const NEON_FILL_SHADOW = 0;
const NEON_FILL = 1;
const NEON_STROKE_SHADOW = 2;
const NEON_STROKE = 3;
const NEON_HEAD = 10; // + dirCode
const NEON_FRUIT = 20; // + índice de color

const neonFast: SpriteMap = new Map();

function neonSegmentPath(b: CanvasRenderingContext2D) {
  b.beginPath();
  b.roundRect(
    BAKE_PAD + NEON_INSET,
    BAKE_PAD + NEON_INSET,
    NEON_SIZE,
    NEON_SIZE,
    6,
  );
}
function neonSegmentFill(b: CanvasRenderingContext2D) {
  b.fillStyle = NEON.bodyFill;
  neonSegmentPath(b);
  b.fill();
}
function neonSegmentStroke(b: CanvasRenderingContext2D) {
  b.lineWidth = 2;
  b.strokeStyle = NEON.body;
  neonSegmentPath(b);
  b.stroke();
}

function buildNeon(code: number): HTMLCanvasElement {
  return bakeSprite(SPRITE, SPRITE, (b) => {
    if (code === NEON_FILL_SHADOW) {
      shadowOnly(b, NEON.body, 12, neonSegmentFill);
    } else if (code === NEON_FILL) {
      neonSegmentFill(b);
    } else if (code === NEON_STROKE_SHADOW) {
      shadowOnly(b, NEON.body, 12, neonSegmentStroke);
    } else if (code === NEON_STROKE) {
      neonSegmentStroke(b);
    } else if (code >= NEON_FRUIT) {
      const c = NEON.fruits[code - NEON_FRUIT];
      const cx = BAKE_PAD + CELL / 2;
      const cy = BAKE_PAD + CELL / 2 + 2;
      b.shadowColor = c.stroke;
      b.shadowBlur = 14;
      b.lineWidth = 2;
      b.strokeStyle = c.stroke;
      b.fillStyle = c.fill;
      b.beginPath();
      b.arc(cx, cy, 11, 0, Math.PI * 2);
      b.fill();
      b.stroke();

      // Stem
      b.shadowColor = NEON.body;
      b.strokeStyle = NEON.body;
      b.beginPath();
      b.moveTo(cx, cy - 11);
      b.lineTo(cx + 4, cy - 16);
      b.stroke();
    } else {
      const d = code - NEON_HEAD;
      b.lineWidth = 2;
      b.shadowColor = NEON.head;
      b.shadowBlur = 16;
      b.strokeStyle = NEON.head;
      b.fillStyle = NEON.headFill;
      b.beginPath();
      b.roundRect(BAKE_PAD + 3, BAKE_PAD + 3, CELL - 6, CELL - 6, 8);
      b.fill();
      b.stroke();

      b.shadowColor = NEON.eyes;
      b.shadowBlur = 6;
      b.fillStyle = NEON.eyes;
      fillEyes(b, BAKE_PAD, BAKE_PAD, codeDx(d), codeDy(d), 8, 4, false);
    }
  });
}

const neon: SnakeSkin = {
  name: 'Neon',
  drawBoard: bakedBoard('neon', paintNeonBoard),
  drawSnake(ctx, snake, dir) {
    const fillShadow = sprite(
      neonFast,
      'snake:neon:',
      NEON_FILL_SHADOW,
      buildNeon,
    );
    const fill = sprite(neonFast, 'snake:neon:', NEON_FILL, buildNeon);
    const strokeShadow = sprite(
      neonFast,
      'snake:neon:',
      NEON_STROKE_SHADOW,
      buildNeon,
    );
    const stroke = sprite(neonFast, 'snake:neon:', NEON_STROKE, buildNeon);
    for (let i = snake.length - 1; i >= 1; i--) {
      const col = snake[i].col;
      const row = snake[i].row;
      ctx.globalAlpha = bodyAlpha(i, snake.length);
      drawCell(ctx, fillShadow, col, row);
      drawCell(ctx, fill, col, row);
      drawCell(ctx, strokeShadow, col, row);
      drawCell(ctx, stroke, col, row);
    }
    ctx.globalAlpha = 1;
    drawCell(
      ctx,
      sprite(neonFast, 'snake:neon:', NEON_HEAD + dirCode(dir), buildNeon),
      snake[0].col,
      snake[0].row,
    );
  },
  drawFruit(ctx, _img, name, col, row) {
    const c = FRUIT_INDEX[name] % NEON.fruits.length;
    drawCell(
      ctx,
      sprite(neonFast, 'snake:neon:', NEON_FRUIT + c, buildNeon),
      col,
      row,
    );
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

function paintRetroBoard(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? RETRO.bgA : RETRO.bgB;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

// Fruta de píxeles pre-renderizada en una celda, por color
function buildRetroFruit(code: number): HTMLCanvasElement {
  return bakeSprite(CELL, CELL, (b) => {
    const size = RETRO_FRUIT.length * RETRO_PX;
    const ox = (CELL - size) / 2;
    const oy = (CELL - size) / 2;
    const colours: Record<string, string> = {
      f: RETRO.fruits[code],
      w: RETRO.shine,
      g: RETRO.head,
    };
    RETRO_FRUIT.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const c = colours[line[x]];
        if (!c) continue;
        b.fillStyle = c;
        b.fillRect(ox + x * RETRO_PX, oy + y * RETRO_PX, RETRO_PX, RETRO_PX);
      }
    });
  });
}

const retroFast: SpriteMap = new Map();
let retroOverlay: HTMLCanvasElement | null = null;

const retro: SnakeSkin = {
  name: 'Retro',
  drawBoard: bakedBoard('retro', paintRetroBoard),
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

    ctx.fillStyle = RETRO.bgA;
    fillEyes(ctx, hx, hy, dir.dx, dir.dy, 8, 6, true);
  },
  drawFruit(ctx, _img, name, col, row) {
    const c = FRUIT_INDEX[name] % RETRO.fruits.length;
    ctx.drawImage(
      sprite(retroFast, 'snake:retro:fruit:', c, buildRetroFruit),
      col * CELL,
      row * CELL,
    );
  },
  drawOverlay(ctx) {
    retroOverlay ??= getBaked('snake:retro:overlay', () =>
      bakeSprite(W, H, (b) => {
        b.fillStyle = 'rgba(0, 0, 0, 0.22)';
        for (let y = 0; y < H; y += 3) b.fillRect(0, y, W, 1);
      }),
    );
    ctx.drawImage(retroOverlay, 0, 0);
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
