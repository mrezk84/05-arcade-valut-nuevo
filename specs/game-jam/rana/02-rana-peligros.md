# SPEC GJ-rana-02 — Mosca bonus, cocodrilos y serpiente en Rana

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07, SPEC GJ-rana-01 · **Fecha:** 2026-10-07
> **Objetivo:** Añadir a Rana una mosca bonus en los nidos, cocodrilos que bloquean nidos desde el nivel 2 y una serpiente en la mediana desde el nivel 3.

---

## Por qué existe este spec

SPEC GJ-rana-01 deja un juego completo, pero cada nivel solo se distingue del anterior por la velocidad. Este spec añade tres elementos clásicos de Frogger que cambian las decisiones del jugador: a qué nido ir (mosca y cocodrilo) y cuándo cruzar la mediana (serpiente).

Es un spec aparte porque es opcional y cambia la puntuación: el juego es completo sin él.

---

## Scope

**In:**

- Módulo `components/games/rana/hazards.ts` con las constantes, los tipos y la lógica pura de mosca, cocodrilos y serpiente.
- Mosca bonus desde el nivel 1: aparece en un nido libre, y entrar en ese nido suma +200 puntos extra.
- Cocodrilo en los nidos desde el nivel 2: asoma en un nido libre, y entrar en él mientras muerde cuesta una vida.
- Serpiente en la mediana (fila 7) desde el nivel 3: recorre la fila de lado a lado, y tocarla cuesta una vida.
- Texto flotante "+200" sobre el nido durante 800 ms al cazar la mosca.
- Dibujo de los tres elementos en `components/games/rana/draw.ts`, con su aspecto diseñado con `/frontend-design`.

**Fuera de alcance (para specs futuros):**

- Cocodrilos como plataformas en el río, nutrias y rana hembra del Frogger original.
- Nuevas métricas en el HUD React (moscas cazadas, peligros activos).
- Audio de mosca, mordisco o serpiente.
- Selector de dificultad o de nivel inicial.
- Cambios en `lanes.ts`, en las velocidades o en las reglas de muerte de SPEC GJ-rana-01.
- Cambios en la fila de `games`, en `GamePlayShell`, en `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y endurecimiento de RLS.

---

## Data model

### Constantes y tipos

```ts
// components/games/rana/hazards.ts
export const FLY_EVERY_MS = 8000; // tiempo entre apariciones
export const FLY_STAY_MS = 5000;
export const POINTS_FLY = 200;
export const FLY_TEXT_MS = 800;

export const CROC_FROM_LEVEL = 2;
export const CROC_EVERY_MS = 10_000;
export const CROC_WARN_MS = 1000; // asoma: el nido sigue siendo seguro
export const CROC_BITE_MS = 3000; // muerde: entrar cuesta una vida
export const CROC_MIN_FREE_NESTS = 2;

export const SNAKE_FROM_LEVEL = 3;
export const SNAKE_LENGTH = 2; // celdas
export const SNAKE_SPEED = 60; // px/s a nivel 1, se multiplica por `mult`

