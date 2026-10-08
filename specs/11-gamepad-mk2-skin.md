# SPEC 11 — Gamepad MK-II neón para el mando táctil

> **Estado:** Implementado · **Depende de:** SPEC 10 · **Fecha:** 2026-10-08
> **Objetivo:** Sustituir el aspecto del mando táctil de SPEC 10 por el diseño Gamepad MK-II neón de `references/gamepad-assets/` en los 4 juegos, sin cambiar su comportamiento ni el escritorio.

> **Nota de verificación:** los criterios se comprobaron con un móvil emulado (Chromium con táctil y `pointer: coarse`, 360×640 y 412×915) y con capturas de pantalla. Faltan dos comprobaciones en un móvil real: el multitáctil con dos dedos y el aspecto del glow en gama baja.

---

## Scope

**In:**

- Restyling de `components/games/TouchControls.tsx` con el lenguaje visual del MK-II (`references/gamepad-assets/gamepad.html` y `gamepad-neon.png`):
  - Carcasa en `.touch-controls`: gradiente `#1c1c28 → #0c0c14`, borde `--line` cian, doble borde interior, trama de puntos y `border-radius` de 16–22 px.
  - Teclas de la cruceta oscuras con sombra de "tecla física". Al pulsarlas se hunden y se iluminan en cian.
  - Hub central con un rombo cian que late (`pulse-led`).
  - Botones A/B redondos con gradiente radial, letra en `Press Start 2P` con glow y anillo discontinuo al pulsar. A en magenta y B en cian (hoy B es amarillo).
- Flechas en SVG (los triángulos del HTML de referencia) en lugar de los glifos `◀▶▲▼`.
- El hub es un `<span aria-hidden="true">` decorativo, no un botón.
- Orden visual B a la izquierda y A a la derecha, como en la referencia. El orden del DOM y `config.buttons` no cambian: se usa CSS `order`. Se elimina el desfase vertical actual de B (`margin-top`).
- Estados: la clase `.on`/`:active` de la referencia pasa a `.is-pressed`, con el mismo `transform` y glow. `.is-inactive` (Arkanoid, `showInactive`) y `:disabled` se ven atenuados sobre el nuevo estilo.
- Tamaños: se reutilizan `--pad-dir` y `--pad-act` de `.av-player--touch` (`app/globals.css`). El MK-II se escala a esos valores; no se usan los 156 px / 74 px fijos de la referencia, para que todo siga cabiendo a 360×640.
- Sin fuentes nuevas: `Press Start 2P` y los tokens (`--cyan`, `--magenta`, `--ink-dim`, `--line`, `--pixel`) ya existen en la app.
- `prefers-reduced-motion`: el rombo del hub no se anima.

**Fuera de alcance (para specs futuros):**

- Selector o sistema de skins del mando: es un reemplazo directo.
- Mostrar el mando en escritorio.
- Teclado físico (WASD, Z/X/J/K) y que el mando reaccione a él: es el script de la referencia y no se porta.
- Cambios en el mapeo de teclas, `repeat`, `showInactive`, `statsPanel`/`statsLine`, el pie (PAUSA/REGRESAR/skin), el aviso de landscape y el modal de fin de partida.
- Cambios en la lógica de los juegos, en `GamePlayShell.tsx`, en `TouchControlsConfig` y en Supabase.
- Cualquier cambio visible en escritorio.

---

## Data model

No hay cambios en Supabase ni en `localStorage`, y `TouchControlsConfig` no cambia. Solo cambian el markup interno de `TouchControls` (SVG de flecha, hub, anillo y letra) y las clases CSS.

### Correspondencia referencia → app

| Referencia (`gamepad.html`) | App                                                    |
| --------------------------- | ------------------------------------------------------ |
| `.gp`                       | `.touch-controls`                                      |
| `.dp`, `.dp-up`…            | `.touch-dir`, `.touch-dir-up`…                         |
| `.dp-hub` / `.dp-hub-gem`   | `.touch-hub` / `.touch-hub-gem` (nuevo)                |
| `.ab.a` / `.ab.b`           | `.touch-action-a` / `.touch-action-b`                  |
| `.ab-ring`, `.ab-letter`    | `.touch-action-ring`, `.touch-action-letter` (nuevo)   |
| `.on`, `:active`            | `.is-pressed` (el estado ya lo gestiona el componente) |

### Colores por control

| Control           | Color   | Token       |
| ----------------- | ------- | ----------- |
| Cruceta (pulsada) | cian    | `--cyan`    |
| Botón A           | magenta | `--magenta` |
| Botón B           | cian    | `--cyan`    |

