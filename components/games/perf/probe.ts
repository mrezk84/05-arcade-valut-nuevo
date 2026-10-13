// Sonda de rendimiento (SPEC 12). Solo se activa con `?perf=1` en la URL;
// sin ese parámetro devuelve un objeto compartido con funciones vacías.

export interface PerfReport {
  gameId: string;
  skin: string;
  fpsAvg: number;
  fpsMin: number;
  frameP95: number;
  frames: number;
}

export interface PerfProbe {
  frame: (now: number) => void;
  report: () => PerfReport;
}

const BUFFER_SIZE = 600; // ~10 s a 60 FPS
const MAX_VALID_DT = 1000; // descarta pausas largas (pestaña oculta)
const LOG_EVERY = 600;

const EMPTY_REPORT: PerfReport = {
  gameId: '',
  skin: '',
  fpsAvg: 0,
  fpsMin: 0,
  frameP95: 0,
  frames: 0,
};

const NOOP_PROBE: PerfProbe = {
  frame: () => {},
  report: () => EMPTY_REPORT,
};

function perfEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('perf') === '1';
}

export function createPerfProbe(gameId: string, skin: string): PerfProbe {
  if (!perfEnabled()) return NOOP_PROBE;

  const times = new Float32Array(BUFFER_SIZE);
  let count = 0; // muestras válidas en el anillo (≤ BUFFER_SIZE)
  let head = 0;
  let frames = 0;
  let prev = -1;

  const report = (): PerfReport => {
    if (count === 0) return { ...EMPTY_REPORT, gameId, skin, frames };
    const sorted = times.slice(0, count).sort();
    let sum = 0;
    for (let i = 0; i < count; i++) sum += sorted[i];
    const r: PerfReport = {
      gameId,
      skin,
      fpsAvg: Math.round((1000 / (sum / count)) * 10) / 10,
      fpsMin: Math.round((1000 / sorted[count - 1]) * 10) / 10,
      frameP95:
        Math.round(sorted[Math.min(count - 1, Math.floor(count * 0.95))] * 100) /
        100,
      frames,
    };
    console.log('[perf]', r);
    return r;
  };

  const probe: PerfProbe = {
    frame: (now) => {
      if (prev >= 0) {
        const dt = now - prev;
        if (dt > 0 && dt < MAX_VALID_DT) {
          times[head] = dt;
          head = (head + 1) % BUFFER_SIZE;
          if (count < BUFFER_SIZE) count++;
          frames++;
          if (frames % LOG_EVERY === 0) report();
        }
      }
      prev = now;
    },
    report,
  };

  // Accesible desde la consola: `window.__perf.<gameId>.report()`
  const w = window as unknown as { __perf?: Record<string, PerfProbe> };
  (w.__perf ??= {})[gameId] = probe;
  return probe;
}
