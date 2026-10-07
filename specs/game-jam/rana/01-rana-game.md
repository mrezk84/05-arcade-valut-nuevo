# SPEC GJ-rana-01 — Integración del juego Rana

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07 · **Fecha:** 2026-10-07
> **Objetivo:** Integrar Rana, un Frogger de una pantalla, como juego jugable en `/games/rana/play`, con HUD de puntuación, vidas, nivel y tiempo, y guardado del score en el leaderboard de Supabase.

---

## Por qué existe este spec

El tema del game-jam es «Cruza la carretera y el río sin convertirte en papilla». Rana es la respuesta directa: una rana que cruza seis carriles de tráfico y cinco de río hasta llenar cinco nidos.

RANA ya figuraba como candidato pendiente en `references/game-suggestiones-todo.md`, y `cover-rana` ya existe en `app/globals.css`. No hay referencia en `references/started-games/`, así que el juego se diseña desde cero, sin assets: todo se dibuja con formas y colores neón en el canvas.

---

## Scope

**In:**

- Componente `components/games/RanaGame.tsx`, diseñado desde cero, con canvas 800×600 y una cuadrícula de 20×15 celdas de 40 px.
- Módulos `components/games/rana/constants.ts` (cuadrícula, tiempos, puntuación y ritmo de niveles), `components/games/rana/lanes.ts` (definición de los 11 carriles) y `components/games/rana/draw.ts` (dibujo del tablero, objetos, rana y nidos).
- Play-page `app/games/rana/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Zonas del tablero, de arriba abajo: barra de tiempo (fila 0), nidos (fila 1), río (filas 2–6), mediana segura (fila 7), carretera (filas 8–13) y acera de salida (fila 14).
- Seis carriles de carretera con coches, bulldozers, camiones y un bólido, y cinco carriles de río con troncos y grupos de tortugas, algunas de las cuales se sumergen.
- Saltos de una celda por pulsación con `←↑→↓` y `WASD`, con `preventDefault` solo en las flechas.
- Tres vidas, 30 s por intento y cinco nidos por nivel. Al llenar los cinco nidos sube el nivel y todo se acelera.
- Animación de muerte de 900 ms ("papilla" en la carretera, ondas en el río) y reaparición en la acera.
- El HUD de la plataforma refleja `score`, `lives`, `level` y `time`.
- Fila `rana` en la tabla `games`, con `cat = 'ARCADE'`, `color = 'yellow'`, `cover = 'cover-rana'` (reutilizada) y `sort_order = 12`.

**Fuera de alcance (para specs futuros):**

- Mosca bonus, cocodrilos en los nidos y serpiente en la mediana: van en SPEC GJ-rana-02.
- Audio y música.
- Vidas extra por puntuación.
- Modo versus o dos ranas a la vez.
- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlays, menú de inicio y estado de "pulsa una tecla para empezar".
- HUD dibujado en el canvas (puntuación o vidas). Solo se dibuja la barra de tiempo.
- Distinguir victoria de derrota en el modal del shell (el juego no tiene victoria).
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- Cambios en `GamePlayShell` y en las play-pages de Asteroids, Tetris, Arkanoid y Snake.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'rana', 'RANA', 'Cruza la carretera y el río sin acabar en papilla.',
  'Lleva cinco ranas hasta sus nidos al otro lado de la pantalla. Esquiva coches y camiones en la carretera, salta sobre troncos y tortugas en el río y no te quedes sin tiempo. Cada ronda completa sube el nivel y todo se mueve más rápido.',
  'ARCADE', 'cover-rana', 'yellow', 12
);
```

`cat = 'ARCADE'` y `color = 'yellow'` ya son valores válidos del CHECK real. No hay migración de schema.

### Props del componente

