# SPEC GJ-pixel-fighters-02 — Modo supervivencia con furia y losas eléctricas en Pixel Fighters

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07, SPEC GJ-pixel-fighters-01 · **Fecha:** 2026-10-15
> **Objetivo:** Añadir a Pixel Fighters un segundo modo de juego, supervivencia por oleadas, con salud que se arrastra entre rivales, barra de furia con golpe especial y losas eléctricas en la arena.

---

## Por qué existe este spec

SPEC GJ-pixel-fighters-01 deja un modo arcade completo, cerrado y con techo: cuatro rivales y una cota de puntuación de unos 133 600 puntos. Quien lo domina llega siempre al mismo final y el leaderboard se satura.

Este spec añade una variante jugable distinta del mismo juego base, con tres cambios que alteran las decisiones del jugador:

- La salud **no** se restablece entre rivales, así que ganar rápido y sin recibir golpes importa.
- La barra de **furia** convierte el daño recibido en una oportunidad de remontada.
- Las **losas eléctricas** hacen que la posición en la arena deje de ser neutral.

Es un spec aparte porque es opcional: el juego es completo sin él y el modo arcade no cambia ni una regla.

---

## Scope

**In:**

- Modo `survival` seleccionable en el HUD, junto al modo `arcade` de SPEC GJ-pixel-fighters-01.
- Componente `components/games/pixel-fighters/ModeSelect.tsx`, lista desplegable con los dos modos, pasada al shell por la prop `hudExtra`.
- Preferencia de modo persistida en `localStorage` con la clave `pixel-fighters-mode`, leída con el hook existente `useGameSkin`.
- Módulo `components/games/pixel-fighters/survival.ts` con las constantes del modo, la salud y el perfil de IA por oleada y las reglas de puntuación.
- Módulo `components/games/pixel-fighters/hazards.ts` con las constantes, los tipos y la lógica pura de las losas eléctricas.
- Oleadas sucesivas de un solo combate a una ronda, hasta la oleada 50 (victoria) o hasta que la salud del jugador llegue a 0.
- La salud del jugador se arrastra entre oleadas y recupera 25 puntos al superar cada una, con máximo de 100.
- Cronómetro de 45 segundos por oleada: si se agota, la partida termina en derrota.
- Barra de furia de 0 a 100 para el jugador, que se llena con el daño infligido y recibido.
- Golpe de furia con la tecla `C` cuando la barra está llena: 30 de daño, alcance 120 px y empuje de 60 px.
- La CPU también tiene barra de furia desde la oleada 5, con las mismas reglas.
- Losas eléctricas desde la oleada 3: dos losas fijas con ciclo de aviso, descarga e inercia, que dañan y aturden a quien las pise.
- Puntuación propia del modo: daño, oleada superada con bonus creciente, oleada sin recibir daño, K.O. con golpe de furia y superar la oleada 50.
- HUD de la plataforma en supervivencia: `score`, `wave` (como Oleada), salud y furia.
- HUD de canvas en supervivencia: barra de furia bajo la del jugador, `OLEADA n` en lugar de los marcadores de ronda y cronómetro de 45 segundos.
- Dibujo de las losas y de la barra de furia en `components/games/pixel-fighters/draw.ts`, con su aspecto diseñado con `/frontend-design`.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio en las reglas del modo arcade: rivales, rondas, cronómetro de 60 segundos y puntuación de SPEC GJ-pixel-fighters-01 se quedan igual.
- Furia y losas en el modo arcade.
- Leaderboards separados por modo: los dos modos guardan en `scores` con `game_id = 'pixel-fighters'`.
- Más peligros de arena (suelo que se hunde, muros que empujan, proyectiles del escenario).
- Golpes de furia distintos por rival y barra de furia con dos niveles.
- Ataques en el aire, agarres y combos con cancelación (siguen fuera, como en el 01).
- Audio de furia, de descarga eléctrica o de aturdimiento.
- Skins y sprites de imagen.
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en la fila de `games`, en `GamePlayShell`, en `TouchControls`, en `/games`, `/games/[id]` y `/hall-of-fame`.

---

## Data model

