# SPEC GJ-pixel-fighters-01 — Integración del juego Pixel Fighters

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07 · **Fecha:** 2026-10-15
> **Objetivo:** Integrar Pixel Fighters como juego jugable en `/games/pixel-fighters/play`, con combates 1v1 al mejor de tres rondas contra cuatro rivales de CPU y guardado del score en el leaderboard de Supabase.

---

## Por qué existe este spec

El catálogo real tiene cuatro categorías en el CHECK de `games.cat` y una está vacía: `VERSUS`. Los cinco juegos integrados (Asteroids, Tetris, Arkanoid, Snake, Rana) son todos de un solo jugador contra el sistema. Pixel Fighters cubre ese hueco con el género más reconocible de la categoría: la pelea 1v1 contra una CPU.

El juego no tiene origen en `references/started-games/`: se diseña desde cero, igual que Snake en SPEC 09. Las dos piezas que el backlog señalaba como caras (sprites e IA con estados) se resuelven así:

- **Sprites:** no hay assets externos. Los luchadores se dibujan por código con rectángulos de 8 px, al estilo del cuerpo de la serpiente en SPEC 09. Así el spec no depende de que alguien produzca un spritesheet.
- **IA:** una máquina de estados pequeña (siete estados) con cuatro perfiles de parámetros, uno por rival. La dificultad sube cambiando números, no añadiendo código.

---

## Scope

**In:**

- Componente `components/games/PixelFightersGame.tsx`, diseñado desde cero, con canvas 800×600 y un arena de suelo plano.
- Módulos `components/games/pixel-fighters/constants.ts` (arena, física, ataques, puntuación), `components/games/pixel-fighters/ai.ts` (perfiles y máquina de estados de la CPU) y `components/games/pixel-fighters/draw.ts` (luchadores pixel art, arena y HUD de canvas).
- Play-page `app/games/pixel-fighters/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Modo arcade: escalera de cuatro rivales (`ROOKIE`, `BRAWLER`, `NINJA`, `MASTER`), cada uno un combate al mejor de tres rondas.
- Una barra de salud de 100 puntos por luchador y por ronda, y un cronómetro de 60 segundos por ronda.
- Dos ataques: puñetazo (`Z`, 8 de daño) y patada (`X`, 14 de daño), con arranque, activo y recuperación medidos en milisegundos.
- Movimiento con `←`/`→`, salto con `↑` y cubrirse con `↓`. Cubrirse reduce el daño al 25 %.
- IA de CPU con los estados `idle`, `approach`, `retreat`, `strike`, `block`, `jump` y `hitstun`, y un perfil de parámetros por rival.
- Puntuación por daño infligido, ronda ganada, bonus de tiempo, ronda perfecta, combate ganado y escalera completa.
- HUD de la plataforma con `score`, rival (como Nivel), rondas ganadas del combate y salud del jugador.
- HUD dibujado en el canvas: barras de salud, nombre del rival, cronómetro, marcadores de rondas y banner de fase (`ROUND 1`, `K.O.`, `RIVAL VENCIDO`).
- Perder un combate y completar la escalera disparan los dos `onGameOver(score)`.
- Fila `pixel-fighters` en la tabla `games`, con `cat = 'VERSUS'`, `color = 'magenta'`, `cover = 'cover-duelo'` (reutilizada) y `sort_order = 12`.

**Fuera de alcance (para specs futuros):**

- Modo supervivencia, barra de furia y peligros de arena: van en SPEC GJ-pixel-fighters-02.
- Segundo jugador humano en el mismo teclado y cualquier forma de multijugador.
- Ataques en el aire, agarres, barridos, proyectiles y combos con ventana de cancelación.
- Selector de personaje, de rival inicial o de dificultad.
- Skins (las añade `skin-designer` en su propio flujo) y sprites de imagen.
- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlay propio de game over, de victoria y de pausa dibujado en el canvas.
- Distinguir victoria de derrota en el modal del shell.
- Audio y música.
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- Cambios en `GamePlayShell`, en `TouchControls` y en las play-pages de los juegos ya integrados.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'pixel-fighters', 'PIXEL FIGHTERS', 'Pelea 1v1 contra la CPU.',
  'Cuatro rivales, combates al mejor de tres rondas y una sola barra de salud. Muévete con las flechas, salta, cúbrete y encadena puñetazos y patadas con Z y X. Cada golpe suma puntos, y ganar la ronda antes de que se agote el cronómetro suma mucho más.',
  'VERSUS', 'cover-duelo', 'magenta', 12
);
```

