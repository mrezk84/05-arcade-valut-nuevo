'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import GamePlayShell from '@/components/games/GamePlayShell';

const ArkanoidGame = dynamic(() => import('@/components/games/ArkanoidGame'), {
  ssr: false,
});

export default function ArkanoidPlay() {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handleScoreChange = useCallback((s: number) => setScore(s), []);
  const handleLivesChange = useCallback((l: number) => setLives(l), []);
  const handleLevelChange = useCallback((l: number) => setLevel(l), []);
  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  function restart() {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setGameKey((k) => k + 1);
  }

  return (
    <>
      <GamePlayShell
        gameId="arkanoid"
        title="ARKANOID"
        stats={[
          { label: 'Puntuación', value: score.toLocaleString('es-ES') },
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
        onForceEnd={() => {
          setLives(0);
          setOver(true);
        }}
        onRestart={restart}
      >
        <ArkanoidGame
          key={gameKey}
          paused={paused || over}
          onScoreChange={handleScoreChange}
          onLivesChange={handleLivesChange}
          onLevelChange={handleLevelChange}
          onGameOver={handleGameOver}
        />
      </GamePlayShell>
      <div className="tetris-below">
        <p className="tetris-controls">
          <span>Mouse mover pala</span>
          <span>← → mover pala</span>
        </p>
      </div>
    </>
  );
}
