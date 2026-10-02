# SPEC 07 — Integración del juego Tetris

> **Estado:** Aprobado · **Depende de:** SPEC 05, SPEC 06 · **Fecha:** 2026-10-02
> **Objetivo:** Integrar Tetris como juego jugable en `/games/tetris/play`, con HUD de puntuación, líneas, nivel y vidas, y guardado del score en el leaderboard de Supabase.

---

## Por qué existe este spec

Es el segundo juego canvas de la plataforma. SPEC 05 pospuso la extracción de un componente compartido hasta que llegara el segundo juego, y este es ese momento. Por eso el plan empieza extrayendo `GamePlayShell` desde la play-page de Asteroids.

El origen es `references/started-games/03-tetris/` (HTML + CSS + un único `game.js` con globals y acceso directo al DOM). El método es portar primero y limpiar después:

- Primero se porta el código de `game.js` tal cual (mismos nombres, mismo orden, misma estructura) a `TetrisGame.tsx`.
- Solo se adapta lo necesario para el HUD de la plataforma, la pausa y el ciclo de vida del componente.
- Cuando el juego funciona y su HUD está validado, un paso final de limpieza lo separa en módulos y elimina el código muerto.

Los overlays, el leaderboard local y el panel lateral del original se sustituyen por los de la plataforma.

---

## Scope

**In:**

- Extraer `components/games/GamePlayShell.tsx` desde `app/games/asteroids/play/page.tsx` y migrar Asteroids a él sin cambiar su comportamiento visible.
- El shell congela el juego mientras el modal de game over está abierto (la play-page pasa `paused || over` al juego).
- El shell acota el score a 10 000 000 antes de insertarlo en `scores` y no marca "guardado" si el insert falla.
- Componente `components/games/TetrisGame.tsx` con la lógica de `game.js` portada tal cual, el loop, el teclado y el canvas "siguiente pieza".
- Tetris tiene una sola vida: `lives` empieza en 1 y pasa a 0 al terminar la partida.
- El HUD de la plataforma refleja `score`, `lines`, `level` y `lives`, y el game over del juego abre el modal del shell.
- Layout dentro del marco CRT: el canvas principal centrado en la pantalla y el canvas "siguiente" a su derecha, sin alinearlo con el principal.
- Play-page `app/games/tetris/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Fila `tetris` en la tabla `games`, reutilizando `cover-tetro`.
- Paso final de limpieza: separar en `components/games/tetris/` (constantes, tablero, dibujo) y eliminar código muerto, sin cambiar el comportamiento.
- Se conservan las 8 piezas del código original, incluida la pieza `N` (tuerca).

**Fuera de alcance (para specs futuros):**

- Skins (retro, neon, pastel, pixel). Se usa solo la skin `retro`.
- Selector de nivel inicial. Toda partida empieza en nivel 1.
- Menú de pausa propio, tema claro/oscuro y tabla de records local del juego original.
- Contador de combo (`maxCombo`): solo servía al leaderboard local. No se refleja en el HUD.
- Tecla `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Más de una vida o cualquier mecánica que reviva la partida.
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'tetris', 'TETRIS', 'Encaja piezas y limpia líneas.',
  'Un tablero de 10×20 y ocho piezas que no paran de caer. Rota, desplaza y encaja los bloques para completar líneas. Cada diez líneas sube el nivel y la caída se acelera.',
  'PUZZLE', 'cover-tetro', 'cyan', 8
);
```

`cat = 'PUZZLE'` y `color = 'cyan'` ya son valores válidos del CHECK real. No hay migración de schema.

### Props del componente

```ts
interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

El juego original actualiza su HUD con `updateHUD()`. Esa función pasa a emitir los valores por callbacks, y cada callback solo se dispara cuando el valor cambia respecto al anterior.

| Estado del juego                          | Callback                 |
| ----------------------------------------- | ------------------------ |
| `score`                                   | `onScoreChange(score)`   |
| `lines`                                   | `onLinesChange(lines)`   |
| `level`                                   | `onLevelChange(level)`   |
| `lives` (nuevo): 1 al iniciar, 0 al morir | `onLivesChange(lives)`   |
| `endGame()`                               | `onGameOver(finalScore)` |

Reglas de emisión:

- `init()` pone `lives = 1`, reinicia los valores previos y emite el estado inicial.
- `endGame()` pone `lives = 0`, llama a `updateHUD()` para emitirlo y después llama a `onGameOver(score)`.
- `endGame()` se alcanza por dos caminos: el tick del loop (caída natural) y el teclado (hard drop o soft drop). Ambos emiten por la misma vía.
- `onGameOver` se dispara una sola vez, protegido por el flag `gameOver` del original.
- El botón FIN del shell no pasa por el juego: la play-page pone `lives` a 0 al abrir el modal.

