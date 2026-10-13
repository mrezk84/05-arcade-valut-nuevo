import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  GOAL_COLS,
  GOAL_WIDTH,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  type Entity,
} from './constants';
import { bakeSprite, getBaked } from '../perf/spriteCache';

export type SkinId = 'classic' | 'neon' | 'retro';

export interface FroggerHud {
  score: number;
  level: number;
  lives: number;
  /** Remaining round time, 0–1. */
  timeRatio: number;
}

/** Visual only: skins never read or change the game state. */
export interface FroggerSkin {
  name: string;
  /** Paints the whole canvas (it also clears the previous frame). */
  drawBackground(ctx: CanvasRenderingContext2D): void;
  drawEntity(ctx: CanvasRenderingContext2D, e: Entity, row: number): void;
  /** `goals[i]` is true when that bay already holds a frog. */
  drawGoals(ctx: CanvasRenderingContext2D, goals: boolean[]): void;
  drawFrog(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    jump: boolean,
  ): void;
  drawHud(ctx: CanvasRenderingContext2D, hud: FroggerHud): void;
  /** Drawn last, over everything (e.g. scanlines). */
  drawOverlay?(ctx: CanvasRenderingContext2D): void;
}

export const SKIN_STORAGE_KEY = 'frogger-skin';
export const DEFAULT_SKIN: SkinId = 'classic';

// Bay geometry shared by every skin (same rectangle as the original look)
const GOAL_Y = 18;
const GOAL_H = CELL - GOAL_Y;
const GOAL_W = GOAL_WIDTH * CELL;

// Etiquetas del HUD: solo se reconstruye el string cuando cambia el valor.
function memoLabel(prefix: string) {
  let last = -1;
  let text = '';
  return (n: number) => {
    if (n !== last) {
      last = n;
      text = prefix + n;
    }
    return text;
  };
}

// ── classic: the original look (unchanged) ─────────────────────────────────

