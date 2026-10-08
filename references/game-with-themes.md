# Juegos con skins

Referencia y memoria de `@skin-designer`. Contrato: todo juego listado aquí debe tener como mínimo las skins `classic` (default), `neon` y `retro`, y cada skin debe verse bien en modo oscuro (la plataforma es dark-only, `--bg: #0a0a0f`).

El agente trabaja **un solo juego por invocación** (`@skin-designer <game-id>`) y solo actualiza la fila de ese juego. Los juegos que no se le piden no se tocan.

Estados: `ok` · `falta` · `falla` (no cumple el chequeo de modo oscuro) · `—` (no aplica / sin auditar).

| ID          | classic | neon  | retro | Extras           | Modo oscuro | Última revisión | Notas                                                                                                                                                    |
| ----------- | ------- | ----- | ----- | ---------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tetris`    | falta   | ok    | ok    | `pastel` `pixel` | falla       | —               | Hoy `retro` es el default y es el look clásico. `pastel` usa fondo claro `#f8f0ff`.                                                                      |
| `asteroids` | ok      | ok    | ok    | —                | ok          | 2026-10-08      | `components/games/asteroids/skins.ts`; selector con la infra compartida `components/games/skins/` (`useGameSkin`, `SkinSelect`). Clave `asteroids-skin`. |
| `arkanoid`  | falta   | falta | falta | —                | —           | —               | Usa sprites (`public/games/arkanoid/spritesheet-breakout.png`). Sin skins.                                                                               |
| `snake`     | falta   | falta | falta | —                | —           | —               | Colores fijos en `SnakeGame.tsx` y sprites `fruits.png`. Sin skins.                                                                                      |

## Contrastes registrados

El agente añade aquí, por juego y skin, el fondo del canvas, su luminancia relativa y el contraste WCAG de los elementos jugables.

### `asteroids` (marco `cyan`) — 2026-10-08

| Skin      | Fondo     | L fondo | Nave              | Asteroide (trazo) | Bala              | Propulsor             | Texto HUD         | Decorado (< 1.5:1)                               |
| --------- | --------- | ------- | ----------------- | ----------------- | ----------------- | --------------------- | ----------------- | ------------------------------------------------ |
| `classic` | `#000`    | 0.0000  | `#fff` 21.00:1    | `#fff` 21.00:1    | `#fff` 21.00:1    | `#ff8200`·0.85 6.22:1 | `#fff` 21.00:1    | —                                                |
| `neon`    | `#000000` | 0.0000  | `#00f5ff` 15.50:1 | `#ff006e` 5.48:1  | `#f5ff00` 19.19:1 | `#00ff88` 15.66:1     | `#00f5ff` 15.50:1 | rejilla cian·0.06 1.08:1; rellenos 1.20 / 1.05:1 |
| `retro`   | `#0e0c1f` | 0.0046  | `#29adff` 7.81:1  | `#c2c3c7` 10.93:1 | `#ffec27` 15.84:1 | `#ffa300` 9.62:1      | `#fff1e8` 17.41:1 | scanlines negro·0.22 1.02:1                      |

Notas: en `retro` el relleno del asteroide `#3f3566` (1.75:1) va siempre bajo el contorno `#c2c3c7` (6.24:1 contra el relleno), y la nave `#29adff` contrasta 4.45:1 contra ese relleno. Paleta `retro` = 8 colores. Partículas: `classic` blanco, `neon` magenta (5.48:1), `retro` amarillo (15.84:1), con alfa decreciente.
