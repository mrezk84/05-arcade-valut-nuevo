import {
  EXPLOSION_FRAMES,
  drawFrame,
  drawSprite,
  type BlockColor,
} from './sprites';

export type SkinId = 'classic' | 'neon' | 'retro';

type Ctx = CanvasRenderingContext2D;

/**
 * Visual-only skin for Arkanoid. Every draw function receives the entity's
 * real box (x, y, w, h); skins never change sizes, hitboxes or game rules.
 */
export interface ArkanoidSkin {
  name: string;
  /** Canvas background. */
  bg: string;
  hudText: string;
  /** Receives the resolved pixel font family (empty if unavailable). */
  hudFont(pixelFamily: string): string;
  /** `shadowBlur` for the HUD text; 0 disables glow. */
  hudGlow: number;
  /** Drawn right after the background, under every entity. */
  drawBackdrop?(ctx: Ctx, w: number, h: number): void;
  drawBlock(
    ctx: Ctx,
    color: BlockColor,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  /** `t` is the explosion progress in [0, 1). */
  drawExplosion(
    ctx: Ctx,
    color: BlockColor,
    t: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  drawPaddle(ctx: Ctx, x: number, y: number, w: number, h: number): void;
  /** Also used for the lives icons in the HUD. */
  drawBall(ctx: Ctx, x: number, y: number, w: number, h: number): void;
  /** Drawn last, over everything (e.g. scanlines). */
  drawOverlay?(ctx: Ctx, w: number, h: number): void;
}

export const SKIN_STORAGE_KEY = 'arkanoid-skin';
export const DEFAULT_SKIN: SkinId = 'classic';

/** Four hard animation steps, shared by the sprite and the 8-bit explosions. */
function explosionStep(t: number) {
  return Math.min(Math.floor(t * 4), 3);
}

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ── Neon ─────────────────────────────────────────────────────────────────────
const NEON = {
  cyan: '#00f5ff',
  magenta: '#ff006e',
  yellow: '#f5ff00',
  green: '#00ff88',
};

const NEON_BLOCK: Record<BlockColor, string> = {
  red: '#ff2a4d',
  yellow: NEON.yellow,
  cyan: NEON.cyan,
  magenta: NEON.magenta,
  hotpink: '#ff4fd8',
  green: NEON.green,
  gray: '#8a8aa8',
};

const NEON_FILL_ALPHA = 0.16;
const NEON_BLOCK_FILL = Object.fromEntries(
  Object.entries(NEON_BLOCK).map(([k, c]) => [k, rgba(c, NEON_FILL_ALPHA)]),
) as Record<BlockColor, string>;

const NEON_SPARKS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -1.3],
  [0, 1.3],
];

// ── Retro (8 colours, PICO-8 subset) ─────────────────────────────────────────
const RETRO = {
  bg: '#0e0c1f',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  green: '#00e436',
  blue: '#29adff',
  pink: '#ff77a8',
  cream: '#fff1e8',
};

// Gray blocks become silver (cream) bricks, like the arcade's metal blocks
const RETRO_BLOCK: Record<BlockColor, string> = {
  red: RETRO.red,
  yellow: RETRO.yellow,
  cyan: RETRO.blue,
  magenta: RETRO.pink,
  hotpink: RETRO.orange,
  green: RETRO.green,
  gray: RETRO.cream,
};

