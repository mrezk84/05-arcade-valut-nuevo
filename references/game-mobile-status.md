# Juegos en móvil

Referencia y memoria de `@mobile-porter`. Contrato: `specs/10-touch-controls-mobile.md`. Todo juego listado aquí debe ser jugable en móvil (mando virtual, layout portrait, aviso en landscape) sin cambios en escritorio.

El agente trabaja **un solo juego por invocación** (`@mobile-porter <game-id>`) y solo actualiza la fila de ese juego.

Estados: `ok` · `falta` · `falla` · `—` (sin auditar).

| ID          | Mando | Layout móvil | Landscape | Stats móvil | Escritorio sin cambios | Última revisión | Notas                                                                                                                                                      |
| ----------- | ----- | ------------ | --------- | ----------- | ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asteroids` | ok    | ok           | ok        | ok (canvas) | ok                     | 2026-10-08      | `dpad` 4 dir; A `Space` (Disparar), B `ArrowUp` (Impulso). Sin `repeat`.                                                                                   |
| `tetris`    | ok    | ok           | ok        | ok          | ok                     | 2026-10-08      | `dpad` 4 dir; `repeat` left/right/down; A `ArrowUp` (Rotar), B `Space` (Caída rápida); `statsPanel` en el CRT.                                             |
| `arkanoid`  | ok    | ok           | ok        | ok (canvas) | ok                     | 2026-10-08      | `dpad` left/right con `showInactive`; sin botones activos.                                                                                                 |
| `snake`     | ok    | ok           | ok        | ok          | ok                     | 2026-10-08      | `dpad` 4 dir; sin A/B; `statsLine` Puntuación.                                                                                                             |
| `frogger`   | ok    | ok           | ok        | ok (canvas) | ok                     | 2026-10-13      | `dpad` 4 dir; sin `repeat` (el juego ignora `e.repeat`: un salto por toque); sin A/B. Pantalla 8:7 en táctil (`:has(#frogger-skin)`). Sin revisión visual. |

Desde SPEC 11 (2026-10-08) el mando usa el aspecto Gamepad MK-II neón (carcasa, cruceta con hub, B cian a la izquierda y A magenta a la derecha); el mapeo no cambia.

Pendiente en todos: confirmar en un móvil real (SPEC 10 se verificó solo con emulación táctil) y el multitáctil con dos dedos (SPEC 11) y el guardado del score con el mando.