---

## Implementation plan

> Borrador sin revisar. Cada paso deja el sistema funcional y sin cambios en escritorio.

1. **Markup de `TouchControls.tsx`.** SVG de flecha por dirección (`fill: currentColor`), hub en la celda central de la rejilla (fila 2, columna 2), y anillo y letra dentro de A/B. Sin cambios de lógica ni de props.
2. **Carcasa y cruceta.** Reescribir en `app/globals.css` el bloque `.touch-controls`, `.touch-dpad`, `.touch-btn` y `.touch-dir` con el estilo MK-II, siempre dentro del `@media (hover: none) and (pointer: coarse)` existente.
3. **Botones A/B.** Reescribir `.touch-actions` y `.touch-action-*`: A magenta, B cian, orden B|A con `order`, sin `margin-top`.
4. **Estados.** `.is-pressed`, `.is-inactive`, `:disabled` y `prefers-reduced-motion`. Los pseudo-elementos decorativos llevan `pointer-events: none`.
5. **Encaje y verificación.** Medir a 360×640 y 412×915 en los 4 juegos y ajustar padding o `clamp` si la carcasa resta altura al CRT (Tetris es el caso crítico). Comprobar el mapeo en cada juego. Actualizar las notas de `references/game-mobile-status.md` y el estado de esta spec a `Implementado`.

---

## Acceptance criteria

- [x] En móvil táctil, el mando de los 4 juegos se ve como `gamepad-neon.png`: carcasa, cruceta con hub y rombo, B cian a la izquierda y A magenta a la derecha.
- [ ] Pulsar un control lo hunde y le aplica glow; al soltar vuelve a su estado. Se pueden mantener dos controles a la vez con dos dedos. _(El hundido y el glow se comprobaron con toques emulados; mantener dos controles a la vez con dos dedos falta probarlo en un móvil real.)_
- [x] Snake no muestra A/B. En Arkanoid, ↑, ↓, A y B se ven atenuados, deshabilitados y sin emitir teclas.
- [x] El mapeo de teclas y el auto-repeat de SPEC 10 funcionan igual en los 4 juegos.
- [x] A 360×640 y 412×915 el canvas, el mando y el pie caben sin scroll ni cortes, y la separación de ~50 px sobre la flecha ↑ se mantiene.
- [x] Al pausar o terminar la partida, el mando no envía teclas.
- [x] En escritorio (ratón) no hay ningún cambio, y `/games/[id]/play` (genérica) tampoco.
- [x] Con `prefers-reduced-motion`, el rombo del hub no se anima.
- [x] `npm run build` pasa y `npm run lint` no añade errores nuevos respecto a los previos de SPEC 10. _(Los errores de lint están en `app/page.tsx`, `app/games/[id]/play/page.tsx` y `GamePlayShell.tsx`, previos a esta spec.)_

---

## Decisiones tomadas y descartadas

- **Reemplazo directo y no skin seleccionable.** Decisión del usuario. Descartado: un selector del mando en el pie (clave `av-gamepad-skin`), que añade estado y UI sin necesidad.
- **Solo visual.** Se reutiliza `TouchControls` con sus Pointer Events y su emisión de `KeyboardEvent`. Descartado: portar el script de la referencia (teclado físico, WASD, Z/X).
- **Tamaños con `--pad-dir` y `--pad-act`** en lugar de los px fijos del MK-II, para no romper el encaje vertical de SPEC 10.
- **B en cian** (antes amarillo), por fidelidad a la referencia.
- **Orden B|A con CSS `order`**, sin tocar `config.buttons` ni el DOM.
- **Sin fuentes nuevas.** `Press Start 2P` ya está cargada en la app.
- **Se depende de `.is-pressed` y no de `:active`**, porque el componente ya gestiona el estado pulsado y `:active` es poco fiable en iOS.

---

## Riesgos identificados

> Borrador sin revisar.

- **Altura.** La carcasa (padding y borde) resta altura al CRT en 360×640, sobre todo en Tetris. Hay que medirlo antes de dar por buena la escala.
- **Rendimiento.** `box-shadow` y `filter: drop-shadow` en móviles de gama baja: el glow fuerte se limita al estado pulsado.
- **Toques bloqueados.** Si los pseudo-elementos de la carcasa no llevan `pointer-events: none`, pueden tapar los controles.
- **Contraste.** Las flechas en `--ink-dim` sobre la tecla oscura deben seguir siendo legibles al sol; se revisa al medir en el paso 5.
