# SPEC GJ-ciempies-02 — Araña, pulga y escorpión en Ciempiés

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07, SPEC GJ-ciempies-01 · **Fecha:** 2026-10-15
> **Objetivo:** Añadir a Ciempiés una araña en la zona del jugador desde la oleada 1, una pulga que siembra setas desde la oleada 2 y un escorpión que envenena setas desde la oleada 3.

---

## Por qué existe este spec

SPEC GJ-ciempies-01 deja un juego completo, pero la zona del jugador solo se ve amenazada cuando baja el ciempiés, y cada oleada solo se distingue de la anterior por la velocidad y el número de cabezas. Este spec añade los tres bichos clásicos de Centipede, y cada uno cambia una decisión del jugador: dónde ponerse (araña), cuándo limpiar setas (pulga) y a qué setas no acercar al ciempiés (escorpión).

Es un spec aparte porque es opcional y cambia la puntuación: el juego es completo sin él.

---

## Scope

**In:**

- Módulo `components/games/ciempies/bugs.ts` con las constantes, los tipos y la lógica pura de araña, pulga y escorpión.
- Araña desde la oleada 1: cruza la zona del jugador en zigzag, se come las setas por las que pasa y mata al tocar la nave. Vale 300, 600 o 900 puntos según su distancia vertical a la nave.
- Pulga desde la oleada 2: cae en vertical cuando quedan menos de 5 setas en la zona del jugador, siembra setas al caer, aguanta dos disparos y mata al tocar la nave. Vale 200 puntos.
- Escorpión desde la oleada 3: cruza una fila de la parte alta y envenena las setas por las que pasa. Vale 1 000 puntos y no mata.
- Setas envenenadas: una cabeza que choca con una de ellas se lanza en picado hasta la fila 23.
- Texto flotante con los puntos durante 800 ms al abatir la araña, la pulga o el escorpión.
- Cambios en `field.ts` (capa de veneno) y en `centipede.ts` (picado), sin cambiar las reglas de SPEC GJ-ciempies-01 para setas sin veneno.
- Dibujo de los tres bichos y de las setas envenenadas en `components/games/ciempies/draw.ts`, con su aspecto diseñado con `/frontend-design`.

**Fuera de alcance (para specs futuros):**

- Cabezas que entran por los lados en la zona del jugador.
- Nuevas métricas en el HUD React (bichos abatidos, peligros activos).
- Audio de los bichos.
- Selector de oleada inicial o de dificultad.
- Cambios en la composición de las oleadas, el tick del ciempiés, la puntuación de segmentos y setas, las vidas o la reaparición de SPEC GJ-ciempies-01.
- Skins y controles táctiles o mobile.
- Cambios en la fila de `games`, en `GamePlayShell`, en `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y endurecimiento de RLS.

---

## Data model

### Constantes y tipos

```ts
// components/games/ciempies/bugs.ts
export const SPIDER_FROM_WAVE = 1;
export const SPIDER_EVERY_MS = 5000; // desde que la anterior sale o muere
export const SPIDER_W = 36;
export const SPIDER_H = 20;
export const SPIDER_VX = 120; // px/s
export const SPIDER_VY = 180; // px/s
export const SPIDER_TOP_Y = 425; // dos filas por encima de la zona del jugador
export const SPIDER_POINTS = [900, 600, 300]; // < 50 px, < 100 px, resto

export const FLEA_FROM_WAVE = 2;
export const FLEA_CHECK_MS = 1000;
export const FLEA_COOLDOWN_MS = 4000;
export const FLEA_ZONE_MIN = 5; // setas en filas 19–23
export const FLEA_SIZE = 16;
export const FLEA_SPEED = 300; // px/s
export const FLEA_SPEED_HIT = 600; // px/s tras el primer impacto
export const FLEA_SEED_CHANCE = 0.25;
export const FLEA_POINTS = 200;