export interface NestHazards {
  fly: { nest: number; leftMs: number } | null;
  croc: { nest: number; leftMs: number } | null;
  flyCooldownMs: number;
  crocCooldownMs: number;
}
export interface MedianSnake {
  x: number; // borde izquierdo en px
  dir: 1 | -1;
}
```

`NestHazards` y `MedianSnake` viven en el estado interno del efecto de `RanaGame.tsx`, junto al estado de SPEC GJ-rana-01.

### Reglas

Mosca:

- Al cargar cada nivel, `flyCooldownMs` vale `FLY_EVERY_MS`. Cuando llega a 0, la mosca aparece en un nido libre al azar sin cocodrilo, y se queda `FLY_STAY_MS`.
- Si no hay nido libre sin cocodrilo, la aparición se salta y el contador vuelve a `FLY_EVERY_MS`.
- Al desaparecer, o al cazarla, el contador vuelve a `FLY_EVERY_MS`. Solo hay una mosca a la vez.
- Entrar en el nido de la mosca suma los puntos de nido de SPEC GJ-rana-01 más `POINTS_FLY` (200), y muestra "+200" sobre el nido durante `FLY_TEXT_MS`.

Cocodrilo:

- Solo desde el nivel `CROC_FROM_LEVEL` (2). Al cargar el nivel, `crocCooldownMs` vale `CROC_EVERY_MS`.
- Cuando el contador llega a 0, el cocodrilo aparece en un nido libre al azar sin mosca, solo si quedan al menos `CROC_MIN_FREE_NESTS` (2) nidos libres sin mosca. Si no, la aparición se salta.
- Dura `CROC_WARN_MS + CROC_BITE_MS` (4 s): el primer segundo solo asoma y el nido sigue siendo seguro, y los tres siguientes muerde.
- Entrar en un nido con el cocodrilo mordiendo cuesta una vida, igual que un nido inválido de SPEC GJ-rana-01.
- Entrar mientras asoma cuenta como nido normal, y el cocodrilo desaparece.

Serpiente:

- Solo desde el nivel `SNAKE_FROM_LEVEL` (3). Al cargar el nivel aparece con `x = 0` y `dir = 1` en la fila 7.
- Avanza `dir × SNAKE_SPEED × mult × dt / 1000` píxeles por frame, con el `mult` de SPEC GJ-rana-01, y cambia de sentido al tocar un borde del canvas.
- Si la rana está en la fila 7 y su hitbox se solapa con el rectángulo de la serpiente (80×24 centrado en la fila), pierde una vida.

Comunes:

- Los tres usan el tiempo de juego, así que se congelan en pausa y con el modal abierto.
- Al subir de nivel se eliminan la mosca y el cocodrilo y se reinician sus contadores. La serpiente vuelve a `x = 0`.
- Una muerte de la rana no reinicia ninguno de los tres.
- Máximo por nivel: 3 300 + 5 × 200 = 4 300 puntos. El score sigue sin máximo teórico.

### Props, HUD y callbacks

`RanaGameProps` y la tabla de captura del HUD de SPEC GJ-rana-01 no cambian. Los +200 llegan al HUD React por `onScoreChange`, y las muertes por cocodrilo o serpiente por `onLivesChange`.

### `games` y `scores`

No cambian. No hay migración de schema ni fila nueva. Se sigue insertando `{ game_id: 'rana', name, score }`, con `name` de 1 a 10 caracteres y `score` entre 0 y 10 000 000.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulo de peligros.** Crear `components/games/rana/hazards.ts` con las constantes y los tipos del data model, y funciones puras para elegir un nido libre al azar con exclusiones, avanzar los contadores de `NestHazards` y mover la serpiente con rebote. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Mosca bonus.** En `RanaGame.tsx`, añadir `NestHazards` al estado, avanzar el contador de la mosca con el tiempo de juego, dibujarla en su nido y sumar `POINTS_FLY` con el texto "+200" al entrar en ese nido. Reiniciar la mosca y su contador al subir de nivel. El aspecto de la mosca y del texto se diseña con `/frontend-design`.
   Verificación: cada 8 s aparece una mosca en un nido libre durante 5 s, y entrar en ese nido suma 200 puntos más que un nido normal.

3. **Cocodrilo en los nidos.** Desde el nivel 2, avanzar el contador del cocodrilo, dibujar sus fases (asoma y muerde) y tratar la entrada en el nido según la fase. Respetar la exclusión con la mosca y el mínimo de dos nidos libres.
   Verificación: con el nivel inicial puesto temporalmente en 2 en desarrollo, el cocodrilo asoma cada 10 s, entrar mientras asoma cuenta como nido y entrar mientras muerde cuesta una vida.

4. **Serpiente en la mediana.** Desde el nivel 3, mover la serpiente por la fila 7 con rebote en los bordes, dibujarla y detectar el solape con la rana como muerte. Reiniciar su posición al subir de nivel.
   Verificación: con el nivel inicial puesto temporalmente en 3 en desarrollo, la serpiente recorre la mediana de lado a lado y tocarla cuesta una vida. El nivel inicial vuelve a 1 antes de commitear.

---

## Acceptance criteria

- [ ] En el nivel 1 aparece una mosca en un nido libre a los 8 s de juego y desaparece a los 5 s.
- [ ] La mosca nunca aparece en un nido ocupado ni en un nido con cocodrilo.
- [ ] Nunca hay más de una mosca a la vez.
- [ ] Entrar en el nido de la mosca suma exactamente 200 puntos más que un nido sin mosca y muestra "+200" sobre el nido.
- [ ] El HUD React refleja los +200 al instante.
- [ ] En el nivel 1 no aparece ningún cocodrilo ni la serpiente.
- [ ] Desde el nivel 2, un cocodrilo asoma en un nido libre cada 10 s y se va a los 4 s.
- [ ] Entrar en un nido con el cocodrilo asomando cuenta como nido normal.
- [ ] Entrar en un nido con el cocodrilo mordiendo resta una vida.
- [ ] El cocodrilo no aparece si quedan menos de dos nidos libres sin mosca.
- [ ] Desde el nivel 3, la serpiente recorre la mediana y cambia de sentido en los bordes del canvas.
- [ ] Tocar la serpiente en la mediana resta una vida.
- [ ] La serpiente es más rápida en niveles más altos, con el mismo tope que los carriles.
- [ ] Al subir de nivel, mosca y cocodrilo desaparecen y la serpiente vuelve al borde izquierdo.
- [ ] PAUSA congela la mosca, el cocodrilo, la serpiente y sus contadores; REANUDAR continúa sin saltos.
- [ ] Perder la última vida por cocodrilo o serpiente abre el modal de game over una sola vez.
- [ ] "JUGAR DE NUEVO" empieza sin mosca, sin cocodrilo y sin serpiente.
- [ ] El nivel inicial entregado es 1.
- [ ] Los criterios de SPEC GJ-rana-01 siguen cumpliéndose, salvo la puntuación por nido con mosca.
- [ ] `/games/rana/play` carga sin errores de SSR ni de consola.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: un spec aparte para los peligros y el bonus.** Razón: son opcionales y cambian la puntuación. El juego queda completo con SPEC GJ-rana-01 y este spec se puede implementar, o descartar, después.
- **Sí: mosca, cocodrilo en nidos y serpiente en la mediana.** Razón: son los tres extras clásicos que no exigen carriles nuevos ni tocar `lanes.ts`. Descartados los cocodrilos-plataforma del río y las nutrias, que cambian las reglas de plataforma.
- **Sí: introducir los peligros por niveles (mosca en 1, cocodrilo en 2, serpiente en 3).** Razón: cada nivel añade una novedad además de la velocidad, y el primer nivel sigue siendo fácil de aprender.
- **Sí: +200 por mosca.** Razón: equivale a 20 s de tiempo restante, suficiente para que merezca desviarse sin desequilibrar el leaderboard.
- **Sí: el cocodrilo avisa 1 s antes de morder.** Razón: igual que con las tortugas, el aviso hace justa la muerte.
- **Sí: el cocodrilo exige al menos dos nidos libres sin mosca.** Razón: así nunca bloquea el último nido y no obliga a esperar para completar el nivel.
- **Sí: mosca y cocodrilo nunca en el mismo nido.** Razón: un nido con premio y castigo a la vez sería ambiguo.
- **Sí: la serpiente rebota en los bordes y usa el multiplicador de velocidad.** Razón: la mediana es una sola fila y un recorrido de ida y vuelta la cubre entera. Compartir el multiplicador mantiene una sola curva de dificultad.
- **Sí: una muerte no reinicia los peligros.** Razón: reiniciarlos daría al jugador un respiro artificial tras cada muerte.
- **No: métricas nuevas en el HUD React.** Razón: los efectos llegan por `onScoreChange` y `onLivesChange`, y ampliar las props no aporta al leaderboard.
- **No: cambiar la fila de `games`.** Razón: el `long` describe el juego base y sigue siendo cierto.
- **Sí: verificar los niveles 2 y 3 con un nivel inicial temporal en desarrollo.** Razón: llegar al nivel 3 a mano en cada prueba no es realista. Esa verificación no cambia el código entregado y hay un criterio que lo comprueba.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «Cruza la carretera y el río sin convertirte en papilla» (estilo Frogger), sin revisión del usuario sección por sección; se revisa directamente en este archivo.

---

## Risks

| Riesgo                                                             | Mitigación                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| El cocodrilo bloquea el último nido y alarga el nivel sin salida   | Solo aparece con dos nidos libres sin mosca o más.                                          |
| La serpiente cruza la celda de llegada y causa muertes inevitables | Velocidad base de 60 px/s y 80 px de largo: la rana puede esperar en la carretera o el río. |
| El nivel inicial temporal de desarrollo se queda en el commit      | Criterio de aceptación que exige nivel inicial 1.                                           |
| Los contadores avanzan en pausa                                    | Usan el tiempo de juego de SPEC GJ-rana-01, que no avanza en pausa ni con el modal abierto. |
| Mosca y cocodrilo sorteados en el mismo frame sobre el mismo nido  | La elección de nido excluye siempre el nido ocupado por el otro elemento.                   |
| Regresiones en el juego base al tocar `RanaGame.tsx`               | La lógica nueva vive en `hazards.ts` y se repiten los criterios de SPEC GJ-rana-01.         |

---

## What is **not** in this spec

- Cocodrilos-plataforma en el río, nutrias y rana hembra.
- Métricas nuevas en el HUD React.
- Audio de mosca, mordisco o serpiente.
- Selector de dificultad o de nivel inicial.
- Cambios en carriles, velocidades y reglas de muerte de SPEC GJ-rana-01.
- Cambios en la fila de `games`, `GamePlayShell`, `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y RLS más estricto.

Cada uno de esos puntos, si llega, va en su propio spec.