### Props del shell

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
  children: React.ReactNode;
}
```

Se confirman contra el código de Asteroids al implementar el paso 1. El shell muestra el campo "Jugador" por sí mismo, y la play-page aporta el resto de métricas en `stats`. Las vidas se muestran con el mismo formato que Asteroids: `♥` por vida y `—` cuando es 0.

### Layout del canvas

- El canvas principal (300×600, proporción 1:2) va en un contenedor centrado en `.crt-screen` (4:3), con la altura de la pantalla.
- El centro horizontal del canvas principal coincide con el centro de la pantalla.
- El panel "siguiente" (etiqueta y canvas 120×120) cuelga a la derecha del contenedor del tablero, con un margen, anclado arriba y sin alinearlo con el centro del tablero.
- El panel "siguiente" no desplaza al canvas principal.

### Tipos y constantes de Tetris

En el paso de portado, las constantes y las funciones viven dentro de `TetrisGame.tsx` tal como están en `game.js`, con los tipos mínimos que exige TypeScript. Tras la limpieza (paso 8) quedan así:

```ts
// components/games/tetris/constants.ts
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_BG = '#1a1a25';
export const GRID_LINE = '#22222e';
export const LINE_SCORES = [0, 100, 300, 500, 800];

// components/games/tetris/board.ts
export type Shape = number[][];
export interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}
```

- `COLORS` y `PIECES` se copian de `game.js` (8 tipos, índice `1..8`, `0` = vacío).
- `BOARD_BG` y `GRID_LINE` son los valores del tema oscuro del original. Sustituyen a `getComputedStyle(...)` y a la variable CSS `--grid-line`, que no existen en la plataforma.
- Puntuación y velocidad no cambian:
  - Líneas: `LINE_SCORES[n] × level`.
  - Hard drop: +2 por celda.
  - Soft drop: +1 por fila.
  - Nivel: `floor(lines / 10) + 1`.
  - Intervalo de caída: `max(100, 1000 − (level − 1) × 90)` ms.

### `scores`

No cambia. Se inserta `{ game_id: 'tetris', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Extraer `GamePlayShell`.** Crear `components/games/GamePlayShell.tsx` moviendo el HUD, los botones PAUSA/FIN/SALIR, el marco CRT, el overlay "EN PAUSA" y el modal de game over desde `app/games/asteroids/play/page.tsx`. Incluye el prefill de `av_player_name`, el acotado del score a 10 000 000 y el manejo del error del insert. Migrar la play-page de Asteroids al shell, pasando `paused || over` a `AsteroidsGame`.
   Verificación: `/games/asteroids/play` se comporta igual (HUD, pausa, modal, guardado) y el juego queda congelado con el modal abierto.

2. **Esqueleto de `TetrisGame` y play-page.** Crear `components/games/TetrisGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `AsteroidsGame`) y el layout: canvas principal 300×600 centrado y panel "siguiente" a su derecha. Crear `app/games/tetris/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `lines`, `level`, `lives` (inicial 1), `paused`, `over` y `gameKey`, `GamePlayShell` y una línea de controles bajo el CRT. El layout se diseña con `/frontend-design`.
   Verificación: `/games/tetris/play` carga sin errores, el tablero está centrado en la pantalla y el panel "siguiente" queda a su derecha.

3. **Portar el estado y la lógica tal cual.** Copiar de `game.js` dentro del efecto de `TetrisGame.tsx` las constantes, `PIECES`, el estado y las funciones `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece` y `spawn`, con sus mismos nombres y orden. Solo se añaden los tipos mínimos. `maxCombo` y `startLevel = 1` se conservan tal cual en esta etapa.
   Verificación: `npm run build` sin errores de TypeScript.

4. **Portar el dibujo.** Copiar `drawBlock` (solo el estilo `retro`, con su cuerpo sin cambios), `drawGrid`, `draw`, `drawNext` e `init`. `drawGrid` usa `GRID_LINE` en lugar de `getComputedStyle`, y el fondo usa `BOARD_BG`. Los canvas se obtienen por `useRef`.
   Verificación: `/games/tetris/play` muestra el tablero con la primera pieza, la pieza fantasma y la siguiente pieza en el panel.

5. **Portar el loop y el teclado.** Copiar `loop` con las adaptaciones acordadas: sigue corriendo con `paused`, actualiza `lastTime` en cada frame, acota `dt` a 100 ms y no acumula caída mientras `paused`. Copiar el `keydown` en `window` con `preventDefault` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, y sin las teclas `P`/`Esc`. Cleanup completo en el `return` del efecto.
   Verificación: las piezas caen, se mueven, rotan y se fijan, y PAUSA congela el juego.

6. **Capturar el HUD y el game over.** Reescribir `updateHUD()` para emitir `score`, `lines`, `level` y `lives` por los callbacks, según la tabla de "Captura del HUD". Añadir `lives`, que `init()` pone a 1 y `endGame()` pone a 0, y hacer que `endGame()` emita y llame a `onGameOver(score)`. En la play-page, conectar los callbacks y hacer que FIN ponga `lives` a 0. Quitar de la copia los restos del DOM original (`getElementById`, overlays, leaderboard, skins, tema, pausa propia, selector de nivel).
   Verificación: el HUD refleja puntuación, líneas, nivel y vidas en tiempo real, y al perder aparece el modal de game over con `lives` en `—`.

7. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca en `/games` antes de ser jugable.
   Verificación: la card aparece en `/games` y `/games/tetris` carga con datos reales.

8. **Limpieza sin cambio de comportamiento.** Separar el código portado en `components/games/tetris/constants.ts`, `board.ts` y `draw.ts`, con funciones que reciben el tablero y el contexto como argumentos, y dejar en `TetrisGame.tsx` solo el loop, el teclado y los callbacks. Eliminar el código muerto: `maxCombo`, `currentCombo`, `lastClearWasCombo` y `startLevel`.
   Verificación: se repiten los criterios de aceptación de juego y HUD con el mismo resultado, y `npm run build` completa sin errores.

---

## Acceptance criteria

- [ ] La card de Tetris aparece en `/games` y `/games/tetris` carga con datos reales.
- [ ] `/games/tetris/play` carga sin errores de SSR ni de consola.
- [ ] El centro horizontal del canvas principal coincide con el centro de la pantalla CRT (diferencia de 2 px o menos).
- [ ] El canvas "siguiente" está a la derecha del canvas principal, no centrado con él, y se ve completo dentro de la pantalla.
- [ ] El panel "siguiente" no desplaza al canvas principal: el tablero sigue centrado con o sin panel.
- [ ] El tablero es de 10×20 y aparecen las 8 piezas, incluida la `N`.
- [ ] `←`/`→` mueven la pieza, `↑` y `X` la rotan, `↓` hace soft drop y `Espacio` hace hard drop.
- [ ] Pulsar las flechas o `Espacio` no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] La pieza fantasma se dibuja con transparencia en la posición de aterrizaje.
- [ ] El canvas "siguiente" muestra la pieza que viene y se actualiza al fijar cada pieza.
- [ ] Al empezar, el HUD muestra `♥` en Vidas (una sola vida), 0 en puntuación y líneas, y nivel 01.
- [ ] El HUD React muestra puntuación, líneas y nivel, y coinciden con los del juego.
- [ ] Limpiar una línea a nivel 1 suma 100 puntos y limpiar cuatro suma 800.
- [ ] El nivel sube al llegar a 10 líneas y la caída se acelera.
- [ ] PAUSA congela la caída y las teclas; REANUDAR continúa sin caídas acumuladas.
- [ ] Al apilar hasta arriba por caída natural, Vidas pasa a `—` y aparece el modal de game over con la puntuación final.
- [ ] Si el game over ocurre al hacer hard drop o soft drop, también aparece el modal con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Vidas en `—` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay, leaderboard ni toggle de tema del juego original.
- [ ] Con el modal abierto, las teclas no mueven piezas.
- [ ] "JUGAR DE NUEVO" reinicia score, líneas, nivel, vidas (a 1), tablero y pieza siguiente.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'tetris'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/tetris` y en `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] Tras el paso de limpieza, el juego y el HUD se comportan igual que antes y no queda código de combo ni de `startLevel`.
- [ ] `/games/asteroids/play` mantiene HUD, pausa, modal y guardado, y queda congelado con el modal abierto.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: portar `game.js` tal cual y limpiar después.** Razón: el HUD se valida contra el comportamiento original antes de refactorizar, y así una regresión se atribuye al paso de limpieza y no al portado.
- **Sí: adaptar solo lo necesario en el portado.** Razón: HUD por callbacks, pausa de la plataforma, teclado en `window`, canvas por `useRef`, cleanup y constantes en lugar de lo que leía del DOM. Todo lo demás se mantiene.
- **Sí: una sola vida.** Razón: todos los juegos de la plataforma muestran vidas. Tetris termina en el primer game over natural, así que `lives` pasa de 1 a 0 solo en `endGame()`.
- **Sí: `endGame()` emite el HUD y después llama a `onGameOver`.** Razón: se alcanza desde el loop y desde el teclado, y el original solo refrescaba el HUD en el teclado. Emitir desde `endGame()` evita que la vida y el score finales no lleguen al HUD.
- **Sí: FIN pone `lives` a 0 desde la play-page.** Razón: el botón no pasa por el juego y el HUD quedaría con una vida detrás del modal.
- **Sí: tablero centrado y panel "siguiente" a su derecha sin alinear.** Razón: el tablero es el foco visual. Colgar el panel del contenedor del tablero evita que el panel lo desplace del centro.
- **Sí: extraer `GamePlayShell` ahora.** Razón: SPEC 05 lo pospuso hasta el segundo juego canvas, y duplicar ~150 líneas de HUD, modal y guardado sería deuda inmediata.
- **Sí: migrar Asteroids al shell en el mismo spec.** Razón: sin un segundo consumidor no se valida que el shell sea realmente genérico. Es el primer paso y se verifica por separado.
- **Sí: el shell congela el juego con el modal abierto (`paused || over`).** Razón: en Tetris el teclado seguiría moviendo piezas detrás del modal. Se corrige en el shell para que valga también para Asteroids.
- **Sí: acotar el score a 10 000 000 en el shell.** Razón: la base lo rechaza por CHECK, y hacerlo una vez cubre a todos los juegos.
- **Sí: el shell no marca "guardado" si el insert falla.** Razón: la play-page de Asteroids lo marca antes de insertar y pierde el score en silencio si hay error.
- **Sí: mantener la pieza `N`.** Razón: es el comportamiento jugable real del código. El README del origen dice 7 piezas, pero `randomPiece()` genera 8.
- **Sí: `BOARD_BG` y `GRID_LINE` como constantes.** Razón: el original leía `--grid-line` del `body`, y esa variable y el tema claro/oscuro no existen en la plataforma.
- **Sí: canvas "siguiente" dentro del componente.** Razón: es estado interno del juego, y subirlo al shell exigiría un slot genérico sin segundo caso de uso.
- **Sí: controles como una línea de texto en la play-page de Tetris.** Razón: no amplía el contrato del shell.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en Asteroids y evita lógica de reinicio interna.
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: el original no limitaba `dt`, y al reanudar o volver de otra pestaña soltaría varias caídas de golpe.
- **Sí: fila de `games` antes de la limpieza.** Razón: el juego ya es jugable en el paso 6, y la limpieza del paso 8 se verifica contra el juego publicado.
- **No: skins, nivel inicial, combo y tema claro/oscuro.** Razón: son features del origen, no de la plataforma. Cada uno merece su spec si se quiere recuperar.
- **No: enrutar `P` como tecla de pausa.** Razón: obligaría a ampliar el contrato del shell con un callback nuevo.
- **No: partir en dos specs.** Razón: son dos canvas, sin assets ni audio y una sola fuente de lógica. La infraestructura (shell) ya es el primer paso de este plan.
- **Sin confirmación por sección.** Las secciones de Scope a Riesgos se redactaron en un solo paso por petición del usuario, que las revisa directamente en este archivo. Las decisiones de los bloques de preguntas 1 y 2 sí se confirmaron una a una. Esta versión incorpora la revisión posterior del usuario (layout, una vida, captura del HUD y orden portar-y-limpiar).

