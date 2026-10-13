# SPEC 12 — Rendimiento del canvas (sonda en los 5 juegos, optimización de Frogger)

> **Estado:** Implementado · **Depende de:** SPEC 05, 07, 08, 09 y el juego Frogger (`specs/game-jam/frogger/`) · **Fecha:** 2026-10-13
> **Objetivo:** Eliminar los bajones de FPS de Frogger en escritorio y móvil optimizando el dibujado del canvas, y dejar instalada la sonda de medición en los 5 juegos (Asteroids, Tetris, Arkanoid, Snake y Frogger) para specs futuros, sin cambiar el aspecto de los skins, la lógica de juego ni añadir estado de React.

---

## Scope

**In:**

- **Medición de línea base**, antes de optimizar y otra vez después:
  - FPS medios, FPS mínimos y tiempo de frame (p95) de cada juego en cada skin.
  - Se mide en build de producción (`npm run build && npm start`), nunca en `dev`, en escritorio y en móvil. Además, un diagnóstico por skin (`classic`, `neon`, `retro` y extras) y por entorno (`dev` frente a producción) como primer paso, porque todavía no se sabe si el bajón depende del skin o del modo dev.
  - Heap snapshots al arrancar y a los 60 s de juego, para distinguir una fuga real de la presión del recolector de basura.
  - Se activa con `?perf=1` en la URL. Sin ese parámetro no se mide ni cambia nada.
  - Sin `useState`: los contadores viven en variables locales del `useEffect` del juego o en refs, y la salida va a consola o al objeto que devuelve `report()`.
- **Optimización del dibujado de Frogger** en `components/games/FroggerGame.tsx` y `components/games/frogger/skins.ts`:
  - Cachear el fondo estático de cada skin en un canvas offscreen y pintarlo con un solo `drawImage` por frame.
  - Pre-renderizar en un canvas offscreen los sprites con glow (`shadowBlur`) y los sprites de píxeles, y pintarlos con `drawImage` en lugar de recalcularlos en cada frame.
  - Eliminar asignaciones por frame (arrays, objetos y closures nuevos) y trabajo repetido dentro de `draw()` y `update()`.
  - Los cachés se reconstruyen al cambiar de skin, leyendo el skin desde la ref que ya existe, sin reiniciar la partida.
- **Sin aspecto distinto:** cada skin se ve igual que antes, comprobado con capturas antes/después.
- **Restricción de estado:** el spec no introduce `useState` ni `useEffect` nuevos. El estado nuevo va en `useRef`, variables locales del bucle o un `Map` a nivel de módulo. Los `useState` existentes (`paused`, `over`, `skin`, `score`, `lives`, `level`, `gameKey`) se quedan como están.
- **Invariante HUD (solo se verifica):** con la partida en marcha y sin cambios de score, vidas, nivel o pausa, ningún componente de React se re-renderiza ni es notificado. Los 5 juegos ya llaman a sus callbacks únicamente cuando el valor cambia; el spec lo fija como criterio medible y no modifica código de React.

**Fuera de alcance (para specs futuros):**

- Optimizar el dibujado de Asteroids, Tetris, Arkanoid y Snake. Reutilizarán `perf/probe.ts` y `perf/spriteCache.ts` con el patrón aplicado en Frogger.
- Optimizaciones de React: memoizar componentes, estabilizar handlers o pasar el HUD a refs y DOM directo. Se descartó que React sea la causa.
- Capas CSS: scanlines, viñeta del CRT y glow del mando MK-II. Solo se abrirá un spec nuevo si la medición señala que son el cuello de botella.
- Cambios en la lógica de los juegos, la puntuación, las colisiones o el mapeo de teclas.
- Cambios en `GamePlayShell.tsx`, `TouchControls.tsx`, `TouchControlsConfig`, Supabase o `localStorage`.
- Skins nuevos o cambios visibles en cualquier skin, en escritorio o en móvil.
- Mover el render a Web Workers u `OffscreenCanvas` en otro hilo.

---

## Data model

No hay cambios en Supabase, `localStorage`, `TouchControlsConfig` ni en los props de los juegos. Las estructuras nuevas viven en módulos y variables locales, nunca en estado de React.

### Módulo de medición — `components/games/perf/probe.ts` (nuevo)

Se activa solo con `?perf=1` en la URL. Sin ese parámetro, `createPerfProbe` devuelve un objeto con funciones vacías, que no asigna memoria ni dibuja nada.

