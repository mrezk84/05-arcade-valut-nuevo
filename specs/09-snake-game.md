# SPEC 09 — Integración del juego Snake

> **Estado:** Aprobado· **Depende de:** SPEC 06, SPEC 07, SPEC 08 · **Fecha:** 2026-10-05
> **Objetivo:** Integrar Snake como juego jugable en `/games/snake/play`, con HUD de puntuación, longitud y nivel, y guardado del score en el leaderboard de Supabase.

---

## Scope

**In:**

- Componente `components/games/SnakeGame.tsx`, diseñado desde cero (no hay lógica de origen), con canvas 800×600 y una cuadrícula de 20×15 celdas de 40 px.
- Módulos `components/games/snake/sprites.ts` (atlas de frutas portado de `sprites.js` y carga de la imagen) y `components/games/snake/constants.ts` (cuadrícula, tick y ritmo de niveles).
- Play-page `app/games/snake/play/page.tsx` sobre `GamePlayShell`, con una línea de controles bajo el CRT.
- Asset `public/games/snake/fruits.png`, copiado de `references/source-assets/snake-assets/fruits.png`.
- Movimiento por pasos discretos: un tick cada 140 ms, que baja 10 ms cada vez que sube el nivel, con un mínimo de 70 ms.
- Chocar con una pared o con el propio cuerpo termina la partida.
- Una fruta a la vez, elegida al azar entre las 22 de la fila pixel art, que da +10 puntos y 1 segmento de crecimiento. Cada 5 frutas sube el nivel.
- Controles `←↑→↓` y `WASD`, con `preventDefault` solo en las flechas. La dirección contraria a la actual se ignora, y hay una cola de entrada de 2 giros por tick.
- Cuerpo y cabeza dibujados con rectángulos en verde neón, sin sprites. Las frutas se escalan para caber en la celda sin deformarse.
- El HUD de la plataforma refleja `score`, `length` y `level`. No hay vidas.
- La victoria (llenar las 300 celdas) también dispara `onGameOver(score)`.
- Fila `snake` en la tabla `games`, con `cat = 'ARCADE'`, `color = 'green'`, `cover = 'cover-snake'` (reutilizada) y `sort_order = 10`.

**Fuera de alcance (para specs futuros):**

- Teclas `P`/`Esc` de pausa: la pausa la controla únicamente la plataforma.
- Overlays, menú de inicio y estado de "pulsa una tecla para empezar".
- Modos de dificultad, obstáculos, frutas especiales y wrap-around.
- Las otras dos filas de estilo de `fruits.png` (suave y realista) y las skins.
- Sprites de cuerpo y cabeza (el atlas no los trae).
- Audio y música.
- Distinguir victoria de derrota en el modal del shell.
- Controles táctiles o mobile.
- Supabase Auth y endurecimiento de RLS.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- Cambios en `GamePlayShell` y en las play-pages de Asteroids, Tetris y Arkanoid.

---

## Data model

### Fila de `games`

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (
  'snake', 'SNAKE', 'Come frutas y crece sin chocar.',
  'Guía a la serpiente por el tablero con las flechas o WASD. Cada fruta suma 10 puntos y alarga el cuerpo. Cada cinco frutas sube el nivel y la serpiente se acelera. No toques las paredes ni tu propia cola.',
  'ARCADE', 'cover-snake', 'green', 10
);
```

`cat = 'ARCADE'` y `color = 'green'` ya son valores válidos del CHECK real. No hay migración de schema.

### Props del componente

```ts
interface SnakeGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Captura del HUD

| Estado del juego                                      | Callback                 |
| ----------------------------------------------------- | ------------------------ |
| `score` (10 por fruta)                                | `onScoreChange(score)`   |
| `snake.length` (3 al iniciar, +1 por fruta)           | `onLengthChange(length)` |
| `level` (`floor(frutas / 5) + 1`)                     | `onLevelChange(level)`   |
| Choque con pared o cuerpo, o tablero lleno (victoria) | `onGameOver(finalScore)` |

Reglas de emisión:

