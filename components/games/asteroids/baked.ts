// Caché de dibujado de Asteroids (SPEC 12, patrón de Frogger).
// Fondos, overlays y sprites con glow se pintan una vez en un canvas offscreen
// (a tamaño nativo, sin devicePixelRatio) y cada frame hace un `drawImage`.
// Las tablas `fast*` evitan construir la clave en cada frame; están acotadas
// por el nº de skins, igual que el `Map` de `spriteCache.ts`.

import { bakeSprite, getBaked } from '../perf/spriteCache';
import { SKINS, type SkinId } from './skins';

export const CANVAS_W = 800;
export const CANVAS_H = 600;

// Margen para que el halo del glow (shadowBlur 12 ≈ 18 px) no se recorte
const BAKE_PAD = 24;
const BULLET_RADIUS = 2;
/** Distancia del centro del sprite de bala a su esquina superior izquierda. */
export const BULLET_SPRITE_C = BULLET_RADIUS + BAKE_PAD;

/** Alto de la capa del HUD: texto (baseline 26) y vidas (y 18) con su halo. */
export const HUD_H = 80;

const fastBg: Partial<Record<SkinId, HTMLCanvasElement>> = {};
const fastOverlay: Partial<Record<SkinId, HTMLCanvasElement>> = {};
const fastBullet: Partial<Record<SkinId, HTMLCanvasElement>> = {};

/** Fondo + `drawBackdrop` del skin. Solo para skins con backdrop. */
export function bakedBackground(id: SkinId): HTMLCanvasElement {
  let baked = fastBg[id];
  if (!baked) {
    const S = SKINS[id];
    baked = getBaked(`asteroids:${id}:bg`, () =>
      bakeSprite(CANVAS_W, CANVAS_H, (b) => {
        b.fillStyle = S.bg;
        b.fillRect(0, 0, CANVAS_W, CANVAS_H);
        S.drawBackdrop?.(b, CANVAS_W, CANVAS_H);
      }),
    );
    fastBg[id] = baked;
  }
  return baked;
}

/** `drawOverlay` del skin (p. ej. scanlines). Solo para skins con overlay. */
export function bakedOverlay(id: SkinId): HTMLCanvasElement {
  let baked = fastOverlay[id];
  if (!baked) {
    const S = SKINS[id];
    baked = getBaked(`asteroids:${id}:overlay`, () =>
      bakeSprite(CANVAS_W, CANVAS_H, (b) =>
        S.drawOverlay?.(b, CANVAS_W, CANVAS_H),
      ),
    );
    fastOverlay[id] = baked;
  }
  return baked;
}

/** Bala redonda con glow. Se pinta en (x - C, y - C), C = BULLET_SPRITE_C. */
export function bakedBullet(id: SkinId): HTMLCanvasElement {
  let baked = fastBullet[id];
  if (!baked) {
    const S = SKINS[id];
    const size = BULLET_SPRITE_C * 2;
    baked = getBaked(`asteroids:${id}:bullet`, () =>
      bakeSprite(size, size, (b) => {
        b.fillStyle = S.bullet;
        b.shadowBlur = S.glow;
        b.shadowColor = S.bullet;
        b.beginPath();
        b.arc(BULLET_SPRITE_C, BULLET_SPRITE_C, BULLET_RADIUS, 0, Math.PI * 2);
        b.fill();
      }),
    );
    fastBullet[id] = baked;
  }
  return baked;
}

/**
 * Capa reutilizable del HUD (una sola, compartida por todos los skins y
 * reinicios). El juego la redibuja solo cuando cambian score, nivel, vidas,
 * skin o el estado de carga de las fuentes.
 */
export function hudLayer(): HTMLCanvasElement {
  return getBaked('asteroids:shared:hud', () =>
    bakeSprite(CANVAS_W, HUD_H, () => {}),
  );
}

const particleStyles: Partial<Record<SkinId, string[]>> = {};
const particleSquareStyles: Partial<Record<SkinId, string[]>> = {};

/**
 * Colores de partícula `rgba(r,g,b,a)` precalculados por skin: índice
 * `Math.round(alpha * 100)` (0..100), mismo texto que `alpha.toFixed(2)`.
 */
export function particleStreakStyles(id: SkinId): string[] {
  let table = particleStyles[id];
  if (!table) {
    const rgb = SKINS[id].particleRgb;
    table = [];
    for (let i = 0; i <= 100; i++)
      table.push(`rgba(${rgb},${(i / 100).toFixed(2)})`);
    particleStyles[id] = table;
  }
  return table;
}

/** Colores de partícula cuadrada (fade en 4 pasos): índice `Math.ceil(alpha * 4)`. */
export function particleSquareStylesFor(id: SkinId): string[] {
  let table = particleSquareStyles[id];
  if (!table) {
    const rgb = SKINS[id].particleRgb;
    table = [];
    for (let i = 0; i <= 4; i++) table.push(`rgba(${rgb},${i / 4})`);
    particleSquareStyles[id] = table;
  }
  return table;
}