// Tortuga vista desde arriba, mirando a la izquierda (los carriles de tortugas
// avanzan hacia la izquierda).
function classicTurtle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  submerged?: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.9, 0.9); // deja aire entre tortugas contiguas
  if (submerged) {
    ctx.strokeStyle = 'rgba(74,222,128,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Aletas
  ctx.fillStyle = '#22c55e';
  for (const [fx, fy, rot] of [
    [-8, -11, -0.5],
    [-8, 11, 0.5],
    [9, -10, 0.5],
    [9, 10, -0.5],
  ]) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, 6, 3.2, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cola y cabeza
  ctx.beginPath();
  ctx.moveTo(12, -2.5);
  ctx.lineTo(18, 0);
  ctx.lineTo(12, 2.5);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(-15, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#052e16';
  for (const ey of [-2.5, 2.5]) {
    ctx.beginPath();
    ctx.arc(-17, ey, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Caparazón con placas
  ctx.fillStyle = '#15803d';
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-3, -5);
  ctx.lineTo(3, -5);
  ctx.lineTo(6, 0);
  ctx.lineTo(3, 5);
  ctx.lineTo(-3, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(-7, -9);
  ctx.moveTo(3, -5);
  ctx.lineTo(7, -9);
  ctx.moveTo(-3, 5);
  ctx.lineTo(-7, 9);
  ctx.moveTo(3, 5);
  ctx.lineTo(7, 9);
  ctx.moveTo(6, 0);
  ctx.lineTo(12, 0);
  ctx.stroke();
  ctx.restore();
}

function classicFrog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  jump: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#22c55e';
  if (jump) {
    // Patas extendidas durante el salto.
    ctx.fillRect(-18, -12, 8, 6);
    ctx.fillRect(10, -12, 8, 6);
    ctx.fillRect(-18, 6, 8, 6);
    ctx.fillRect(10, 6, 8, 6);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const ex of [-6, 6]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(ex, -8, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const classicScore = memoLabel('SCORE ');
const classicLevel = memoLabel('NIVEL ');

const classic: FroggerSkin = {
  name: 'Clásico',
  drawBackground(ctx) {
    const zones: [number, number, string][] = [
      [ROW_GOALS, ROW_GOALS, '#0a3d1a'],
      [ROW_RIVER_TOP, ROW_RIVER_BOT, '#0a1f4d'],
      [ROW_SAFE_MID, ROW_SAFE_MID, '#14532d'],
      [ROW_ROAD_TOP, ROW_ROAD_BOT, '#0b0b10'],
      [ROW_START, ROW_START, '#14532d'],
    ];
    for (const [from, to, color] of zones) {
      ctx.fillStyle = color;
      ctx.fillRect(0, from * CELL, CANVAS_W, (to - from + 1) * CELL);
    }
    // Marcas de carril en la carretera.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let r = ROW_ROAD_TOP; r < ROW_ROAD_BOT; r++) {
      for (let x = 0; x < CANVAS_W; x += CELL * 2) {
        ctx.fillRect(x + 8, (r + 1) * CELL - 1, CELL - 16, 2);
      }
    }
  },
  drawEntity(ctx, e, row) {
    const x = e.col * CELL;
    const y = row * CELL;
    const w = e.width * CELL;
    switch (e.type) {
      case 'car': {
        ctx.fillStyle = e.width % 2 ? '#ef4444' : '#facc15';
        ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(x + w * 0.3, y + 10, w * 0.4, CELL - 20);
        ctx.fillStyle = '#111827';
        for (const wx of [x + 10, x + w - 10]) {
          ctx.beginPath();
          ctx.arc(wx, y + 6, 4, 0, Math.PI * 2);
          ctx.arc(wx, y + CELL - 6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'truck': {
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(x + 2, y + 5, w - 4, CELL - 10);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x + w - CELL * 0.7, y + 5, CELL * 0.7 - 2, CELL - 10);
        ctx.fillStyle = '#111827';
        for (let k = 0; k < e.width; k++) {
          ctx.beginPath();
          ctx.arc(x + k * CELL + 12, y + 5, 4, 0, Math.PI * 2);
          ctx.arc(x + k * CELL + 12, y + CELL - 5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'log': {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        for (let k = 12; k < w - 6; k += 16) {
          ctx.beginPath();
          ctx.moveTo(x + k, y + 9);
          ctx.lineTo(x + k, y + CELL - 9);
          ctx.stroke();
        }
        break;
      }
      case 'turtle': {
        for (let k = 0; k < e.width; k++) {
          classicTurtle(
            ctx,
            x + k * CELL + CELL / 2,
            y + CELL / 2,
            e.submerged,
          );
        }
        break;
      }
    }
  },
  drawGoals(ctx, goals) {
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      const filled = goals[i];
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x, GOAL_Y, GOAL_W, GOAL_H);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, GOAL_Y + 1, GOAL_W - 2, GOAL_H - 2);
      if (filled) {
        classicFrog(ctx, x + GOAL_W / 2, GOAL_Y + GOAL_H / 2, 0.6, false);
      }
    }
  },
  drawFrog: classicFrog,
  drawHud(ctx, { score, level, lives, timeRatio }) {
    ctx.fillStyle =
      timeRatio > 0.5 ? '#22c55e' : timeRatio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(0, 0, CANVAS_W * timeRatio, 5);

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(classicScore(score), 8, 16);
    ctx.textAlign = 'center';
    ctx.fillText(classicLevel(level), CANVAS_W / 2, 16);
    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(CANVAS_W - 14 - i * 20, 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ── neon: night highway, strokes over translucent fills, glow ──────────────

const NEON = {
  bg: '#000000',
  goalRow: 'rgba(0, 255, 136, 0.05)',
  river: 'rgba(0, 245, 255, 0.07)',
  safe: 'rgba(0, 255, 136, 0.07)',
  waves: 'rgba(0, 245, 255, 0.12)',
  safeGrid: 'rgba(0, 255, 136, 0.10)',
  laneMark: 'rgba(255, 0, 110, 0.22)',
  frog: '#00ff88',
  frogFill: 'rgba(0, 255, 136, 0.20)',
  eyes: '#f5ff00',
  carA: '#ff006e', // 1-cell cars
  carB: '#f5ff00', // 2-cell cars
  truck: '#00f5ff',
  cab: '#ff006e',
  log: '#ff9f1c',
  turtle: '#00f5ff',
  submerged: 'rgba(0, 245, 255, 0.30)',
  goal: '#f5ff00',
  goalFill: 'rgba(0, 255, 136, 0.08)',
  text: '#00f5ff',
  timer: ['#00ff88', '#f5ff00', '#ff006e'],
};

// Translucent fill + glowing stroke for the shape built by `path`
function neonShape(
  ctx: CanvasRenderingContext2D,
  color: string,
  fillAlpha: number,
  blur: number,
  path: () => void,
) {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function neonFrog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  jump: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.shadowColor = NEON.frog;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = NEON.frog;
  ctx.lineWidth = 2;
  // Legs: tucked in at rest, stretched while jumping
  const reach = jump ? 19 : 15;
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    ctx.moveTo(sx * 9, -6);
    ctx.lineTo(sx * reach, jump ? -14 : -10);
    ctx.moveTo(sx * 9, 7);
    ctx.lineTo(sx * reach, jump ? 15 : 11);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 1, 11, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = NEON.frogFill;
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = NEON.eyes;
  ctx.shadowBlur = 8;
  ctx.fillStyle = NEON.eyes;
  for (const ex of [-5, 5]) {
    ctx.beginPath();
    ctx.arc(ex, -8, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const neon: FroggerSkin = {
  name: 'Neon',
  drawBackground(ctx) {
    ctx.fillStyle = NEON.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = NEON.goalRow;
    ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    ctx.fillStyle = NEON.river;
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    ctx.fillStyle = NEON.safe;
    for (const r of [ROW_SAFE_MID, ROW_START]) {
      ctx.fillRect(0, r * CELL, CANVAS_W, CELL);
    }

    ctx.save();
    ctx.lineWidth = 1;
    // River: staggered ripples
    ctx.strokeStyle = NEON.waves;
    ctx.beginPath();
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      const y = r * CELL + CELL / 2;
      const shift = (r % 2) * CELL;
      for (let x = shift - CELL; x < CANVAS_W; x += CELL * 2) {
        ctx.moveTo(x + 10, y);
        ctx.quadraticCurveTo(x + 20, y - 5, x + 30, y);
        ctx.quadraticCurveTo(x + 40, y + 5, x + 50, y);
      }
    }
    ctx.stroke();
    // Safe strips: faint cell grid
    ctx.strokeStyle = NEON.safeGrid;
    ctx.beginPath();
    for (const r of [ROW_SAFE_MID, ROW_START]) {
      for (let x = CELL; x < CANVAS_W; x += CELL) {
        ctx.moveTo(x + 0.5, r * CELL);
        ctx.lineTo(x + 0.5, (r + 1) * CELL);
      }
    }
    ctx.stroke();
    // Road: solid edges and dashed lane dividers
    ctx.strokeStyle = NEON.laneMark;
    ctx.beginPath();
    for (const y of [ROW_ROAD_TOP * CELL, (ROW_ROAD_BOT + 1) * CELL]) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_W, y + 0.5);
    }
    ctx.stroke();
    ctx.setLineDash([CELL - 16, CELL + 16]);
    ctx.lineDashOffset = -8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = ROW_ROAD_TOP; r < ROW_ROAD_BOT; r++) {
      ctx.moveTo(0, (r + 1) * CELL);
      ctx.lineTo(CANVAS_W, (r + 1) * CELL);
    }
    ctx.stroke();
    ctx.restore();
  },
  drawEntity(ctx, e, row) {
    const x = e.col * CELL;
    const y = row * CELL;
    const w = e.width * CELL;
    switch (e.type) {
      case 'car': {
        const color = e.width % 2 ? NEON.carA : NEON.carB;
        neonShape(ctx, color, 0.16, 12, () =>
          ctx.roundRect(x + 4, y + 7, w - 8, CELL - 14, 7),
        );
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + w * 0.3, y + 12, w * 0.4, CELL - 24, 3);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'truck': {
        const cabW = CELL * 0.7;
        neonShape(ctx, NEON.truck, 0.12, 10, () =>
          ctx.roundRect(x + 3, y + 6, w - cabW - 8, CELL - 12, 3),
        );
        neonShape(ctx, NEON.cab, 0.18, 12, () =>
          ctx.roundRect(x + w - cabW - 1, y + 6, cabW - 2, CELL - 12, 6),
        );
        break;
      }
      case 'log': {
        neonShape(ctx, NEON.log, 0.14, 10, () =>
          ctx.roundRect(x + 2, y + 7, w - 4, CELL - 14, 13),
        );
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = NEON.log;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 16; k < w - 10; k += 22) {
          ctx.moveTo(x + k, y + CELL / 2 - 4);
          ctx.lineTo(x + k + 10, y + CELL / 2 - 4);
          ctx.moveTo(x + k + 6, y + CELL / 2 + 4);
          ctx.lineTo(x + k + 16, y + CELL / 2 + 4);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'turtle': {
        for (let k = 0; k < e.width; k++) {
          const cx = x + k * CELL + CELL / 2;
          const cy = y + CELL / 2;
          if (e.submerged) {
            ctx.save();
            ctx.strokeStyle = NEON.submerged;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.ellipse(cx, cy, 12, 10, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else {
            // Vista desde arriba, mirando a la izquierda.
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(0.9, 0.9);
            ctx.translate(-cx, -cy);
            neonShape(ctx, NEON.turtle, 0.16, 8, () => {
              ctx.ellipse(cx - 15, cy, 5, 4.5, 0, 0, Math.PI * 2); // cabeza
              ctx.moveTo(cx + 12, cy - 2);
              ctx.lineTo(cx + 18, cy);
              ctx.lineTo(cx + 12, cy + 2); // cola
            });
            neonShape(ctx, NEON.turtle, 0.16, 8, () => {
              ctx.ellipse(cx - 8, cy - 11, 5, 2.6, -0.5, 0, Math.PI * 2);
              ctx.ellipse(cx - 8, cy + 11, 5, 2.6, 0.5, 0, Math.PI * 2);
              ctx.ellipse(cx + 9, cy - 10, 5, 2.6, 0.5, 0, Math.PI * 2);
              ctx.ellipse(cx + 9, cy + 10, 5, 2.6, -0.5, 0, Math.PI * 2);
            });
            neonShape(ctx, NEON.turtle, 0.2, 12, () =>
              ctx.ellipse(cx, cy, 12, 10, 0, 0, Math.PI * 2),
            );
            ctx.save();
            ctx.strokeStyle = NEON.turtle;
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy);
            ctx.lineTo(cx - 3, cy - 5);
            ctx.lineTo(cx + 3, cy - 5);
            ctx.lineTo(cx + 6, cy);
            ctx.lineTo(cx + 3, cy + 5);
            ctx.lineTo(cx - 3, cy + 5);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            ctx.restore();
          }
        }
        break;
      }
    }
  },
  drawGoals(ctx, goals) {
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      const filled = goals[i];
      neonShape(ctx, NEON.goal, 0, 8, () =>
        ctx.rect(x + 2, GOAL_Y + 1, GOAL_W - 4, GOAL_H - 2),
      );
      ctx.fillStyle = NEON.goalFill;
      ctx.fillRect(x + 3, GOAL_Y + 2, GOAL_W - 6, GOAL_H - 4);
      if (filled) {
        neonFrog(ctx, x + GOAL_W / 2, GOAL_Y + GOAL_H / 2, 0.6, false);
      }
    }
  },
  drawFrog: neonFrog,
  drawHud(ctx, { score, level, lives, timeRatio }) {
    const timer = NEON.timer[timeRatio > 0.5 ? 0 : timeRatio > 0.25 ? 1 : 2];
    ctx.save();
    ctx.shadowColor = timer;
    ctx.shadowBlur = 10;
    ctx.fillStyle = timer;
    ctx.fillRect(0, 0, CANVAS_W * timeRatio, 4);
    ctx.restore();
    ctx.drawImage(neonHudText(score, level, lives), 0, 0);
  },
};

// Texto y vidas del HUD con glow: solo se vuelven a pintar si cambian los valores
const hudLayer = { canvas: null as HTMLCanvasElement | null };
let hudScoreSeen = -1;
let hudLevelSeen = -1;
let hudLivesSeen = -1;

function neonHudText(
  score: number,
  level: number,
  lives: number,
): HTMLCanvasElement {
  if (!hudLayer.canvas) {
    hudLayer.canvas = document.createElement('canvas');
    hudLayer.canvas.width = CANVAS_W;
    hudLayer.canvas.height = 32;
  }
  const layer = hudLayer.canvas;
  if (
    score !== hudScoreSeen ||
    level !== hudLevelSeen ||
    lives !== hudLivesSeen
  ) {
    hudScoreSeen = score;
    hudLevelSeen = level;
    hudLivesSeen = lives;
    const ctx = layer.getContext('2d')!;
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.save();
    ctx.shadowColor = NEON.text;
    ctx.shadowBlur = 6;
    ctx.fillStyle = NEON.text;
    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score}`, 8, 16);
    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, 16);

    ctx.shadowColor = NEON.frog;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = NEON.frog;
    ctx.fillStyle = NEON.frogFill;
    ctx.lineWidth = 2;
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(CANVAS_W - 14 - i * 20, 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  return layer;
}

// ── retro: 1981 arcade cabinet, 8 colours, solid pixels, scanlines ─────────

const RETRO = {
  road: '#0c0a1a',
  water: '#14204a',
  grass: '#0f2a1a',
  green: '#00e436',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  white: '#fff1e8',
};
const PX = 4; // one "arcade pixel"

// Snaps to the pixel grid so moving things step like 8-bit hardware (visual only)
const snap = (v: number) => Math.round(v / PX) * PX;

function pixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: readonly string[],
  colours: Record<string, string>,
  ox: number,
  oy: number,
  px: number,
) {
  for (let y = 0; y < sprite.length; y++) {
    const line = sprite[y];
    for (let x = 0; x < line.length; x++) {
      const c = colours[line[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }
}

const FROG_IDLE = [
  '.ww..ww.',
  '.wk..kw.',
  '..gggg..',
  'g.gggg.g',
  'gggggggg',
  '..gggg..',
  '.gg..gg.',
  'g......g',
];
const FROG_JUMP = [
  'gww..wwg',
  '.wk..kw.',
  '..gggg..',
  '..gggg..',
  '.gggggg.',
  '..gggg..',
  '.g....g.',
  'g......g',
];
const FROG_COLOURS = { g: RETRO.green, w: RETRO.white, k: RETRO.road };

// Vista desde arriba, mirando a la izquierda: cabeza (h), aletas y cola (g).
const TURTLE = [
  '..g..g..',
  '.grrrrg.',
  'hhrryrrt',
  'hhrryrrt',
  '.grrrrg.',
  '..g..g..',
];
const TURTLE_SUBMERGED = [
  '..r..r..',
  '........',
  'r......r',
  'r......r',
  '........',
  '..r..r..',
];
const TURTLE_COLOURS = {
  r: RETRO.red,
  y: RETRO.yellow,
  g: RETRO.green,
  h: RETRO.green,
  t: RETRO.green,
};

function retroFrog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  jump: boolean,
) {
  const px = Math.max(1, Math.round(PX * scale));
  const size = 8 * px;
  ctx.drawImage(
    retroFrogSprite(px, jump),
    snap(cx - size / 2),
    snap(cy - size / 2),
  );
}

// Rana pre-renderizada por tamaño de píxel y pose (SPEC 12)
const retroFrogCache = new Map<number, HTMLCanvasElement>();
function retroFrogSprite(px: number, jump: boolean): HTMLCanvasElement {
  const code = px * 2 + (jump ? 1 : 0);
  let sprite = retroFrogCache.get(code);
  if (!sprite) {
    sprite = getBaked(`frogger:retro:frog:${px}:${jump}`, () =>
      bakeSprite(8 * px, 8 * px, (b) =>
        pixelSprite(b, jump ? FROG_JUMP : FROG_IDLE, FROG_COLOURS, 0, 0, px),
      ),
    );
    retroFrogCache.set(code, sprite);
  }
  return sprite;
}

const retroScore = memoLabel('SCORE ');
const retroLevel = memoLabel('NIVEL ');

const retro: FroggerSkin = {
  name: 'Retro',
  drawBackground(ctx) {
    const zones: [number, number, string][] = [
      [ROW_GOALS, ROW_GOALS, RETRO.grass],
      [ROW_RIVER_TOP, ROW_RIVER_BOT, RETRO.water],
      [ROW_SAFE_MID, ROW_SAFE_MID, RETRO.grass],
      [ROW_ROAD_TOP, ROW_ROAD_BOT, RETRO.road],
      [ROW_START, ROW_START, RETRO.grass],
    ];
    for (const [from, to, color] of zones) {
      ctx.fillStyle = color;
      ctx.fillRect(0, from * CELL, CANVAS_W, (to - from + 1) * CELL);
    }
    // Water ripples and grass tufts in the darkest colour
    ctx.fillStyle = RETRO.road;
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      const shift = (r % 2) * CELL;
      for (let x = shift; x < CANVAS_W; x += CELL * 2) {
        ctx.fillRect(x + 8, r * CELL + 12, PX * 3, PX);
        ctx.fillRect(x + 24, r * CELL + 28, PX * 3, PX);
      }
    }
    for (const r of [ROW_GOALS, ROW_SAFE_MID, ROW_START]) {
      for (let x = 0; x < CANVAS_W; x += PX * 4) {
        ctx.fillRect(x + ((x / (PX * 4)) % 2) * PX * 2, r * CELL + 32, PX, PX);
      }
    }
    // Lane dividers
    ctx.fillStyle = RETRO.water;
    for (let r = ROW_ROAD_TOP; r < ROW_ROAD_BOT; r++) {
      for (let x = 0; x < CANVAS_W; x += CELL * 2) {
        ctx.fillRect(x + 8, (r + 1) * CELL - 2, CELL - 16, PX);
      }
    }
  },
  drawEntity(ctx, e, row) {
    const x = snap(e.col * CELL);
    const y = row * CELL;
    const w = e.width * CELL;
    switch (e.type) {
      case 'car': {
        ctx.fillStyle = e.width % 2 ? RETRO.red : RETRO.yellow;
        ctx.fillRect(x + 4, y + 8, w - 8, CELL - 16);
        ctx.fillStyle = RETRO.white;
        ctx.fillRect(x + snap(w * 0.3), y + 12, snap(w * 0.4), CELL - 24);
        // Tyres cut into the corners of the body
        ctx.fillStyle = RETRO.road;
        for (const wx of [x + 8, x + w - 16]) {
          ctx.fillRect(wx, y + 8, 8, PX);
          ctx.fillRect(wx, y + CELL - 12, 8, PX);
        }
        break;
      }
      case 'truck': {
        const cabW = 28;
        ctx.fillStyle = RETRO.white;
        ctx.fillRect(x + 4, y + 8, w - cabW - 8, CELL - 16);
        ctx.fillStyle = RETRO.orange;
        ctx.fillRect(x + 4, y + CELL / 2 - 2, w - cabW - 8, PX);
        ctx.fillStyle = RETRO.red;
        ctx.fillRect(x + w - cabW, y + 8, cabW - 4, CELL - 16);
        ctx.fillStyle = RETRO.road;
        for (let k = 0; k < e.width; k++) {
          ctx.fillRect(x + k * CELL + 8, y + 8, 8, PX);
          ctx.fillRect(x + k * CELL + 8, y + CELL - 12, 8, PX);
        }
        break;
      }
      case 'log': {
        ctx.fillStyle = RETRO.orange;
        ctx.fillRect(x + 4, y + 8, w - 8, CELL - 16);
        ctx.fillStyle = RETRO.road;
        for (let k = 12; k < w - 12; k += 16) {
          ctx.fillRect(x + k, y + 12 + ((k / 16) % 2) * 8, PX * 2, PX);
        }
        // Cut ends
        ctx.fillRect(x + 4, y + 8, PX, PX);
        ctx.fillRect(x + 4, y + CELL - 12, PX, PX);
        ctx.fillRect(x + w - 8, y + 8, PX, PX);
        ctx.fillRect(x + w - 8, y + CELL - 12, PX, PX);
        break;
      }
      case 'turtle': {
        for (let k = 0; k < e.width; k++) {
          pixelSprite(
            ctx,
            e.submerged ? TURTLE_SUBMERGED : TURTLE,
            TURTLE_COLOURS,
            x + k * CELL + 4,
            y + 8,
            PX,
          );
        }
        break;
      }
    }
  },
  drawGoals(ctx, goals) {
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      const filled = goals[i];
      ctx.fillStyle = RETRO.yellow;
      ctx.fillRect(x, GOAL_Y, GOAL_W, GOAL_H);
      ctx.fillStyle = RETRO.road;
      ctx.fillRect(x + PX, GOAL_Y + PX, GOAL_W - PX * 2, GOAL_H - PX);
      if (filled) {
        retroFrog(ctx, x + GOAL_W / 2, GOAL_Y + GOAL_H / 2 + 2, 0.5, false);
      }
    }
  },
  drawFrog: retroFrog,
  drawHud(ctx, { score, level, lives, timeRatio }) {
    ctx.fillStyle =
      timeRatio > 0.5
        ? RETRO.green
        : timeRatio > 0.25
          ? RETRO.yellow
          : RETRO.red;
    ctx.fillRect(0, 0, snap(CANVAS_W * timeRatio), PX);

    ctx.fillStyle = RETRO.white;
    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(retroScore(score), 8, 16);
    ctx.textAlign = 'center';
    ctx.fillText(retroLevel(level), CANVAS_W / 2, 16);
    const lifeSprite = retroFrogSprite(2, false);
    for (let i = 0; i < lives; i++) {
      ctx.drawImage(lifeSprite, CANVAS_W - 22 - i * 20, 2);
    }
  },
  drawOverlay(ctx) {
    ctx.drawImage(
      getBaked('frogger:retro:overlay', () =>
        bakeSprite(CANVAS_W, CANVAS_H, (b) => {
          b.fillStyle = 'rgba(0, 0, 0, 0.22)';
          for (let y = 0; y < CANVAS_H; y += 3) b.fillRect(0, y, CANVAS_W, 1);
        }),
      ),
      0,
      0,
    );
  },
};

// ── Caché de dibujado (SPEC 12) ─────────────────────────────────────────────
// Fondo y sprites con coste alto (glow en neon, píxeles en retro) se pintan
// una vez en un canvas offscreen; cada frame hace un `drawImage`.

const BAKE_PAD = CELL; // margen para que el halo del glow no se recorte
const ENTITY_TYPES: Entity['type'][] = ['car', 'truck', 'log', 'turtle'];

function withBakedBackground(id: SkinId, skin: FroggerSkin): FroggerSkin {
  const drawRaw = skin.drawBackground;
  let baked: HTMLCanvasElement | null = null;
  return {
    ...skin,
    drawBackground(ctx) {
      baked ??= getBaked(`frogger:${id}:bg`, () =>
        bakeSprite(CANVAS_W, CANVAS_H, drawRaw),
      );
      ctx.drawImage(baked, 0, 0);
    },
  };
}

function withBakedEntities(
  id: SkinId,
  skin: FroggerSkin,
  snapX: (v: number) => number,
): FroggerSkin {
  const drawRaw = skin.drawEntity;
  const fast = new Map<number, HTMLCanvasElement>();
  return {
    ...skin,
    drawEntity(ctx, e, row) {
      const code =
        ENTITY_TYPES.indexOf(e.type) * 64 + e.width * 2 + (e.submerged ? 1 : 0);
      let sprite = fast.get(code);
      if (!sprite) {
        const { type, width, submerged } = e;
        sprite = getBaked(`frogger:${id}:entity:${code}`, () =>
          bakeSprite(width * CELL + BAKE_PAD * 2, CELL + BAKE_PAD * 2, (b) =>
            drawRaw(b, { col: 1, width, type, submerged }, BAKE_PAD / CELL),
          ),
        );
        fast.set(code, sprite);
      }
      ctx.drawImage(
        sprite,
        snapX(e.col * CELL) - BAKE_PAD,
        row * CELL - BAKE_PAD,
      );
    },
  };
}

const identity = (v: number) => v;

function withBakedNeonFrog(skin: FroggerSkin): FroggerSkin {
  const fast = new Map<number, HTMLCanvasElement>();
  const R = 40; // radio del canvas: cubre la rana más el glow
  return {
    ...skin,
    drawFrog(ctx, cx, cy, scale, jump) {
      const code = Math.round(scale * 100) * 2 + (jump ? 1 : 0);
      let sprite = fast.get(code);
      if (!sprite) {
        sprite = getBaked(`frogger:neon:frog:${code}`, () =>
          bakeSprite(R * 2, R * 2, (b) => skin.drawFrog(b, R, R, scale, jump)),
        );
        fast.set(code, sprite);
      }
      ctx.drawImage(sprite, cx - R, cy - R);
    },
  };
}

// Las 5 bocas con su rana (32 combinaciones posibles) se pre-renderizan por máscara
function withBakedNeonGoals(skin: FroggerSkin): FroggerSkin {
  const fast = new Map<number, HTMLCanvasElement>();
  return {
    ...skin,
    drawGoals(ctx, goals) {
      let mask = 0;
      for (let i = 0; i < goals.length; i++) if (goals[i]) mask |= 1 << i;
      let band = fast.get(mask);
      if (!band) {
        band = getBaked(`frogger:neon:goals:${mask}`, () =>
          bakeSprite(CANVAS_W, CELL + BAKE_PAD, (b) =>
            skin.drawGoals(
              b,
              GOAL_COLS.map((_, i) => (mask & (1 << i)) !== 0),
            ),
          ),
        );
        fast.set(mask, band);
      }
      ctx.drawImage(band, 0, 0);
    },
  };
}

const bakedNeon = withBakedNeonGoals(
  withBakedNeonFrog(
    withBakedEntities('neon', withBakedBackground('neon', neon), identity),
  ),
);
const bakedRetro = withBakedEntities(
  'retro',
  withBakedBackground('retro', retro),
  snap,
);

export const SKINS: Record<SkinId, FroggerSkin> = {
  classic: withBakedBackground('classic', classic),
  neon: bakedNeon,
  retro: bakedRetro,
};

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const SKIN_OPTIONS = SKIN_IDS.map((id) => ({
  id,
  name: SKINS[id].name,
}));

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKINS;
}
