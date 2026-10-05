# SPEC 08 — Integración del juego Arkanoid

> **Estado:** Aprobado · **Depende de:** SPEC 06, SPEC 07 · **Fecha:** 2026-10-05
> **Objetivo:** Integrar Arkanoid como juego jugable en `/games/arkanoid/play`, con HUD de puntuación, vidas y nivel, y guardado del score en el leaderboard de Supabase.

---

## Scope

**In:**

- Componente `components/games/ArkanoidGame.tsx` portado desde `references/started-games/04-arkanoid/`, con canvas 800×600, mouse y teclado.
- Módulos `components/games/arkanoid/levels.ts` (los 5 niveles) y `components/games/arkanoid/sprites.ts` (spritesheet y dibujo de sprites).
- Play-page `app/games/arkanoid/play/page.tsx` sobre `GamePlayShell`.
- Assets en `public/games/arkanoid/`: el spritesheet y los dos sonidos.
- El HUD de la plataforma refleja `score`, `lives` y `level`.
- El HUD dibujado en el canvas (Score, Nivel y bolas de vida) se conserva.
- La victoria (limpiar el nivel 5) también dispara `onGameOver(score)`.
- Fila `arkanoid` en la tabla `games`, reutilizando `cover-bricks`.

**Fuera de alcance (para specs futuros):**

- Selector "Saltar al nivel" del overlay de pausa.
- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlays de GAME OVER, victoria y pausa dibujados en canvas.
- Distinguir victoria de derrota en el modal del shell.
- Música de fondo y control de volumen.
- Corregir los frames de explosión del bloque `gray` (usa los del rojo, como en el original).
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- Cambios en `GamePlayShell` y en las play-pages de Asteroids y Tetris.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'arkanoid', 'ARKANOID', 'Rompe todos los ladrillos con la pelota.',
  'Mueve la pala con el mouse o las flechas y evita que la pelota caiga. Rompe todos los bloques de cada nivel para pasar al siguiente. Son cinco niveles y la pelota se acelera en cada uno.',
  'ARCADE', 'cover-bricks', 'magenta', 9
);
```

`cat = 'ARCADE'` y `color = 'magenta'` ya son valores válidos del CHECK real. No hay migración de schema.

### Props del componente

```ts
interface ArkanoidGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

| Estado del juego                               | Callback                 |
| ---------------------------------------------- | ------------------------ |
| `score`                                        | `onScoreChange(score)`   |
| `lives` (3 al iniciar, baja al caer la pelota) | `onLivesChange(lives)`   |
| `currentLevel` (1–5)                           | `onLevelChange(level)`   |
| `gameState` pasa a `gameover` o `win`          | `onGameOver(finalScore)` |

Reglas de emisión:

- Cada callback solo se dispara cuando el valor cambia respecto al anterior.
- Al montar se emite el estado inicial: score 0, vidas 3, nivel 1.
- Al perder la última vida, `lives` pasa a 0, se emite y después se llama a `onGameOver(score)`.
- Al limpiar el nivel 5, `gameState` pasa a `win` y se llama a `onGameOver(score)` con las vidas que queden.
- `onGameOver` se dispara una sola vez, porque el juego solo lo llama al salir de `playing`.
- El botón FIN del shell no pasa por el juego: la play-page pone `lives` a 0 al abrir el modal.

### Constantes y tipos

```ts
// components/games/arkanoid/levels.ts
export interface LevelBlock {
  col: number;
  row: number;
  color: BlockColor;
}
export interface Level {
  speed: number;
  blocks: LevelBlock[];
}
export const LEVELS: Level[]; // 5 niveles: 60, 40, 30, 39 y 39 bloques

// components/games/arkanoid/sprites.ts
export type BlockColor =
  | 'red'
  | 'yellow'
  | 'cyan'
  | 'magenta'
  | 'hotpink'
  | 'green'
  | 'gray';
export const EXPLOSION_DURATION = 150; // ms
export function loadSpritesheet(): Promise<HTMLCanvasElement>;
```