| Elemento                        | Tipo                                | Descripción                                                              |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `createPerfProbe(gameId, skin)` | `() => PerfProbe`                   | Se crea dentro del `useEffect` del juego, una vez por montaje.           |
| `PerfProbe.frame(now)`          | `(now: number) => void`             | Se llama una vez por frame. Guarda el tiempo de frame en un buffer fijo. |
| `PerfProbe.report()`            | `() => PerfReport`                  | Devuelve `fpsAvg`, `fpsMin`, `frameP95`, `frames`. También a consola.    |
| Buffer de tiempos               | `Float32Array(600)` (anillo, ~10 s) | Tamaño fijo: no crece con la duración de la partida.                     |

### Caché de sprites — `components/games/perf/spriteCache.ts` (nuevo)

| Elemento                 | Tipo                                                 | Descripción                                                                                             |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bakeSprite(w, h, draw)` | `(w, h, (ctx) => void) => HTMLCanvasElement`         | Dibuja una vez en un canvas offscreen. El juego lo pinta luego con un `drawImage` por frame.            |
| `getBaked(key, build)`   | `(key: string, build: () => HTMLCanvasElement) => …` | Caché por clave `"<gameId>:<skin>:<sprite>"` en un `Map` a nivel de módulo. Construye en el primer uso. |

- Tamaño nativo del canvas del juego, sin escalar por `devicePixelRatio`. Los canvas ya se escalan por CSS.
- La memoria está acotada: nº de skins × nº de sprites distintos por juego. El `Map` no crece con la partida.
- Cambiar de skin no reinicia la partida. El juego lee la skin desde su ref y pide `getBaked` con la clave nueva.

### Archivos que cambian

| Archivo                                                               | Cambio                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `components/games/{Asteroids,Tetris,Arkanoid,Snake,Frogger}Game.tsx`  | Llaman a `probe.frame()`. Solo Frogger usa fondos y sprites cacheados. |
| `components/games/frogger/skins.ts`                                   | Dibuja vía `bakeSprite`/`getBaked`.                                    |
| `app/games/*/play/page.tsx`, `GamePlayShell.tsx`, `TouchControls.tsx` | **Sin cambios.**                                                       |

### Regla de estado de React

- Este spec no introduce ningún `useState`, `useReducer`, `useContext` ni `useEffect` nuevo.
- Todo el estado nuevo (buffer de medición, caché de sprites, contadores) vive en:
  - variables locales del `useEffect([])` ya existente de cada juego,
  - `useRef` cuando deba sobrevivir entre efectos,
  - o el `Map` a nivel de módulo de `spriteCache.ts`.
- Nada de lo anterior dispara un re-render: no se lee desde el JSX ni se pasa por props.
- Se mantiene la regla actual de los juegos: los callbacks del HUD (`onScoreChange`, `onLivesChange`, `onLevelChange`, etc.) solo se llaman cuando el valor cambia.
- Los `useState` existentes (`paused`, `over`, `skin`, `score`, `lives`, `level`, `gameKey`) no se tocan.

---

## Plan de implementación

Cada paso deja la app funcionando y se puede revisar y commitear por separado. Todo se mide en build de producción (`npm run build && npm start`), salvo la comparación dev/prod del paso 1.

1. **Sonda de medición y línea base.**
   - Crear `components/games/perf/probe.ts` (ver Data model) y llamar a `probe.frame(now)` en el bucle de los 5 juegos. Sin `?perf=1` es un no-op.
   - Medir en escritorio y en móvil, por cada juego y cada skin (`classic`, `neon`, `retro` y los extras): FPS medios, FPS mínimos y p95 del tiempo de frame, durante 60 s.
   - Repetir en `npm run dev` y en producción en al menos Frogger, para saber cuánto pesa el modo dev.
   - Tomar heap snapshots al arrancar y a los 60 s en cada juego.
   - Anotar los resultados en la tabla "Línea base" de este spec. Esa tabla confirma o descarta la hipótesis de `shadowBlur` y de `pixelSprite`.
   - Los resultados deciden si hay fuga real o solo presión del GC.
   - _Verificación:_ la app se comporta igual sin `?perf=1` y la tabla está completa.

2. **Caché de sprites.**
   - Crear `components/games/perf/spriteCache.ts` con `bakeSprite` y `getBaked`, sin consumidores todavía.
   - _Verificación:_ `npm run build` y `npm run lint` pasan, y no hay cambios visibles.

3. **Frogger** (el caso reportado). En `components/games/frogger/skins.ts` y `FroggerGame.tsx`:
   - Cachear el fondo de cada skin en un offscreen y pintarlo con un `drawImage`.
   - Pre-renderizar los sprites de `retro` (`pixelSprite`) y los glows de `neon` (`shadowBlur`).
   - Quitar las asignaciones por frame del HUD y los closures de `forEach`.
   - Cambiar de skin en caliente no reinicia la partida.
   - _Verificación:_ medir con la sonda, comparar capturas antes/después de cada skin y comprobar que el heap se estabiliza a los 60 s.
   - Si el heap sigue creciendo, aislar y corregir la causa (listeners, imágenes u objetos sin liberar en el cleanup del efecto) antes de dar el paso por terminado.

---

## Criterios de aceptación

Las mediciones se hacen en build de producción, con `?perf=1`, durante 60 s de partida, en Frogger y en cada skin (la línea base abarca los 5 juegos).

**Medición y línea base**

- [ ] Existe `components/games/perf/probe.ts` y los 5 juegos llaman a `probe.frame()` en su bucle.
- [ ] Sin `?perf=1` la sonda no asigna memoria ni escribe en consola.
- [ ] La tabla "Línea base" del spec tiene, para cada juego y skin, FPS medios, FPS mínimos y p95 del frame, en escritorio y móvil, más la comparación dev/prod de Frogger.

**Rendimiento (después de optimizar)**

- [ ] Escritorio: FPS medios ≥ 58 y p95 del tiempo de frame ≤ 20 ms en Frogger y todos sus skins.
- [ ] Móvil: FPS medios ≥ 50 y p95 ≤ 25 ms en Frogger y todos sus skins.
- [ ] La columna "Después" de la tabla es mejor que la línea base en cada fila de Frogger.

**Memoria**

- [ ] Heap a los 60 s ≤ 110 % del heap a los 20 s en Frogger, con un GC forzado antes de cada snapshot.
- [ ] Reiniciar la partida 5 veces seguidas con "JUGAR DE NUEVO" no deja el heap por encima de 120 % del de la primera partida.
- [ ] Cambiar de skin 10 veces seguidas no hace crecer el heap más de un 10 %: la caché de sprites está acotada.

**Sin cambios de comportamiento ni de aspecto**

- [ ] Las capturas de cada skin de Frogger, antes y después, son visualmente idénticas.
- [ ] Cambiar de skin durante la partida no reinicia la partida ni pierde el score.
- [ ] Puntuación, colisiones, niveles y controles se comportan igual que antes, con una partida manual en Frogger.
- [ ] Pausa, "FIN", fin de partida y guardado de score siguen funcionando.

**Invariante HUD y estado de React**

- [ ] Con React Profiler, 30 s de partida sin cambios de score, vidas, nivel ni pausa dan 0 renders de la play-page y de `GamePlayShell`.
- [ ] El diff del spec no añade `useState`, `useReducer`, `useContext` ni `useEffect`.
- [ ] `GamePlayShell.tsx`, `TouchControls.tsx` y las `app/games/*/play/page.tsx` no aparecen en el diff.

**Calidad**

- [ ] `npm run lint`, `npm run format:check` y `npm run build` pasan sin errores.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Optimizar el canvas y no React.** Los bucles de los 5 juegos ya están bien montados: `useEffect([])`, `requestAnimationFrame`, props y callbacks por refs, y sin `setState` dentro del bucle. El coste por frame está en el dibujado: `shadowBlur` por entidad en `neon` y un `fillRect` por píxel de sprite en `retro`, con fondos estáticos repintados en cada frame. Se descartó que React fuera la causa a petición del usuario.
- **Medir antes de optimizar.** No se conoce todavía la causa del crecimiento de memoria, ni si el bajón depende del skin o de `dev`/producción. El paso 1 fija una línea base que decide el orden de los pasos 3–7 y el criterio de éxito.
- **Caché en canvas offscreen en lugar de quitar efectos.** Pre-renderizar fondos y sprites con glow conserva el aspecto de los skins y mueve el coste de cada frame a una sola vez. Quitar o reducir `shadowBlur` habría sido más simple, pero cambia el aspecto.
- **La sonda de medición se activa con `?perf=1`.** Sin el parámetro es un no-op. Así no pesa en producción y no necesita estado de React, un panel ni una dependencia nueva.
- **Solo Frogger en este spec.** Es el caso reportado y el que más información da. Los otros cuatro juegos se optimizarán en specs propios, replicando el patrón una vez comprobado que el heap de Frogger se estabiliza.
- **Cero estado de React nuevo.** Todo lo nuevo vive en variables locales del efecto, refs o un `Map` a nivel de módulo, y nada se lee desde el JSX.
- **Invariante HUD verificado, no construido.** Los 5 juegos ya llaman a sus callbacks solo cuando el valor cambia. El spec lo fija como criterio medible con React Profiler, para que ninguna optimización lo rompa.
- **Umbrales de rendimiento:** ≥ 58 FPS en escritorio y ≥ 50 en móvil, con p95 del frame ≤ 20 ms y ≤ 25 ms respectivamente.

**Descartadas**

- **Memoizar componentes, estabilizar handlers o pasar el HUD a refs y DOM directo.** Se descartó que React sea la causa. Son los re-renders puntuales por cambio de score, no los bajones constantes. El refactor tocaría `GamePlayShell.tsx` y las 5 play-pages, con riesgo alto y poco beneficio medible. Se retomaría en un spec propio si la medición lo justifica.
- **Optimizar las capas CSS** (scanlines, viñeta del CRT, glow del mando MK-II). Solo se abrirá un spec nuevo si la medición del paso 1 señala que son el cuello de botella.
- **Quitar o reducir `shadowBlur` y los efectos de los skins.** Ahorra el mismo coste, pero cambia el aspecto, y el objetivo del spec es no cambiarlo.
- **Mover el render a Web Workers u `OffscreenCanvas` en otro hilo.** Es complejidad y compatibilidad de navegador desproporcionadas para un problema que se espera resolver con caché.
- **Mostrar un panel de FPS en pantalla con `useState`.** Rompería la regla de estado y re-renderizaría el HUD. La sonda escribe en consola y en el objeto que devuelve `report()`.
- **Escalar el canvas por `devicePixelRatio` para la caché.** Los canvas ya se escalan por CSS, así que cachear a tamaño nativo basta y no multiplica la memoria.
- **Validar el rendimiento móvil solo con un emulador.** El coste del `shadowBlur` depende de la GPU del dispositivo, por lo que los criterios móviles exigen un móvil real.

---

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                              | Probabilidad | Impacto | Mitigación                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El crecimiento de memoria no viene del canvas.** La causa puede ser otra: listeners o `requestAnimationFrame` duplicados al reiniciar con `key={gameKey}`, o el doble montaje del modo estricto en `dev`. Optimizar el dibujado no la arreglaría. | Media        | Alto    | El paso 1 mide con heap snapshots antes de optimizar. Si en el paso 3 el heap no se estabiliza, se aísla y corrige la causa en el cleanup del efecto antes de seguir. Si la fuga está fuera de los juegos, se abre un spec propio. |
| **El glow cacheado no se ve igual que el dibujado en vivo.** `shadowBlur` depende del contexto y del tamaño. Un sprite pre-renderizado puede recortar el halo, o perder la mezcla con el fondo.                                                     | Media        | Medio   | Cada sprite se pre-renderiza con margen para el halo. La comparación de capturas antes/después es un criterio de aceptación. Si un sprite no queda idéntico, se mantiene dibujado en vivo y se optimiza de otra forma.             |
| **La caché consume más memoria de la esperada en móviles de gama baja.** El fondo y los sprites ocupan memoria de GPU, multiplicada por el número de skins.                                                                                         | Baja         | Medio   | La caché se construye de forma perezosa, solo para el skin activo, y está acotada. El criterio de memoria incluye 10 cambios de skin seguidos.                                                                                     |
| **No hay un móvil real para validar.** El coste del `shadowBlur` depende de la GPU, y un emulador de escritorio no es representativo.                                                                                                               | Media        | Medio   | Los tres criterios móviles se marcan como "pendientes de comprobar en dispositivo real" y no bloquean pasar el spec a `Implementado`, igual que se hizo en el SPEC 11.                                                             |
| **La medición cambia el comportamiento.** La sonda corre dentro del bucle y las capturas o snapshots pueden alterar los tiempos.                                                                                                                    | Baja         | Bajo    | La sonda es un no-op sin `?perf=1`. El buffer es de tamaño fijo y las mediciones se hacen sin DevTools abiertos salvo en los snapshots de heap.                                                                                    |
| **Un cambio de skin en caliente deja la caché inconsistente.** Se pinta con la clave del skin anterior durante un frame, o con un sprite aún sin construir.                                                                                         | Baja         | Bajo    | La clave incluye el skin que se lee de la ref en cada frame, y `getBaked` construye en el primer uso, así que el dibujado nunca queda a medias. Se verifica cambiando de skin 10 veces durante la partida.                         |

---

## Línea base

> Se completa en el paso 1 y la columna "Después" tras medir Frogger optimizado. Escritorio y móvil por separado; FPS medios / FPS mínimos / p95 del frame (ms).

| Juego       | Skin | Antes (escritorio) | Antes (móvil) | Después (escritorio) | Después (móvil) |
| ----------- | ---- | ------------------ | ------------- | -------------------- | --------------- |
| _pendiente_ |      |                    |               |                      |                 |

**Comparación dev/prod (Frogger):** _pendiente_

**Heap (arranque / 60 s) por juego:** _pendiente_