```ts
interface RanaGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onTimeChange: (seconds: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

| Estado del juego                                       | Callback                 |
| ------------------------------------------------------ | ------------------------ |
| `score`                                                | `onScoreChange(score)`   |
| `lives` (3 al iniciar, −1 por muerte)                  | `onLivesChange(lives)`   |
| `level` (1 al iniciar, +1 al llenar los 5 nidos)       | `onLevelChange(level)`   |
| `ceil(timeLeftMs / 1000)` (30 al iniciar cada intento) | `onTimeChange(seconds)`  |
| Muerte con `lives` en 0                                | `onGameOver(finalScore)` |

Reglas de emisión:

- Cada callback solo se dispara cuando el valor cambia respecto al anterior.
- Al montar se emite el estado inicial: score 0, vidas 3, nivel 1, tiempo 30.
- `onTimeChange` se dispara como mucho una vez por segundo de juego, y vuelve a 30 al reaparecer o al llegar a un nido.
- Al perder la última vida, `lives` pasa a 0, se emite y después se llama a `onGameOver(score)`, sin esperar a la animación de muerte.
- `onGameOver` se dispara una sola vez, protegido por un flag `gameOver`.
- El botón FIN del shell no pasa por el juego: la play-page pone `lives` a 0 y abre el modal con `setOver(true)`.

### Constantes y tipos

```ts
// components/games/rana/constants.ts
export const COLS = 20;
export const ROWS = 15;
export const CELL = 40; // canvas 800×600
export const TIMER_ROW = 0;
export const NEST_ROW = 1;
export const MEDIAN_ROW = 7;
export const START_ROW = 14;
export const START_COL = 9;
export const NEST_COLS = [1, 5, 9, 13, 17]; // cada nido ocupa 2 celdas
export const START_LIVES = 3;
export const TIME_LIMIT_MS = 30_000;
export const HOP_COOLDOWN_MS = 100;
export const DEATH_MS = 900;
export const POINTS_HOP = 10;
export const POINTS_NEST = 50;
export const POINTS_PER_SECOND = 10;
export const POINTS_LEVEL = 1000;
export const SPEED_STEP = 0.15; // multiplicador extra por nivel
export const SPEED_MAX = 2;
export const LANE_MIN_X = -240; // borde izquierdo del bucle de carril
export const LANE_LOOP = 1040; // 800 visibles + 240 de margen
export const DIVE_CYCLE_MS = 6000;
export const DIVE_SINK_AT = 4000; // empieza a hundirse (sigue siendo segura)
export const DIVE_UNDER_AT = 5000; // sumergida (ya no es plataforma)
export const FROG_INSET = 8; // hitbox de la rana: 24×24 centrada
export const VEHICLE_INSET = 4;
export const MAX_DT = 100; // ms