### Fila de `games`

No cambia. La fila `pixel-fighters` de SPEC GJ-pixel-fighters-01 sigue igual: el modo no es un juego nuevo, es una opción dentro del mismo.

### Props del componente

`PixelFightersGameProps` de SPEC GJ-pixel-fighters-01 se amplía con la prop `mode` y dos callbacks:

```ts
export type GameMode = 'arcade' | 'survival';

interface PixelFightersGameProps {
  paused: boolean;
  mode: GameMode; // nuevo
  onScoreChange: (score: number) => void;
  onRivalChange: (rival: number) => void;
  onRoundsChange: (playerWins: number, cpuWins: number) => void;
  onHealthChange: (health: number) => void;
  onWaveChange: (wave: number) => void; // nuevo, solo en survival
  onFuryChange: (fury: number) => void; // nuevo, solo en survival
  onGameOver: (finalScore: number) => void;
}
```

`mode` se lee una sola vez al montar el efecto, no por una ref: cambiar de modo reinicia el componente por `key`.

### Captura del HUD

| Estado del juego                                                | Callback                 |
| --------------------------------------------------------------- | ------------------------ |
| `score` (reglas de puntuación de este spec)                     | `onScoreChange(score)`   |
| `wave` (1–50, oleada actual)                                    | `onWaveChange(wave)`     |
| `player.hp` (0–100, arrastrada entre oleadas)                   | `onHealthChange(health)` |
| `player.fury` (0–100, entero truncado)                          | `onFuryChange(fury)`     |
| Salud del jugador a 0, cronómetro agotado, u oleada 50 superada | `onGameOver(finalScore)` |

Reglas de emisión:

- En `survival`, `onRivalChange` y `onRoundsChange` no se emiten: el HUD de la play-page no muestra ni Nivel ni Rondas en este modo.
- En `arcade`, `onWaveChange` y `onFuryChange` no se emiten.
- Al montar en `survival` se emite el estado inicial: score 0, oleada 1, salud 100, furia 0.
- `onFuryChange` emite el entero truncado de la furia y solo cuando ese entero cambia.
- `onGameOver` se dispara una sola vez, con el mismo flag `gameOver` del 01.
- Superar la oleada 50 llama a `onGameOver(score)` igual que perder.
- El botón FIN sigue sin pasar por el juego: la play-page pone `health` a 0 y abre el modal.

### Constantes y tipos del modo

```ts
// components/games/pixel-fighters/survival.ts
export const WAVE_TIME = 45; // s por oleada
export const WAVE_MAX = 50; // superar esta oleada es victoria
export const WAVE_HEAL = 25; // salud recuperada al superar una oleada
export const RIVAL_HP_BASE = 100;
export const RIVAL_HP_STEP = 10; // por oleada
export const RIVAL_HP_CAP = 250;
export const WAVE_INTRO_MS = 1200; // fase waveIntro
export const WAVE_END_MS = 1200; // fase waveEnd

export const POINTS_WAVE_BASE = 2000;
export const POINTS_WAVE_STEP = 500; // por oleada superada
export const POINTS_NO_DAMAGE = 4000;
export const POINTS_FURY_KO = 1000;
export const POINTS_SURVIVAL_CLEAR = 50000;

/** Salud del rival de la oleada: min(250, 100 + 10 × (wave − 1)). */
export function rivalHp(wave: number): number;
/** Perfil base: AI_PROFILES[min(3, floor((wave − 1) / 2))]. */
export function waveProfile(wave: number): AiProfile;
```

```ts
// components/games/pixel-fighters/hazards.ts
export const TILE_W = 96;
export const TILE_H = 12;
export const TILE_X = [240, 560] as const; // centros de las dos losas
export const TILE_FIRST_WAVE = 3; // oleada desde la que aparecen
export const TILE_FAST_WAVE = 8; // oleada desde la que el ciclo se acorta
export const TILE_DAMAGE = 6;
export const TILE_STUN = 300; // ms

export interface TileCycle {
  warn: number; // ms de aviso
  live: number; // ms de descarga
  idle: number; // ms inerte
}
export const CYCLE_SLOW: TileCycle = { warn: 600, live: 1000, idle: 2400 };
export const CYCLE_FAST: TileCycle = { warn: 500, live: 1000, idle: 1500 };

export type TilePhase = 'idle' | 'warn' | 'live';
export interface Tile {
  x: number;
  t: number; // ms dentro del ciclo
  phase: TilePhase;
  hitPlayer: boolean; // ya dañó al jugador en esta descarga
  hitCpu: boolean; // ya dañó a la CPU en esta descarga
}
```

