# SPEC GJ-duelo-pixel-02 — Skins de la pista de Duelo Pixel

> **Estado:** Borrador · **Depende de:** SPEC 06, SPEC 07 (shell y patrón de skins), SPEC GJ-duelo-pixel-01 · **Fecha:** 2026-10-06
> **Objetivo:** Permitir elegir entre cuatro skins visuales de la pista de Duelo Pixel desde una lista desplegable del HUD, con la preferencia guardada en `localStorage`.

---

## Por qué existe este spec

Duelo Pixel (SPEC GJ-duelo-pixel-01) se dibuja solo con rectángulos y un único amarillo neón. Eso lo hace fácil de integrar, pero también deja margen para personalizar el aspecto sin tocar las reglas del juego.

Tetris resolvió lo mismo en el paso 9 del SPEC 07 con cuatro skins, un selector en el HUD y una clave en `localStorage`. Este spec reutiliza esa forma: el mismo patrón de `useSkin` (`useSyncExternalStore`), la misma prop `hudExtra` del shell y el mismo criterio de que el cambio es solo de dibujo y se aplica en cualquier momento.

Es un spec aparte porque es opcional: el juego es completo sin él.

---

## Scope

**In:**

- Módulo `components/games/duelo-pixel/skins.ts` con `SkinId`, la interfaz `Skin`, las cuatro skins, `DEFAULT_SKIN`, `SKIN_STORAGE_KEY` e `isSkinId`.
- Módulo `components/games/duelo-pixel/useSkin.ts` (`useSyncExternalStore`) que lee y escribe la preferencia en `localStorage`.
- Prop `skin: SkinId` en `DueloPixelGame`, que sustituye a los colores fijos del dibujo.
- Lista desplegable (`<select>`) en el HUD con Neón / Retro / Synthwave / Game Boy, pasada al shell con la prop opcional `hudExtra`.
- Skins `neon` (la actual, por defecto), `retro`, `synthwave` y `gameboy`, cada una con su propio fondo, línea central, palas, pelota, texto y brillo.
- Preferencia guardada en `localStorage` con la clave `duelo-pixel-skin`.

**Fuera de alcance (para specs futuros):**

- Skins con sprites o imágenes: las cuatro se dibujan con colores planos.
- Skins desbloqueables por puntuación o por nivel.
- Selector de skin en la página `/games/duelo-pixel` o fuera de la play-page.
- Efectos de partículas, estela de la pelota o animaciones propias de cada skin.
- Cambios en las reglas, la puntuación, el HUD React de métricas o la IA.
- Cambios en `GamePlayShell`, que ya trae `hudExtra` desde el SPEC 07.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y endurecimiento de RLS.

---

## Data model

### Tipos y constantes de skins

```ts
// components/games/duelo-pixel/skins.ts
export type SkinId = 'neon' | 'retro' | 'synthwave' | 'gameboy';

export interface Skin {
  name: string; // texto de la lista desplegable
  bg: string; // fondo de la pista
  line: string; // línea central discontinua
  paddle: string; // ambas palas
  ball: string; // pelota
  text: string; // marcador TÚ–CPU
  glow: string | null; // color del resplandor (shadowColor), o null si no hay
}

export const SKINS: Record<SkinId, Skin>;
export const DEFAULT_SKIN: SkinId = 'neon';
export const SKIN_STORAGE_KEY = 'duelo-pixel-skin';
export function isSkinId(value: unknown): value is SkinId;
```

### Valores de cada skin

| `SkinId`    | `name`    | `bg`      | `line`    | `paddle`  | `ball`    | `text`    | `glow`    |
| ----------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `neon`      | Neón      | `#0a0a18` | `#5c5420` | `#ffe14d` | `#ffffff` | `#ffe14d` | `#ffe14d` |
| `retro`     | Retro     | `#000000` | `#555555` | `#ffffff` | `#ffffff` | `#ffffff` | `null`    |
| `synthwave` | Synthwave | `#1a0b2e` | `#6a2c91` | `#ff2ea6` | `#2ee6ff` | `#2ee6ff` | `#ff2ea6` |
| `gameboy`   | Game Boy  | `#9bbc0f` | `#8bac0f` | `#0f380f` | `#0f380f` | `#0f380f` | `null`    |

La skin `neon` reproduce el aspecto definido en SPEC GJ-duelo-pixel-01. Los valores exactos se afinan con `/frontend-design` en el paso 3, pero no cambia ni la lista de campos ni los identificadores.