// components/games/rana/lanes.ts
export type LaneKind = 'car' | 'dozer' | 'truck' | 'racer' | 'log' | 'turtles';
export interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1; // 1 = derecha, -1 = izquierda
  speed: number; // px/s a nivel 1
  length: number; // en celdas
  count: number; // objetos por carril, repartidos a LANE_LOOP / count
  offset: number; // px, desfase inicial del carril
  color: string;
}
export const LANES: Lane[]; // 11 carriles, tabla siguiente
```

### Carriles

| Fila | Zona      | `kind`    | `dir` | `speed` (px/s) | `length` | `count` |
| ---- | --------- | --------- | ----- | -------------- | -------- | ------- |
| 13   | Carretera | `car`     | −1    | 60             | 1        | 3       |
| 12   | Carretera | `dozer`   | 1     | 45             | 1        | 3       |
| 11   | Carretera | `car`     | −1    | 80             | 1        | 4       |
| 10   | Carretera | `car`     | 1     | 100            | 1        | 2       |
| 9    | Carretera | `truck`   | −1    | 65             | 2        | 3       |
| 8    | Carretera | `racer`   | 1     | 150            | 1        | 1       |
| 6    | Río       | `turtles` | −1    | 55             | 3        | 4       |
| 5    | Río       | `log`     | 1     | 45             | 3        | 3       |
| 4    | Río       | `log`     | 1     | 85             | 6        | 2       |
| 3    | Río       | `turtles` | −1    | 65             | 2        | 4       |
| 2    | Río       | `log`     | 1     | 65             | 4        | 3       |

Los valores de `offset` y `color` se fijan en el paso 1 y se afinan con `/frontend-design` en el paso 2. No cambian ni la tabla de velocidades ni las longitudes.

### Reglas

Convenciones:

- Origen en la esquina superior izquierda. La rana tiene `x` continua en píxeles (borde izquierdo) y `row` entera de 0 a 14.
- Posición inicial y de reaparición: `x = START_COL × CELL` (360) y `row = START_ROW` (14).
- Todo lo que se mueve usa el tiempo de juego, que no avanza en pausa ni con el modal abierto.

Movimiento de los carriles:

- Cada objeto guarda su `x` y avanza `dir × speed × mult × dt / 1000` píxeles por frame.
- El multiplicador de velocidad es `mult = min(SPEED_MAX, 1 + SPEED_STEP × (level − 1))`, y llega al máximo en el nivel 8.
- La `x` se mantiene en el bucle `[LANE_MIN_X, LANE_MIN_X + LANE_LOOP)`, así que un objeto de hasta 6 celdas sale y entra siempre fuera de la vista.
- Las posiciones iniciales del objeto `i` son `LANE_MIN_X + offset + i × LANE_LOOP / count`.
- En cada carril de tortugas se sumerge el grupo 0 en los niveles 1 y 2, y los grupos 0 y 2 desde el nivel 3. Cada grupo que se sumerge sigue un ciclo de `DIVE_CYCLE_MS`: a flote de 0 a 4 000 ms, hundiéndose de 4 000 a 5 000 ms (sigue siendo plataforma) y sumergido de 5 000 a 6 000 ms (ya no es plataforma).

Saltos:

- Cada pulsación de `←↑→↓` o `WASD` da un salto de una celda. Se ignoran `e.repeat` y las pulsaciones dentro de `HOP_COOLDOWN_MS` desde el último salto.
- Un salto horizontal mueve `x` ±40 px. Se ignora si el centro de la rana quedaría fuera de `[20, 780]`.
- Un salto vertical cambia `row` ±1. Se ignora por debajo de la fila 14 y por encima de la fila 1.
- Al aterrizar en una fila que no es de río, `x` se ajusta a la columna más cercana (`round(x / 40) × 40`).
- Mientras la rana está en una fila de río y sobre una plataforma, avanza con ella a la misma velocidad.

Muertes (cada una resta 1 vida):

- Atropello: la hitbox de la rana (24×24 centrada) se solapa con la de un vehículo (su rectángulo con 4 px de margen horizontal).
- Ahogo: la rana está en una fila de río y su centro no cae sobre un tronco ni sobre tortugas a flote o hundiéndose.
- Arrastre: el centro de la rana sale de `[0, 800]` mientras la lleva una plataforma.
- Nido inválido: la rana llega a la fila 1 con su centro fuera de un nido libre (seto u otro nido ocupado).
- Tiempo: `timeLeftMs` llega a 0.
- Tras una muerte, la rana muestra su animación durante `DEATH_MS`, los carriles siguen moviéndose, el teclado se ignora y el tiempo no corre. Después reaparece en la acera con 30 s.

Nidos, puntuación y niveles:

- El nido `k` ocupa las columnas `NEST_COLS[k]` y `NEST_COLS[k] + 1`. La rana entra si su centro cae en `[NEST_COLS[k] × 40, NEST_COLS[k] × 40 + 80)` y el nido está libre.
- +10 (`POINTS_HOP`) por cada salto hacia arriba a una fila más alta que la más alta alcanzada en ese intento. La fila de referencia se reinicia al reaparecer y al llegar a un nido.
- +50 (`POINTS_NEST`) por rana en un nido, más 10 × los segundos enteros que queden (`floor(timeLeftMs / 1000)`).
- Al llenar los cinco nidos: +1 000 (`POINTS_LEVEL`), sube el nivel, los nidos se vacían y la rana reaparece en la acera.
- No hay victoria: el juego sigue mientras queden vidas.
- Máximo por nivel: 5 × (130 + 50 + 280) + 1 000 = 3 300 puntos, contando 13 filas nuevas por rana y como mucho 28 s restantes. El nivel no tiene tope, así que el score no tiene máximo teórico.

### `scores`

No cambia. Se inserta `{ game_id: 'rana', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulos de constantes y carriles.** Crear `components/games/rana/constants.ts` con las constantes del data model y `components/games/rana/lanes.ts` con `LaneKind`, `Lane` y `LANES` según la tabla de carriles, con un `offset` y un `color` por carril. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Esqueleto de `RanaGame` y play-page.** Crear `components/games/RanaGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `components/games/SnakeGame.tsx`) y un canvas 800×600 con escalado CSS. Crear `components/games/rana/draw.ts` con el dibujo estático de las zonas (barra de tiempo, nidos y seto, río, mediana, carretera con marcas y acera), los objetos en su posición inicial y la rana en la acera. Crear `app/games/rana/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `lives` (inicial 3), `level`, `time` (inicial 30), `paused`, `over` y `gameKey`, `GamePlayShell` (con `paused || over` hacia el juego) y una línea de controles bajo el CRT (patrón de `app/games/snake/play/page.tsx`). El aspecto del tablero, los vehículos, los troncos, las tortugas y la rana se diseña con `/frontend-design`.
   Verificación: `/games/rana/play` carga sin errores de consola, el canvas llena la pantalla CRT sin desbordar y se ven las seis zonas.

3. **Loop y movimiento de los carriles.** Implementar el loop con `requestAnimationFrame`: sigue dibujando con `paused`, actualiza `lastTime` en cada frame, acota `dt` a `MAX_DT` y solo avanza el tiempo de juego fuera de pausa. Mover cada objeto con el multiplicador del nivel, mantenerlo en el bucle del carril e implementar el ciclo de inmersión de las tortugas, con el grupo hundiéndose dibujado translúcido y el sumergido invisible. Cleanup completo en el `return` del efecto.
   Verificación: los carriles se mueven en sus direcciones y velocidades, los objetos entran y salen fuera de la vista, las tortugas del grupo 0 se sumergen cada 6 s y PAUSA congela todo.

4. **Saltos de la rana y teclado.** Añadir `keydown` en `window` para `←↑→↓` y `WASD`, con `preventDefault` solo en las flechas, sin `P`/`Esc` y sin efecto si el juego está en pausa o en game over. Implementar los saltos con el cooldown, los límites, el ajuste a la columna fuera del río y el arrastre sobre las plataformas.
   Verificación: la rana salta una celda por pulsación, no sale del tablero, viaja sobre troncos y tortugas, la página no hace scroll con las flechas y mantener una tecla pulsada no repite saltos.

5. **Muertes, tiempo y reaparición.** Implementar las cinco causas de muerte, la cuenta atrás de 30 s con su barra en la fila 0, la animación de muerte de `DEATH_MS` (mancha de "papilla" en la carretera y ondas en el río) y la reaparición en la acera. Restar una vida por muerte.
   Verificación: chocar con un vehículo, caer al agua, salir arrastrado por un borde, saltar al seto y agotar el tiempo matan a la rana, que reaparece en la acera con 30 s.

6. **Nidos, puntuación y niveles.** Implementar la entrada en los nidos, el dibujo de las ranas ya colocadas, los puntos por fila nueva, por nido, por tiempo restante y por nivel, el avance de nivel con el vaciado de nidos y el cambio de grupos de tortugas que se sumergen desde el nivel 3.
   Verificación: llegar a un nido suma los puntos esperados y deja una rana dibujada en él, y llenar los cinco sube el nivel y acelera los carriles.

7. **Capturar el HUD y el fin de partida.** Emitir `score`, `lives`, `level` y `time` por los callbacks (solo al cambiar, con el estado inicial al montar) y llamar a `onGameOver(score)` una sola vez al perder la tercera vida, con `lives` en 0. En la play-page, conectar los callbacks, mostrar Vidas con `♥` por vida y `—` en 0, Nivel y Tiempo con dos dígitos, y hacer que FIN ponga `lives` a 0 y abra el modal.
   Verificación: el HUD React refleja puntuación, vidas, nivel y tiempo en tiempo real, y al perder la última vida aparece el modal de game over con la puntuación final.

8. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games` con `cover-rana`, `/games/rana` carga con datos reales y el tab RANA aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Rana aparece en `/games` con `cover-rana` y `/games/rana` carga con datos reales.
- [ ] El tab RANA aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/rana/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] El tablero muestra, de arriba abajo, la barra de tiempo, cinco nidos, cinco carriles de río, la mediana, seis carriles de carretera y la acera.
- [ ] Al empezar, la rana está en la acera, en la columna 9.
- [ ] Al empezar, el HUD React muestra puntuación 0, tres `♥` en Vidas, nivel 01 y tiempo 30.
- [ ] Cada pulsación de `←↑→↓` o `WASD` mueve la rana exactamente una celda.
- [ ] Mantener una tecla pulsada no repite el salto.
- [ ] Pulsar las flechas no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] La rana no puede salir del tablero saltando ni bajar de la acera.
- [ ] Sobre un tronco o unas tortugas, la rana avanza con ellos.
- [ ] Los objetos de cada carril aparecen y desaparecen fuera de la vista, sin saltos visibles.
- [ ] Tocar un vehículo resta una vida y muestra la animación de "papilla".
- [ ] Caer al agua fuera de un tronco o unas tortugas resta una vida y muestra las ondas.
- [ ] Unas tortugas sumergidas no sostienen a la rana, y unas tortugas que se están hundiendo sí.
- [ ] Salir por un borde del canvas arrastrada por una plataforma resta una vida.
- [ ] Saltar al seto o a un nido ocupado resta una vida.
- [ ] Al llegar el tiempo a 0, la rana pierde una vida y el tiempo vuelve a 30 al reaparecer.
- [ ] Tras una muerte, la rana reaparece en la acera a los 900 ms y el teclado no la mueve durante la animación.
- [ ] Avanzar a una fila nueva suma 10 puntos, y volver a pisar una fila ya alcanzada en el mismo intento no suma.
- [ ] Entrar en un nido libre con 20 s restantes suma 10 (fila nueva) + 50 + 200 puntos.
- [ ] Una rana colocada en un nido queda dibujada en él hasta el cambio de nivel.
- [ ] Llenar los cinco nidos suma 1 000 puntos, sube el nivel, vacía los nidos y acelera los carriles un 15 %.
- [ ] Desde el nivel 3 se sumergen dos grupos de tortugas por carril de tortugas.
- [ ] La velocidad de los carriles deja de subir a partir del nivel 8.
- [ ] El HUD React muestra puntuación, vidas, nivel y tiempo, y coinciden con los del juego.
- [ ] Al perder la tercera vida, Vidas pasa a `—` y aparece el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Vidas en `—` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay, menú ni mensaje de inicio dibujado por el juego.
- [ ] PAUSA congela carriles, rana, tiempo e inmersión de tortugas; REANUDAR continúa sin saltos.
- [ ] Con el modal abierto, las teclas no mueven la rana y el tiempo no corre.
- [ ] "JUGAR DE NUEVO" reinicia score (a 0), vidas (a 3), nivel (a 1), tiempo (a 30), nidos y carriles.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'rana'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/rana` y en el tab RANA de `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play` y `/games/snake/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: Frogger como respuesta al tema.** Razón: «cruzar la carretera y el río sin convertirse en papilla» es literalmente su mecánica. RANA ya era candidato pendiente en `references/game-suggestiones-todo.md`.
- **Sí: `cat = 'ARCADE'`.** Razón: es un juego de reflejos de un jugador. Descartado `VERSUS`, aunque es el hueco del catálogo, porque exigiría una segunda rana o una CPU rival que el tema no pide. Queda en "Fuera de alcance".
- **Sí: `color = 'yellow'`.** Razón: ningún juego de la base usa `yellow` y el CHECK ya lo admite. El spec en borrador de Duelo Pixel también propone `yellow`; si ambos se implementan, solo cambia el acento de dos cards.
- **No: `color = 'green'`.** Razón: es el color natural de una rana, pero Snake ya lo usa y no cubre ningún hueco.
- **Sí: reutilizar `cover-rana`.** Razón: ya existe en `globals.css` y representa carriles y una rana verde. Si no encaja en la card, se rediseña con `/frontend-design` en un spec aparte.
- **Sí: `id = 'rana'` y `sort_order = 12`.** Razón: el id está libre en `games`. El 11 es el siguiente libre en la base, pero lo reserva el spec en borrador de Duelo Pixel, y usar 12 evita un empate si ambos se implementan.
- **Sí: diseñar desde cero y sin assets.** Razón: no hay referencia en `references/started-games/`, y las formas neón dibujadas en canvas encajan con la plataforma y evitan cargas asíncronas.
- **Sí: cuadrícula de 20×15 con celdas de 40 px (canvas 800×600).** Razón: la proporción 4:3 encaja con `.crt-screen`, como Arkanoid y Snake, y las 15 filas dan justo una barra de tiempo, nidos, 5 de río, mediana, 6 de carretera y acera.
- **Sí: saltos discretos de una celda y `x` continua.** Razón: el salto por casillas es la regla clásica, y la `x` continua es necesaria para que troncos y tortugas arrastren a la rana.
- **Sí: ajustar `x` a la columna al aterrizar fuera del río.** Razón: tras bajar de un tronco, la rana quedaría desalineada con los carriles y los nidos.
- **Sí: ignorar `e.repeat` y un cooldown de 100 ms, sin cola de entrada.** Razón: una pulsación es un salto, y una cola haría saltar a la rana tras soltar la tecla, que en Frogger mata. Descartada la cola de Snake.
- **Sí: bucle de carril de 1 040 px con borde en −240.** Razón: el objeto más largo mide 240 px, así que con ese margen todos entran y salen fuera de la vista sin aparecer de golpe.
- **Sí: posición integrada por frame, no calculada desde el tiempo.** Razón: al subir de nivel cambia la velocidad, y una posición calculada como `velocidad × tiempo` haría saltar a todos los objetos.
- **Sí: tortugas que se sumergen con un aviso de 1 s.** Razón: es el peligro propio del río, y el aviso lo hace justo. Desde el nivel 3 se sumergen dos grupos para añadir dificultad sin carriles nuevos.
- **Sí: tres vidas y 30 s por intento.** Razón: es la regla clásica y da partidas de pocos minutos para un leaderboard.
- **Sí: puntuación clásica (10 por fila nueva, 50 por nido, 10 por segundo restante y 1 000 por nivel).** Razón: premia avanzar, llegar y hacerlo rápido, y repetir filas no da puntos.
- **Sí: acelerar un 15 % por nivel con tope ×2 en el nivel 8.** Razón: da progresión sin un nivel imposible, igual que el tope de tick de Snake.
- **Sí: sin victoria y sin máximo de nivel.** Razón: el juego es infinito como el original. Llegar a 10 000 000 exigiría unos 3 000 niveles, así que no se acota el score en el juego y el shell lo acota antes de insertar.
- **No: vidas extra por puntuación.** Razón: complica el balance del leaderboard y no la pide el tema.
- **Sí: el HUD refleja `score`, `lives`, `level` y `time`.** Razón: el tiempo es la presión propia del juego. Se emite como mucho una vez por segundo, así que no recarga React.
- **Sí: el canvas solo dibuja la barra de tiempo como HUD.** Razón: puntuación, vidas y nivel ya están en el HUD React. La barra se mantiene porque se lee de reojo mientras se juega.
- **Sí: `onGameOver` al morir la última vez, sin esperar a la animación.** Razón: el shell congela el juego al abrir el modal, y esperar 900 ms dejaría una ventana en la que FIN podría duplicar el fin.
- **Sí: animación de muerte con el teclado bloqueado y los carriles en marcha.** Razón: se ve qué pasó ("papilla" o agua) y el mundo no se congela de forma artificial.
- **Sí: pausa solo de la plataforma, sin `P`/`Esc`.** Razón: enrutarlas obligaría a ampliar el contrato del shell con un callback nuevo.
- **Sí: FIN pone `lives` a 0 desde la play-page.** Razón: el botón no pasa por el juego y el HUD quedaría con vidas detrás del modal, como en Tetris y Arkanoid.
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: al reanudar o volver de otra pestaña, los objetos no deben teletransportarse a través de la rana.
- **Sí: sin audio.** Razón: no hay assets y el audio sintetizado merece su propio spec.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado y manda el schema leído con `list_tables`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en todas las play-pages.
- **Sí: la fila de `games` va en el último paso.** Razón: el juego no debe aparecer en `/games` antes de ser jugable.
- **No: partir este spec en dos.** Razón: un solo canvas, sin assets y con lógica propia acotada. Los peligros extra ya van en SPEC GJ-rana-02.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «Cruza la carretera y el río sin convertirte en papilla» (estilo Frogger), sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                               | Mitigación                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Las velocidades de la tabla hacen el juego demasiado fácil o difícil | Todas viven en `lanes.ts` y `constants.ts`, y se ajustan en el paso 3 sin tocar la lógica.                   |
| Los objetos aparecen de golpe dentro de la vista                     | Bucle de 1 040 px con borde en −240, mayor que el objeto más largo. Criterio de aceptación específico.       |
| La rana desalineada tras bajar de un tronco no cabe en un nido       | Ajuste a la columna al aterrizar fuera del río y nidos de 2 celdas de ancho.                                 |
| Muerte injusta al pisar tortugas justo cuando se sumergen            | Fase de hundimiento de 1 s que sigue siendo plataforma y se dibuja translúcida.                              |
| Los objetos saltan al reanudar o al volver de otra pestaña           | `dt` acotado a 100 ms, `lastTime` actualizado en cada frame y tiempo de juego que no avanza en pausa.        |
| `onTimeChange` provoca un render por frame                           | Se emite solo al cambiar el segundo entero.                                                                  |
| Dos `onGameOver` seguidos (última muerte y botón FIN)                | El juego lo dispara una sola vez, sin esperar a la animación, y el shell congela el juego al abrir el modal. |
| Score por encima de 10 000 000 en partidas imposiblemente largas     | El shell acota a 10 000 000 antes de insertar.                                                               |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños     | Escalado CSS resuelto en el paso 2 con `/frontend-design`, verificado con el criterio de ajuste.             |
| Listeners duplicados al reiniciar                                    | Cleanup completo en el efecto y reinicio por `key`.                                                          |
| Cualquier cliente puede insertar scores (RLS abierto)                | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                         |

---

## What is **not** in this spec

- Mosca bonus, cocodrilos en los nidos y serpiente en la mediana (SPEC GJ-rana-02).
- Audio y música.
- Vidas extra por puntuación.
- Modo versus o dos ranas a la vez.
- Teclas `P`/`Esc` de pausa, overlays y menú de inicio.
- HUD de puntuación o vidas dibujado en el canvas.
- Distinguir victoria de derrota en el modal.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame` y `GamePlayShell`.

Cada uno de esos puntos, si llega, va en su propio spec.
