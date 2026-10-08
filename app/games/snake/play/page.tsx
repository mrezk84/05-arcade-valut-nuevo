'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import GamePlayShell from '@/components/games/GamePlayShell';
import type { TouchControlsConfig } from '@/components/games/TouchControls';
import { START_LENGTH } from '@/components/games/snake/constants';
import SkinSelect from '@/components/games/skins/SkinSelect';
import { useGameSkin } from '@/components/games/skins/useGameSkin';
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_OPTIONS,
  SKIN_STORAGE_KEY,
} from '@/components/games/snake/skins';

const SnakeGame = dynamic(() => import('@/components/games/SnakeGame'), {
  ssr: false,
});

const TOUCH: TouchControlsConfig = {
  dpad: ['left', 'right', 'up', 'down'],
};

export default function SnakePlay() {
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(START_LENGTH);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [skin, setSkin] = useGameSkin(SKIN_STORAGE_KEY, SKIN_IDS, DEFAULT_SKIN);

  const handleScoreChange = useCallback((s: number) => setScore(s), []);
  const handleLengthChange = useCallback((l: number) => setLength(l), []);
  const handleLevelChange = useCallback((l: number) => setLevel(l), []);
  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  function restart() {
    setScore(0);
    setLength(START_LENGTH);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setGameKey((k) => k + 1);
  }

  return (
    <>
      <GamePlayShell
        gameId="snake"
        title="SNAKE"
        touch={TOUCH}
        stats={[
          { label: 'Puntuación', value: score.toLocaleString('es-ES') },
          { label: 'Longitud', value: String(length) },
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
        onForceEnd={() => setOver(true)}
        onRestart={restart}
        hudExtra={
          <SkinSelect
            id="snake-skin"
            value={skin}
            options={SKIN_OPTIONS}
            onChange={setSkin}
          />
        }
      >
        <SnakeGame
          key={gameKey}
          paused={paused || over}
          skin={skin}
          onScoreChange={handleScoreChange}
          onLengthChange={handleLengthChange}
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
