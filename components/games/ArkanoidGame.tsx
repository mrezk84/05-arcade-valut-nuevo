'use client';

import { useEffect, useRef } from 'react';
import { LEVELS } from './arkanoid/levels';
import { drawSprite, loadSpritesheet } from './arkanoid/sprites';

interface ArkanoidGameProps {
  paused: boolean;
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

export default function ArkanoidGame({
  paused,
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

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
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

    loadSpritesheet()
      .then(() => {
        if (cancelled) return;

        const paddle = { x: (W - 81) / 2, y: 560, w: 81, h: 14 };
        const ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
        const blocks = LEVELS[0].blocks.map((b) => ({
          x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
          y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
          color: b.color,
        }));

        function initBall() {
          const speed = LEVELS[0].speed;
          ball.x = paddle.x + (paddle.w - ball.w) / 2;
          ball.y = paddle.y - ball.h;
          ball.vx = BASE_BALL_VX * speed;
          ball.vy = BASE_BALL_VY * speed;
        }
        initBall();

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
          if (keys.ArrowLeft)
            paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
          if (keys.ArrowRight)
            paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.x <= 0) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
          }
          if (ball.x + ball.w >= W) {
            ball.x = W - ball.w;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
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
          }
        }

        // ── Draw ───────────────────────────────────────────────────────────────
        function draw() {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
          for (const b of blocks) {
            drawSprite(ctx, `block_${b.color}`, b.x, b.y, BLOCK_W, BLOCK_H);
          }
          drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h);
          drawSprite(ctx, 'ball', ball.x, ball.y, ball.w, ball.h);
        }

        // ── Loop ───────────────────────────────────────────────────────────────
        let lastTime: number | null = null;
        function loop(timestamp: number) {
          if (lastTime === null) lastTime = timestamp;
          const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT);
          lastTime = timestamp;

          if (!pausedRef.current) update(dt);
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