`cat = 'VERSUS'` y `color = 'magenta'` ya son valores válidos del CHECK real (`cat` admite `ARCADE|PUZZLE|SHOOTER|VERSUS`, `color` admite `cyan|magenta|yellow|green`). No hay migración de schema.

### Props del componente

```ts
interface PixelFightersGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onRivalChange: (rival: number) => void;
  onRoundsChange: (playerWins: number, cpuWins: number) => void;
  onHealthChange: (health: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

| Estado del juego                                               | Callback                      |
| -------------------------------------------------------------- | ----------------------------- |
| `score`                                                        | `onScoreChange(score)`        |
| `rival` (1–4, índice del rival de la escalera)                 | `onRivalChange(rival)`        |
| `roundWins.player` y `roundWins.cpu` (0–2, del combate)        | `onRoundsChange(player, cpu)` |
| `player.hp` (0–100, salud del jugador)                         | `onHealthChange(health)`      |
| La CPU gana 2 rondas, o el jugador gana el combate del rival 4 | `onGameOver(finalScore)`      |

Reglas de emisión:

- Cada callback solo se dispara cuando su valor cambia respecto al anterior. `onRoundsChange` compara los dos números.
- Al montar se emite el estado inicial: score 0, rival 1, rondas 0-0, salud 100.
- Al empezar cada ronda se emite salud 100.
- Al acabar el combate de un rival se emiten las rondas en 0-0 antes de la primera ronda del rival siguiente.
- `onGameOver` se dispara una sola vez, protegido por un flag `gameOver`.
- Completar la escalera llama a `onGameOver(score)` igual que perder un combate.
- El botón FIN del shell no pasa por el juego: la play-page pone `health` a 0 y abre el modal con `setOver(true)`.
- El cronómetro no se emite al HUD React: solo se dibuja en el canvas.

### Constantes y tipos

```ts
// components/games/pixel-fighters/constants.ts
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const FLOOR_Y = 520; // línea de pies
export const WALL_LEFT = 40; // borde izquierdo del cuerpo
export const WALL_RIGHT = 760; // borde derecho del cuerpo
export const BODY_W = 56;
export const BODY_H = 96;
export const PIXEL = 8; // lado del "píxel" con el que se dibujan los luchadores

export const WALK_SPEED = 220; // px/s del jugador
export const GRAVITY = 1800; // px/s²
export const JUMP_V = -620; // px/s (altura ≈ 106 px)

export const MAX_HP = 100;
export const ROUND_TIME = 60; // s
export const ROUNDS_TO_WIN = 2; // al mejor de 3
export const RIVAL_COUNT = 4;

export const BLOCK_FACTOR = 0.25; // daño bloqueado = floor(daño × 0.25)
export const HITSTUN = 220; // ms
export const BLOCKSTUN = 120; // ms
export const PUSH_HIT = 24; // px
export const PUSH_BLOCK = 12; // px

export const INTRO_MS = 1000; // fase roundIntro
export const ROUND_END_MS = 1200; // fase roundEnd
export const MATCH_END_MS = 1600; // fase matchEnd

export const POINTS_PER_DAMAGE = 10;
export const POINTS_ROUND_WIN = 2000;
export const POINTS_PER_SECOND_LEFT = 30;
export const POINTS_PERFECT_ROUND = 3000;
export const POINTS_MATCH_WIN = 5000;
export const POINTS_LADDER_CLEAR = 20000;