- Canvas 800×600. Pala 81×14, pelota 16×16 y bloque 64×24. Los bloques parten de (80, 80).
- Velocidad de la pala: 400 px/s. Velocidad base de la pelota: (200, −300) × `LEVELS[n].speed`.
- Puntuación: 10 por bloque. Máximo teórico: 208 bloques, es decir, 2 080 puntos.
- Rutas de assets: `/games/arkanoid/spritesheet-breakout.png` y `/games/arkanoid/sounds/{ball-bounce,break-sound}.mp3`.
- `loadSpritesheet` devuelve una promesa. El loop no arranca hasta que resuelve, y el cleanup cancela si el componente se desmonta antes.

### `scores`

No cambia. Se inserta `{ game_id: 'arkanoid', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Copiar los assets.** Copiar `assets/spritesheet-breakout.png` a `public/games/arkanoid/` y `assets/sounds/ball-bounce.mp3` y `break-sound.mp3` a `public/games/arkanoid/sounds/`.
   Verificación: con `npm run dev`, `/games/arkanoid/spritesheet-breakout.png` y las dos rutas de sonido responden 200.

2. **Portar los módulos de datos.** Crear `components/games/arkanoid/levels.ts` con `LEVELS` (mismos cinco patrones y velocidades de `levels.js`, tipado) y `components/games/arkanoid/sprites.ts` con `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet()` (promesa con la ruta absoluta `/games/arkanoid/...`), `drawSprite` y `drawFrame`. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

3. **Esqueleto de `ArkanoidGame` y play-page.** Crear `components/games/ArkanoidGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `AsteroidsGame`), un canvas 800×600 con escalado CSS y, tras cargar el spritesheet, un dibujo estático de los bloques del nivel 1, la pala y la pelota. Crear `app/games/arkanoid/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `lives` (inicial 3), `level`, `paused`, `over` y `gameKey`, `GamePlayShell` (con `paused || over` hacia el juego) y una línea de controles bajo el CRT. El encaje del canvas en `.crt-screen` se diseña con `/frontend-design`.
   Verificación: `/games/arkanoid/play` carga sin errores de consola y el canvas llena la pantalla CRT sin desbordar.

4. **Portar el loop, la pala y la pelota.** Copiar `paddle`, `ball`, `initPaddle`, `initBall`, `update` (solo movimiento de la pala, rebotes en paredes y en la pala) y `loop`. El loop sigue dibujando con `paused`, actualiza `lastTime` en cada frame, acota `dt` a 100 ms y no actualiza mientras `paused`. Copiar `mousemove` en el canvas y `keydown`/`keyup` de `←`/`→` en `window`, con `preventDefault` solo en esas dos teclas y sin las teclas `P`/`Esc`. Resetear el mapa `keys` al pausar y reanudar. Cleanup completo en el `return` del efecto.
   Verificación: la pelota rebota en paredes y pala, mouse y flechas mueven la pala, PAUSA congela el juego y la página no hace scroll con las flechas.

5. **Portar bloques, niveles y explosiones.** Copiar `loadLevel`, `collideAABB`, la colisión con bloques (un bloque por frame, +10 puntos), el avance de nivel con la velocidad de `LEVELS[n].speed` y la animación de explosión. Dibujar el HUD del canvas (Score, Nivel y bolas de vida).
   Verificación: romper un bloque suma 10 puntos y lanza su explosión, y al limpiar un nivel carga el siguiente con la pelota más rápida.

6. **Capturar el HUD, la caída y el fin de partida.** Emitir `score`, `lives` y `level` por los callbacks (solo al cambiar), restar una vida al caer la pelota y reposicionarla, y llamar a `onGameOver(score)` una sola vez al llegar a 0 vidas (con `lives` en 0) o al limpiar el nivel 5. Quitar de la copia el DOM original (`getElementById`), los overlays de GAME OVER, victoria y pausa, el selector de nivel y el `click` del canvas. En la play-page, conectar los callbacks y hacer que FIN ponga `lives` a 0.
   Verificación: el HUD React refleja puntuación, vidas y nivel en tiempo real, y al perder o ganar aparece el modal de game over con la puntuación final.

7. **Audio.** Cargar los dos mp3 desde `/games/arkanoid/sounds/` dentro del efecto, reproducirlos con `cloneNode()` solo en el frame en que ocurre el rebote o la rotura y solo si el juego no está en pausa, y capturar en silencio el rechazo de `play()`. Detener y liberar los sonidos en el cleanup.
   Verificación: suenan rebote y rotura, no suena nada en pausa y la consola no muestra errores de autoplay.

8. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games`, `/games/arkanoid` carga con datos reales y el tab ARKANOID aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Arkanoid aparece en `/games` y `/games/arkanoid` carga con datos reales.
- [ ] El tab ARKANOID aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/arkanoid/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] La pala sigue al mouse sobre el canvas y se mueve con `←` y `→`.
- [ ] Pulsar `←`, `→` no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] Al empezar, el HUD React muestra puntuación 0, tres `♥` en Vidas y nivel 01.
- [ ] El HUD del canvas muestra Score, Nivel y las bolas de vida, y coincide con el HUD React.
- [ ] Romper un bloque suma exactamente 10 puntos y lanza su animación de explosión.
- [ ] Limpiar un nivel carga el siguiente y la pelota se mueve a la velocidad de `LEVELS[n].speed`.
- [ ] Al caer la pelota se pierde una vida y la pelota se reposiciona sobre la pala.
- [ ] Al perder la tercera vida, Vidas pasa a `—` y aparece el modal de game over con la puntuación final.
- [ ] Al limpiar el nivel 5 aparece el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Vidas en `—` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay de GAME OVER, victoria o pausa dibujado en el canvas, ni el selector de nivel.
- [ ] PAUSA congela la pelota, la pala y el audio; REANUDAR continúa sin saltos.
- [ ] Una tecla pulsada al pausar no deja la pala moviéndose al reanudar.
- [ ] Con el modal abierto, el mouse y las teclas no mueven la pala.
- [ ] Suena el rebote y la rotura de bloques, y no suena nada en pausa.
- [ ] "JUGAR DE NUEVO" reinicia score, vidas (a 3), nivel (a 1), bloques y pelota.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'arkanoid'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/arkanoid` (top 10) y en el tab ARKANOID de `/hall-of-fame` (top 12) al recargar.
- [ ] Salir de la página no deja listeners, loops ni sonidos activos.
- [ ] `/games/asteroids/play` y `/games/tetris/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: no extraer el shell.** Razón: `GamePlayShell` ya existe desde SPEC 07 y cubre HUD, pausa, modal y guardado.
- **Sí: portar a módulos TS desde el principio, sin paso de limpieza posterior.** Razón: el origen ya separa datos (`levels.js`, `spritesheet.js`) de la lógica (`game.js`, unas 270 líneas), así que no hace falta el patrón portar-y-limpiar de SPEC 07.
- **Sí: conservar el HUD dibujado en canvas, además del HUD React.** Razón: es la regla por defecto de la skill y el usuario la eligió. Los valores quedan duplicados a propósito.
- **No: quitar el HUD del canvas.** Razón: era la recomendación inicial, pero el usuario prefirió conservarlo.
- **Sí: eliminar los overlays de GAME OVER, victoria y pausa del canvas.** Razón: el modal y el "EN PAUSA" del shell los reemplazan.
- **Sí: pausa solo de la plataforma.** Razón: enrutar `P`/`Esc` obligaría a ampliar el contrato del shell con un callback nuevo.
- **No: selector "Saltar al nivel".** Razón: es una herramienta de desarrollo del original, y permitiría saltar al nivel 5 y falsear el leaderboard.
- **Sí: la victoria también dispara `onGameOver(score)`.** Razón: sin esto el jugador que completa el juego no podría guardar su score.
- **No: distinguir victoria de derrota en el modal.** Razón: el shell no lo soporta, y ampliarlo merece su propio spec.
- **Sí: mouse y teclado a la vez, con `preventDefault` solo en `←` y `→`.** Razón: es el control original, y solo esas dos teclas provocan scroll.
- **Sí: resetear el mapa `keys` al pausar y reanudar.** Razón: el original no lo hacía, y una tecla soltada durante la pausa dejaría la pala "atascada".
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: el original no limitaba `dt`, y al reanudar o volver de otra pestaña la pelota atravesaría bloques.
- **Sí: audio solo fuera de pausa y con `play()` capturado en silencio.** Razón: respeta la pausa y evita errores de autoplay en consola.
- **No: música de fondo ni control de volumen.** Razón: el original no los tiene.
- **Sí: assets en `public/games/arkanoid/`, con rutas absolutas.** Razón: es el destino que fija el contrato de integración, y las rutas relativas del original no funcionan bajo `/games/arkanoid/play`.
- **Sí: mantener el defecto del bloque `gray`.** Razón: es un detalle del original que no afecta a la jugabilidad, y corregirlo no es el objetivo de este spec.
- **Sí: reutilizar `cover-bricks` y `color = 'magenta'`.** Razón: el cover ya representa ladrillos y no hace falta diseñar uno nuevo. `magenta` diferencia la card de Asteroids y Tetris, que usan `cyan`.
- **Sí: sin lógica de límite de score en el juego.** Razón: el máximo teórico es 2 080 puntos, y el shell ya acota a 10 000 000.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado, y manda el schema leído con `list_tables`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en Asteroids y Tetris.
- **Sí: la fila de `games` va en el último paso.** Razón: el juego no debe aparecer en `/games` antes de ser jugable.
- **No: partir en dos specs.** Razón: un solo canvas, tres assets y una sola fuente de lógica.
- **Sin confirmación por sección.** Las secciones de Acceptance criteria, Decisions, Risks y "What is not in this spec" se redactaron y guardaron sin que el usuario las revisara una a una, por petición suya al grabar el spec. Cabecera, Scope, Data model e Implementation plan sí se confirmaron antes de guardar.

