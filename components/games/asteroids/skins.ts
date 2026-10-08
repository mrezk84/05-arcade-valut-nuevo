export type SkinId = 'classic' | 'neon' | 'retro';

export interface AsteroidsSkin {
  name: string;
  /** Canvas background. */
  bg: string;
  ship: string;
  /** Translucent or solid hull fill; `null` keeps the vector outline only. */
  shipFill: string | null;
  asteroid: string;
  asteroidFill: string | null;
  bullet: string;
  bulletShape: 'circle' | 'square';
  thrust: string;
  /** Particle colour as `r,g,b`; alpha fades with the particle's life. */
  particleRgb: string;
  particleShape: 'streak' | 'square';
  hudText: string;
  /** Receives the resolved pixel font family (empty if unavailable). */
  hudFont(pixelFamily: string): string;
  lineWidth: number;
  lifeLineWidth: number;
  lineJoin: CanvasLineJoin;
  /** `shadowBlur` for ship, asteroids, bullets and HUD; 0 disables glow. */
  glow: number;
  /** Drawn right after the background, under every entity. */
  drawBackdrop?(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  /** Drawn last, over everything (e.g. scanlines). */
  drawOverlay?(ctx: CanvasRenderingContext2D, w: number, h: number): void;
}

export const SKIN_STORAGE_KEY = 'asteroids-skin';
export const DEFAULT_SKIN: SkinId = 'classic';

export const SKINS: Record<SkinId, AsteroidsSkin> = {
  // Original look: white vector lines on black
  classic: {
    name: 'Clásico',
    bg: '#000',
    ship: '#fff',
    shipFill: null,
    asteroid: '#fff',
    asteroidFill: null,
    bullet: '#fff',
    bulletShape: 'circle',
    thrust: 'rgba(255, 130, 0, 0.85)',
    particleRgb: '255,255,255',
    particleShape: 'streak',
    hudText: '#fff',
    hudFont: () => '15px monospace',
    lineWidth: 1.5,
    lifeLineWidth: 1.2,
    lineJoin: 'round',
    glow: 0,
  },

  // Platform palette with glow over translucent fills and a faint grid
  neon: {
    name: 'Neon',
    bg: '#000000',
    ship: '#00f5ff',
    shipFill: 'rgba(0, 245, 255, 0.12)',
    asteroid: '#ff006e',
    asteroidFill: 'rgba(255, 0, 110, 0.10)',
    bullet: '#f5ff00',
    bulletShape: 'circle',
    thrust: '#00ff88',
    particleRgb: '255,0,110',
    particleShape: 'streak',
    hudText: '#00f5ff',
    hudFont: () => '15px monospace',
    lineWidth: 1.5,
    lifeLineWidth: 1.2,
    lineJoin: 'round',
    glow: 12,
    drawBackdrop(ctx, w, h) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.06)';
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
  },

  // CRT / 8-bit: 8-colour palette, solid shapes, no glow, scanlines
  retro: {
    name: 'Retro',
    bg: '#0e0c1f',
    ship: '#29adff',
    shipFill: '#0e0c1f',
    asteroid: '#c2c3c7',
    asteroidFill: '#3f3566',
    bullet: '#ffec27',
    bulletShape: 'square',
    thrust: '#ffa300',
    particleRgb: '255,236,39',
    particleShape: 'square',
    hudText: '#fff1e8',
    hudFont: (pixel) => (pixel ? `12px ${pixel}, monospace` : '15px monospace'),
    lineWidth: 2,
    lifeLineWidth: 2,
    lineJoin: 'miter',
    glow: 0,
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
