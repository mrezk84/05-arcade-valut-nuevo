'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import GamePlayShell from '@/components/games/GamePlayShell';

const TetrisGame = dynamic(() => import('@/components/games/TetrisGame'), {
  ssr: false,
});

export default function TetrisPlay() {
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handleScoreChange = useCallback((s: number) => setScore(s), []);
  const handleLinesChange = useCallback((l: number) => setLines(l), []);
  const handleLevelChange = useCallback((l: number) => setLevel(l), []);
  const handleLivesChange = useCallback((l: number) => setLives(l), []);
  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  function forceEnd() {
    setLives(0);
    setOver(true);
  }

  function restart() {
    setScore(0);
    setLines(0);
    setLevel(1);
    setLives(1);
    setPaused(false);
    setOver(false);
    setGameKey((k) => k + 1);
  }

  return (
    <>
      <GamePlayShell
        gameId="tetris"
        title="TETRIS"
        stats={[
          { label: 'Puntuación', value: score.toLocaleString('es-ES') },
          { label: 'Líneas', value: String(lines) },
          {
            label: 'Vidas',
            value: '♥ '.repeat(Math.max(0, lives)).trim() || '—',
            className: 'lives',
          },
          {
            label: 'Nivel',
            value: String(level).padStart(2, '0'),
            className: 'level',
          },
        ]}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        over={over}
        score={score}
        onForceEnd={forceEnd}
        onRestart={restart}
      >
        <TetrisGame
          key={gameKey}
          paused={paused || over}
          onScoreChange={handleScoreChange}
          onLinesChange={handleLinesChange}
          onLevelChange={handleLevelChange}
          onLivesChange={handleLivesChange}
          onGameOver={handleGameOver}
        />
      </GamePlayShell>
      <p className="tetris-controls">
        <span>← → mover</span>
        <span>↑ / X rotar</span>
        <span>↓ bajar</span>
        <span>Espacio caída</span>
      </p>
    </>
  );
}
