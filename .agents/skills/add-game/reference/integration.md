# Contrato de integración de un juego en Arcade Vault

Referencia técnica que el spec generado por `/add-game` debe citar. Si algo de aquí contradice el código actual, manda el código: relee los archivos citados en Fase 1.

## 1. Archivos por juego

| Archivo                             | Rol                                                          |
| ----------------------------------- | ------------------------------------------------------------ |
| `components/games/<Pascal>Game.tsx` | Componente `'use client'` con canvas y game loop             |
| `components/games/<id>/*.ts`        | Módulos auxiliares (niveles, sprites, constantes), si hay    |
| `app/games/<id>/play/page.tsx`      | Play-page fina; gana a `app/games/[id]/play` (ruta estática) |
| `public/games/<id>/...`             | Assets (imágenes, audio)                                     |
| Fila en `games` (Supabase)          | Hace aparecer el juego en `/games`, detalle y hall of fame   |
| `app/globals.css` (opcional)        | Clase `.cover-<id>` si no se reutiliza una existente         |

`/games`, `/games/[id]` y `/hall-of-fame` ya leen de Supabase: no se tocan.

## 2. Contrato del componente canvas

```ts
interface <Pascal>GameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  // una prop por métrica extra del HUD: onLivesChange, onLevelChange, onLinesChange...
  onGameOver: (finalScore: number) => void;
}
```

Patrón (ver `components/games/AsteroidsGame.tsx`):

- Props y callbacks se copian a refs (`pausedRef`, `cbScore`, ...) con un `useEffect` por prop; el loop lee las refs y el efecto principal se monta una sola vez.
- El callback se dispara solo cuando el valor cambia (comparar con el anterior).
- `paused === true`: el loop sigue dibujando pero no actualiza; el audio se pausa.
- Cleanup completo en el `return` del efecto: `cancelAnimationFrame`, listeners de `window`/`document`/canvas, timers, audio.
- `preventDefault` solo en las teclas que usa el juego.
- Reinicio: el padre cambia la `key` del componente; no hay reinicio interno.
- Canvas con el tamaño intrínseco del juego; el escalado es CSS.
- Al terminar (game over o victoria) llama `onGameOver(score)` una sola vez.

## 3. Adaptar JS vanilla

- `document.getElementById(...)` → `useRef` o eliminar el elemento.
- Varios `<script>` con globals → módulos TS en `components/games/<id>/` con `export`; respetar el orden de dependencias.
- `new Audio('assets/x.mp3')` / `Image().src = 'assets/...'` → rutas absolutas `/games/<id>/...` desde `public/`.
- Eliminar: overlays de game over/pausa, leaderboard en localStorage, botones de reinicio, menús HTML. La plataforma los reemplaza.
- Mantener: HUD dibujado en canvas, salvo decisión contraria registrada en el spec.
- Tipar las clases/funciones al portar; no usar `any` para evitar errores.
- Sin acceso a `window`/`document` en el cuerpo del módulo (SSR); todo dentro del efecto. La play-page importa el componente con `dynamic(..., { ssr: false })`.

## 4. Shell compartido: `components/games/GamePlayShell.tsx`

Si no existe, el spec lo extrae como **primer paso** de `app/games/asteroids/play/page.tsx`, y migra Asteroids a él antes de añadir el juego nuevo. Verificación de ese paso: `/games/asteroids/play` se comporta igual que antes.

Responsabilidades del shell:

- HUD (jugador + stats), botones PAUSA/REANUDAR, FIN, SALIR (`/games/<id>`).
- Marco CRT, overlay "EN PAUSA", barra inferior con título del juego.
- Modal de game over: puntuación final, input de nombre (mayúsculas, máx. 10), "GUARDAR PUNTUACIÓN", "JUGAR DE NUEVO", "VOLVER AL VAULT".
- Prefill del nombre con `localStorage.getItem('av_player_name')` y persistencia al guardar.
- Insert en Supabase con el cliente browser: `{ game_id, name, score }`. Estado `saved` para evitar doble envío; manejo del error del insert (no marcar guardado si falla).

Props sugeridas (confirmar contra el código al redactar):

```ts
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
  children: React.ReactNode; // el canvas
}
```

## 5. Play-page de un juego

```
'use client'
const Game = dynamic(() => import('@/components/games/<Pascal>Game'), { ssr: false })
estado: score, métricas, paused, over, gameKey
<GamePlayShell ...>{<Game key={gameKey} ... />}</GamePlayShell>
```

`restart()` reinicia métricas, `paused`, `over` y sube `gameKey`.

## 6. Supabase

Schema vigente (confirmar siempre con `list_tables`):

- `games(id text pk, title, short, long, cat, cover, color, sort_order int)`; `cat` y `color` con CHECK.
- `scores(id uuid, game_id text fk → games.id, name text 1–10 chars, score int 0–10 000 000, created_at)`.
- RLS activo: SELECT público en ambas, INSERT público en `scores`.

Seed del juego: migración con `apply_migration`, por ejemplo:

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values ('<id>', '<TITLE>', '<short>', '<long>', '<CAT>', '<cover-class>', '<color>', <n>);
```

Si hace falta un valor nuevo de `cat` o `color`, el spec incluye un paso previo que modifica el CHECK y actualiza `lib/supabase/types.ts`.

## 7. Cover

Clases existentes en `app/globals.css`: `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`/`cover-asteroids`, `cover-rana`, `cover-duelo`. Relee el archivo al ejecutar el skill. Una clase nueva se diseña con `/frontend-design`.
