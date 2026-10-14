import { bakeSprite } from '../perf/spriteCache';
import type { ArkanoidSkin, SkinId } from './skins';

// HUD del canvas (SPEC 12): sin strings nuevos por frame y, en los skins con
// glow, el texto y las vidas se pintan en una capa offscreen que solo se
// redibuja cuando cambian score, nivel o vidas.

const HUD_H = 64; // texto (18px) y vidas (16px) desde y = 10, más el halo
const BALL_SIZE = 16;
const BALL_SPACING = 4;

// Solo se reconstruye el string cuando cambia el valor
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

interface GlowLayer {
  canvas: HTMLCanvasElement;
  font: string;
  score: number;
  level: number;
  lives: number;
}

// Una capa por skin con glow, compartida entre partidas y reinicios (acotada)
const glowLayers: Partial<Record<SkinId, GlowLayer>> = {};

export type DrawHud = (
  ctx: CanvasRenderingContext2D,
  id: SkinId,
  S: ArkanoidSkin,
  score: number,
  level: number,
  lives: number,
) => void;

export function createHudRenderer(w: number, pixelFamily: string): DrawHud {
  const scoreLabel = memoLabel('Score: ');
  const levelLabel = memoLabel('Nivel: ');
  const fonts: Partial<Record<SkinId, string>> = {};

  function paint(
    ctx: CanvasRenderingContext2D,
    S: ArkanoidSkin,
    font: string,
    score: number,
    level: number,
    lives: number,
  ) {
    ctx.fillStyle = S.hudText;
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (S.hudGlow) {
      ctx.shadowBlur = S.hudGlow;
      ctx.shadowColor = S.hudText;
    }
    ctx.fillText(scoreLabel(score), 10, 10);
    ctx.textAlign = 'center';
    ctx.fillText(levelLabel(level), w / 2, 10);
    ctx.shadowBlur = 0;
    for (let i = 0; i < lives; i++) {
      const bx = w - 10 - (lives - i) * (BALL_SIZE + BALL_SPACING);
      S.drawBall(ctx, bx, 10, BALL_SIZE, BALL_SIZE);
    }
  }

  return (ctx, id, S, score, level, lives) => {
    const font = (fonts[id] ??= S.hudFont(pixelFamily));
    if (!S.hudGlow) {
      paint(ctx, S, font, score, level, lives);
      return;
    }
    let layer = glowLayers[id];
    if (!layer) {
      layer = {
        canvas: bakeSprite(w, HUD_H, () => {}),
        font: '',
        score: -1,
        level: -1,
        lives: -1,
      };
      glowLayers[id] = layer;
    }
    if (
      layer.font !== font ||
      layer.score !== score ||
      layer.level !== level ||
      layer.lives !== lives
    ) {
      layer.font = font;
      layer.score = score;
      layer.level = level;
      layer.lives = lives;
      const l = layer.canvas.getContext('2d')!;
      l.clearRect(0, 0, w, HUD_H);
      paint(l, S, font, score, level, lives);
    }
    ctx.drawImage(layer.canvas, 0, 0);
  };
}