---

## Risks

| Riesgo                                                                | Mitigación                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| El spritesheet no carga antes de desmontar el componente              | `loadSpritesheet()` devuelve una promesa y el efecto ignora el resultado si ya hay cleanup.        |
| Autoplay de audio bloqueado por el navegador                          | Capturar el rechazo de `play()` en silencio. Los sonidos arrancan tras la interacción del jugador. |
| Tecla "atascada" al pausar con `←`/`→` pulsada                        | Resetear el mapa `keys` al pausar y reanudar.                                                      |
| La pelota atraviesa bloques con `dt` grande al volver de otra pestaña | `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.                                      |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños      | Escalado CSS resuelto en el paso 3 con `/frontend-design`, verificado con el criterio de ajuste.   |
| Listeners duplicados al reiniciar                                     | Cleanup completo en el efecto y reinicio por `key`.                                                |
| Dos `onGameOver` seguidos (fin natural y botón FIN)                   | El juego lo dispara una sola vez y el shell congela el juego al abrir el modal.                    |
| Cualquier cliente puede insertar scores (RLS abierto)                 | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                               |

---

## What is **not** in this spec

- Selector de nivel y teclas `P`/`Esc` del Arkanoid original.
- Overlays de GAME OVER, victoria y pausa dibujados en canvas.
- Distinguir victoria de derrota en el modal.
- Música de fondo y control de volumen.
- Corregir los frames de explosión del bloque `gray`.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame` y `GamePlayShell`.

Cada uno de esos puntos, si llega, va en su propio spec.
