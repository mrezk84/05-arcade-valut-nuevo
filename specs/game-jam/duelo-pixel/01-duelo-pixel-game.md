# SPEC GJ-duelo-pixel-01 — Integración del juego Duelo Pixel

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07 (shell), SPEC 09 (patrón vigente) · **Fecha:** 2026-10-06
> **Objetivo:** Integrar Duelo Pixel, un Pong de un jugador contra la CPU, como juego jugable en `/games/duelo-pixel/play`, con HUD de puntuación, vidas y nivel, y guardado del score en el leaderboard de Supabase.

---

## Por qué existe este spec

Es el primer spec del game jam con el tema «duelo». El catálogo real tiene cuatro juegos (`asteroids`, `tetris`, `arkanoid`, `snake`) y ninguno es `VERSUS` ni usa el color `yellow`. Duelo Pixel cubre los dos huecos a la vez.

No hay código de origen: el juego se diseña desde cero. Las reglas, los números y los controles se fijan aquí para que la implementación no improvise. El patrón de integración es el de Snake (SPEC 09): `GamePlayShell` ya existe y no se toca.

---

## Scope

**In:**

- Componente `components/games/DueloPixelGame.tsx`, diseñado desde cero, con canvas 800×600, una pala del jugador a la izquierda y una pala de la CPU a la derecha.
- Módulos `components/games/duelo-pixel/constants.ts` (dimensiones, velocidades y ritmo de niveles) y `components/games/duelo-pixel/ai.ts` (objetivo y movimiento de la CPU, funciones puras).
- Play-page `app/games/duelo-pixel/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Controles `↑`/`↓` y `W`/`S`, con `preventDefault` solo en las flechas.
- Pelota con velocidad creciente por golpe y por nivel, y rebote en paredes superior e inferior.
- CPU con velocidad limitada y error de puntería, que mejora con el nivel hasta el nivel 10.
- Tres vidas: cada punto de la CPU quita una. Con 0 vidas termina la partida.
- Puntuación: +10 por cada golpe del jugador y +100 × nivel por cada punto ganado.
- El HUD de la plataforma refleja `score`, `lives` y `level`.
- El HUD dibujado en el canvas (línea central, marcador TÚ–CPU) se conserva.
- Fila `duelo-pixel` en la tabla `games`, con `cat = 'VERSUS'`, `color = 'yellow'`, `cover = 'cover-duelo'` (reutilizada) y `sort_order = 11`.

**Fuera de alcance (para specs futuros):**

- Skins de la pista (SPEC GJ-duelo-pixel-02).
- Segundo jugador humano en el mismo teclado.
- Control con ratón.
- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlays, menú de inicio y estado de "pulsa una tecla para empezar".
- Power-ups, obstáculos y modos de dificultad seleccionables.
- Audio y música.
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- Cambios en `GamePlayShell` y en las play-pages de los otros juegos.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'duelo-pixel', 'DUELO PIXEL', 'Gana el duelo a la CPU, punto a punto.',
  'Mueve tu pala con las flechas o W y S y devuelve la pelota a la CPU. Cada golpe suma 10 puntos y cada punto ganado suma 100 por nivel. Cada tres puntos sube el nivel: la pelota se acelera y la CPU juega mejor. Tienes tres vidas y cada punto de la CPU te quita una.',
  'VERSUS', 'cover-duelo', 'yellow', 11
);
```

`cat = 'VERSUS'` y `color = 'yellow'` ya son valores válidos del CHECK real. No hay migración de schema.

### Props del componente

