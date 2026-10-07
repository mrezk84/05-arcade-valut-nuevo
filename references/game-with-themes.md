# Juegos con skins

Referencia y memoria de `@skin-designer`. Contrato: todo juego listado aquí debe tener como mínimo las skins `classic` (default), `neon` y `retro`, y cada skin debe verse bien en modo oscuro (la plataforma es dark-only, `--bg: #0a0a0f`).

El agente trabaja **un solo juego por invocación** (`@skin-designer <game-id>`) y solo actualiza la fila de ese juego. Los juegos que no se le piden no se tocan.

Estados: `ok` · `falta` · `falla` (no cumple el chequeo de modo oscuro) · `—` (no aplica / sin auditar).

| ID          | classic | neon  | retro | Extras           | Modo oscuro | Última revisión | Notas                                                                               |
| ----------- | ------- | ----- | ----- | ---------------- | ----------- | --------------- | ----------------------------------------------------------------------------------- |
| `tetris`    | falta   | ok    | ok    | `pastel` `pixel` | falla       | —               | Hoy `retro` es el default y es el look clásico. `pastel` usa fondo claro `#f8f0ff`. |
| `asteroids` | falta   | falta | falta | —                | —           | —               | Colores fijos en `AsteroidsGame.tsx` (`#fff` sobre negro). Sin skins.               |
| `arkanoid`  | falta   | falta | falta | —                | —           | —               | Usa sprites (`public/games/arkanoid/spritesheet-breakout.png`). Sin skins.          |
| `snake`     | falta   | falta | falta | —                | —           | —               | Colores fijos en `SnakeGame.tsx` y sprites `fruits.png`. Sin skins.                 |

## Contrastes registrados

El agente añade aquí, por juego y skin, el fondo del canvas, su luminancia relativa y el contraste WCAG de los elementos jugables.

_Sin registros todavía._