export type AttackId = 'punch' | 'kick';
export interface AttackDef {
  damage: number;
  startup: number; // ms
  active: number; // ms
  recovery: number; // ms
  reach: number; // px desde el borde del cuerpo
  boxH: number; // px de alto del hitbox
  boxTop: number; // px por encima de FLOOR_Y donde arranca el hitbox
}
export const ATTACKS: Record<AttackId, AttackDef>;
```

| Ataque   | Tecla | Daño | Arranque | Activo | Recuperación | Alcance | Hitbox             |
| -------- | ----- | ---- | -------- | ------ | ------------ | ------- | ------------------ |
| Puñetazo | `Z`   | 8    | 60 ms    | 70 ms  | 130 ms       | 70 px   | 20 px alto, top 78 |
| Patada   | `X`   | 14   | 110 ms   | 90 ms  | 220 ms       | 95 px   | 26 px alto, top 46 |

```ts
// components/games/pixel-fighters/ai.ts
export interface AiProfile {
  name: string; // ROOKIE, BRAWLER, NINJA, MASTER
  decisionMs: number;
  aggression: number; // 0–1, probabilidad de atacar en rango
  blockChance: number; // 0–1, probabilidad de cubrirse
  walkSpeed: number; // px/s
  jumpChance: number; // 0–1
  preferKick: number; // 0–1, probabilidad de patada frente a puñetazo
}
export const AI_PROFILES: readonly AiProfile[]; // 4 perfiles, índice 0 = rival 1

export type AiState =
  | 'idle'
  | 'approach'
  | 'retreat'
  | 'strike'
  | 'block'
  | 'jump'
  | 'hitstun';
export const AI_ATTACK_COOLDOWN = 160; // ms entre dos ataques de la CPU
export const AI_NEAR = 100; // px, distancia de ataque
export const AI_MID = 140; // px, distancia de acercamiento
export const AI_REACT = 110; // px, distancia a la que reacciona al ataque del jugador
```

| Rival | Nombre    | `decisionMs` | `aggression` | `blockChance` | `walkSpeed` | `jumpChance` | `preferKick` |
| ----- | --------- | ------------ | ------------ | ------------- | ----------- | ------------ | ------------ |
| 1     | `ROOKIE`  | 260          | 0.35         | 0.15          | 170         | 0.00         | 0.25         |
| 2     | `BRAWLER` | 200          | 0.55         | 0.30          | 200         | 0.10         | 0.40         |
| 3     | `NINJA`   | 150          | 0.70         | 0.45          | 240         | 0.25         | 0.55         |
| 4     | `MASTER`  | 110          | 0.85         | 0.60          | 260         | 0.35         | 0.70         |

```ts
// Estado interno del juego (dentro del efecto de PixelFightersGame.tsx)
type Phase = 'roundIntro' | 'fight' | 'roundEnd' | 'matchEnd';