export const SKINS: Record<SkinId, ArkanoidSkin> = {
  // Original look: Petraheim spritesheet on black
  classic: {
    name: 'Clásico',
    bg: '#000',
    hudText: '#fff',
    hudFont: () => 'bold 18px monospace',
    hudGlow: 0,
    drawBlock(ctx, color, x, y, w, h) {
      drawSprite(ctx, `block_${color}`, x, y, w, h);
    },
    drawExplosion(ctx, color, t, x, y, w, h) {
      drawFrame(ctx, EXPLOSION_FRAMES[color][explosionStep(t)], x, y, w, h);
    },
    drawPaddle(ctx, x, y, w, h) {
      drawSprite(ctx, 'paddle', x, y, w, h);
    },
    drawBall(ctx, x, y, w, h) {
      drawSprite(ctx, 'ball', x, y, w, h);
    },
  },

  // Platform palette: glowing outlines over translucent fills, faint grid
  neon: {
    name: 'Neon',
    bg: '#000000',
    hudText: NEON.cyan,
    hudFont: () => 'bold 18px monospace',
    hudGlow: 8,
    drawBackdrop(ctx, w, h) {
      ctx.strokeStyle = rgba(NEON.magenta, 0.06);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 40; x < w; x += 40) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = 40; y < h; y += 40) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
    },
    drawBlock(ctx, color, x, y, w, h) {
      const c = NEON_BLOCK[color];
      ctx.save();
      ctx.fillStyle = NEON_BLOCK_FILL[color];
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.shadowBlur = 10;
      ctx.shadowColor = c;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
      ctx.restore();
    },
    drawExplosion(ctx, color, t, x, y, w, h) {
      const c = NEON_BLOCK[color];
      const grow = t * 10;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.shadowBlur = 12;
      ctx.shadowColor = c;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        x + 3.5 - grow,
        y + 3.5 - grow / 2,
        w - 7 + grow * 2,
        h - 7 + grow,
      );
      ctx.fillStyle = c;
      for (const [dx, dy] of NEON_SPARKS)
        ctx.fillRect(cx + dx * t * 40 - 1.5, cy + dy * t * 20 - 1.5, 3, 3);
      ctx.restore();
    },
    drawPaddle(ctx, x, y, w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, (h - 1.5) / 2);
      ctx.fillStyle = rgba(NEON.cyan, NEON_FILL_ALPHA);
      ctx.fill();
      ctx.shadowBlur = 14;
      ctx.shadowColor = NEON.cyan;
      ctx.strokeStyle = NEON.cyan;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    },
    drawBall(ctx, x, y, w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
      ctx.shadowBlur = 14;
      ctx.shadowColor = NEON.yellow;
      ctx.fillStyle = NEON.yellow;
      ctx.fill();
      ctx.restore();
    },
  },

  // CRT / 8-bit: 8-colour palette, solid pixel shapes, no glow, scanlines
  retro: {
    name: 'Retro',
    bg: RETRO.bg,
    hudText: RETRO.cream,
    hudFont: (pixel) =>
      pixel ? `12px ${pixel}, monospace` : 'bold 18px monospace',
    hudGlow: 0,
    drawBlock(ctx, color, x, y, w, h) {
      const c = RETRO_BLOCK[color];
      const bx = Math.round(x);
      const by = Math.round(y);
      ctx.fillStyle = c;
      ctx.fillRect(bx + 2, by + 2, w - 4, h - 4);
      // Pixel-art glint in the top-left corner
      ctx.fillStyle = c === RETRO.cream ? RETRO.blue : RETRO.cream;
      ctx.fillRect(bx + 5, by + 5, 8, 2);
      ctx.fillRect(bx + 5, by + 7, 2, 2);
    },
    drawExplosion(ctx, color, t, x, y, w, h) {
      // Brick breaks into 4×2 chunks that shrink and scatter in four steps
      const step = explosionStep(t);
      const size = [8, 6, 4, 2][step];
      const spread = step * 5;
      ctx.fillStyle = RETRO_BLOCK[color];
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 2; j++) {
          const cx = x + (w / 4) * (i + 0.5) + (i - 1.5) * spread * 0.6;
          const cy = y + (h / 2) * (j + 0.5) + (j - 0.5) * spread + step * 3;
          ctx.fillRect(
            Math.round(cx - size / 2),
            Math.round(cy - size / 2),
            size,
            size,
          );
        }
    },
    drawPaddle(ctx, x, y, w, h) {
      // Vaus-style: cream body, red caps, blue core light
      const px = Math.round(x);
      const py = Math.round(y);
      ctx.fillStyle = RETRO.red;
      ctx.fillRect(px, py, 8, h);
      ctx.fillRect(px + w - 8, py, 8, h);
      ctx.fillStyle = RETRO.cream;
      ctx.fillRect(px + 8, py + 2, w - 16, h - 4);
      ctx.fillStyle = RETRO.blue;
      ctx.fillRect(Math.round(px + w / 2 - 6), py + 2, 12, h - 4);
    },
    drawBall(ctx, x, y, w, h) {
      // 8×8 pixel disc scaled to the ball box
      const u = w / 8;
      const v = h / 8;
      const px = Math.round(x);
      const py = Math.round(y);
      ctx.fillStyle = RETRO.cream;
      ctx.fillRect(px + 2 * u, py + v, 4 * u, 6 * v);
      ctx.fillRect(px + u, py + 2 * v, 6 * u, 4 * v);
    },
    drawOverlay(ctx, w, h) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    },
  },
};

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const SKIN_OPTIONS = SKIN_IDS.map((id) => ({
  id,
  name: SKINS[id].name,
}));

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKINS;
}