```ts
// components/games/pixel-fighters/constants.ts (añadidos)
export const FURY_MAX = 100;
export const FURY_PER_DAMAGE_DEALT = 1; // por punto de daño infligido
export const FURY_PER_DAMAGE_TAKEN = 0.5; // por punto de daño recibido
export const FURY_CPU_WAVE = 5; // oleada desde la que la CPU tiene furia

export const FURY_ATTACK: AttackDef = {
  damage: 30,
  startup: 180,
  active: 120,
  recovery: 320,
  reach: 120,
  boxH: 40,
  boxTop: 70,
};
export const FURY_BLOCK_FACTOR = 0.5; // bloqueada quita floor(30 × 0.5) = 15
export const FURY_HITSTUN = 420; // ms
export const FURY_PUSH = 60; // px
export const FURY_BLOCKSTUN = 200; // ms
```

Reglas del modo supervivencia:

- Fases: `waveIntro` (1200 ms) → `fight` → `waveEnd` (1200 ms) → `waveIntro` de la oleada siguiente, o fin de partida. Fuera de `fight` el cronómetro no corre y el teclado se ignora.
- Cada oleada es un único combate a una ronda: no hay recuento al mejor de tres.
- Salud del rival de la oleada: `min(250, 100 + 10 × (wave − 1))`, es decir, tope a partir de la oleada 16.
- Perfil de IA de la oleada: `AI_PROFILES[min(3, floor((wave − 1) / 2))]`. Oleadas 1–2 `ROOKIE`, 3–4 `BRAWLER`, 5–6 `NINJA`, 7 y siguientes `MASTER`.
- Sobre ese perfil, la oleada aplica dos factores: `walkSpeed × min(1.25, 1 + 0.015 × (wave − 1))` y `decisionMs × max(0.6, 1 − 0.01 × (wave − 1))`.
- Paleta del rival: la del 01, rotando los cuatro colores con `(wave − 1) % 4`.
- La salud del jugador se arrastra de oleada en oleada. Al superar una, recupera 25 puntos, con máximo de 100.
- Si la salud del jugador llega a 0, la partida termina, sin importar la causa (golpe o losa).
- Si el cronómetro de 45 segundos llega a 0, la partida termina en derrota, sin importar la salud de cada uno.
- Superar la oleada 50 termina la partida como victoria y dispara `onGameOver(score)`.
- Furia: `+1` por punto de daño infligido y `+0.5` por punto de daño recibido, con tope en 100. Se arrastra entre oleadas.
- Con la barra llena, `C` lanza el golpe de furia y consume los 100 puntos. Con la barra incompleta, `C` no hace nada.
- El golpe de furia se lanza solo en el suelo, sigue las tres fases de ataque del 01 y golpea una sola vez.
- Bloquear el golpe de furia deja 15 de daño y 200 ms de blockstun. Sin bloquear, 30 de daño, 420 ms de hitstun y 60 px de empuje.
- La CPU acumula furia con las mismas reglas desde la oleada 5 y la gasta en el estado `strike` cuando la tiene llena, con probabilidad `aggression`.
- Losas: desde la oleada 3, dos losas de 96×12 px centradas en `x = 240` y `x = 560`, apoyadas en el suelo (`y = FLOOR_Y − 12`).
- Ciclo de las losas: `CYCLE_SLOW` (4000 ms) hasta la oleada 7 y `CYCLE_FAST` (3000 ms) desde la 8. Las dos losas arrancan desfasadas media vuelta de ciclo.
- Un luchador recibe 6 de daño y 300 ms de aturdimiento si sus pies están dentro del ancho de una losa en fase `live`, una sola vez por descarga y por luchador.
- Estar en el aire sobre una losa activa no daña: cuenta la posición de los pies en el suelo.
- El daño de las losas no suma puntos ni llena la barra de furia de nadie.
- Un luchador aturdido no puede actuar y se dibuja parpadeando en blanco.
- Puntuación del modo: `+10` por punto de daño infligido (igual que el 01), `+2000 + 500 × (wave − 1)` al superar una oleada, `+4000` si la oleada se supera sin recibir ningún daño, `+1000` si el K.O. de la oleada lo da el golpe de furia y `+50000` al superar la oleada 50.
- En supervivencia no hay bonus de tiempo ni de ronda perfecta: los sustituyen el bonus de oleada y el de oleada sin daño.
- Cota superior de la puntuación: unos 1 140 000 puntos (50 oleadas, con 2 500 de daño, 26 500 de bonus de oleada, 4 000 sin daño y 1 000 de furia en las últimas), más 50 000. Queda por debajo de 10 000 000.
- Aun así, el juego acota el score a 10 000 000 antes de emitirlo, porque el modo tiene una progresión abierta.

