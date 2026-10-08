# Juegos con skins

Referencia y memoria de `@skin-designer`. Contrato: todo juego listado aquí debe tener como mínimo las skins `classic` (default), `neon` y `retro`, y cada skin debe verse bien en modo oscuro (la plataforma es dark-only, `--bg: #0a0a0f`).

El agente trabaja **un solo juego por invocación** (`@skin-designer <game-id>`) y solo actualiza la fila de ese juego. Los juegos que no se le piden no se tocan.

Estados: `ok` · `falta` · `falla` (no cumple el chequeo de modo oscuro) · `—` (no aplica / sin auditar).

| ID          | classic | neon | retro | Extras           | Modo oscuro | Última revisión | Notas                                                                                                                                                        |
| ----------- | ------- | ---- | ----- | ---------------- | ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tetris`    | falta   | ok   | ok    | `pastel` `pixel` | falla       | —               | Hoy `retro` es el default y es el look clásico. `pastel` usa fondo claro `#f8f0ff`.                                                                          |
| `asteroids` | ok      | ok   | ok    | —                | ok          | 2026-10-08      | `components/games/asteroids/skins.ts`; selector con la infra compartida `components/games/skins/` (`useGameSkin`, `SkinSelect`). Clave `asteroids-skin`.     |
| `arkanoid`  | ok      | ok   | ok    | —                | ok          | 2026-10-08      | `components/games/arkanoid/skins.ts`; `classic` = spritesheet original, `neon`/`retro` vectoriales. Selector con la infra compartida. Clave `arkanoid-skin`. |
| `snake`     | ok      | ok   | ok    | —                | ok          | 2026-10-08      | `components/games/snake/skins.ts`; `classic` mantiene `fruits.png`, `neon`/`retro` vectoriales. Clave `snake-skin`.                                          |

## Contrastes registrados

El agente añade aquí, por juego y skin, el fondo del canvas, su luminancia relativa y el contraste WCAG de los elementos jugables.

### `asteroids` (marco `cyan`) — 2026-10-08

| Skin      | Fondo     | L fondo | Nave              | Asteroide (trazo) | Bala              | Propulsor             | Texto HUD         | Decorado (< 1.5:1)                               |
| --------- | --------- | ------- | ----------------- | ----------------- | ----------------- | --------------------- | ----------------- | ------------------------------------------------ |
| `classic` | `#000`    | 0.0000  | `#fff` 21.00:1    | `#fff` 21.00:1    | `#fff` 21.00:1    | `#ff8200`·0.85 6.22:1 | `#fff` 21.00:1    | —                                                |
| `neon`    | `#000000` | 0.0000  | `#00f5ff` 15.50:1 | `#ff006e` 5.48:1  | `#f5ff00` 19.19:1 | `#00ff88` 15.66:1     | `#00f5ff` 15.50:1 | rejilla cian·0.06 1.08:1; rellenos 1.20 / 1.05:1 |
| `retro`   | `#0e0c1f` | 0.0046  | `#29adff` 7.81:1  | `#c2c3c7` 10.93:1 | `#ffec27` 15.84:1 | `#ffa300` 9.62:1      | `#fff1e8` 17.41:1 | scanlines negro·0.22 1.02:1                      |

Notas: en `retro` el relleno del asteroide `#3f3566` (1.75:1) va siempre bajo el contorno `#c2c3c7` (6.24:1 contra el relleno), y la nave `#29adff` contrasta 4.45:1 contra ese relleno. Paleta `retro` = 8 colores. Partículas: `classic` blanco, `neon` magenta (5.48:1), `retro` amarillo (15.84:1), con alfa decreciente.

### `snake` (marco `green`) — 2026-10-08

| Skin      | Fondo (L)                           | Cuerpo cuello / cola                   | Cabeza            | Fruta                                            | Decorado (< 1.5:1)                   |
| --------- | ----------------------------------- | -------------------------------------- | ----------------- | ------------------------------------------------ | ------------------------------------ |
| `classic` | `#07100c`/`#0a1510` (0.0044/0.0064) | 14.39 / 4.85                           | `#c8ffe4` 17.35:1 | sprite `fruits.png`, no medido                   | damero 1.04:1                        |
| `neon`    | `#000000` (0.0000)                  | 15.66 / 4.87                           | `#00f5ff` 15.50:1 | magenta 5.48:1 · amarillo 19.19:1                | rejilla 1.09:1; rellenos 1.10–1.40:1 |
| `retro`   | `#0c140e`/`#13221a` (0.0061/0.0136) | `#008751` 4.09 (3.61 en casilla clara) | `#00e436` 10.83:1 | rojo 4.78 (4.22) · naranja 9.35 · amarillo 15.40 | damero 1.13:1; scanlines 1.03:1      |

Notas: paleta `retro` = 8 colores (`#0c140e #13221a #008751 #00e436 #ff004d #ffa300 #ffec27 #fff1e8`). Ojos `neon` `#f5ff00` 13.69:1 sobre la cabeza; ojos `retro` 10.83:1. El canvas no tiene texto.

### `arkanoid` (marco `magenta`) — 2026-10-08

| Skin      | Fondo     | L fondo | Pala                                       | Pelota              | Bloques (mín.–máx.)                        | Texto HUD         | Decorado (< 1.5:1)                                   |
| --------- | --------- | ------- | ------------------------------------------ | ------------------- | ------------------------------------------ | ----------------- | ---------------------------------------------------- |
| `classic` | `#000`    | 0.0000  | sprite plata ≈ 12:1                        | sprite plata ≈ 12:1 | sprites ≈ 3:1 (`gray`) – ≈ 14:1 (`yellow`) | `#fff` 21.00:1    | —                                                    |
| `neon`    | `#000000` | 0.0000  | `#00f5ff` 15.50:1                          | `#f5ff00` 19.19:1   | `#ff006e` 5.48:1 – `#f5ff00` 19.19:1       | `#00f5ff` 15.50:1 | rejilla magenta·0.06 1.02:1; rellenos ·0.16 ≤ 1.40:1 |
| `retro`   | `#0e0c1f` | 0.0046  | `#fff1e8` 17.41:1 (topes `#ff004d` 4.91:1) | `#fff1e8` 17.41:1   | `#ff004d` 4.91:1 – `#fff1e8` 17.41:1       | `#fff1e8` 17.41:1 | scanlines negro·0.22 1.02:1                          |

Notas: bloques `neon` = `red #ff2a4d` 5.69, `yellow #f5ff00` 19.19, `cyan #00f5ff` 15.50, `magenta #ff006e` 5.48, `hotpink #ff4fd8` 7.36, `green #00ff88` 15.66, `gray #8a8aa8` 6.28 (trazo con glow sobre relleno al 16 %). Bloques `retro` = `red #ff004d` 4.91, `yellow #ffec27` 15.84, `cyan→#29adff` 7.81, `magenta→#ff77a8` 7.75, `hotpink→#ffa300` 9.61, `green #00e436` 11.13, `gray→#fff1e8` (ladrillo plateado) 17.41. Paleta `retro` = 8 colores (subconjunto PICO-8). Los valores de `classic` son estimados a ojo del spritesheet (no medidos por píxel); el bloque `gray` (piedra oscura, solo fila 0 del nivel 2) queda en el límite de 3:1 y no se toca por la regla de regresión cero.
