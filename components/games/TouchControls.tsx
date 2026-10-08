'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type DpadDir = 'left' | 'right' | 'up' | 'down';
export type TouchKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Space';

export interface TouchButton {
  label: 'A' | 'B';
  key: TouchKey;
  ariaLabel: string;
}

export interface TouchControlsConfig {
  dpad: DpadDir[];
  repeat?: DpadDir[];
  buttons?: TouchButton[];
}

interface TouchControlsProps {
  config: TouchControlsConfig;
  disabled: boolean;
}

// Games read e.code (Asteroids, Tetris) or e.key (Arkanoid), so both are always sent
const KEY_EVENT: Record<TouchKey, { key: string; code: string }> = {
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown' },
  Space: { key: ' ', code: 'Space' },
};

const DIR_KEY: Record<DpadDir, TouchKey> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

const DIR_GLYPH: Record<DpadDir, string> = {
  left: '◀',
  right: '▶',
  up: '▲',
  down: '▼',
};

const DIR_LABEL: Record<DpadDir, string> = {
  left: 'Izquierda',
  right: 'Derecha',
  up: 'Arriba',
  down: 'Abajo',
};

const REPEAT_DELAY = 200; // ms before the first repeated keydown
const REPEAT_INTERVAL = 100; // ms between repeated keydowns

function emit(type: 'keydown' | 'keyup', touchKey: TouchKey, repeat = false) {
  const { key, code } = KEY_EVENT[touchKey];
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key,
      code,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

interface Hold {
  controlId: string;
  key: TouchKey;
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

interface PadButtonProps {
  controlId: string;
  className: string;
  ariaLabel: string;
  pressed: boolean;
  disabled: boolean;
  onPress: (e: ReactPointerEvent<HTMLButtonElement>, controlId: string) => void;
  onMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onRelease: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

function PadButton({
  controlId,
  className,
  ariaLabel,
  pressed,
  disabled,
  onPress,
  onMove,
  onRelease,
  children,
}: PadButtonProps) {
  return (
    <button
      type="button"
      className={`${className}${pressed ? ' is-pressed' : ''}`}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onPointerDown={(e) => onPress(e, controlId)}
      onPointerMove={onMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function TouchControls({
  config,
  disabled,
}: TouchControlsProps) {
  const holdsRef = useRef(new Map<number, Hold>());
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());

  // Resolves a control id to the key it emits and whether it auto-repeats
  const resolve = useCallback(
    (controlId: string): { key: TouchKey; repeatable: boolean } | null => {
      if (controlId.startsWith('dir:')) {
        const dir = controlId.slice(4) as DpadDir;
        return {
          key: DIR_KEY[dir],
          repeatable: config.repeat?.includes(dir) ?? false,
        };
      }
      const btn = config.buttons?.find((b) => `btn:${b.label}` === controlId);
      return btn ? { key: btn.key, repeatable: false } : null;
    },
    [config],
  );

  const syncPressed = useCallback(() => {
    setPressed(new Set([...holdsRef.current.values()].map((h) => h.controlId)));
  }, []);

  const release = useCallback(
    (pointerId: number) => {
      const hold = holdsRef.current.get(pointerId);
      if (!hold) return;
      clearTimeout(hold.delay);
      clearInterval(hold.interval);
      holdsRef.current.delete(pointerId);
      emit('keyup', hold.key);
      syncPressed();
    },
    [syncPressed],
  );

  const releaseAll = useCallback(() => {
    for (const pointerId of [...holdsRef.current.keys()]) release(pointerId);
  }, [release]);

  const handlePress = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, controlId: string) => {
      if (disabled) return;
      const target = resolve(controlId);
      if (!target) return;
      e.preventDefault();
      // Keeps pointerup/cancel coming even when the finger drifts off the control
      e.currentTarget.setPointerCapture(e.pointerId);
      release(e.pointerId);

      const hold: Hold = { controlId, key: target.key };
      holdsRef.current.set(e.pointerId, hold);
      emit('keydown', target.key);
      if (target.repeatable) {
        hold.delay = setTimeout(() => {
          emit('keydown', target.key, true);
          hold.interval = setInterval(
            () => emit('keydown', target.key, true),
            REPEAT_INTERVAL,
          );
        }, REPEAT_DELAY);
      }
      syncPressed();
    },
    [disabled, resolve, release, syncPressed],
  );

  // Capture stops pointerleave from firing, so leaving the control is detected by bounds
  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!holdsRef.current.has(e.pointerId)) return;
      const r = e.currentTarget.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) release(e.pointerId);
    },
    [release],
  );

  const handleRelease = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => release(e.pointerId),
    [release],
  );

  // Pause and game over: nothing may stay held
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  // Focus loss (incoming call, tab switch) can swallow pointerup
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') releaseAll();
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onHidden);
      releaseAll();
    };
  }, [releaseAll]);

  const buttons = config.buttons ?? [];

  return (
    <div className="touch-controls" role="group" aria-label="Controles">
      <div className="touch-dpad">
        {config.dpad.map((dir) => (
          <PadButton
            key={dir}
            controlId={`dir:${dir}`}
            className={`touch-btn touch-dir touch-dir-${dir}`}
            ariaLabel={DIR_LABEL[dir]}
            pressed={pressed.has(`dir:${dir}`)}
            disabled={disabled}
            onPress={handlePress}
            onMove={handleMove}
            onRelease={handleRelease}
          >
            {DIR_GLYPH[dir]}
          </PadButton>
        ))}
      </div>
      {buttons.length > 0 && (
        <div className="touch-actions">
          {buttons.map((b) => (
            <PadButton
              key={b.label}
              controlId={`btn:${b.label}`}
              className={`touch-btn touch-action touch-action-${b.label.toLowerCase()}`}
              ariaLabel={b.ariaLabel}
              pressed={pressed.has(`btn:${b.label}`)}
              disabled={disabled}
              onPress={handlePress}
              onMove={handleMove}
              onRelease={handleRelease}
            >
              {b.label}
            </PadButton>
          ))}
        </div>
      )}
    </div>
  );
}
