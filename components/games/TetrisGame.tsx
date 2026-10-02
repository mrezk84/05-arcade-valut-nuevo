'use client';

import { useEffect, useRef } from 'react';

interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function TetrisGame({
  paused,
  onScoreChange,
  onLinesChange,
  onLevelChange,
  onLivesChange,
  onGameOver,
}: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  const cbScore = useRef(onScoreChange);
  const cbLines = useRef(onLinesChange);
  const cbLevel = useRef(onLevelChange);
  const cbLives = useRef(onLivesChange);
  const cbOver = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLines.current = onLinesChange;
  }, [onLinesChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbLives.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  return (
    <div className="tetris-stage">
      <div className="tetris-board">
        <canvas
          ref={canvasRef}
          width={300}
          height={600}
          className="tetris-canvas"
        />
        <div className="tetris-next">
          <div className="tetris-next-label">Siguiente</div>
          <canvas
            ref={nextCanvasRef}
            width={120}
            height={120}
            className="tetris-next-canvas"
          />
        </div>
      </div>
    </div>
  );
}
