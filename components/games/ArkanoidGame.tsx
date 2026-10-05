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

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let cancelled = false;

    loadSpritesheet()
      .then(() => {
        if (cancelled) return;

        const paddle = { x: (W - 81) / 2, y: 560, w: 81, h: 14 };
        const ball = { x: 0, y: 0, w: 16, h: 16 };
        ball.x = paddle.x + (paddle.w - ball.w) / 2;
        ball.y = paddle.y - ball.h;

        ctx.clearRect(0, 0, W, H);
        for (const b of LEVELS[0].blocks) {
          drawSprite(
            ctx,
            `block_${b.color}`,
            BLOCKS_ORIGIN_X + b.col * BLOCK_W,
            BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
            BLOCK_W,
            BLOCK_H,
          );
        }
        drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h);
        drawSprite(ctx, 'ball', ball.x, ball.y, ball.w, ball.h);
      })
      .catch(() => {
        // Spritesheet failed to load: leave the canvas blank
      });

    return () => {
      cancelled = true;
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