- Cada callback solo se dispara cuando el valor cambia respecto al anterior.
- Al montar se emite el estado inicial: score 0, longitud 3, nivel 1.
- `onGameOver` se dispara una sola vez, protegido por un flag `gameOver`.
- Al llenar las 300 celdas se llama a `onGameOver(score)` igual que en un choque.
- El botón FIN del shell no pasa por el juego: la play-page abre el modal con `setOver(true)`. No hay vidas que poner a 0.

### Constantes y tipos

```ts
// components/games/snake/constants.ts
export const COLS = 20;
export const ROWS = 15;
export const CELL = 40;
export const START_LENGTH = 3;
export const TICK_START = 140; // ms
export const TICK_STEP = 10; // ms menos por nivel
export const TICK_MIN = 70; // ms
export const FRUITS_PER_LEVEL = 5;
export const POINTS_PER_FRUIT = 10;
export const INPUT_QUEUE_MAX = 2;

// components/games/snake/sprites.ts
export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type FruitName =
  | 'banana'
  | 'orange'
  | /* ... 22 nombres de sprites.js */ 'melon';
export const FRUITS: Record<FruitName, FruitSprite>; // fila pixel art, y = 136, h = 160
export function loadFruits(): Promise<HTMLImageElement>;
```

```ts
// Estado interno del juego (dentro del efecto de SnakeGame.tsx)
interface Cell {
  col: number;
  row: number;
}
// snake[0] es la cabeza; dir es { dx, dy }; fruit es { col, row, name }.
```

Convenciones:

- Origen en la esquina superior izquierda. `col` va de 0 a 19 y `row` de 0 a 14.
- Posición inicial: cabeza en `(5, 7)` y cuerpo a su izquierda, avanzando a la derecha.
- Tick: `max(70, 140 − (level − 1) × 10)` ms. Llega al mínimo en el nivel 8.
- Cada fruta nueva aparece en una celda libre al azar, con un sprite al azar de `FRUITS`.
- El sprite se escala para caber en 36×36 px con proporción original, centrado en la celda.
- Máximo teórico: 297 frutas, es decir, 2 970 puntos.
- La imagen se sirve desde `/games/snake/fruits.png`. `loadFruits()` devuelve una promesa, el loop no arranca hasta que resuelve y el cleanup cancela si el componente se desmonta antes.
- El cuerpo es verde neón (`var(--green)` de la plataforma, resuelto en el paso de diseño). La cabeza lleva dos ojos.

### `scores`

No cambia. Se inserta `{ game_id: 'snake', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Copiar el asset.** Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`.
   Verificación: con `npm run dev`, `/games/snake/fruits.png` responde 200.

2. **Módulos de constantes y sprites.** Crear `components/games/snake/constants.ts` con las constantes del data model y `components/games/snake/sprites.ts` con `FRUITS` (los 22 recortes de `sprites.js`, tipados), `loadFruits()` (promesa con la ruta `/games/snake/fruits.png`) y `drawFruit()` (escala a 36×36 sin deformar y centra en la celda). Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

3. **Esqueleto de `SnakeGame` y play-page.** Crear `components/games/SnakeGame.tsx` (`'use client'`) con las props del data model copiadas a refs (patrón de `ArkanoidGame`), un canvas 800×600 con escalado CSS y, tras cargar las frutas, un dibujo estático de la cuadrícula, la serpiente inicial y una fruta. Crear `app/games/snake/play/page.tsx` con `dynamic(..., { ssr: false })`, el estado `score`, `length` (inicial 3), `level`, `paused`, `over` y `gameKey`, `GamePlayShell` (con `paused || over` hacia el juego) y una línea de controles bajo el CRT. El encaje del canvas en `.crt-screen` y el aspecto de la serpiente y el tablero se diseñan con `/frontend-design`.
   Verificación: `/games/snake/play` carga sin errores de consola y el canvas llena la pantalla CRT sin desbordar.

