'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import GamePlayShell from '@/components/games/GamePlayShell';
import type { TouchControlsConfig } from '@/components/games/TouchControls';
import SkinSelect from '@/components/games/skins/SkinSelect';
import { useGameSkin } from '@/components/games/skins/useGameSkin';
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_OPTIONS,
  SKIN_STORAGE_KEY,
} from '@/components/games/frogger/skins';

const FroggerGame = dynamic(() => import('@/components/games/FroggerGame'), {
  ssr: false,
});

// One hop per press (the game ignores e.repeat): no auto-repeat, no A/B.
// Score, level, lives and timer are drawn on the canvas, so no statsLine/statsPanel.
const TOUCH: TouchControlsConfig = {
  dpad: ['left', 'right', 'up', 'down'],
};

const START_LIVES = 3;

export default function FroggerPlay() {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [skin, setSkin] = useGameSkin(SKIN_STORAGE_KEY, SKIN_IDS, DEFAULT_SKIN);

  const handleScoreChange = useCallback((s: number) => setScore(s), []);
  const handleLivesChange = useCallback((l: number) => setLives(l), []);
  const handleLevelChange = useCallback((l: number) => setLevel(l), []);
  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  function restart() {
    setScore(0);
    setLives(START_LIVES);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setGameKey((k) => k + 1);
  }

  return (
    <>
      <GamePlayShell
        gameId="frogger"
        title="FROGGER"
        touch={TOUCH}
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
        hudExtra={
          <SkinSelect
            id="frogger-skin"
            value={skin}
            options={SKIN_OPTIONS}
            onChange={setSkin}
          />
        }
      >
        <FroggerGame
          key={gameKey}
          paused={paused || over}
          skin={skin}
          onScoreChange={handleScoreChange}
          onLivesChange={handleLivesChange}
          onLevelChange={handleLevelChange}
          onGameOver={handleGameOver}
        />
      </GamePlayShell>
      <div className="tetris-below">
        <p className="tetris-controls">
          <span>← ↑ → ↓ mover</span>
          <span>W A S D mover</span>
        </p>
      </div>
    </>
  );
}