---

## Risks

| Riesgo                                                                                     | Mitigación                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Extraer el shell rompe Asteroids                                                           | El paso 1 se verifica por separado, antes de añadir Tetris, y es commiteable por sí solo.                                       |
| El tablero vertical 300×600 más el panel "siguiente" no encaja bien en `.crt-screen` (4:3) | El layout se resuelve en el paso 2 con `/frontend-design`: tablero centrado a la altura del marco y panel colgado a su derecha. |
| El panel "siguiente" se sale de la pantalla en tamaños pequeños                            | Dimensionar el panel en proporción al tablero y verificar el criterio de visibilidad completa.                                  |
| Game over alcanzado desde el teclado no llega al HUD                                       | `endGame()` emite el HUD y llama a `onGameOver` por sí mismo, protegido por el flag `gameOver`.                                 |
| Dos `onGameOver` seguidos (fin natural y botón FIN)                                        | El juego lo dispara una sola vez, y el shell congela el juego al abrir el modal.                                                |
| La limpieza (paso 8) introduce regresiones en el juego portado                             | El paso es commiteable por sí solo y se verifica repitiendo los criterios de juego y HUD.                                       |
| Listeners de teclado duplicados al reiniciar                                               | Cleanup en el efecto y reinicio por `key`.                                                                                      |
| Cualquier cliente puede insertar scores (RLS abierto)                                      | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                                            |

---

## What is **not** in this spec

- Skins, selector de nivel inicial, combo y tema claro/oscuro del Tetris original.
- Menú de pausa propio y tecla `P`/`Esc`.
- Tabla de records local del juego.
- Más de una vida.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame`.

Cada uno de esos puntos, si llega, va en su propio spec.