### Selector de modo

```ts
// components/games/pixel-fighters/ModeSelect.tsx
interface ModeSelectProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  disabled: boolean;
}
export const MODE_IDS = ['arcade', 'survival'] as const;
export const MODE_OPTIONS = [
  { id: 'arcade', name: 'Arcade' },
  { id: 'survival', name: 'Supervivencia' },
] as const;
export const MODE_STORAGE_KEY = 'pixel-fighters-mode';
export const DEFAULT_MODE: GameMode = 'arcade';
```

- Mismo marcado y mismas clases que `components/games/skins/SkinSelect.tsx` (`.hud-stat`, `.skin-select`), con la etiqueta `Modo`, y `blur()` tras elegir para que el teclado vuelva al juego.
- La play-page lee y escribe el modo con `useGameSkin(MODE_STORAGE_KEY, MODE_IDS, DEFAULT_MODE)`.
- Cambiar de modo reinicia la partida desde cero: misma función que "JUGAR DE NUEVO" (puntuación, salud, oleada, rival, rondas, furia y `gameKey`).
- El selector está deshabilitado mientras el modal de game over está abierto.

### `scores`

No cambia. Los dos modos insertan `{ game_id: 'pixel-fighters', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Selector de modo sin efecto en el juego.** Añadir `GameMode`, `MODE_IDS`, `MODE_OPTIONS`, `MODE_STORAGE_KEY` y `DEFAULT_MODE`, crear `components/games/pixel-fighters/ModeSelect.tsx` y conectarlo en `app/games/pixel-fighters/play/page.tsx` con `useGameSkin` y la prop `hudExtra` del shell. El modo se pasa al componente como prop, que de momento lo ignora, y cambiarlo reinicia la partida.
   Verificación: el desplegable `Modo` aparece en el HUD, cambiar de modo reinicia la partida con puntuación 0, la elección persiste al recargar y el modo arcade sigue jugándose igual.

2. **Constantes del modo supervivencia.** Crear `components/games/pixel-fighters/survival.ts` con las constantes, `rivalHp(wave)` y `waveProfile(wave)`. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript, y `rivalHp(1) === 100`, `rivalHp(16) === 250` y `rivalHp(30) === 250`.

3. **Bucle de oleadas.** En `PixelFightersGame.tsx`, ramificar por `mode` al montar: con `survival`, sustituir las fases de ronda y combate por `waveIntro`, `fight` y `waveEnd`, el cronómetro de 45 segundos, la salud del rival por oleada, los factores de velocidad y decisión, la salud del jugador arrastrada con la cura de 25 y el fin de partida por salud a 0, por tiempo agotado o por superar la oleada 50. Dibujar `OLEADA n` y el cronómetro en el HUD de canvas.
   Verificación: en supervivencia se enlazan oleadas sin cortes, la salud del jugador no se restablece entre oleadas, el rival de la oleada 5 aguanta 140 de daño y agotar el cronómetro abre el modal.

4. **Puntuación de supervivencia.** Implementar el daño por 10, el bonus de oleada `2000 + 500 × (wave − 1)`, el bonus de 4000 por oleada sin recibir daño y el de 50 000 por superar la oleada 50. Acotar el score a 10 000 000 antes de emitirlo. Emitir `score`, `wave` y `health` por los callbacks, y en la play-page mostrar `Oleada` en lugar de `Nivel` y `Rondas` cuando el modo es `survival`.
   Verificación: superar la oleada 1 suma 2 000 y la oleada 3 suma 3 000, superar una oleada sin recibir daño suma 4 000 más, y el HUD React muestra Puntuación, Oleada y Salud.

5. **Barra de furia y golpe de furia.** Añadir `fury` a cada luchador, su llenado con el daño infligido y recibido, la tecla `C` (solo en el suelo y con la barra llena), el ataque `FURY_ATTACK` con sus tres fases, su daño bloqueado de 15, su hitstun de 420 ms y su empuje de 60 px, y el bonus de 1 000 por K.O. con furia. Dibujar la barra bajo la del jugador y la pose del golpe. La CPU gana furia y la usa desde la oleada 5.
   Verificación: la barra sube al golpear y al recibir golpes, `C` con la barra llena quita 30 de salud y vacía la barra, `C` con la barra a medias no hace nada, y a partir de la oleada 5 la CPU lanza su propio golpe de furia.

6. **Losas eléctricas.** Crear `components/games/pixel-fighters/hazards.ts` con las constantes, el tipo `Tile` y `updateTiles(tiles, dt, cycle)`, función pura que avanza el ciclo y devuelve las fases. Conectarla al loop desde la oleada 3, con las dos losas desfasadas media vuelta, el ciclo rápido desde la oleada 8, los 6 de daño y los 300 ms de aturdimiento por descarga y por luchador, y la regla de que estar en el aire salva. Dibujar las tres fases y el parpadeo del luchador aturdido. El aspecto de las losas se diseña con `/frontend-design`.
   Verificación: en la oleada 3 aparecen dos losas que avisan antes de descargar, pisar una activa quita 6 de salud una sola vez y aturde 300 ms, saltar sobre ella no daña y la CPU también la sufre.

7. **Fin del modo y repaso del arcade.** Comprobar que en `survival` no se emiten `onRivalChange` ni `onRoundsChange`, que el modo arcade conserva todas las reglas de SPEC GJ-pixel-fighters-01 (rondas, cronómetro de 60 s, puntuación, sin furia y sin losas) y que FIN y "JUGAR DE NUEVO" funcionan en los dos modos.
   Verificación: se repiten los criterios de aceptación de juego, HUD y puntuación de SPEC GJ-pixel-fighters-01 en modo arcade con el mismo resultado.

---

## Acceptance criteria

- [ ] En el HUD hay una lista desplegable `Modo` con Arcade y Supervivencia, y muestra el modo activo.
- [ ] El modo elegido se mantiene al recargar la página (`localStorage`, clave `pixel-fighters-mode`).
- [ ] Sin valor guardado, o con uno inválido, el modo es Arcade.
- [ ] Cambiar de modo reinicia la partida con puntuación 0, salud 100 y la primera oleada o el primer rival.
- [ ] El selector de modo está deshabilitado mientras el modal de game over está abierto.
- [ ] Tras elegir en la lista, las flechas y `Z`, `X` y `C` controlan el juego y no la lista.
- [ ] En modo Supervivencia el HUD React muestra Puntuación, Oleada, Salud y Furia, y no muestra Nivel ni Rondas.
- [ ] En modo Arcade el HUD React muestra Puntuación, Nivel, Rondas y Salud, y no muestra Oleada ni Furia.
- [ ] En Supervivencia, cada oleada es un único combate: no hay marcador de rondas en el canvas.
- [ ] El HUD de canvas muestra `OLEADA n` y un cronómetro que empieza en 45.
- [ ] La salud del rival es 100 en la oleada 1, 140 en la oleada 5 y 250 desde la oleada 16.
- [ ] La salud del jugador no se restablece al pasar de oleada.
- [ ] Superar una oleada recupera 25 puntos de salud, sin pasar de 100.
- [ ] Agotar el cronómetro de 45 segundos abre el modal de game over, incluso con el jugador por delante en salud.
- [ ] Dejar la salud del jugador a 0 abre el modal de game over con la puntuación final.
- [ ] Superar una oleada suma `2000 + 500 × (oleada − 1)` puntos: 2 000 en la oleada 1 y 3 000 en la 3.
- [ ] Superar una oleada sin recibir ningún daño suma además 4 000 puntos.
- [ ] Infligir daño sigue sumando 10 puntos por punto de salud quitado.
- [ ] En Supervivencia no se suman bonus de tiempo ni de ronda perfecta.
- [ ] La barra de furia sube 1 punto por punto de daño infligido y 0,5 por punto recibido, y se detiene en 100.
- [ ] La furia se arrastra entre oleadas y el HUD React la muestra como entero.
- [ ] Con la barra llena, `C` lanza el golpe de furia, quita 30 de salud y deja la barra a 0.
- [ ] Con la barra por debajo de 100, `C` no hace nada.
- [ ] El golpe de furia no se puede lanzar en el aire.
- [ ] El golpe de furia bloqueado quita 15 de salud.
- [ ] Un golpe de furia sin bloquear deja al rival sin control 420 ms y lo empuja 60 px.
- [ ] Ganar la oleada con el golpe de furia suma 1 000 puntos extra.
- [ ] Desde la oleada 5, la CPU acumula furia y lanza su propio golpe de furia.
- [ ] En las oleadas 1 y 2 no hay losas en la arena.
- [ ] Desde la oleada 3 hay dos losas centradas en `x = 240` y `x = 560`, apoyadas en el suelo.
- [ ] Las dos losas no descargan a la vez: arrancan desfasadas media vuelta de ciclo.
- [ ] Cada losa avisa antes de descargar y después queda inerte.
- [ ] Pisar una losa en descarga quita exactamente 6 de salud y aturde 300 ms.
- [ ] Una misma descarga no daña dos veces al mismo luchador.
- [ ] Saltar por encima de una losa en descarga no causa daño.
- [ ] La CPU también recibe daño y aturdimiento de las losas.
- [ ] El daño de las losas no suma puntos ni llena la barra de furia.
- [ ] Un luchador aturdido no se mueve ni ataca, y se distingue visualmente del resto de estados.
- [ ] Desde la oleada 8, el ciclo de las losas pasa de 4 000 a 3 000 ms.
- [ ] Superar la oleada 50 suma 50 000 puntos y abre el modal de game over con la puntuación final.
- [ ] El score emitido nunca supera 10 000 000.
- [ ] En modo Arcade no hay barra de furia, la tecla `C` no hace nada y no hay losas en la arena.
- [ ] En modo Arcade siguen cumpliéndose los criterios de rondas, cronómetro de 60 segundos y puntuación de SPEC GJ-pixel-fighters-01.
- [ ] PAUSA congela a los luchadores, el cronómetro de oleada y el ciclo de las losas; REANUDAR continúa sin saltos.
- [ ] El botón FIN pone Salud en `0%` y abre el modal con la puntuación actual en los dos modos.
- [ ] "JUGAR DE NUEVO" reinicia puntuación, salud, furia y oleada (a 1) en Supervivencia.
- [ ] El modal de game over se abre una sola vez por partida en los dos modos.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'pixel-fighters'` desde los dos modos.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: un segundo modo en el mismo juego, no un juego nuevo.** Razón: comparte arena, luchadores, ataques e IA. Una segunda fila en `games` duplicaría el catálogo y partiría el leaderboard de un mismo juego.
- **Sí: un solo leaderboard para los dos modos.** Razón: `scores` no tiene columna de modo y añadirla es un cambio de schema que merece su propio spec. Las cotas (133 600 en arcade y 1 140 000 en supervivencia) hacen que supervivencia domine el top, y eso es intencionado: es el modo de puntuación abierta.
- **Sí: selector de modo en el HUD con `hudExtra`.** Razón: es el hueco que el shell ya ofrece y donde vive el selector de skin de Tetris y Snake. No amplía el contrato del shell.
- **Sí: componente `ModeSelect` propio en lugar de reutilizar `SkinSelect`.** Razón: `SkinSelect` tiene la etiqueta `Skin` escrita en el componente. Copiar su marcado y sus clases cuesta menos que generalizarlo y tocar dos juegos ya implementados.
- **Sí: reutilizar el hook `useGameSkin` para persistir el modo.** Razón: ya valida el valor guardado, cae a un valor por defecto y funciona sin `localStorage`. Es genérico pese al nombre.
- **Sí: cambiar de modo reinicia la partida desde cero.** Razón: los dos modos tienen bucles y puntuaciones distintos. Mezclarlos en una misma partida falsearía el leaderboard. Descartado bloquear el selector durante la partida, que obliga a salir y volver para cambiar de modo.
- **Sí: `mode` se lee al montar, no por una ref.** Razón: el reinicio por `key` ya garantiza que el efecto se vuelve a montar con el modo nuevo, y una ref dejaría el bucle a medio camino entre los dos modos.
- **Sí: una sola ronda por oleada.** Razón: el recuento al mejor de tres ya es el ritmo del arcade. En supervivencia, la tensión la da la salud arrastrada.
- **Sí: la salud del jugador se arrastra y se cura 25 al superar la oleada.** Razón: es la decisión central del modo. Sin cura la partida se corta en tres oleadas; con cura completa desaparece el riesgo.
- **Sí: cronómetro de 45 segundos y derrota al agotarse.** Razón: con salud arrastrada, esperar es una estrategia dominante. 45 segundos obligan a atacar y son menos que los 60 del arcade, donde el tiempo solo decidía la ronda.
- **Sí: salud del rival `min(250, 100 + 10 × (wave − 1))`.** Razón: la dificultad sube sin que una oleada se vuelva imposible de terminar en 45 segundos. El tope llega en la oleada 16.
- **Sí: perfiles de IA reutilizados, con factores de velocidad y decisión por oleada.** Razón: no hace falta inventar perfiles nuevos; dos multiplicadores acotados (1,25 y 0,6) bastan para que la oleada 30 se note frente a la 10.
- **Sí: victoria en la oleada 50.** Razón: un modo infinito no tiene final ni cota de puntuación. 50 oleadas dan un techo verificable y por debajo del límite de la base.
- **Sí: acotar el score a 10 000 000 en el juego, además del acotado del shell.** Razón: la progresión es abierta y el acotado en origen evita que una futura subida de bonus rompa el CHECK.
- **Sí: furia que se llena con el daño infligido y recibido.** Razón: cargar solo con el daño infligido premia a quien ya va ganando. Con `+0,5` por daño recibido, la barra es también una vía de remontada.
- **Sí: tecla `C` para el golpe de furia.** Razón: queda junto a `Z` y `X`, no provoca scroll y deja libre la mano derecha en las flechas.
- **Sí: el golpe de furia se puede bloquear, con 15 de daño.** Razón: un golpe imbloqueable convertiría el modo en una carrera por llenar la barra. Que atraviese mejor la guardia que un ataque normal (50 % frente a 25 %) ya lo hace valioso.
- **Sí: furia solo en el suelo y con una sola pose.** Razón: mantiene la regla del 01 de no atacar en el aire y evita añadir poses y hitboxes nuevos.
- **Sí: la CPU tiene furia desde la oleada 5.** Razón: en las primeras oleadas el jugador necesita aprender el modo. Desde la 5 la amenaza es simétrica.
- **Sí: dos losas fijas en `x = 240` y `x = 560`.** Razón: posiciones fijas se aprenden y convierten la arena en una decisión de posición. Descartadas las losas aleatorias, que harían el daño injusto e irrepetible.
- **Sí: ciclo con aviso antes de la descarga.** Razón: sin aviso, el daño es una lotería. 600 ms (500 en el ciclo rápido) bastan para salir caminando o saltando.
- **Sí: las losas también dañan a la CPU.** Razón: un peligro que solo castiga al jugador se percibe como trampa. Además abre la táctica de empujar al rival sobre una losa.
- **Sí: el daño de las losas no da puntos ni furia.** Razón: si diera puntos, la estrategia óptima sería empujar a la CPU a las losas y no pelear.
- **Sí: estar en el aire salva de la descarga.** Razón: hace útil el salto, que en el 01 solo servía para reposicionarse.
- **Sí: desde la oleada 8 el ciclo baja a 3 000 ms.** Razón: una sola curva de dificultad (la salud del rival) hace las oleadas tardías monótonas.
- **Sí: aturdimiento de 300 ms por descarga.** Razón: duele sin cadenas de aturdimiento: 300 ms es más que el hitstun normal (220 ms) y menos que el de furia (420 ms).
- **No: furia ni losas en el modo arcade.** Razón: el 01 ya está especificado y verificado con sus cotas de puntuación. Cambiarlo invalidaría los scores guardados de ese modo.
- **No: más peligros de arena ni golpes de furia por rival.** Razón: tres mecánicas nuevas ya es el límite de un spec. Lo demás, si llega, va en otro.
- **No: audio del golpe de furia ni de la descarga.** Razón: no hay assets propios, igual que en el 01.
- **Sí: `onWaveChange` y `onFuryChange` como callbacks nuevos.** Razón: respetan la convención de un callback por métrica del HUD, igual que el resto de juegos.
- **Sí: no emitir `onRivalChange` ni `onRoundsChange` en supervivencia.** Razón: en ese modo no hay escalera ni rondas, y la play-page compone `stats` según el modo.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «PIXEL FIGHTERS», sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                                  | Mitigación                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| La rama `survival` en el loop duplica el código de fases del 01         | Las fases comparten `fight`; solo cambian intro, fin y la condición de fin, encapsuladas en `survival.ts`.                |
| Supervivencia aplasta al modo arcade en el leaderboard                  | Aceptado y documentado en las decisiones. Si molesta, un spec posterior añade la columna de modo a `scores`.              |
| La salud arrastrada hace que la partida se corte en dos oleadas         | Cura de 25 al superar cada oleada, verificada en el paso 3 y ajustable por constante.                                     |
| La furia desequilibra el combate y el modo se reduce a esperar la barra | La barra solo da un golpe (30 de daño sobre 100 de salud), es bloqueable y la CPU también la tiene desde la oleada 5.     |
| Cadenas de aturdimiento entre losa y golpes                             | Una descarga daña una sola vez por luchador y el aturdimiento es de 300 ms, menor que un ciclo de losa.                   |
| Un luchador queda atrapado entre una losa y la pared                    | Las losas están a 240 y 560, a más de 200 px de cada pared, así que siempre hay suelo seguro a los lados.                 |
| Cambiar de modo por error borra una partida en curso                    | El desplegable está en el HUD, fuera del área de juego, y el reinicio es inmediato y visible (puntuación a 0).            |
| El ciclo de las losas avanza de golpe al volver de otra pestaña         | `updateTiles` recibe el `dt` ya acotado a 100 ms del loop del 01.                                                         |
| La barra de furia emite demasiados renders de React                     | `onFuryChange` emite el entero truncado y solo cuando cambia: como máximo 100 emisiones por partida.                      |
| Partida de supervivencia muy larga (50 oleadas)                         | Cada oleada dura 45 segundos como máximo y la dificultad creciente la corta antes; el botón FIN permite cerrar y guardar. |
| Cualquier cliente puede insertar scores (RLS abierto)                   | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                                                      |

---

## What is **not** in this spec

- Cambios en las reglas del modo arcade de SPEC GJ-pixel-fighters-01.
- Furia y losas eléctricas en el modo arcade.
- Leaderboards separados por modo y cambios de schema en `scores`.
- Más peligros de arena y golpes de furia distintos por rival.
- Ataques en el aire, agarres y combos con cancelación.
- Audio de furia, descarga o aturdimiento.
- Skins y sprites de imagen.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en la fila de `games`, en `GamePlayShell`, en `TouchControls`, en `/games`, `/games/[id]` y `/hall-of-fame`.

Cada uno de esos puntos, si llega, va en su propio spec.