### Hook

```ts
// components/games/duelo-pixel/useSkin.ts
export function setSkin(id: SkinId): void;
export function useSkin(): [SkinId, (id: SkinId) => void];
```

- Mismo patrón que `components/games/tetris/useSkin.ts`: `useSyncExternalStore` con un conjunto de listeners y el evento `storage`.
- El snapshot del servidor devuelve `DEFAULT_SKIN`, así que el HTML inicial es siempre `neon`.
- Si `localStorage` falta, lanza o contiene un valor inválido, se usa la skin guardada en memoria o, si no hay, `DEFAULT_SKIN`. El selector sigue funcionando en memoria.

### Props del componente

`DueloPixelGameProps` gana una prop y el resto no cambia:

```ts
interface DueloPixelGameProps {
  paused: boolean;
  skin: SkinId; // nueva
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

`skin` se copia a una ref como el resto de props y el loop la lee en cada frame. No reinicia el efecto ni la partida.

### `games` y `scores`

No cambian. No hay migración de schema ni fila nueva.

---

## Implementation plan

Antes de escribir código de rutas o páginas hay que leer la guía correspondiente en `node_modules/next/dist/docs/`, porque Next.js 16 difiere del conocimiento previo.

1. **Módulo de skins.** Crear `components/games/duelo-pixel/skins.ts` con `SkinId`, `Skin`, `SKINS` con los valores de la tabla, `DEFAULT_SKIN`, `SKIN_STORAGE_KEY` e `isSkinId`. Sin acceso a `window` ni `document` en el cuerpo del módulo.
   Verificación: `npm run build` sin errores de TypeScript.

2. **Hook `useSkin`.** Crear `components/games/duelo-pixel/useSkin.ts` siguiendo el patrón de `components/games/tetris/useSkin.ts`, con la clave `duelo-pixel-skin` y `neon` como valor por defecto.
   Verificación: `npm run build` sin errores de TypeScript y sin errores de hidratación en `/games/duelo-pixel/play`.

3. **Dibujo por skin.** Añadir la prop `skin` a `DueloPixelGame` y sustituir los colores fijos del dibujo (fondo, línea central, palas, pelota, marcador y resplandor) por los de la skin activa, leída desde la ref en cada frame. El resplandor usa `shadowColor` y `shadowBlur` solo si `glow` no es `null`. Los valores finales de color se afinan con `/frontend-design`.
   Verificación: con `skin = 'neon'` la pista se ve igual que antes del spec, y cambiar la prop a mano en la play-page muestra cada una de las cuatro skins.

4. **Selector en el HUD.** En `app/games/duelo-pixel/play/page.tsx`, llamar a `useSkin()`, pasar `skin` a `DueloPixelGame` y pasar al shell, mediante `hudExtra`, un `<select>` con las cuatro skins. Al elegir una opción, el selector llama a `setSkin` y se desenfoca (`blur()`).
   Verificación: la lista muestra la skin activa, el cambio se ve al instante, también en plena partida, y persiste al recargar.

---

## Acceptance criteria

- [ ] En el HUD, junto a las métricas, hay una lista desplegable con Neón, Retro, Synthwave y Game Boy, y muestra la skin activa.
- [ ] Al cambiar de skin, la pista, las palas, la pelota y el marcador se redibujan al instante, también con la partida en curso.
- [ ] Al cambiar de skin con la partida en pausa, la pista se redibuja sin reanudar el juego.
- [ ] La skin elegida se mantiene al recargar la página (`localStorage`, clave `duelo-pixel-skin`).
- [ ] Sin valor guardado, o con uno inválido, se usa Neón.
- [ ] Con la skin Neón, la pista se ve igual que en SPEC GJ-duelo-pixel-01.
- [ ] Cada skin usa su propio fondo, su propia línea central y sus propios colores de palas, pelota y marcador.
- [ ] Retro y Game Boy no dibujan resplandor, y Neón y Synthwave sí.
- [ ] En Game Boy, el marcador, las palas y la pelota se leen sobre el fondo verde claro.
- [ ] Tras elegir una skin en la lista, `↑`/`↓` y `W`/`S` mueven la pala y no cambian la opción de la lista.
- [ ] Cambiar de skin no altera puntuación, vidas, nivel, marcador, posición de la pelota ni la pausa.
- [ ] Cambiar de skin no reinicia la partida ni dispara `onGameOver`.
- [ ] Si `localStorage` no está disponible, el selector sigue funcionando durante la sesión.
- [ ] `/games/duelo-pixel/play` carga sin errores de SSR, de hidratación ni de consola.
- [ ] `/games/tetris/play` y el resto de play-pages siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.

---

## Decisions

- **Sí: un spec aparte para las skins.** Razón: son opcionales y no cambian las reglas. El juego queda completo con SPEC GJ-duelo-pixel-01 y este spec se puede implementar, o descartar, después.
- **Sí: seguir el patrón de skins del SPEC 07.** Razón: ya está validado en Tetris (`useSyncExternalStore`, `hudExtra`, `localStorage`) y evita inventar otro mecanismo.
- **Sí: cuatro skins (`neon`, `retro`, `synthwave`, `gameboy`).** Razón: cubren un abanico claro (la estética de la plataforma, blanco y negro clásico, dos colores saturados y una paleta verde) sin sprites. Descartadas skins con imágenes, porque exigen assets.
- **Sí: `neon` es la skin por defecto y reproduce el aspecto original.** Razón: quien no toque el selector ve lo mismo que sin este spec.
- **Sí: el cambio de skin se aplica en cualquier momento, también en pausa.** Razón: solo cambia el dibujo y el loop sigue dibujando con `paused`, así que no hace falta pausar.
- **Sí: `skin` entra como prop leída desde una ref.** Razón: es el patrón de las demás props y evita reiniciar el efecto, que reiniciaría la partida.
- **Sí: `glow` puede ser `null`.** Razón: Retro y Game Boy imitan pantallas sin brillo, y un resplandor rompería su aspecto.
- **Sí: clave `duelo-pixel-skin`.** Razón: sigue la forma `<juego>-skin` de `tetris-skin` y no choca con las claves `av_*` de la plataforma.
- **Sí: el selector se desenfoca tras elegir.** Razón: un `<select>` enfocado se come las flechas. Es la solución que ya usa Tetris.
- **Sí: el snapshot del servidor devuelve la skin por defecto.** Razón: evita errores de hidratación, porque el servidor no tiene `localStorage`.
- **Sí: memoria de respaldo si `localStorage` falla.** Razón: el selector debe seguir funcionando en navegación privada o con el almacenamiento bloqueado.
- **No: el selector fuera de la play-page.** Razón: la skin solo se ve al jugar y añadirlo a `/games/[id]` obligaría a tocar páginas que ya leen de Supabase.
- **No: skins desbloqueables.** Razón: exigiría persistir progreso, que la plataforma no tiene (no hay Supabase Auth).
- **No: cambios en `GamePlayShell`.** Razón: `hudExtra` ya existe desde el SPEC 07.
- **Sin confirmación por sección.** Generado por @game-jam a partir del tema «duelo», sin revisión del usuario sección por sección; se revisa directamente en este archivo. Los colores de la tabla son una propuesta del agente y se afinan en el paso 3.

---

## Risks

| Riesgo                                                             | Mitigación                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Error de hidratación porque el servidor no conoce la skin guardada | Snapshot del servidor con `DEFAULT_SKIN`, y la play-page carga el juego con `ssr: false`. |
| El `<select>` enfocado captura las flechas y la pala no responde   | `blur()` tras elegir y criterio de aceptación específico.                                 |
| Un color de skin deja el marcador o la pelota ilegibles            | Los valores se verifican a ojo en cada skin en el paso 3, con foco en Game Boy.           |
| `localStorage` bloqueado o con un valor corrupto                   | `try/catch` en lectura y escritura, `isSkinId` y memoria de respaldo.                     |
| El resplandor (`shadowBlur`) cuesta rendimiento en equipos lentos  | Solo dos skins lo usan y se dibuja en pocos elementos.                                    |
| Cambiar de skin reinicia el efecto del juego y con él la partida   | `skin` se lee desde una ref y no está entre las dependencias del efecto principal.        |

---

## What is **not** in this spec

- Skins con sprites o imágenes.
- Skins desbloqueables por puntuación o nivel.
- Selector de skin fuera de la play-page.
- Partículas, estelas o animaciones propias de cada skin.
- Cambios en reglas, puntuación, IA y HUD de métricas.
- Cambios en `GamePlayShell`, `/games`, `/games/[id]` y `/hall-of-fame`.
- Supabase Auth y RLS más estricto.

Cada uno de esos puntos, si llega, va en su propio spec.
