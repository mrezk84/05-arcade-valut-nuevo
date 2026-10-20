'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useUser } from '@/app/context/UserContext';
import { createClient } from '@/lib/supabase/client';
import TouchControls, {
  type TouchControlsConfig,
} from '@/components/games/TouchControls';

const MAX_SCORE = 10_000_000;
const REDIRECT_DELAY = 1200; // ms, para que se vea "PUNTUACIÓN GUARDADA"

const COARSE_QUERY = '(hover: none) and (pointer: coarse)';

function subscribeCoarse(onChange: () => void) {
  const mq = window.matchMedia(COARSE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const getCoarse = () => window.matchMedia(COARSE_QUERY).matches;
const getCoarseServer = () => false;

interface GamePlayShellProps {
  gameId: string;
  title: string;
  stats: { label: string; value: string; className?: string }[];
  paused: boolean;
  onTogglePause: () => void;
  over: boolean;
  score: number;
  onForceEnd: () => void;
  onRestart: () => void;
  hudExtra?: React.ReactNode;
  touch?: TouchControlsConfig;
  children: React.ReactNode;
}

export default function GamePlayShell({
  gameId,
  title,
  stats,
  paused,
  onTogglePause,
  over,
  score,
  onForceEnd,
  onRestart,
  hudExtra,
  touch,
  children,
}: GamePlayShellProps) {
  const { user } = useUser();
  const router = useRouter();

  const [name, setName] = useState(user ?? 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (over) {
      const stored = localStorage.getItem('av_player_name');
      // localStorage is an external system; read it once when the game ends
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setName(stored);
    }
  }, [over]);

  // Touch layout is portrait-only: entering landscape pauses the game (the notice is CSS)
  const latest = useRef({ paused, over, onTogglePause });
  useEffect(() => {
    latest.current = { paused, over, onTogglePause };
  });
  const hasTouch = !!touch;
  // On touch devices the skin select lives in the pad footer, so it is rendered only once
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    getCoarse,
    getCoarseServer,
  );
  const padUi = hasTouch && coarse;
  useEffect(() => {
    if (!hasTouch) return;
    const mq = window.matchMedia(
      '(orientation: landscape) and (hover: none) and (pointer: coarse)',
    );
    const pauseIfLandscape = () => {
      const { paused, over, onTogglePause } = latest.current;
      if (mq.matches && !paused && !over) onTogglePause();
    };
    pauseIfLandscape();
    mq.addEventListener('change', pauseIfLandscape);
    return () => mq.removeEventListener('change', pauseIfLandscape);
  }, [hasTouch]);

  // Gamepad layout owns the whole screen: the site chrome (nav, footer) hides via this class
  useEffect(() => {
    if (!hasTouch) return;
    document.documentElement.classList.add('av-gamepad');
    return () => document.documentElement.classList.remove('av-gamepad');
  }, [hasTouch]);

  // Tras guardar, lleva al leaderboard del juego.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => router.push(`/games/${gameId}`), REDIRECT_DELAY);
    return () => clearTimeout(t);
  }, [saved, router, gameId]);

  function restart() {
    setSaved(false);
    setSaving(false);
    setName(user ?? 'INVITADO');
    onRestart();
  }

  async function save() {
    if (saving || saved) return;
    setSaving(true);
    localStorage.setItem('av_player_name', name);
    const supabase = createClient();
    const { error } = await supabase.from('scores').insert({
      game_id: gameId,
      name,
      score: Math.min(Math.max(0, score), MAX_SCORE),
    });
    setSaving(false);
    if (!error) setSaved(true);
  }

  return (
    <div className={`av-player fade-in${touch ? ' av-player--touch' : ''}`}>
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat hud-player">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          {stats.map((s) => (
            <div
              key={s.label}
              className={`hud-stat${s.className ? ` ${s.className}` : ''}`}
            >
              <div className="l">{s.label}</div>
              <div className="v">{s.value}</div>
            </div>
          ))}
          {hudExtra && !padUi && <div className="hud-extra">{hudExtra}</div>}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={onTogglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={onForceEnd}>
            FIN
          </button>
          <Link href={`/games/${gameId}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {children}
          {touch?.statsPanel && (
            <div className="touch-stats">
              {stats
                .filter((s) => touch.statsPanel?.includes(s.label))
                .map((s) => (
                  <div
                    key={s.label}
                    className={`hud-stat${s.className ? ` ${s.className}` : ''}`}
                  >
                    <div className="l">{s.label}</div>
                    <div className="v">{s.value}</div>
                  </div>
                ))}
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        {touch?.statsLine && (
          <div className="touch-stats-line">
            {stats
              .filter((s) => touch.statsLine?.includes(s.label))
              .map((s) => (
                <div
                  key={s.label}
                  className={`hud-stat${s.className ? ` ${s.className}` : ''}`}
                >
                  <span className="l">{s.label}</span>
                  <span className="v">{s.value}</span>
                </div>
              ))}
          </div>
        )}
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {touch && (
        <>
          <div className="touch-rotate" role="alert">
            <div className="touch-rotate-icon" aria-hidden="true">
              ⟳
            </div>
            <div className="touch-rotate-title">GIRA EL DISPOSITIVO</div>
            <div className="touch-rotate-text">
              Este juego se juega en vertical
            </div>
          </div>
          <TouchControls
            config={touch}
            disabled={paused || over}
            footer={
              <>
                <button
                  type="button"
                  className="btn yellow touch-pad-btn touch-pad-pause"
                  onClick={onTogglePause}
                  disabled={over}
                >
                  {paused ? 'REANUDAR' : 'PAUSA'}
                </button>
                {padUi && hudExtra}
                <Link
                  href={`/games/${gameId}`}
                  className="btn ghost touch-pad-btn touch-pad-exit"
                >
                  SALIR
                </Link>
              </>
            }
          />
        </>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" disabled={saving} onClick={save}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href={`/games/${gameId}`} className="btn yellow">
                VER LEADERBOARD
              </Link>
              <Link href="/games" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