interface Fighter {
  x: number; // centro del cuerpo
  y: number; // pies (FLOOR_Y en el suelo)
  vy: number;
  facing: 1 | -1;
  hp: number;
  blocking: boolean;
  attack: AttackId | null;
  attackT: number; // ms transcurridos del ataque
  hitLanded: boolean; // un ataque golpea una sola vez
  stunT: number; // ms restantes de hitstun o blockstun
  walkT: number; // ms acumulados para la animación de caminar
}
```

Convenciones y reglas de la arena:

- Origen en la esquina superior izquierda. `x` es el centro del cuerpo y `y` la línea de pies.
- El cuerpo ocupa de `x − 28` a `x + 28` y de `y − 96` a `y`.
- Posiciones iniciales de cada ronda: jugador en `x = 260`, CPU en `x = 540`, ambos con `y = FLOOR_Y`.
- Cada luchador mira siempre al rival. `facing` se actualiza solo cuando no está atacando ni en stun.
- Los cuerpos no se solapan: si se cruzan, cada uno retrocede la mitad del solape, respetando `WALL_LEFT` y `WALL_RIGHT`.
- El hitbox de ataque nace en el borde frontal del cuerpo y mide `reach` de ancho. Es AABB contra el cuerpo del rival.
- Un ataque golpea una sola vez (`hitLanded`), solo durante su fase activa.
- Mientras ataca, un luchador no se desplaza ni puede cubrirse.
- Cubrirse exige estar en el suelo y recibir el golpe por delante. Un golpe bloqueado hace `floor(daño × 0.25)`: 2 el puñetazo y 3 la patada.
- En el aire no se puede atacar ni cubrirse.
- `hitstun` y `blockstun` bloquean toda acción hasta agotarse.
- Fases: `roundIntro` (1000 ms) → `fight` → `roundEnd` (1200 ms) → `roundIntro` del combate o `matchEnd` (1600 ms). Fuera de `fight` el cronómetro no corre y el teclado se ignora.
- La ronda acaba cuando un luchador llega a 0 de salud o cuando el cronómetro llega a 0.
- Por tiempo gana quien tenga más salud. Con la misma salud, la ronda es para la CPU.
- La salud de los dos luchadores vuelve a 100 al empezar cada ronda.
- Combate ganado = 2 rondas ganadas. Si lo gana la CPU, la partida termina.
- Puntuación: `daño × 10` al infligir (el daño bloqueado puntúa por lo que realmente quita), `+2000` por ronda ganada, `+30 × segundos enteros restantes` al ganar la ronda, `+3000` si la ronda se gana con 100 de salud, `+5000` por combate ganado y `+20000` al ganar el combate del rival 4.
- Cota superior de la puntuación: 3 rondas × (1000 + 2000 + 3000 + 1770) + 5000 por rival, 4 rivales, más 20 000 ≈ 133 600 puntos. No hace falta acotar nada en el juego.
- El daño que inflige la CPU no suma puntos al jugador.
- Luchadores dibujados por código con rectángulos de `PIXEL = 8`: cabeza 24×24, torso 24×40, brazos y piernas de 8 y 16 px de ancho. Poses por estado: `idle`, `walk` (dos fotogramas que alternan cada 140 ms), `jump`, `punch`, `kick`, `block`, `hit` y `ko`.
- Paletas: el jugador en cian (`--cyan`), los rivales en magenta, amarillo, verde y rojo, uno por rival. Los colores se resuelven en el paso de diseño con `/frontend-design`, con un literal de respaldo si la variable CSS no está disponible.

### `scores`

No cambia. Se inserta `{ game_id: 'pixel-fighters', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulo de constantes.** Crear `components/games/pixel-fighters/constants.ts` con todas las constantes y tipos del data model, incluida la tabla `ATTACKS`. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Módulo de dibujo.** Crear `components/games/pixel-fighters/draw.ts` con `drawArena(ctx)` (fondo, suelo y pared de fondo), `drawFighter(ctx, fighter, pose, palette)` (rectángulos de 8 px, una pose por estado) y `drawCanvasHud(ctx, hud)` (barras de salud, nombre del rival, cronómetro, marcadores de rondas y banner de fase). El aspecto se diseña con `/frontend-design`.
   Verificación: `npm run build` sin errores de TypeScript.

3. **Esqueleto del componente y play-page.** Crear `components/games/PixelFightersGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `SnakeGame`), un canvas 800×600 con escalado CSS y un dibujo estático de la arena, los dos luchadores en pose `idle` y el HUD de canvas. Crear `app/games/pixel-fighters/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `rival` (inicial 1), `roundWins` (inicial 0-0), `health` (inicial 100), `paused`, `over` y `gameKey`, `GamePlayShell` con `paused || over` hacia el juego, y una línea de controles bajo el CRT. El encaje del canvas en `.crt-screen` se diseña con `/frontend-design`.
   Verificación: `/games/pixel-fighters/play` carga sin errores de consola y el canvas llena la pantalla CRT sin desbordar.

4. **Loop, movimiento y teclado del jugador.** Implementar el loop con `requestAnimationFrame`: actualiza `lastTime` en cada frame, acota `dt` a 100 ms, sigue dibujando con `paused` y no actualiza nada mientras `paused`. Implementar caminar, salto con gravedad, cubrirse, los límites de arena y la separación de cuerpos. Añadir `keydown`/`keyup` en `window` para `←`, `→`, `↑`, `↓`, `Z` y `X`, con `preventDefault` solo en las cuatro flechas, ignorando `e.repeat` en los ataques y vaciando el mapa de teclas al pausar y al reanudar. Cleanup completo en el `return` del efecto.
   Verificación: el jugador camina, salta, aterriza, se cubre, no atraviesa los bordes ni a la CPU, PAUSA lo congela y las flechas no hacen scroll de la página.

5. **Ataques, impactos y bloqueo.** Implementar las tres fases de cada ataque con sus milisegundos, el hitbox AABB, el impacto único por ataque, el daño, el hitstun, el blockstun y los empujes. Dibujar las poses `punch`, `kick`, `block` y `hit`.
   Verificación: el puñetazo quita 8 de salud y la patada 14, un golpe bloqueado quita 2 y 3 respectivamente, y durante la recuperación el luchador no puede actuar.

6. **IA de la CPU.** Crear `components/games/pixel-fighters/ai.ts` con `AI_PROFILES`, los tipos de estado y `decideAiState(...)`, una función pura que recibe distancia, estado del jugador, perfil y aleatoriedad y devuelve el estado siguiente. Conectarla al loop con el temporizador de decisión del perfil, el enfriamiento de ataque y la reacción al ataque del jugador a menos de 110 px.
   Verificación: la CPU se acerca, ataca en rango, se cubre a veces y queda quieta en hitstun; el rival 4 ataca y bloquea visiblemente más que el rival 1.

7. **Rondas, cronómetro y escalera.** Implementar las fases `roundIntro`, `fight`, `roundEnd` y `matchEnd`, el cronómetro de 60 segundos, el fallo por tiempo a favor de quien tenga más salud, el recuento al mejor de tres, el avance al rival siguiente con su perfil y su paleta, y los banners de fase en el canvas.
   Verificación: tras un K.O. aparece el banner, la ronda siguiente arranca con las dos saludes a 100 y ganar dos rondas pasa al rival 2 con su nombre en el HUD de canvas.

8. **Puntuación, HUD y fin de partida.** Sumar los puntos de daño, ronda ganada, bonus de tiempo, ronda perfecta, combate ganado y escalera completa. Emitir `score`, `rival`, `roundWins` y `health` por los callbacks, solo al cambiar y con el estado inicial al montar. Llamar a `onGameOver(score)` una sola vez al perder un combate o al ganar el del rival 4. En la play-page, conectar los callbacks y hacer que FIN ponga `health` a 0 y abra el modal.
   Verificación: el HUD React refleja puntuación, rival, rondas y salud en tiempo real, y al perder un combate o al completar la escalera aparece el modal de game over con la puntuación final.

9. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games` con `cover-duelo` y el filtro `VERSUS`, `/games/pixel-fighters` carga con datos reales y el tab PIXEL FIGHTERS aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Pixel Fighters aparece en `/games` con `cover-duelo` y se muestra al filtrar por `VERSUS`.
- [ ] `/games/pixel-fighters` carga con datos reales (título, descripción larga y leaderboard vacío).
- [ ] El tab PIXEL FIGHTERS aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/pixel-fighters/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] Al empezar, el jugador está en `x = 260`, la CPU en `x = 540` y los dos en el suelo.
- [ ] Al empezar, el HUD React muestra puntuación 0, Nivel 01, Rondas `0-0` y Salud `100%`.
- [ ] `←` y `→` mueven al jugador y `↑` lo hace saltar y aterrizar en el suelo.
- [ ] Pulsar las flechas no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] Ningún luchador sale de los límites `WALL_LEFT`/`WALL_RIGHT` ni atraviesa el cuerpo del otro.
- [ ] `Z` hace un puñetazo que quita exactamente 8 de salud al impactar.
- [ ] `X` hace una patada que quita exactamente 14 de salud al impactar.
- [ ] Un mismo ataque no puede golpear dos veces al rival.
- [ ] Mantener `Z` o `X` pulsada no repite el ataque.
- [ ] Cubrirse con `↓` reduce el puñetazo a 2 de daño y la patada a 3.
- [ ] En el aire no se puede atacar ni cubrirse.
- [ ] Durante la recuperación de un ataque, el luchador no se mueve ni ataca de nuevo.
- [ ] Recibir un golpe deja al luchador sin control durante 220 ms y lo empuja 24 px.
- [ ] La CPU se acerca, ataca en rango, se cubre y salta según su perfil, y el rival 4 es visiblemente más agresivo que el rival 1.
- [ ] La CPU no lanza dos ataques separados por menos de 160 ms.
- [ ] El cronómetro de la ronda empieza en 60 y baja un segundo por segundo solo durante la fase `fight`.
- [ ] Si el cronómetro llega a 0, la ronda la gana quien tenga más salud, y la CPU si hay empate.
- [ ] Dejar la salud del rival a 0 gana la ronda y muestra el banner `K.O.` en el canvas.
- [ ] La ronda siguiente arranca con las dos saludes a 100 y el HUD React muestra el nuevo marcador de rondas.
- [ ] Ganar dos rondas pasa al rival siguiente, el HUD React sube el Nivel y las rondas vuelven a `0-0`.
- [ ] El HUD del canvas muestra las dos barras de salud, el nombre del rival, el cronómetro y los marcadores de ronda.
- [ ] Infligir daño suma exactamente 10 puntos por punto de salud quitado.
- [ ] Ganar una ronda suma 2000 puntos más 30 por cada segundo entero restante.
- [ ] Ganar una ronda con 100 de salud suma además 3000 puntos.
- [ ] Ganar un combate suma 5000 puntos y ganar el del rival 4 suma además 20 000.
- [ ] El daño que inflige la CPU no suma puntos al jugador.
- [ ] Perder dos rondas contra un rival abre el modal de game over con la puntuación final.
- [ ] Ganar el combate del rival 4 abre el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN pone Salud en `0%` y abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay de game over, victoria o pausa dibujado en el canvas.
- [ ] PAUSA congela a los dos luchadores, el cronómetro y las fases; REANUDAR continúa sin saltos.
- [ ] Una tecla pulsada al pausar no deja al jugador caminando ni cubriéndose al reanudar.
- [ ] Con el modal abierto, las teclas no mueven ni hacen atacar al jugador.
- [ ] "JUGAR DE NUEVO" reinicia puntuación (a 0), rival (a 1), rondas (a `0-0`), salud (a 100) y posiciones.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'pixel-fighters'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/pixel-fighters` y en el tab PIXEL FIGHTERS de `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play`, `/games/snake/play` y `/games/frogger/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: cubrir `VERSUS` con un juego de lucha 1v1 contra la CPU.** Razón: es la única categoría del CHECK sin ningún juego, y la pelea 1v1 es el género que la define.
- **Sí: `color = 'magenta'`.** Razón: es el color con el que el backlog registró el candidato y encaja con el rojo-rosa del género. Descartado `yellow`, que sigue libre: se reserva para un juego que no tenga ya un color asignado en el backlog.
- **Sí: reutilizar `cover-duelo`.** Razón: la clase ya existe en `app/globals.css` y dibuja exactamente un duelo (línea divisoria central, figura cian a la izquierda y magenta a la derecha). Crear `.cover-pixel-fighters` sería trabajo de diseño sin ganancia.
- **Sí: `sort_order = 12`.** Razón: es el siguiente libre tras Asteroids (7), Tetris (8), Arkanoid (9), Snake (10) y Frogger (11).
- **Sí: luchadores dibujados por código con rectángulos de 8 px.** Razón: el backlog marcaba los sprites como el coste principal del juego. Dibujarlos por código quita la dependencia de un spritesheet y mantiene la estética pixel art, igual que el cuerpo de la serpiente en SPEC 09.
- **No: spritesheet de animación.** Razón: hacen falta decenas de fotogramas por luchador y no hay assets propios. Si llegan, van en un spec de arte.
- **Sí: cuatro rivales con perfiles de parámetros.** Razón: la dificultad sube cambiando números, no añadiendo ramas de código, y da una escalera con final claro.
- **Sí: combates al mejor de tres rondas.** Razón: es la estructura del género y evita que un K.O. afortunado decida un combate. Descartada la ronda única, que hace el modo arcade demasiado corto.
- **Sí: salud de los dos luchadores a 100 en cada ronda.** Razón: regla clásica y la más fácil de verificar. La salud acumulada entre combates se explora en SPEC GJ-pixel-fighters-02.
- **Sí: cronómetro de 60 segundos por ronda.** Razón: evita que un jugador pasivo alargue la partida indefinidamente y da la base para el bonus de tiempo.
- **Sí: con la misma salud al agotarse el tiempo, la ronda es para la CPU.** Razón: un empate obligaría a una regla de ronda extra y a más estado. Castigar la pasividad es coherente con el bonus de tiempo.
- **Sí: dos ataques (`Z` puñetazo, `X` patada).** Razón: dos ataques ya crean la decisión de rápido-débil frente a lento-fuerte. Descartados puñetazos y patadas altos y bajos, que multiplicarían hitboxes y poses sin aportar a la integración.
- **Sí: `←→` para moverse, `↑` saltar y `↓` cubrirse, con `preventDefault` solo en las flechas.** Razón: deja la mano izquierda sobre `Z`/`X`, y solo las flechas provocan scroll. Descartado `WASD` como alternativa, porque `A`, `S` y `D` quedan junto a las teclas de ataque y se pulsarían por error.
- **Sí: cubrirse manteniendo `↓`, con el daño al 25 %.** Razón: el bloqueo con tecla propia es más legible que "mantener atrás", que choca con el cambio de lado. Reducir en lugar de anular el daño impide ganar ronda por tiempo a base de guardia.
- **No: ataques en el aire.** Razón: duplicarían las poses, los hitboxes y los estados de la IA. El salto sirve para esquivar y reposicionarse.
- **No: combos con ventana de cancelación ni medidor de daño escalado.** Razón: es equilibrio fino, no integración. El hitstun de 220 ms ya permite encadenar un segundo golpe si se ajusta la distancia.
- **Sí: `decideAiState` como función pura en `ai.ts`.** Razón: se puede razonar y verificar sin el loop, y los perfiles quedan como datos.
- **Sí: enfriamiento de 160 ms entre ataques de la CPU.** Razón: sin él, el rival 4 encadena ataques sin huecos y el combate es injusto.
- **Sí: la CPU reacciona al ataque del jugador a menos de 110 px.** Razón: es lo que hace creíble el bloqueo. Sin esa regla, la CPU solo se cubre al azar.
- **Sí: puntuación por daño, ronda, tiempo, ronda perfecta, combate y escalera.** Razón: premia jugar bien y rápido, no solo sobrevivir, y hace comparables dos partidas en el leaderboard.
- **Sí: el daño bloqueado puntúa por lo que realmente quita.** Razón: mantiene la regla "10 puntos por punto de salud" sin excepciones.
- **Sí: completar la escalera también dispara `onGameOver(score)`.** Razón: sin esto, quien gana el juego no podría guardar su score.
- **No: distinguir victoria de derrota en el modal.** Razón: el shell no lo soporta y ampliarlo merece su propio spec.
- **Sí: conservar el HUD dibujado en el canvas (barras, cronómetro, rondas, banners).** Razón: en un juego de lucha, las barras de salud son parte de la lectura del combate y no se pueden sustituir por el HUD React, que está fuera de la pantalla CRT.
- **Sí: el cronómetro solo en el canvas.** Razón: emitirlo al HUD React forzaría un render por segundo sin aportar información nueva.
- **Sí: banners de fase en el canvas (`ROUND 1`, `K.O.`, `RIVAL VENCIDO`).** Razón: son información de la partida, no la UI de la plataforma. El game over y la pausa siguen siendo del shell.
- **Sí: `onRoundsChange(playerWins, cpuWins)` con dos argumentos.** Razón: las rondas se leen juntas en el HUD como `1-0` y así no se crea un objeto nuevo por emisión.
- **Sí: FIN pone `health` a 0 desde la play-page.** Razón: el botón no pasa por el juego, igual que en Tetris y Arkanoid, y el HUD quedaría con salud detrás del modal.
- **Sí: pausa solo de la plataforma, sin `P`/`Esc`.** Razón: enrutarlas obligaría a ampliar el contrato del shell con un callback nuevo.
- **Sí: vaciar el mapa de teclas al pausar y al reanudar.** Razón: una tecla soltada durante la pausa dejaría al jugador caminando o cubierto.
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: al volver de otra pestaña, las fases de ataque y el cronómetro no deben avanzar de golpe.
- **Sí: sin lógica de límite de score en el juego.** Razón: la cota superior es de unos 133 600 puntos y el shell ya acota a 10 000 000.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado y manda el schema leído con `list_tables`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en todos los juegos de la plataforma.
- **Sí: la fila de `games` va en el último paso.** Razón: el juego no debe aparecer en `/games` antes de ser jugable.
- **No: segundo jugador humano.** Razón: cambia el modelo de puntuación (no habría un score individual que guardar) y el shell está pensado para un jugador.
- **No: skins en este spec.** Razón: las paletas por rival ya dan variedad, y las skins las añade `skin-designer` en su propio flujo tras la implementación.
- **No: audio.** Razón: no hay assets propios y los golpes se leen bien por el empuje y el parpadeo.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «PIXEL FIGHTERS», sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                                  | Mitigación                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| La CPU resulta imbatible o trivial con los perfiles propuestos          | Los cuatro perfiles son solo datos en `ai.ts`; el paso 6 se verifica jugando y se ajustan los números sin tocar la lógica. |
| La CPU se queda atascada contra una pared empujando al jugador          | La separación de cuerpos reparte el solape entre los dos y la IA cambia a `retreat` por probabilidad cada decisión.        |
| Dos ataques simultáneos se intercambian golpes y parecen un fallo       | Es intencionado (el género lo llama _trade_); el hitstun de 220 ms deja ver los dos impactos.                              |
| El jugador gana por tiempo manteniendo la guardia                       | El bloqueo reduce el daño pero no lo anula, y el bonus de tiempo premia cerrar la ronda pronto.                            |
| Las poses dibujadas por código no se leen y no se sabe qué ataque viene | Cada estado tiene su pose y se verifica en el paso 5 con el criterio de daño; el aspecto se cierra con `/frontend-design`. |
| Las fases de ataque avanzan de golpe al volver de otra pestaña          | `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.                                                              |
| Tecla "atascada" al pausar con `←`, `→` o `↓` pulsada                   | Vaciar el mapa de teclas al pausar y al reanudar.                                                                          |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños        | Escalado CSS resuelto en el paso 3 con `/frontend-design`, verificado con el criterio de ajuste.                           |
| Listeners duplicados al reiniciar                                       | Cleanup completo en el efecto y reinicio por `key`.                                                                        |
| Dos `onGameOver` seguidos (fin natural y botón FIN)                     | El juego lo dispara una sola vez y el shell congela el juego al abrir el modal.                                            |
| Partida muy larga (hasta 13 rondas de 60 s)                             | El bonus de tiempo y la agresividad creciente de la CPU acortan las rondas; el botón FIN permite cerrar y guardar.         |
| Cualquier cliente puede insertar scores (RLS abierto)                   | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                                       |

---

## What is **not** in this spec

- Modo supervivencia, barra de furia y peligros de arena (SPEC GJ-pixel-fighters-02).
- Segundo jugador humano y multijugador.
- Ataques en el aire, agarres, proyectiles y combos con cancelación.
- Selector de personaje, de rival inicial o de dificultad.
- Skins y sprites de imagen.
- Teclas `P`/`Esc` de pausa y overlays propios de game over o victoria.
- Distinguir victoria de derrota en el modal.
- Audio y música.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame`, `GamePlayShell` y `TouchControls`.

Cada uno de esos puntos, si llega, va en su propio spec.