4. **Loop, movimiento y teclado.** Implementar el loop con acumulador de tiempo: sigue dibujando con `paused`, actualiza `lastTime` en cada frame, acota `dt` a 100 ms y avanza un paso cada vez que se acumula el tick. Implementar la dirección, la cola de entrada de 2 giros y el bloqueo de la dirección contraria. Añadir `keydown` en `window` para `←↑→↓` y `WASD`, con `preventDefault` solo en las flechas. Vaciar la cola al pausar y reanudar. Cleanup completo en el `return` del efecto.
   Verificación: la serpiente avanza por pasos, gira con flechas y WASD, no se da la vuelta sobre sí misma, PAUSA la congela y la página no hace scroll con las flechas.

5. **Frutas, crecimiento y niveles.** Implementar la aparición de la fruta en una celda libre al azar con un sprite al azar, el crecimiento de 1 segmento y los +10 puntos al comerla, y el nivel `floor(frutas / 5) + 1` con la reducción del tick hasta el mínimo de 70 ms.
   Verificación: comer una fruta suma 10 puntos, alarga la serpiente y aparece otra fruta en una celda libre, y cada 5 frutas el movimiento se acelera.

6. **Capturar el HUD y el fin de partida.** Emitir `score`, `length` y `level` por los callbacks (solo al cambiar, con el estado inicial al montar). Detectar el choque con pared y con el propio cuerpo, y la victoria al llenar las 300 celdas, y llamar a `onGameOver(score)` una sola vez. En la play-page, conectar los callbacks y hacer que FIN abra el modal.
   Verificación: el HUD React refleja puntuación, longitud y nivel en tiempo real, y al chocar o ganar aparece el modal de game over con la puntuación final.

7. **Insertar la fila en `games`.** Aplicar la migración con `apply_migration` usando el `insert` del data model. Va tras la play-page para que el juego no aparezca antes de ser jugable.
   Verificación: la card aparece en `/games` con `cover-snake`, `/games/snake` carga con datos reales y el tab SNAKE aparece en `/hall-of-fame`.

---

## Acceptance criteria

