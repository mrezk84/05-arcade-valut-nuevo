'use client';

import { useEffect, useRef } from 'react';
import { LEVELS } from './arkanoid/levels';
import {
  EXPLOSION_DURATION,
  loadSpritesheet,
  type BlockColor,
} from './arkanoid/sprites';
import { SKINS, type ArkanoidSkin, type SkinId } from './arkanoid/skins';

interface ArkanoidGameProps {
  paused: boolean;
  skin: SkinId;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

const W = 800;
const H = 600;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = 80;
const BLOCKS_ORIGIN_Y = 80;
const PADDLE_SPEED = 400;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const MAX_DT = 0.1; // s
const SOUNDS_PATH = '/games/arkanoid/sounds';
const LAST_LEVEL = LEVELS.length;
const INITIAL_LIVES = 3;

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

export default function ArkanoidGame({
  paused,
  skin,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: ArkanoidGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  const cbScore = useRef(onScoreChange);
  const cbLives = useRef(onLivesChange);
  const cbLevel = useRef(onLevelChange);
  const cbOver = useRef(onGameOver);
  // Read inside the loop so switching skins never restarts the game
  const skinRef = useRef(skin);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLives.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  // Pressed arrow keys. Cleared on pause and resume so a key released while paused can't stick
  const keysRef = useRef({ ArrowLeft: false, ArrowRight: false });

  useEffect(() => {
    keysRef.current.ArrowLeft = false;
    keysRef.current.ArrowRight = false;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const keys = keysRef.current;
    let cancelled = false;
    let raf = 0;
    let teardown: (() => void) | null = null;

    // ── Skin (visual only; refreshed every frame from skinRef) ──────────────
    let S: ArkanoidSkin = SKINS[skinRef.current];
    // Press Start 2P family injected by next/font on <html>; empty if missing
    const pixelFamily = getComputedStyle(canvas)
      .getPropertyValue('--font-press-start')
      .trim();

    const bounceSound = new Audio(`${SOUNDS_PATH}/ball-bounce.mp3`);
    const breakSound = new Audio(`${SOUNDS_PATH}/break-sound.mp3`);
    const playing = new Set<HTMLAudioElement>();

    // One clone per hit so overlapping sounds don't cut each other. Never plays while paused
    function play(sound: HTMLAudioElement) {
      if (pausedRef.current) return;
      const clone = sound.cloneNode() as HTMLAudioElement;
      playing.add(clone);
      clone.addEventListener('ended', () => playing.delete(clone), {
        once: true,
      });
      clone.play().catch(() => playing.delete(clone));
    }

    loadSpritesheet()
      .then(() => {
        if (cancelled) return;

        const paddle = { x: (W - 81) / 2, y: 560, w: 81, h: 14 };
        const ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
        let blocks: Block[] = [];
        let explosions: Explosion[] = [];
        let score = 0;
        let lives = INITIAL_LIVES;
        let currentLevel = 1;
        let gameState: 'playing' | 'win' | 'gameover' = 'playing';

        function initBall() {
          const speed = LEVELS[currentLevel - 1].speed;
          ball.x = paddle.x + (paddle.w - ball.w) / 2;
          ball.y = paddle.y - ball.h;
          ball.vx = BASE_BALL_VX * speed;
          ball.vy = BASE_BALL_VY * speed;
        }

        function loadLevel(n: number) {
          currentLevel = n;
          blocks = LEVELS[n - 1].blocks.map((b) => ({
            x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
            y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
            w: BLOCK_W,
            h: BLOCK_H,
            color: b.color,
            alive: true,
          }));
          explosions = [];
          initBall();
        }
        loadLevel(1);

        // Report HUD values only when they change. Game over fires once, after the final lives value
        let lastScore = -1;
        let lastLives = -1;
        let lastLevel = -1;
        let overFired = false;
        function emitChanges() {
          if (score !== lastScore) {
            lastScore = score;
            cbScore.current(score);
          }
          if (lives !== lastLives) {
            lastLives = lives;
            cbLives.current(lives);
          }
          if (currentLevel !== lastLevel) {
            lastLevel = currentLevel;
            cbLevel.current(currentLevel);
          }
          if (gameState !== 'playing' && !overFired) {
            overFired = true;
            cbOver.current(score);
          }
        }
        emitChanges();

        function collideAABB(block: Block) {
          return (
            ball.x < block.x + block.w &&
            ball.x + ball.w > block.x &&
            ball.y < block.y + block.h &&
            ball.y + ball.h > block.y
          );
        }

        // ── Input ──────────────────────────────────────────────────────────────
        function onMouseMove(e: MouseEvent) {
          if (pausedRef.current) return;
          const rect = canvas.getBoundingClientRect();
          const mouseX = ((e.clientX - rect.left) * W) / rect.width;
          paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
        }
        function onKeyDown(e: KeyboardEvent) {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          if (pausedRef.current) return;
          keys[e.key] = true;
        }
        function onKeyUp(e: KeyboardEvent) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
            keys[e.key] = false;
        }
        canvas.addEventListener('mousemove', onMouseMove);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // ── Update ─────────────────────────────────────────────────────────────
        function update(dt: number) {
          if (gameState !== 'playing') return;

          if (keys.ArrowLeft)
            paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
          if (keys.ArrowRight)
            paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.x <= 0) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
            play(bounceSound);
          }
          if (ball.x + ball.w >= W) {
            ball.x = W - ball.w;
            ball.vx = -Math.abs(ball.vx);
            play(bounceSound);
          }
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
            play(bounceSound);
          }

          if (
            ball.vy > 0 &&
            ball.x + ball.w > paddle.x &&
            ball.x < paddle.x + paddle.w &&
            ball.y + ball.h >= paddle.y &&
            ball.y + ball.h <= paddle.y + paddle.h + 8
          ) {
            ball.y = paddle.y - ball.h;
            ball.vy = -Math.abs(ball.vy);
            play(bounceSound);
          }

          // One block per frame
          for (const block of blocks) {
            if (!block.alive || !collideAABB(block)) continue;
            block.alive = false;
            explosions.push({
              x: block.x,
              y: block.y,
              w: block.w,
              h: block.h,
              color: block.color,
              elapsed: 0,
            });
            score += 10;
            ball.vy = -ball.vy;
            play(breakSound);
            if (blocks.every((b) => !b.alive)) {
              if (currentLevel < LAST_LEVEL) loadLevel(currentLevel + 1);
              else gameState = 'win';
            }
            break;
          }

          for (const exp of explosions) exp.elapsed += dt * 1000;
          explosions = explosions.filter((e) => e.elapsed < EXPLOSION_DURATION);

          if (ball.y > H) {
            lives--;
            if (lives <= 0) {
              lives = 0;
              gameState = 'gameover';
            } else {
              initBall();
            }
          }
        }

        // ── Draw ───────────────────────────────────────────────────────────────
        function draw() {
          ctx.shadowBlur = 0;
          ctx.fillStyle = S.bg;
          ctx.fillRect(0, 0, W, H);
          S.drawBackdrop?.(ctx, W, H);
          for (const b of blocks) {
            if (b.alive) S.drawBlock(ctx, b.color, b.x, b.y, b.w, b.h);
          }
          for (const exp of explosions) {
            S.drawExplosion(
              ctx,
              exp.color,
              exp.elapsed / EXPLOSION_DURATION,
              exp.x,
              exp.y,
              exp.w,
              exp.h,
            );
          }
          S.drawPaddle(ctx, paddle.x, paddle.y, paddle.w, paddle.h);
          S.drawBall(ctx, ball.x, ball.y, ball.w, ball.h);

          if (gameState === 'playing') {
            ctx.fillStyle = S.hudText;
            ctx.font = S.hudFont(pixelFamily);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            if (S.hudGlow) {
              ctx.shadowBlur = S.hudGlow;
              ctx.shadowColor = S.hudText;
            }
            ctx.fillText(`Score: ${score}`, 10, 10);
            ctx.textAlign = 'center';
            ctx.fillText(`Nivel: ${currentLevel}`, W / 2, 10);
            ctx.shadowBlur = 0;
            const ballSize = 16;
            const ballSpacing = 4;
            for (let i = 0; i < lives; i++) {
              const bx = W - 10 - (lives - i) * (ballSize + ballSpacing);
              S.drawBall(ctx, bx, 10, ballSize, ballSize);
            }
          }
          S.drawOverlay?.(ctx, W, H);
        }

        // ── Loop ───────────────────────────────────────────────────────────────
        let lastTime: number | null = null;
        function loop(timestamp: number) {
          if (lastTime === null) lastTime = timestamp;
          const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT);
          lastTime = timestamp;

          if (!pausedRef.current) {
            update(dt);
            emitChanges();
          }
          S = SKINS[skinRef.current];
          draw();

          raf = requestAnimationFrame(loop);
        }
        raf = requestAnimationFrame(loop);

        teardown = () => {
          canvas.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('keyup', onKeyUp);
        };
      })
      .catch(() => {
        // Spritesheet failed to load: leave the canvas blank
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      teardown?.();
      for (const clone of playing) {
        clone.pause();
        clone.removeAttribute('src');
        clone.load();
      }
      playing.clear();
      for (const sound of [bounceSound, breakSound]) {
        sound.removeAttribute('src');
        sound.load();
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}