```ts
interface DueloPixelGameProps {
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
| `lives` (3 al iniciar, −1 por punto de la CPU) | `onLivesChange(lives)`   |
| `level` (`floor(puntos / 3) + 1`)              | `onLevelChange(level)`   |
| `lives` llega a 0                              | `onGameOver(finalScore)` |

Reglas de emisión:

- Cada callback solo se dispara cuando el valor cambia respecto al anterior.
- Al montar se emite el estado inicial: score 0, vidas 3, nivel 1.
- Al perder la última vida, `lives` pasa a 0, se emite y después se llama a `onGameOver(score)`.
- `onGameOver` se dispara una sola vez, protegido por un flag `gameOver`.
- El botón FIN del shell no pasa por el juego: la play-page pone `lives` a 0 al abrir el modal.
- `puntos` es el número de puntos que ha ganado el jugador y es estado interno del juego. No se emite.

### Constantes y tipos

```ts
// components/games/duelo-pixel/constants.ts
export const WIDTH = 800;
export const HEIGHT = 600;
export const PADDLE_W = 14;
export const PADDLE_H = 90;
export const PADDLE_MARGIN = 30; // distancia de cada pala a su borde
export const BALL_SIZE = 14;
export const PLAYER_SPEED = 480; // px/s
export const START_LIVES = 3;
export const POINTS_PER_LEVEL = 3;
export const MAX_DIFFICULTY_LEVEL = 10;
export const BALL_BASE_SPEED = 360; // px/s en el nivel 1
export const BALL_LEVEL_STEP = 30; // px/s más por nivel
export const BALL_RALLY_STEP = 12; // px/s más por golpe dentro de un punto
export const BALL_MAX_SPEED = 660; // px/s
export const MAX_BOUNCE_ANGLE = 55; // grados
export const SERVE_DELAY = 800; // ms de pausa antes de sacar
export const SERVE_MAX_ANGLE = 25; // grados, al azar en cada saque
export const HIT_POINTS = 10;
export const WIN_POINT_BASE = 100; // × nivel
export const CPU_SPEED_BASE = 220; // px/s en el nivel 1
export const CPU_SPEED_STEP = 30; // px/s más por nivel
export const CPU_SPEED_MAX = 420; // px/s
export const CPU_ERROR_BASE = 60; // px, menos 5 por nivel
export const CPU_ERROR_MIN = 10; // px
export const CPU_RETARGET = 250; // ms entre recalculos del objetivo
export const MAX_STEP = 1 / 120; // s, paso máximo de física