- [ ] La card de Snake aparece en `/games` con `cover-snake` y `/games/snake` carga con datos reales.
- [ ] El tab SNAKE aparece en `/hall-of-fame` sin cambios de código en esa página.
- [ ] `/games/snake/fruits.png` responde 200.
- [ ] `/games/snake/play` carga sin errores de SSR ni de consola.
- [ ] El canvas es de 800×600 y llena la pantalla CRT sin desbordar.
- [ ] Al empezar, la serpiente tiene 3 segmentos, la cabeza está en la celda `(5, 7)` y avanza hacia la derecha.
- [ ] Al empezar, el HUD React muestra puntuación 0, longitud 3 y nivel 01, y no muestra vidas.
- [ ] `←↑→↓` y `WASD` giran la serpiente.
- [ ] Pulsar las flechas no hace scroll de la página.
- [ ] Pulsar `P` o `Esc` no pausa el juego.
- [ ] La serpiente ignora la dirección contraria a la actual.
- [ ] Dos giros pulsados dentro de un mismo tick se ejecutan en ticks consecutivos y no se pierden.
- [ ] Solo hay una fruta en el tablero y nunca aparece sobre el cuerpo de la serpiente.
- [ ] La fruta se dibuja con un sprite de `fruits.png`, sin deformar, dentro de su celda.
- [ ] Comer una fruta suma exactamente 10 puntos y alarga la serpiente en 1 segmento.
- [ ] El HUD React muestra la longitud y la puntuación, y coinciden con las del juego.
- [ ] El nivel sube a 2 al comer la 5.ª fruta y el tick pasa de 140 a 130 ms.
- [ ] El tick nunca baja de 70 ms.
- [ ] Chocar con una pared abre el modal de game over con la puntuación final.
- [ ] Chocar con el propio cuerpo abre el modal de game over con la puntuación final.
- [ ] Al llenar las 300 celdas aparece el modal de game over con la puntuación final.
- [ ] El modal de game over se abre una sola vez por partida.
- [ ] El botón FIN abre el modal con la puntuación actual.
- [ ] No se muestra ningún overlay, menú ni mensaje de inicio dibujado por el juego.
- [ ] PAUSA congela la serpiente; REANUDAR continúa sin saltos ni pasos acumulados.
- [ ] Una tecla pulsada durante la pausa no gira la serpiente al reanudar.
- [ ] Con el modal abierto, las teclas no mueven la serpiente.
- [ ] "JUGAR DE NUEVO" reinicia score (a 0), longitud (a 3), nivel (a 1), serpiente y fruta.
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = 'snake'` y el botón se deshabilita tras el primer envío.
- [ ] Si el insert falla, el modal no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] El score guardado aparece en `/games/snake` y en el tab SNAKE de `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos.
- [ ] `/games/asteroids/play`, `/games/tetris/play` y `/games/arkanoid/play` siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: no extraer el shell.** Razón: `GamePlayShell` ya existe desde SPEC 07 y cubre HUD, pausa, modal y guardado.
- **Sí: diseñar el juego desde cero.** Razón: la referencia solo trae `fruits.png` y `sprites.js`, sin lógica de juego, así que reglas, loop y controles se definieron en las preguntas.
- **Sí: portar `sprites.js` a un módulo TS tipado.** Razón: el original depende de `window.SPRITE_ATLAS` y de una ruta relativa, que no funcionan bajo `/games/snake/play` ni en SSR. El `.js` queda intacto en `references/`.
- **Sí: usar solo la fila pixel art de `fruits.png`.** Razón: es la que cataloga `sprites.js` y encaja con la estética CRT de la plataforma.
- **No: las filas suave y realista.** Razón: mezclar estilos rompería la coherencia visual. Cada una podría ser una skin en otro spec.
- **Sí: cuerpo y cabeza dibujados con rectángulos.** Razón: el atlas no trae sprites de serpiente. Pedirlos retrasaría el spec y los rectángulos en verde neón encajan con la plataforma.
- **Sí: cuadrícula de 20×15 con celdas de 40 px (canvas 800×600).** Razón: la proporción 4:3 encaja con `.crt-screen`, igual que Arkanoid. Descartadas 17×15 (estilo Google Snake) y 15×15 (cuadrada).
- **Sí: pasos discretos y muerte al tocar la pared.** Razón: es la regla clásica y la más simple de verificar. Descartados el wrap-around y la interpolación suave.
- **Sí: una fruta a la vez, +10 puntos y +1 segmento.** Razón: mantiene la puntuación predecible, con un máximo teórico de 2 970 puntos.
- **Sí: nivel cada 5 frutas y tick de 140 ms que baja 10 ms por nivel, con mínimo de 70 ms.** Razón: da progresión sin un nivel imposible. El mínimo se alcanza en el nivel 8. Descartada la velocidad fija.
- **Sí: sin vidas.** Razón: Snake termina en la primera colisión. El HUD muestra longitud en lugar de vidas.
- **Sí: el HUD refleja `score`, `length` y `level`.** Razón: la longitud es la métrica propia del juego y es lo único que el jugador no ve reflejado en la puntuación.
- **Sí: la victoria (300 celdas) también dispara `onGameOver(score)`.** Razón: sin esto, quien llena el tablero no podría guardar su score.
- **No: distinguir victoria de derrota en el modal.** Razón: el shell no lo soporta y ampliarlo merece su propio spec.
- **Sí: `←↑→↓` y `WASD`, con `preventDefault` solo en las flechas.** Razón: solo las flechas provocan scroll, y `WASD` no necesita bloqueo.
- **Sí: ignorar la dirección contraria y cola de entrada de 2 giros.** Razón: sin esto, un giro rápido en U mata a la serpiente de forma injusta. Descartada la cola vacía, que pierde giros.
- **Sí: cada giro de la cola se valida contra la última dirección ya encolada, no contra la dirección actual.** Razón: es lo que evita que dos pulsaciones rápidas reviertan la serpiente.
- **Sí: pausa solo de la plataforma, sin `P`/`Esc`.** Razón: enrutarlas obligaría a ampliar el contrato del shell con un callback nuevo.
- **Sí: vaciar la cola de entrada al pausar y reanudar.** Razón: una tecla pulsada durante la pausa giraría la serpiente al reanudar.
- **Sí: sin overlays ni estado de "pulsa una tecla para empezar".** Razón: la plataforma ya tiene su UI. Descartado el estado "listo" porque añade complejidad sin aportar a la integración.
- **Sí: `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.** Razón: al reanudar o volver de otra pestaña, el acumulador no debe soltar varios pasos de golpe.
- **Sí: fruta escalada a 36×36 sin deformar y centrada.** Razón: los recortes miden entre 110×160 y 170×160 px y la celda es de 40 px. Escalar sin proporción los deformaría.
- **Sí: sin audio.** Razón: la referencia no trae sonidos.
- **Sí: `green` y `cover-snake` reutilizada.** Razón: `green` ya es válido en el CHECK y ningún juego lo usa, y la clase ya existe en `globals.css`. Si la cover no encaja en la card, se rediseña con `/frontend-design` en un spec aparte.
- **Sí: `sort_order = 10`.** Razón: es el siguiente libre tras Asteroids (7), Tetris (8) y Arkanoid (9).
- **Sí: sin lógica de límite de score en el juego.** Razón: el máximo teórico es 2 970 puntos y el shell ya acota a 10 000 000.
- **Sí: columnas reales de `scores` (`name`, sin `user_id`).** Razón: el spec 06 está desactualizado y manda el schema leído con `list_tables`.
- **Sí: reinicio por `key`.** Razón: es el patrón vigente en Asteroids, Tetris y Arkanoid.
- **Sí: la fila de `games` va en el último paso.** Razón: el juego no debe aparecer en `/games` antes de ser jugable.
- **Sí: verificar la victoria con un tablero reducido temporalmente en desarrollo.** Razón: llenar 300 celdas a mano no es realista. Esa verificación no cambia el código entregado.
- **No: partir en dos specs.** Razón: un solo canvas, un asset y lógica propia sencilla.

---

## Risks

| Riesgo                                                             | Mitigación                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| La imagen no carga antes de desmontar el componente                | `loadFruits()` devuelve una promesa y el efecto ignora el resultado si ya hay cleanup.             |
| Los recortes de `sprites.js` no coinciden con el PNG               | Verificar visualmente en el paso 3 que cada fruta se ve completa y sin cortes.                     |
| Giro en U en un solo tick mata a la serpiente                      | Ignorar la dirección contraria y validar contra la dirección ya ejecutada, no contra la pendiente. |
| El acumulador suelta varios pasos tras pausar o cambiar de pestaña | `dt` acotado a 100 ms y `lastTime` actualizado en cada frame.                                      |
| Tecla "atascada" al pausar con una flecha pulsada                  | Vaciar la cola de entrada al pausar y reanudar.                                                    |
| Elegir una celda libre al azar es lento con el tablero casi lleno  | Elegir entre la lista de celdas libres y no reintentar al azar. Sin celdas libres, es victoria.    |
| El canvas 800×600 no encaja en `.crt-screen` en tamaños pequeños   | Escalado CSS resuelto en el paso 3 con `/frontend-design`, verificado con el criterio de ajuste.   |
| Listeners duplicados al reiniciar                                  | Cleanup completo en el efecto y reinicio por `key`.                                                |
| Dos `onGameOver` seguidos (fin natural y botón FIN)                | El juego lo dispara una sola vez y el shell congela el juego al abrir el modal.                    |
| Cualquier cliente puede insertar scores (RLS abierto)              | Aceptado, igual que en SPEC 06. Se resuelve en un spec de seguridad.                               |

---

## What is **not** in this spec

- Teclas `P`/`Esc` de pausa, overlays y menú de inicio.
- Modos de dificultad, obstáculos, frutas especiales y wrap-around.
- Las filas suave y realista de `fruits.png` y las skins.
- Sprites de cuerpo y cabeza de la serpiente.
- Audio y música.
- Distinguir victoria de derrota en el modal.
- Controles táctiles o mobile.
- Supabase Auth y RLS más estricto.
- Cambios en `/games`, `/games/[id]`, `/hall-of-fame` y `GamePlayShell`.

Cada uno de esos puntos, si llega, va en su propio spec.
