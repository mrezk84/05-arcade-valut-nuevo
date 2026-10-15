# SPEC GJ-ciempies-01 — Integración del juego Ciempiés

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07 · **Fecha:** 2026-10-15
> **Objetivo:** Integrar Ciempiés (Centipede en una pantalla con campo de setas) como juego jugable en `/games/ciempies/play`, con HUD de puntuación, vidas y oleada, y guardado del score en el leaderboard de Supabase.

---

## Scope

**In:**

- Componente `components/games/CiempiesGame.tsx`, diseñado desde cero (no hay referencia en `references/started-games/`), con canvas 800×600 y una cuadrícula de 32×24 celdas de 25 px.
- Módulos en `components/games/ciempies/`: `constants.ts` (cuadrícula, velocidades y puntuación), `field.ts` (campo de setas), `centipede.ts` (oleadas, movimiento y partición del ciempiés) y `draw.ts` (dibujo con primitivas canvas).
- Play-page `app/games/ciempies/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Campo de 40 setas al azar en las filas 1–18 al empezar. Cada seta aguanta 4 disparos y da 1 punto al destruirla.
- Ciempiés que avanza por pasos de una celda, gira y baja al chocar con una seta o un borde, y al llegar abajo oscila dentro de la zona del jugador.
- Nave del jugador con movimiento libre en la zona del jugador (filas 19–23) a 300 px/s. Las setas la bloquean.
- Un solo disparo en pantalla a la vez, a 900 px/s, con disparo automático manteniendo `Espacio`.
- Cada segmento abatido se convierte en seta y parte el ciempiés en dos. Cabeza: 100 puntos. Cuerpo: 10 puntos.
- Oleadas: limpiar todos los segmentos inicia la siguiente, más rápida y con más cabezas sueltas.
- 3 vidas, vida extra cada 12 000 puntos (máximo 6), y una pausa de reaparición de 1 000 ms tras cada muerte.
- Controles `←↑→↓` y `WASD` para mover y `Espacio` para disparar, con `preventDefault` solo en las flechas y en `Espacio`.
- El HUD de la plataforma refleja `score`, `lives` y `wave`. Sin HUD dibujado en el canvas.
- Clase `.cover-ciempies` nueva en `app/globals.css`, diseñada con `/frontend-design`.
- Fila `ciempies` en la tabla `games`, con `cat = 'SHOOTER'`, `color = 'green'`, `cover = 'cover-ciempies'` y `sort_order = 12`.

**Fuera de alcance (para specs futuros):**

- Araña, pulga, escorpión y setas envenenadas (los cubre SPEC GJ-ciempies-02).
- Cabezas nuevas que entran por los lados cuando el ciempiés llega a la zona del jugador.
- Puntos por restaurar setas dañadas al morir.
- Audio y música.
- Skins (las añade `skin-designer` en una invocación aparte).
- Controles táctiles o mobile (los añade `mobile-porter` siguiendo SPEC 10).
- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlays, menú de inicio, HUD dibujado en el canvas y pantallas de "oleada superada".
- Selector de oleada inicial o de dificultad.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame`, `GamePlayShell` y las play-pages de otros juegos.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'ciempies', 'CIEMPIÉS', 'Dispara al ciempiés antes de que baje.',
  'Un ciempiés baja zigzagueando por un campo de setas. Muévete por la franja inferior con las flechas o WASD y dispara con Espacio. Cada segmento abatido se convierte en seta y parte al bicho en dos. Las cabezas valen 100 puntos y los segmentos 10. Limpia la oleada y llegará otra más rápida.',
  'SHOOTER', 'cover-ciempies', 'green', 12
);
```

`cat = 'SHOOTER'` y `color = 'green'` ya son valores válidos del CHECK (`GameRow` en `lib/supabase/types.ts`). No hay migración de schema.

### Props del componente

```ts
interface CiempiesGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onWaveChange: (wave: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

| Estado del juego                                             | Callback                 |
| ------------------------------------------------------------ | ------------------------ |
| `score` (cabeza 100, cuerpo 10, seta destruida 1)            | `onScoreChange(score)`   |
| `lives` (3 al iniciar, −1 por muerte, +1 cada 12 000 puntos) | `onLivesChange(lives)`   |
| `wave` (1 al iniciar, +1 al limpiar todos los segmentos)     | `onWaveChange(wave)`     |
| `lives` llega a 0                                            | `onGameOver(finalScore)` |

Reglas de emisión:

- Cada callback solo se dispara cuando el valor cambia respecto al anterior.
- Al montar se emite el estado inicial: score 0, vidas 3, oleada 1.
- Al perder la última vida, `lives` pasa a 0, se emite y después se llama a `onGameOver(score)`.
- `onGameOver` se dispara una sola vez, protegido por un flag `gameOver`.
- La vida extra se emite en el mismo frame en que el score cruza un múltiplo de 12 000, sin pasar de 6.
- El botón FIN del shell no pasa por el juego: la play-page pone `lives` a 0 y abre el modal con `setOver(true)`.

### Constantes y tipos

```ts
// components/games/ciempies/constants.ts
export const COLS = 32;
export const ROWS = 24;
export const CELL = 25; // canvas 800×600
export const PLAYER_TOP_ROW = 19; // zona del jugador: filas 19–23
export const PLAYER_SIZE = 20; // px
export const PLAYER_SPEED = 300; // px/s
export const BULLET_SPEED = 900; // px/s
export const BULLET_SUBSTEP = 12; // px máximos por comprobación
export const MUSHROOM_HP = 4;
export const START_MUSHROOMS = 40; // filas 1–18
export const CHAIN_MAX = 12; // segmentos totales por oleada
export const CHAIN_MIN = 6; // longitud mínima de la cadena principal
export const TICK_START = 90; // ms por paso en la oleada 1
export const TICK_STEP = 5; // ms menos por oleada
export const TICK_MIN = 50; // ms
export const POINTS_HEAD = 100;
export const POINTS_BODY = 10;
export const POINTS_MUSHROOM = 1;
export const START_LIVES = 3;
export const MAX_LIVES = 6;
export const EXTRA_LIFE_EVERY = 12_000;
export const RESPAWN_MS = 1000;
```

```ts
// components/games/ciempies/field.ts
export type Field = Uint8Array; // COLS × ROWS, vida de la seta (0 = vacía)

// components/games/ciempies/centipede.ts
export interface Segment {
  col: number;
  row: number;
  dx: 1 | -1; // último sentido horizontal
}
export interface Chain {
  segments: Segment[]; // segments[0] es la cabeza
  vdir: 1 | -1; // sentido vertical: 1 baja, −1 sube
}
export function spawnWave(wave: number): Chain[];
export function stepChain(chain: Chain, field: Field): void;
export function splitAt(
  chains: Chain[],
  chainIdx: number,
  segIdx: number,
): void;
```

Convenciones:

- Origen en la esquina superior izquierda. `col` va de 0 a 31 y `row` de 0 a 23.
- Composición de la oleada `n`: una cadena de `max(6, 13 − n)` segmentos y `12 − longitud` cabezas sueltas. Oleada 1: 12 + 0. Oleada 7 en adelante: 6 + 6.
- La cadena empieza con la cabeza en `(19, 0)`, el cuerpo hacia la derecha y `dx = −1`. Las cabezas sueltas empiezan en `(2 + 3k, 0)` con `dx = +1`.
- Tick del ciempiés: `max(50, 90 − (wave − 1) × 5)` ms. Llega al mínimo en la oleada 9.
- Paso de la cabeza: si `(col + dx, row)` está dentro del tablero y sin seta, avanza ahí. Si no, invierte `dx` y se mueve una fila en `vdir`. Si se saldría por abajo, `vdir` pasa a −1 y sube. Si subiendo saldría de la zona del jugador, `vdir` pasa a 1 y baja.
- El movimiento vertical ignora las setas. El cuerpo sigue a la cabeza: cada segmento ocupa la celda que dejó el anterior.
- Abatir el segmento `i`: su celda pasa a seta con 4 de vida, los segmentos anteriores siguen como cadena y los posteriores forman una cadena nueva con el mismo `vdir`, cuya cabeza es el segmento `i + 1`.
- Los segmentos no chocan entre sí.
- El disparo nace en el centro superior de la nave y avanza en subpasos de 12 px como máximo. En cada subpaso se mira la celda de la punta: primero los segmentos y después la seta.
- La nave empieza centrada en `x = 400`, en el centro de la fila 22. Se mueve en 8 direcciones dentro de la zona del jugador, y cada eje se resuelve por separado contra las setas.
- Hitbox de la nave: 20×20 px. Hitbox de un segmento: su celda reducida a 21×21 px.
- Muerte: un segmento toca la nave. Durante `RESPAWN_MS` no se mueve nada. Después las setas dañadas recuperan 4 de vida, la oleada actual vuelve a empezar completa y la nave vuelve al inicio.
- Máximo teórico: ninguno, porque las oleadas no terminan. Una oleada da como mucho 1 200 puntos por segmentos más las setas destruidas.
- Todo se dibuja con primitivas canvas, sin assets. El aspecto se resuelve con `/frontend-design`: ciempiés en verde neón (`var(--green)` con un valor de respaldo), setas con cuatro estados de daño y nave en cian.

### `scores`

No cambia. Se inserta `{ game_id: 'ciempies', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulos de lógica pura.** Crear `components/games/ciempies/constants.ts` con las constantes del data model, `field.ts` (crear el campo, sembrar 40 setas al azar en las filas 1–18, dañar, restaurar y contar) y `centipede.ts` (`spawnWave`, `stepChain` y `splitAt` con las reglas del data model). Sin acceso a `window` ni `document` en el cuerpo de los módulos.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Esqueleto de `CiempiesGame` y play-page.** Crear `components/games/CiempiesGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `SnakeGame`), un canvas 800×600 con escalado CSS y un dibujo estático del campo, la cadena de la oleada 1 y la nave, en `components/games/ciempies/draw.ts`. Crear `app/games/ciempies/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `lives` (inicial 3), `wave` (inicial 1), `paused`, `over` y `gameKey`, `GamePlayShell` (con `paused || over` hacia el juego), las stats Puntuación, Vidas (`♥` por vida, `—` en 0) y Oleada, y una línea de controles bajo el CRT. El aspecto del campo, las setas, el ciempiés y la nave se diseña con `/frontend-design`.
   Verificación: `/games/ciempies/play` carga sin errores de consola y el canvas llena la pantalla CRT sin desbordar.

3. **Loop, nave y teclado.** Implementar el loop con `requestAnimationFrame`: sigue dibujando con `paused`, actualiza `lastTime` en cada frame y acota `dt` a 100 ms. Mover la nave con un mapa `keys` de `←↑→↓` y `WASD`, limitada a la zona del jugador y bloqueada por las setas. Añadir `keydown`/`keyup` en `window` con `preventDefault` solo en las flechas y en `Espacio`, y vaciar `keys` al pausar, al reanudar y en `blur`. Cleanup completo en el `return` del efecto.
   Verificación: la nave se mueve en 8 direcciones sin salir de la franja inferior, no atraviesa setas, PAUSA la congela y la página no hace scroll.

4. **Disparo y setas.** Implementar el disparo único con autodisparo al mantener `Espacio`, el avance por subpasos de 12 px y el daño a las setas: −1 de vida por impacto y +1 punto al destruirla.
   Verificación: solo hay un disparo en pantalla, cada seta desaparece al cuarto impacto pasando por cuatro estados visibles, y destruirla suma 1 punto.

5. **Movimiento del ciempiés.** Avanzar las cadenas con un acumulador de tiempo y el tick de la oleada, aplicando `stepChain` a cada cadena. Vaciar el acumulador al pausar y al reanudar.
   Verificación: el ciempiés avanza por celdas, gira y baja al tocar una seta o un borde, y al llegar a la fila 23 oscila dentro de la zona del jugador.

6. **Impactos, partición y oleadas.** Comprobar los segmentos antes que la seta en cada subpaso del disparo. Al acertar, aplicar `splitAt`, sumar 100 o 10 puntos y dejar la seta. Al no quedar segmentos, subir la oleada y crear la siguiente con `spawnWave`.
   Verificación: abatir un segmento del medio deja una seta y dos ciempiés independientes, y al limpiar la oleada 1 aparece la 2 con una cadena de 11 y una cabeza suelta, más rápida.

7. **Vidas, muerte, HUD y fin de partida.** Detectar el contacto de un segmento con la nave, restar una vida, aplicar la pausa de reaparición de 1 000 ms y reiniciar la oleada según el data model. Sumar la vida extra cada 12 000 puntos con tope de 6. Emitir `score`, `lives` y `wave` por los callbacks (solo al cambiar, con el estado inicial al montar) y llamar a `onGameOver(score)` una sola vez al llegar a 0 vidas. En la play-page, conectar los callbacks y hacer que FIN ponga `lives` a 0 y abra el modal.
   Verificación: el HUD React refleja puntuación, vidas y oleada en tiempo real, y al perder la tercera vida aparece el modal de game over con la puntuación final.

8. **Cover.** Añadir `.cover-ciempies` (y su `::after`) a `app/globals.css`, junto a las demás `.cover-*`, diseñada con `/frontend-design`: fondo oscuro verdoso, setas en magenta y amarillo y una cadena de segmentos verde neón.
   Verificación: `npm run build` sin errores y la clase existe en `app/globals.css`.

9. **Insertar la fila en `games`.** Comprobar antes con `select id, sort_order from games order by sort_order` que `ciempies` no existe y que `12` sigue libre. Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page y la cover para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games` con `cover-ciempies`, `/games/ciempies` carga con datos reales y el tab CIEMPIÉS aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Ciempiés aparece en `/games` con `cover-ciempies` y `/games/ciempies` carga con datos reales.
- [ ] El tab CIEMPIÉS aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/ciempies/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] Al empezar hay 40 setas, todas en las filas 1–18.
- [ ] Al empezar, la cadena tiene 12 segmentos en la fila 0, con la cabeza en la columna 19, y avanza hacia la izquierda.
- [ ] Al empezar, el HUD React muestra puntuación 0, tres `♥` en Vidas y oleada 01.
- [ ] `←↑→↓` y `WASD` mueven la nave en 8 direcciones.
- [ ] La nave nunca sale de las filas 19–23 ni de los bordes laterales.
- [ ] La nave no atraviesa setas.
- [ ] Pulsar las flechas o `Espacio` no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] Nunca hay más de un disparo en pantalla, y mantener `Espacio` dispara de nuevo en cuanto el anterior desaparece.
- [ ] Una seta desaparece al cuarto impacto y suma exactamente 1 punto.
- [ ] El ciempiés gira y baja una fila al tocar una seta o un borde lateral.
- [ ] Al llegar a la fila 23, el ciempiés sube y baja dentro de la zona del jugador y no vuelve a subir de la fila 19.
- [ ] Abatir una cabeza suma exactamente 100 puntos y abatir un segmento de cuerpo suma exactamente 10.
- [ ] Cada segmento abatido deja una seta en su celda.
- [ ] Abatir un segmento del medio parte el ciempiés en dos cadenas que se mueven por separado.
- [ ] Al limpiar todos los segmentos, la oleada sube en 1 y el HUD React lo refleja.
- [ ] La oleada 2 empieza con una cadena de 11 segmentos y 1 cabeza suelta, y avanza con un tick de 85 ms.
- [ ] El tick del ciempiés nunca baja de 50 ms.
- [ ] Que un segmento toque la nave resta una vida, nada se mueve durante 1 s y después la oleada se reinicia completa con las setas dañadas restauradas.
- [ ] Al cruzar 12 000 puntos se gana una vida, y nunca hay más de 6.
- [ ] Al perder la tercera vida, Vidas pasa a `—` y aparece el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Vidas en `—` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay, menú, HUD ni mensaje dibujado en el canvas.
- [ ] PAUSA congela el ciempiés, la nave y el disparo; REANUDAR continúa sin saltos ni pasos acumulados.
- [ ] Una tecla pulsada al pausar no deja la nave moviéndose al reanudar.
- [ ] Con el modal abierto, las teclas no mueven la nave ni disparan.
- [ ] "JUGAR DE NUEVO" reinicia score (a 0), vidas (a 3), oleada (a 1), campo de setas, ciempiés y nave.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'ciempies'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/ciempies` y en el tab CIEMPIÉS de `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play`, `/games/snake/play` y `/games/frogger/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: no extraer el shell.** Razón: `GamePlayShell` existe desde SPEC 07 y cubre HUD, pausa, modal, guardado y redirección al leaderboard.
- **Sí: diseñar el juego desde cero.** Razón: no hay referencia de Centipede en `references/started-games/`, así que reglas, números y controles se fijan en este spec.
- **Sí: `id = 'ciempies'`, `SHOOTER` y `green`.** Razón: los pidió el usuario y coinciden con la candidata CIEMPIÉS de `references/game-suggestiones-todo.md`. Diferencia el SHOOTER de Asteroids, que usa `cyan`.
- **No: cubrir el hueco `VERSUS` o `yellow`.** Razón: el tema fija `SHOOTER` y `green`, y Centipede no tiene rival que justifique `VERSUS`.
- **Sí: `sort_order = 12`.** Razón: es el siguiente libre tras Asteroids (7), Tetris (8), Arkanoid (9), Snake (10) y Frogger (11), deducido de los specs porque el MCP de Supabase no estaba disponible al redactar. El paso 9 lo confirma con un `select` antes de insertar.
- **Sí: canvas 800×600 con cuadrícula de 32×24 y celdas de 25 px.** Razón: la proporción 4:3 llena `.crt-screen`, igual que Snake y Arkanoid. Descartado el formato vertical del arcade original, que dejaría franjas vacías en el CRT.
- **Sí: el ciempiés se mueve por celdas, sin interpolación.** Razón: las colisiones con setas, disparo y nave son exactas por celda, igual que en Snake. Con un tick de 90 ms el paso es legible.
- **Sí: el cuerpo sigue a la cabeza (follow-the-leader).** Razón: es más simple y estable que aplicar la regla de giro a cada segmento, y la seta que deja un segmento abatido hace girar a la cadena trasera igual que en el original.
- **Sí: el movimiento vertical ignora las setas.** Razón: es la regla clásica y evita que el ciempiés quede atrapado entre setas.
- **Sí: nave con movimiento libre y bloqueada por setas.** Razón: la nave es la parte de acción y el original la mueve sin cuadrícula. Bloquear con setas obliga a limpiar la zona inferior.
- **Sí: un solo disparo a la vez, rápido y con autodisparo.** Razón: es la mecánica del original. Acertar cuenta más que pulsar rápido.
- **Sí: subpasos de 12 px para el disparo.** Razón: con `dt` de 100 ms el disparo avanzaría 90 px y se saltaría celdas de 25 px.
- **Sí: cabeza 100, cuerpo 10, seta 1.** Razón: son los valores del original y premian apuntar a la cabeza.
- **Sí: 12 segmentos por oleada, con la cadena más corta y más cabezas sueltas en cada oleada.** Razón: es la progresión clásica y mantiene el máximo por oleada en 1 200 puntos de segmentos.
- **Sí: tick de 90 ms que baja 5 ms por oleada, con mínimo de 50 ms.** Razón: da progresión sin oleadas imposibles. El mínimo se alcanza en la oleada 9.
- **Sí: 3 vidas, vida extra cada 12 000 puntos y tope de 6.** Razón: 12 000 es el valor clásico. El tope evita acumular vidas sin fin.
- **Sí: al morir, la oleada se reinicia completa y se restauran las setas dañadas.** Razón: es más simple que conservar las cadenas parciales y deja un estado limpio para reaparecer. Repetir una oleada da como mucho 1 200 puntos, menos que una vida extra.
- **No: puntos por restaurar setas al morir.** Razón: el original da 5 por seta, pero premiaría morir.
- **Sí: pausa de reaparición de 1 000 ms sin overlay.** Razón: el jugador necesita ver qué lo mató, y la plataforma ya tiene su UI.
- **Sí: sin máximo teórico de score.** Razón: las oleadas no terminan. Llegar a 10 000 000 exigiría más de 7 000 oleadas, y el shell ya acota el score a 10 000 000 antes de insertar.
- **Sí: el HUD refleja `score`, `lives` y `wave`, sin HUD en el canvas.** Razón: la oleada es la métrica de progreso del juego, y un HUD duplicado en el canvas taparía la fila 0, por donde entra el ciempiés.
- **Sí: `←↑→↓`, `WASD` y `Espacio`, con `preventDefault` solo en las flechas y `Espacio`.** Razón: son las teclas que provocan scroll, y `WASD` no lo necesita.
- **Sí: vaciar `keys` al pausar, al reanudar y en `blur`.** Razón: una tecla soltada fuera de la ventana o en pausa dejaría la nave moviéndose.
- **Sí: `dt` acotado a 100 ms y acumulador vacío al pausar y reanudar.** Razón: al volver de otra pestaña o de la pausa no deben soltarse varios pasos de golpe.
- **Sí: pausa solo de la plataforma, sin `P`/`Esc`.** Razón: enrutarlas obligaría a ampliar el contrato del shell con un callback nuevo.
- **Sí: primitivas canvas, sin assets ni audio.** Razón: no hay assets de Centipede en el repo, y dibujar con código encaja con la estética neón de la plataforma.
- **Sí: cover nueva `.cover-ciempies`.** Razón: ninguna `.cover-*` existente representa un ciempiés ni un campo de setas. Reutilizar `cover-snake` confundiría las dos cards verdes.
- **Sí: módulos de lógica pura separados del componente.** Razón: el movimiento y la partición del ciempiés son la parte con más reglas, y separarlos permite verificarlos sin el loop.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado y manda el schema de `lib/supabase/types.ts`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en todos los juegos de la plataforma.
- **Sí: la fila de `games` va en el último paso, tras la cover.** Razón: el juego no debe aparecer en `/games` antes de ser jugable ni con una cover inexistente.
- **No: partir el juego base en dos specs.** Razón: un solo canvas, sin assets y con lógica propia acotada. Los enemigos extra van en SPEC GJ-ciempies-02.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «Ciempiés: Centipede en una pantalla con campo de setas, SHOOTER, green», sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                             | Mitigación                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `sort_order = 12` o el id `ciempies` ya están ocupados en la base  | El paso 9 consulta `games` antes de insertar. Si `12` está ocupado, se usa el siguiente libre.                 |
| El disparo atraviesa segmentos o setas con `dt` grande             | Subpasos de 12 px como máximo, menos que media celda.                                                          |
| Una cadena queda atrapada girando entre dos setas                  | El paso vertical ignora las setas, así que la cadena siempre avanza una fila al girar.                         |
| La partición deja una cadena vacía o con la cabeza mal orientada   | `splitAt` descarta cadenas vacías y la cadena nueva hereda `dx` de su propio segmento y `vdir` de la original. |
| La nave queda encerrada entre setas en la zona inferior            | Puede disparar hacia arriba para abrirse paso, y al morir las setas dañadas se restauran pero no se añaden.    |
| El acumulador suelta varios pasos tras pausar o cambiar de pestaña | `dt` acotado a 100 ms y acumulador vacío al pausar y reanudar.                                                 |
| Tecla "atascada" al pausar o al perder el foco                     | Vaciar `keys` al pausar, al reanudar y en `blur`.                                                              |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños   | Escalado CSS resuelto en el paso 2 con `/frontend-design`, verificado con el criterio de ajuste.               |
| Listeners duplicados al reiniciar                                  | Cleanup completo en el efecto y reinicio por `key`.                                                            |
| Dos `onGameOver` seguidos (fin natural y botón FIN)                | El juego lo dispara una sola vez y el shell congela el juego al abrir el modal.                                |
| Cualquier cliente puede insertar scores (RLS abierto)              | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                           |

---

## What is **not** in this spec

- Araña, pulga, escorpión y setas envenenadas (SPEC GJ-ciempies-02).
- Cabezas que entran por los lados en la zona del jugador.
- Puntos por restaurar setas al morir.
- Audio y música.
- Skins y controles táctiles o mobile.
- Teclas `P`/`Esc`, overlays, menú de inicio y HUD en el canvas.
- Selector de oleada inicial o de dificultad.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame`, `GamePlayShell` y las play-pages de otros juegos.

Cada uno de esos puntos, si llega, va en su propio spec.