// components/games/duelo-pixel/ai.ts
export function cpuSpeed(level: number): number;
export function cpuError(level: number): number;
export function ballSpeed(level: number, rally: number): number;
export function cpuTarget(
  ballY: number,
  ballMovingToCpu: boolean,
  level: number,
  rand: () => number,
): number;
```

Reglas y fórmulas (la dificultad usa `d = min(level, 10)`):

- Origen en la esquina superior izquierda. La pala del jugador está en `x = 30` y la de la CPU en `x = 800 − 30 − 14 = 756`. Ambas empiezan centradas en vertical.
- Velocidad de la pelota: `min(660, 360 + (d − 1) × 30 + golpes × 12)`, con `golpes` el número de golpes de pala dentro del punto actual. Se reinicia en cada saque.
- Rebote en la pala: `offset = (centroPelota − centroPala) / (PADDLE_H / 2)`, acotado a [−1, 1]. El ángulo de salida es `offset × 55°` respecto a la horizontal y la pelota invierte su `vx`. Rebota en las paredes superior e inferior invirtiendo `vy`.
- Saque: la pelota aparece en el centro, queda quieta 800 ms y sale con un ángulo al azar de ±25°. El primer saque va hacia la CPU y los siguientes hacia quien acaba de encajar el punto.
- Velocidad de la CPU: `min(420, 220 + (d − 1) × 30)` px/s. Llega al tope en el nivel 8.
- Objetivo de la CPU: cuando la pelota va hacia ella, apunta a `ballY + error`, con `error` aleatorio en ±`max(10, 60 − d × 5)` px, recalculado cada 250 ms. Cuando la pelota se aleja, vuelve al centro.
- Puntuación: +10 por cada golpe del jugador y +100 × `level` por cada punto ganado, usando el nivel vigente antes de recalcularlo.
- Nivel: `floor(puntos / 3) + 1`. El nivel que se muestra sigue subiendo, pero la dificultad no pasa del nivel 10.
- Máximo teórico de score: no hay tope, porque la partida solo termina al perder las tres vidas. En la práctica, la pelota llega a 660 px/s y la CPU a 420 px/s, así que la CPU falla y el score no se acerca a 10 000 000. El shell ya acota el score al insertarlo.
- La física avanza en pasos de 1/120 s como máximo. A 660 px/s la pelota recorre unos 5,5 px por paso, menos que el ancho de la pala (14 px).
- El color de pala, pelota y línea central es el amarillo neón de la plataforma (`var(--yellow)`, resuelto en el paso de diseño).

### `scores`

No cambia. Se inserta `{ game_id: 'duelo-pixel', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulos de constantes y de IA.** Crear `components/games/duelo-pixel/constants.ts` con las constantes del data model y `components/games/duelo-pixel/ai.ts` con `cpuSpeed`, `cpuError`, `ballSpeed` y `cpuTarget` como funciones puras. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Esqueleto de `DueloPixelGame` y play-page.** Crear `components/games/DueloPixelGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `SnakeGame`), un canvas 800×600 con escalado CSS y un dibujo estático de la pista: fondo, línea central discontinua, las dos palas centradas, la pelota en el centro y el marcador 0–0. Crear `app/games/duelo-pixel/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `lives` (inicial 3), `level`, `paused`, `over` y `gameKey`, `GamePlayShell` (con `paused || over` hacia el juego) y una línea de controles bajo el CRT. El encaje del canvas en `.crt-screen` y el aspecto de la pista se diseñan con `/frontend-design`.
   Verificación: `/games/duelo-pixel/play` carga sin errores de consola y el canvas llena la pantalla CRT sin desbordar.

3. **Loop, pala del jugador y pelota.** Implementar el loop: sigue dibujando con `paused`, actualiza `lastTime` en cada frame, acota `dt` a 100 ms y divide la física en pasos de 1/120 s como máximo. Implementar el movimiento de la pala con `keydown`/`keyup` en `window` para `↑`/`↓` y `W`/`S`, con `preventDefault` solo en las flechas, y el mapa `keys` se vacía al pausar y reanudar. Implementar la pelota, sus rebotes en las paredes y en la pala del jugador según el ángulo del data model, y el saque con 800 ms de espera. Cleanup completo en el `return` del efecto.
   Verificación: la pelota sale tras el saque, rebota en paredes y en la pala del jugador con ángulo según el punto de impacto, PAUSA congela el juego y la página no hace scroll con las flechas.

4. **CPU.** Implementar la pala de la CPU con `cpuTarget`, `cpuSpeed` y el recálculo cada 250 ms, y el rebote de la pelota en ella.
   Verificación: la CPU devuelve la pelota en el nivel 1 con fallos ocasionales y vuelve al centro cuando la pelota se aleja.

5. **Puntos, vidas y niveles.** Implementar el punto del jugador (la pelota pasa la pala de la CPU) y el de la CPU (pasa la del jugador), el saque posterior, los +10 por golpe y los +100 × nivel por punto, la resta de vidas, el cálculo del nivel y la velocidad de la pelota por nivel y por golpe. Dibujar el marcador TÚ–CPU en el canvas.
   Verificación: golpear suma 10, ganar un punto suma 100 × nivel, cada tres puntos sube el nivel y la pelota se acelera, y cada punto de la CPU resta una vida.

6. **Capturar el HUD y el fin de partida.** Emitir `score`, `lives` y `level` por los callbacks (solo al cambiar, con el estado inicial al montar) y llamar a `onGameOver(score)` una sola vez al llegar a 0 vidas, con `lives` ya en 0. En la play-page, conectar los callbacks y hacer que FIN ponga `lives` a 0 y abra el modal.
   Verificación: el HUD React refleja puntuación, vidas y nivel en tiempo real, y al perder la tercera vida aparece el modal de game over con la puntuación final.

7. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games` con `cover-duelo`, `/games/duelo-pixel` carga con datos reales y el tab DUELO PIXEL aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Duelo Pixel aparece en `/games` con `cover-duelo` y `/games/duelo-pixel` carga con datos reales.
- [ ] El tab DUELO PIXEL aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/duelo-pixel/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] La pala del jugador está a la izquierda, la de la CPU a la derecha, y ambas empiezan centradas en vertical.
- [ ] `↑`/`↓` y `W`/`S` mueven la pala del jugador y no la sacan del canvas.
- [ ] Pulsar `↑` o `↓` no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] Al empezar, el HUD React muestra puntuación 0, tres `♥` en Vidas y nivel 01.
- [ ] El HUD del canvas muestra el marcador TÚ–CPU y una línea central, sin duplicar el score.
- [ ] La pelota rebota en las paredes superior e inferior.
- [ ] La pelota sale de la pala con un ángulo mayor cuanto más lejos del centro de la pala impacta, hasta 55°.
- [ ] Tras cada punto, la pelota vuelve al centro, espera unos 800 ms y sale hacia quien encajó el punto. El primer saque va hacia la CPU.
- [ ] Cada golpe del jugador suma exactamente 10 puntos.
- [ ] Ganar un punto suma exactamente 100 × nivel puntos.
- [ ] Cada tres puntos ganados el nivel sube en uno y la pelota se acelera.
- [ ] La velocidad de la pelota nunca supera 660 px/s y la de la CPU nunca supera 420 px/s.
- [ ] La pelota no atraviesa las palas a la velocidad máxima.
- [ ] Cada punto de la CPU resta una vida.
- [ ] Al perder la tercera vida, Vidas pasa a `—` y aparece el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Vidas en `—` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay, menú ni mensaje de inicio dibujado por el juego.
- [ ] PAUSA congela la pelota, las palas y el temporizador del saque; REANUDAR continúa sin saltos.
- [ ] Una tecla pulsada durante la pausa no deja la pala moviéndose al reanudar.
- [ ] Con el modal abierto, las teclas no mueven la pala.
- [ ] "JUGAR DE NUEVO" reinicia score (a 0), vidas (a 3), nivel (a 1), marcador, palas y pelota.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'duelo-pixel'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/duelo-pixel` y en el tab DUELO PIXEL de `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play` y `/games/snake/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: no extraer el shell.** Razón: `GamePlayShell` ya existe desde SPEC 07 y cubre HUD, pausa, modal y guardado.
- **Sí: diseñar el juego desde cero.** Razón: no hay referencia en `references/started-games/`, así que reglas, números y controles se fijan en este spec.
- **Sí: Pong de un jugador contra la CPU, con `cat = 'VERSUS'`.** Razón: es la forma más simple de duelo que cabe en el contrato (un canvas, teclado, score). Descartado el 2 jugadores en un teclado, porque no produce un score competitivo para el leaderboard.
- **Sí: tres vidas y partida sin fin natural.** Razón: da un fin claro y un score que crece con la habilidad. Descartado el "primero a 7", porque el score máximo quedaría acotado y casi todos los jugadores empatarían.
- **Sí: el score premia los golpes (+10) y los puntos (+100 × nivel).** Razón: separa el juego largo del juego arriesgado y hace que subir de nivel valga más. Descartado puntuar solo los puntos ganados, porque una partida sin puntos sumaría 0.
- **Sí: dificultad con tope en el nivel 10.** Razón: la CPU llega a 420 px/s y la pelota a 660 px/s con desvío de hasta 55°, lo que da una componente vertical de unos 540 px/s. Ese margen deja siempre a la CPU batible y evita una CPU perfecta.
- **Sí: la CPU con error de puntería y velocidad limitada.** Razón: una CPU que sigue la pelota sin error sería imbatible y el juego no terminaría nunca a favor del jugador.
- **Sí: saque hacia quien encajó el punto, con 800 ms de espera.** Razón: da tiempo para reaccionar y evita saques con ventaja para quien acaba de ganar.
- **Sí: física en pasos de 1/120 s como máximo.** Razón: a 660 px/s un paso de 100 ms movería la pelota 66 px y atravesaría una pala de 14 px.
- **Sí: `←`/`→` no se usan.** Razón: las palas se mueven en vertical, así que `↑`/`↓` y `W`/`S` bastan.
- **Sí: `preventDefault` solo en `↑` y `↓`.** Razón: son las únicas teclas del juego que provocan scroll.
- **Sí: pausa solo de la plataforma, sin `P`/`Esc`.** Razón: enrutarlas obligaría a ampliar el contrato del shell con un callback nuevo.
- **Sí: vaciar el mapa `keys` al pausar y reanudar.** Razón: una tecla soltada durante la pausa dejaría la pala atascada.
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: al reanudar o volver de otra pestaña no deben soltarse varios pasos de golpe.
- **Sí: conservar el marcador TÚ–CPU dibujado en el canvas, además del HUD React.** Razón: es la identidad visual de Pong. El marcador muestra puntos, no score, así que no duplica el HUD React.
- **Sí: sin overlays ni estado de "pulsa una tecla para empezar".** Razón: la plataforma ya tiene su UI. El saque con espera de 800 ms cubre el arranque.
- **Sí: sin assets ni audio.** Razón: todo se dibuja con rectángulos y no hay referencia con sonidos.
- **Sí: reutilizar `cover-duelo`, `yellow` y `VERSUS`.** Razón: la clase ya existe en `globals.css`, `yellow` y `VERSUS` ya son válidos en el CHECK y ningún juego los usa. Si la cover no encaja en la card, se rediseña con `/frontend-design` en un spec aparte.
- **Sí: `id = 'duelo-pixel'` y `sort_order = 11`.** Razón: el id es único en `games` y 11 es el siguiente libre tras Asteroids (7), Tetris (8), Arkanoid (9) y Snake (10).
- **Sí: sin lógica de límite de score en el juego.** Razón: el shell ya acota a 10 000 000 y alcanzarlo no es realista.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado y manda el schema leído con `list_tables`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en todos los juegos.
- **Sí: la fila de `games` va en el último paso.** Razón: el juego no debe aparecer en `/games` antes de ser jugable.
- **Sí: verificar la IA con un nivel inicial elevado temporalmente en desarrollo.** Razón: llegar al nivel 10 a mano es lento. Esa verificación no cambia el código entregado.
- **No: partir en más specs de integración.** Razón: un solo canvas, ningún asset y lógica propia sencilla. Las skins van en un spec aparte porque son opcionales.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «duelo», sin revisión del usuario sección por sección; se revisa directamente en este archivo. Los números de velocidad, vidas y puntuación son decisiones de diseño tomadas por el agente y son lo primero que conviene revisar.

---

## Risks

| Riesgo                                                           | Mitigación                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| La pelota atraviesa una pala a velocidad alta                    | Física en pasos de 1/120 s como máximo y `dt` acotado a 100 ms.                                            |
| La CPU resulta imbatible o demasiado fácil                       | Velocidad máxima de 420 px/s, error de puntería mínimo de 10 px y ajuste de constantes en un único módulo. |
| La partida no termina nunca si el jugador es muy bueno           | Aceptado: es una partida de resistencia. El score crece con el nivel y el shell acota a 10 000 000.        |
| Tecla "atascada" al pausar con `↑`/`↓` pulsada                   | Vaciar el mapa `keys` al pausar y reanudar.                                                                |
| El temporizador del saque corre durante la pausa                 | El temporizador avanza con el `dt` del juego, que no avanza mientras `paused`.                             |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños | Escalado CSS resuelto en el paso 2 con `/frontend-design`, verificado con el criterio de ajuste.           |
| Listeners duplicados al reiniciar                                | Cleanup completo en el efecto y reinicio por `key`.                                                        |
| Dos `onGameOver` seguidos (fin natural y botón FIN)              | El juego lo dispara una sola vez y el shell congela el juego al abrir el modal.                            |
| Cualquier cliente puede insertar scores (RLS abierto)            | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                       |

---

## What is **not** in this spec

- Skins de la pista (van en SPEC GJ-duelo-pixel-02).
- Segundo jugador humano y control con ratón.
- Teclas `P`/`Esc` de pausa, overlays y menú de inicio.
- Power-ups, obstáculos y modos de dificultad seleccionables.
- Audio y música.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame` y `GamePlayShell`.

Cada uno de esos puntos, si llega, va en su propio spec.
