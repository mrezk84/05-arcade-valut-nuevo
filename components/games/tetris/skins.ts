import { COLORS, BOARD_BG, GRID_LINE } from './constants';

export type SkinId = 'retro' | 'neon' | 'pastel' | 'pixel';

export interface Skin {
  name: string;
  colors: (string | null)[];
  boardBg: string;
  gridLine: string;
  drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ): void;
}

export const SKIN_STORAGE_KEY = 'tetris-skin';
export const DEFAULT_SKIN: SkinId = 'retro';

export const SKINS: Record<SkinId, Skin> = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    boardBg: BOARD_BG,
    gridLine: GRID_LINE,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex]!;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00ffff',
      '#ffff00',
      '#ff00ff',
      '#00ff00',
      '#ff0040',
      '#00aaff',
      '#ff8000',
    ],
    boardBg: '#000000',
    gridLine: '#161622',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex]!;
      const a = alpha ?? 1;
      context.globalAlpha = a;
      context.shadowBlur = a < 0.5 ? 8 : 15;
      context.shadowColor = color;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      context.fillStyle = `rgba(${r},${g},${b},0.55)`;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.strokeRect(
        x * size + 1.75,
        y * size + 1.75,
        size - 3.5,
        size - 3.5,
      );
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    },
  },

  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#bae1ff',
      '#ffffba',
      '#e8baff',
      '#baffc9',
      '#ffb3ba',
      '#ffdfba',
      '#ffd9ba',
    ],
    boardBg: '#f8f0ff',
    gridLine: '#e0d4f0',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex]!;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.65)';
      context.fillRect(x * size + 2, y * size + 2, size - 4, 5);
      context.fillRect(x * size + 2, y * size + 2, 5, size - 4);
      context.fillStyle = 'rgba(0,0,0,0.08)';
      context.fillRect(x * size + 2, y * size + size - 5, size - 4, 4);
      context.fillRect(x * size + size - 5, y * size + 2, 4, size - 4);
      context.globalAlpha = 1;
    },
  },

  pixel: {
    name: 'Pixel Art',
    colors: [
      null,
      '#3ab8c8',
      '#d4b840',
      '#9a50a8',
      '#60a060',
      '#c05060',
      '#7090d8',
      '#d08030',
    ],
    boardBg: '#1a1a2e',
    gridLine: '#252540',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex]!;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const dark = `rgba(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)},0.7)`;
      context.strokeStyle = dark;
      context.lineWidth = 0.5;
      const bx = x * size + 1;
      const by = y * size + 1;
      const bw = size - 2;
      for (let i = 4; i < bw; i += 4) {
        context.beginPath();
        context.moveTo(bx + i, by);
        context.lineTo(bx + i, by + bw);
        context.stroke();
        context.beginPath();
        context.moveTo(bx, by + i);
        context.lineTo(bx + bw, by + i);
        context.stroke();
      }
      context.globalAlpha = 1;
    },
  },
};

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKINS;
}