export const SCORPION_FROM_WAVE = 3;
export const SCORPION_EVERY_MS = 12_000;
export const SCORPION_W = 32;
export const SCORPION_H = 20;
export const SCORPION_SPEED = 100; // px/s
export const SCORPION_ROWS = [2, 14] as const; // fila al azar, inclusive
export const SCORPION_POINTS = 1000;

export const BUG_MULT_STEP = 0.1; // por oleada
export const BUG_MULT_MAX = 1.5;
export const POINTS_TEXT_MS = 800;

export interface Spider {
  x: number;
  y: number;
  dirX: 1 | -1;
  dirY: 1 | -1;
}
export interface Flea {
  x: number;
  y: number;
  hits: 0 | 1;
  lastRow: number;
}
export interface Scorpion {
  x: number;
  row: number;
  dirX: 1 | -1;
}
export interface Bugs {
  spider: Spider | null;
  flea: Flea | null;
  scorpion: Scorpion | null;
  spiderCooldownMs: number;
  fleaCheckMs: number;
  fleaCooldownMs: number;
  scorpionCooldownMs: number;
}
```

```ts
// Cambios en módulos de SPEC GJ-ciempies-01
// field.ts: capa de veneno paralela al campo
export type Poison = Uint8Array; // COLS × ROWS, 1 = seta envenenada
// centipede.ts: Chain gana un flag
interface Chain {
  segments: Segment[];
  vdir: 1 | -1;
  diving: boolean;
}
```

`Bugs` y `Poison` viven en el estado interno del efecto de `CiempiesGame.tsx`, junto al estado de SPEC GJ-ciempies-01. `x` e `y` son el centro de cada bicho, en píxeles.

### Reglas

Comunes:

- Multiplicador de velocidad de los bichos: `min(1.5, 1 + 0.1 × (wave − 1))`. Se aplica a `SPIDER_VX`, `SPIDER_VY`, `FLEA_SPEED`, `FLEA_SPEED_HIT` y `SCORPION_SPEED`.
- Solo hay un bicho de cada tipo a la vez.
- Los bichos usan el tiempo de juego: se congelan en pausa, con el modal abierto y durante la pausa de reaparición.
- Al morir la nave se eliminan los tres bichos y sus contadores vuelven a su valor inicial.
- Al subir de oleada, los bichos activos siguen y sus contadores no se reinician.
- El disparo se comprueba en cada subpaso contra los rectángulos de los bichos antes que contra segmentos y setas.

Araña:

- Al empezar la partida, `spiderCooldownMs` vale `SPIDER_EVERY_MS`. Al llegar a 0 aparece por un lado al azar (`x = −18` o `x = 818`) con una `y` al azar entre `SPIDER_TOP_Y` y `600 − SPIDER_H / 2`.
- Avanza en horizontal hacia el lado contrario y rebota en vertical entre esos dos límites. Al salir por el lado contrario desaparece y el contador vuelve a `SPIDER_EVERY_MS`.
- La seta de la celda bajo su centro desaparece sin dar puntos.
- Si su rectángulo se solapa con la hitbox de la nave, la nave muere igual que con un segmento.
- Al abatirla suma 900 si `|araña.y − nave.y| < 50`, 600 si es menor que 100 y 300 en otro caso. El contador vuelve a `SPIDER_EVERY_MS`.

Pulga:

- Solo desde la oleada `FLEA_FROM_WAVE` (2). Cada `FLEA_CHECK_MS`, si no hay pulga, el enfriamiento terminó y quedan menos de `FLEA_ZONE_MIN` setas en las filas 19–23, la pulga aparece en `y = −8`, en el centro de una columna al azar.
- Cae en vertical. Al entrar en una fila nueva entre la 1 y la 22, si la celda está vacía, crea una seta con 4 de vida con probabilidad `FLEA_SEED_CHANCE`.
- El primer impacto no la mata: pasa a `FLEA_SPEED_HIT`. El segundo la mata y suma `FLEA_POINTS` (200).
- Si se solapa con la nave, la nave muere. Al salir por abajo o morir, empieza el enfriamiento de `FLEA_COOLDOWN_MS`.

Escorpión:

- Solo desde la oleada `SCORPION_FROM_WAVE` (3). Al llegar la oleada 3, `scorpionCooldownMs` vale `SCORPION_EVERY_MS`. Al llegar a 0 aparece por un lado al azar en una fila al azar entre la 2 y la 14.
- Cruza la fila en horizontal y desaparece al salir por el lado contrario. Cada seta de la celda bajo su centro queda envenenada.
- No mata a la nave, porque nunca entra en la zona del jugador.
- Al abatirlo suma `SCORPION_POINTS` (1 000). Al salir o morir, el contador vuelve a `SCORPION_EVERY_MS`.

Setas envenenadas:

- Si la siguiente celda horizontal de una cabeza tiene una seta envenenada, su cadena pasa a `diving = true`.
- Mientras `diving`, la cabeza baja una fila por tick sin moverse en horizontal, y el cuerpo la sigue como siempre.
- Al llegar a la fila 23, `diving` pasa a `false`, `vdir` pasa a −1 y la cadena sigue con las reglas de SPEC GJ-ciempies-01.
- El veneno desaparece cuando la seta se destruye, cuando la araña se la come y cuando las setas se restauran tras una muerte.
- Si una cadena en picado se parte, las dos cadenas resultantes conservan `diving`.

Puntuación:

- El score sigue sin máximo teórico. Los bichos solo suman puntos, y el shell sigue acotando a 10 000 000.
- La vida extra cada 12 000 puntos de SPEC GJ-ciempies-01 cuenta también los puntos de los bichos.

### Props, HUD y callbacks

`CiempiesGameProps` y la tabla de captura del HUD de SPEC GJ-ciempies-01 no cambian. Los puntos de los bichos llegan al HUD React por `onScoreChange`, y las muertes por araña o pulga por `onLivesChange`.

### `games` y `scores`

No cambian. No hay migración de schema ni fila nueva. Se sigue insertando `{ game_id: 'ciempies', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulo de bichos.** Crear `components/games/ciempies/bugs.ts` con las constantes y los tipos del data model, el multiplicador por oleada y funciones puras para crear, mover y puntuar cada bicho. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Araña.** En `CiempiesGame.tsx`, añadir `Bugs` al estado, avanzar el contador de la araña con el tiempo de juego, moverla en zigzag, borrar las setas bajo su centro, matar la nave al solaparse y puntuarla según la distancia al abatirla, con el texto flotante. Eliminar los bichos y reiniciar los contadores al morir la nave. El aspecto de la araña y del texto se diseña con `/frontend-design`.
   Verificación: a los 5 s de partida una araña cruza la zona del jugador, se come setas, abatirla suma 300, 600 o 900 según la distancia y tocarla cuesta una vida.

3. **Pulga.** Desde la oleada 2, comprobar cada segundo el número de setas en las filas 19–23, hacer caer la pulga, sembrar setas al azar, aplicar los dos impactos y matar la nave al solaparse.
   Verificación: con la oleada inicial puesta temporalmente en 2 en desarrollo, la pulga cae al limpiar la zona inferior, deja setas, acelera al primer impacto y suma 200 al segundo.

4. **Escorpión y veneno.** Añadir la capa `Poison` a `field.ts`, con limpieza al destruir, comer y restaurar setas. Añadir `diving` a `Chain` en `centipede.ts` y el picado al chocar con una seta envenenada. Desde la oleada 3, mover el escorpión, envenenar setas y puntuarlo. Dibujar las setas envenenadas con un aspecto distinto.
   Verificación: con la oleada inicial puesta temporalmente en 3 en desarrollo, el escorpión envenena setas, una cabeza que toca una de ellas baja en picado hasta la fila 23 y abatirlo suma 1 000. La oleada inicial vuelve a 1 antes de commitear.

---

## Acceptance criteria

- [ ] En la oleada 1 aparece una araña a los 5 s de partida, por el borde izquierdo o derecho.
- [ ] La araña se mueve en zigzag sin subir por encima de `y = 425` ni salir por abajo del canvas.
- [ ] Las setas por las que pasa el centro de la araña desaparecen sin sumar puntos.
- [ ] Abatir la araña suma exactamente 900, 600 o 300 puntos según su distancia vertical a la nave, y muestra ese valor durante 800 ms.
- [ ] Tocar la araña resta una vida.
- [ ] En la oleada 1 no aparecen la pulga ni el escorpión.
- [ ] Desde la oleada 2, la pulga cae cuando quedan menos de 5 setas en las filas 19–23, y nunca hay dos a la vez.
- [ ] La pulga crea setas en algunas de las celdas vacías por las que cae, nunca en las filas 0 ni 23.
- [ ] El primer impacto acelera la pulga sin sumar puntos, y el segundo la mata y suma exactamente 200.
- [ ] Tocar la pulga resta una vida.
- [ ] Desde la oleada 3, el escorpión cruza una fila entre la 2 y la 14 y envenena las setas por las que pasa.
- [ ] Las setas envenenadas se distinguen a simple vista de las normales.
- [ ] Abatir el escorpión suma exactamente 1 000 puntos.
- [ ] Una cabeza que choca con una seta envenenada baja en picado hasta la fila 23 y después sigue moviéndose con las reglas normales.
- [ ] Destruir una seta envenenada o perder una vida elimina su veneno.
- [ ] Los bichos son más rápidos en oleadas más altas, con un tope de 1,5 veces la velocidad base.
- [ ] Al morir la nave desaparecen los tres bichos y la araña vuelve a tardar 5 s en aparecer.
- [ ] PAUSA congela la araña, la pulga, el escorpión y sus contadores; REANUDAR continúa sin saltos.
- [ ] Durante la pausa de reaparición de 1 s no se mueve ningún bicho.
- [ ] Los puntos de los bichos se reflejan al instante en el HUD React y cuentan para la vida extra cada 12 000 puntos.
- [ ] Perder la última vida por araña o pulga abre el modal de game over una sola vez.
- [ ] "JUGAR DE NUEVO" empieza sin bichos, sin setas envenenadas y con los contadores iniciales.
- [ ] La oleada inicial entregada es 1.
- [ ] Los criterios de SPEC GJ-ciempies-01 siguen cumpliéndose.
- [ ] `/games/ciempies/play` carga sin errores de SSR ni de consola.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: un spec aparte para los bichos.** Razón: son opcionales y cambian la puntuación. El juego queda completo con SPEC GJ-ciempies-01 y este spec se puede implementar, o descartar, después.
- **Sí: araña, pulga y escorpión.** Razón: son los tres bichos del Centipede original y cada uno ataca una parte distinta del campo. Descartadas las cabezas que entran por los lados, que cambian las reglas del ciempiés de SPEC GJ-ciempies-01.
- **Sí: introducir los bichos por oleadas (araña en 1, pulga en 2, escorpión en 3).** Razón: cada oleada añade una novedad además de la velocidad, y la primera sigue siendo fácil de aprender.
- **Sí: la araña puntúa según la distancia vertical a la nave (900, 600 o 300).** Razón: es la regla clásica y premia el riesgo de dejarla acercarse.
- **Sí: la araña se come setas sin dar puntos.** Razón: limpia la zona del jugador y contrarresta a la pulga, y dar puntos premiaría esperarla.
- **Sí: la pulga aparece por escasez de setas en la zona del jugador.** Razón: es la regla clásica e impide que el jugador vacíe la zona inferior para jugar sin obstáculos.
- **Sí: enfriamiento de 4 s tras cada pulga.** Razón: sin él, con la zona vacía caería una pulga tras otra.
- **Sí: la pulga no siembra en las filas 0 ni 23.** Razón: la fila 0 es la entrada del ciempiés y la 23 es el fondo de la zona del jugador, donde una seta nueva encerraría la nave.
- **Sí: el escorpión no mata.** Razón: nunca baja de la fila 14, y su peligro es indirecto, a través del veneno.
- **Sí: el picado termina en la fila 23 y la cadena sigue con `vdir = −1`.** Razón: reutiliza la oscilación de SPEC GJ-ciempies-01 sin un estado nuevo tras el picado.
- **Sí: el veneno desaparece al restaurar las setas tras una muerte.** Razón: igual que el daño, el veneno es parte del estado que se limpia al reaparecer.
- **Sí: multiplicador de velocidad con tope de 1,5.** Razón: da una sola curva de dificultad para los tres bichos sin volverlos imposibles de seguir con la vista.
- **Sí: el disparo comprueba los bichos antes que segmentos y setas.** Razón: los bichos se dibujan por encima del campo, y el jugador espera acertar a lo que ve delante.
- **Sí: una muerte elimina los bichos y reinicia sus contadores.** Razón: es coherente con el reinicio completo de la oleada en SPEC GJ-ciempies-01 y evita morir dos veces al reaparecer.
- **Sí: subir de oleada no reinicia los bichos.** Razón: las oleadas pueden durar pocos segundos, y reiniciar los contadores impediría que aparezcan.
- **Sí: texto flotante con los puntos durante 800 ms.** Razón: la puntuación de la araña depende de la distancia, y sin el texto el jugador no sabe cuánto ha sumado.
- **No: métricas nuevas en el HUD React.** Razón: los efectos llegan por `onScoreChange` y `onLivesChange`, y ampliar las props no aporta al leaderboard.
- **No: cambiar la fila de `games`.** Razón: el `long` describe el juego base y sigue siendo cierto.
- **Sí: verificar las oleadas 2 y 3 con una oleada inicial temporal en desarrollo.** Razón: llegar a la oleada 3 a mano en cada prueba no es realista. Esa verificación no cambia el código entregado y hay un criterio que lo comprueba.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «Ciempiés: Centipede en una pantalla con campo de setas, SHOOTER, green», sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                                 | Mitigación                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| La araña aparece encima de la nave al reaparecer                       | Una muerte elimina los bichos y la araña vuelve a esperar 5 s.                                         |
| La pulga encierra la nave sembrando setas en la zona inferior          | No siembra en la fila 23, tiene un 25 % de probabilidad por celda y la araña se come setas.            |
| Una cadena en picado atraviesa la nave sin margen de reacción          | El picado respeta el tick de la oleada, igual que el movimiento normal.                                |
| El veneno queda en una celda sin seta y envenena la siguiente que nace | El veneno se limpia siempre que la seta desaparece, por disparo, por la araña o por restauración.      |
| Los contadores avanzan en pausa o en la reaparición                    | Usan el tiempo de juego de SPEC GJ-ciempies-01, que no avanza en pausa, con el modal ni al reaparecer. |
| La oleada inicial temporal de desarrollo se queda en el commit         | Criterio de aceptación que exige oleada inicial 1.                                                     |
| Regresiones en el juego base al tocar `field.ts` y `centipede.ts`      | Las reglas sin veneno no cambian y se repiten los criterios de SPEC GJ-ciempies-01.                    |

---

## What is **not** in this spec

- Cabezas que entran por los lados en la zona del jugador.
- Métricas nuevas en el HUD React.
- Audio de los bichos.
- Selector de oleada inicial o de dificultad.
- Cambios en oleadas, tick, puntuación base, vidas y reaparición de SPEC GJ-ciempies-01.
- Skins y controles táctiles o mobile.
- Cambios en la fila de `games`, `GamePlayShell`, `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y RLS más estricto.

Cada uno de esos puntos, si llega, va en su propio spec.
