# SPEC 10 — Controles táctiles para móvil

> **Estado:** Aprobado · **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09 · **Fecha:** 2026-10-08
> **Objetivo:** Permitir jugar Asteroids, Tetris, Arkanoid y Snake en un móvil, con el canvas arriba y un mando virtual (cruceta y hasta 2 botones) debajo, visible solo en dispositivos táctiles.

> **Nota de verificación:** los criterios se comprobaron con un móvil emulado (Chromium con táctil y `pointer: coarse`, 360×640 a 412×915). Falta confirmarlos en un móvil real antes de pasar a `Implementado`.

---

## Scope

**In:**

- Componente `components/games/TouchControls.tsx`: cruceta de 4 direcciones y hasta 2 botones de acción (A y B), con feedback visual al pulsar.
- El mando no toca la lógica de los juegos: dispara `KeyboardEvent` sintéticos en `window` (`keydown`/`keyup`, con `key` y `code`) con las mismas teclas que el teclado. Mientras un control se mantiene pulsado, emite repeticiones cada ~100 ms (auto-repeat, que Tetris necesita). Al soltarlo, al pausar y al desmontar emite `keyup`.
- Mapeo por juego, declarado en cada play-page:
  - Asteroids: ← → rotar · ↑ empuje (igual que B) · ↓ sin efecto en el juego · A = disparar (`Space`) · B = empuje (`ArrowUp`).
  - Tetris: ← → ↓ · ↑ rotar (igual que A) · A = rotar (`ArrowUp`) · B = caída rápida (`Space`).
  - Arkanoid: ← → mueven el paddle. Sin botones A/B.
  - Snake: ← ↑ → ↓. Sin botones A/B.
- Los botones sin uso no se muestran. La cruceta se adapta al juego (por ejemplo, Arkanoid solo necesita ← →).
- Layout móvil de `/games/<id>/play`, solo con `@media (hover: none) and (pointer: coarse)`:
  - De arriba abajo: canvas escalado al espacio disponible manteniendo su proporción, mando virtual y, al pie, en una sola fila, PAUSA/REANUDAR, REGRESAR (enlace a `/games/<id>`) y el selector de skins (cuando el juego lo tiene). Hay unos 50 px de separación entre el borde de la pantalla y la flecha ↑ de la cruceta. La franja de stats (puntuación, vidas/longitud, nivel) se oculta en móvil para dejar la altura al juego: durante la partida solo se ve la puntuación que dibujan Asteroids y Arkanoid en su propio canvas; en Tetris y Snake la puntuación solo se ve en el modal final.
  - El modal de fin de partida se adapta al ancho del móvil: el campo de nombre y los botones se apilan a todo el ancho del recuadro (solo CSS, sin tocar su lógica).
  - Se ocultan por completo el Nav (incluido su menú móvil), el footer del sitio, el bloque JUGADOR, los botones FIN y SALIR y la barra `crt-bottom` del CRT. El shell marca `<html>` con la clase `av-gamepad` mientras el mando está montado, y el CSS oculta el chrome del sitio con ella.
- Solo portrait. En landscape se muestra un aviso "gira el dispositivo" en lugar del juego, y el juego se pausa.
- `viewport` explícito en `app/layout.tsx` (`width=device-width`, `initial-scale=1`), y los controles evitan zoom, scroll y menú contextual al tocar (`touch-action: none`, `user-select: none`).
- Los 4 juegos a la vez, con el mismo componente y el mismo CSS.

**Fuera de alcance (para specs futuros):**

- Controles específicos para juegos nuevos: cada juego futuro declara su mapeo en su propia spec.
- Gestos (swipe, drag sobre el canvas) y el `mousemove` de Arkanoid. En móvil solo manda el mando virtual.
- Vibración háptica, pantalla completa y bloqueo de orientación.
- Soporte landscape.
- Cambios responsive en `/`, `/games`, `/games/[id]`, `/hall-of-fame`, `/about` y el Nav.
- Cambios en la lógica interna de los 4 juegos y en la lógica del modal de fin de partida (solo se adapta su CSS en móvil).
- Cualquier cambio visible en escritorio.
- Gamepads físicos y mando Bluetooth.
- Tests automatizados (no hay runner configurado).

---

## Data model

No hay cambios en Supabase ni en `localStorage`. Las estructuras nuevas son tipos de TypeScript y configuración por juego.

### Tipos y componente

```ts
// components/games/TouchControls.tsx
export type DpadDir = 'left' | 'right' | 'up' | 'down';
export type TouchKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Space';

export interface TouchButton {
  label: 'A' | 'B';
  key: TouchKey;
  ariaLabel: string; // en español, p. ej. 'Disparar'
}

export interface TouchControlsConfig {
  dpad: DpadDir[]; // direcciones visibles; las demás no se dibujan
  repeat?: DpadDir[]; // direcciones con auto-repeat al mantener pulsado
  buttons?: TouchButton[]; // 0, 1 o 2 botones; sin botones no se dibuja la zona de acción
}

interface TouchControlsProps {
  config: TouchControlsConfig;
  disabled: boolean; // true en pausa o game over: no emite teclas
}
```

### Props nuevas en `GamePlayShell`

```ts
interface GamePlayShellProps {
  // ...props actuales
  touch?: TouchControlsConfig; // opcional: sin él, la play-page no cambia en móvil
}
```

Con `touch` definido, el shell añade la clase `av-player--touch` al contenedor. Todo el CSS móvil cuelga de esa clase, así que la play-page genérica `app/games/[id]/play/page.tsx` (sin `touch`) no cambia.

### Mapeo de teclas

| Control           | `key` / `code` emitidos                              |
| ----------------- | ---------------------------------------------------- |
| ← → ↑ ↓           | `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` |
| Botón con `Space` | `key: ' '`, `code: 'Space'`                          |

Los eventos llevan siempre `key` y `code`, porque Asteroids y Tetris leen `e.code` y Arkanoid lee `e.key`. Se crean con `bubbles: true` y `cancelable: true`, y se disparan en `window`, donde los juegos escuchan.

### Configuración por juego

| Juego     | `dpad`                        | `repeat`                | `buttons`                                      |
| --------- | ----------------------------- | ----------------------- | ---------------------------------------------- |
| Asteroids | `left`, `right`, `up`, `down` | —                       | A `Space` (Disparar) · B `ArrowUp` (Impulso)   |
| Tetris    | `left`, `right`, `up`, `down` | `left`, `right`, `down` | A `ArrowUp` (Rotar) · B `Space` (Caída rápida) |
| Arkanoid  | `left`, `right`               | —                       | —                                              |
| Snake     | `left`, `right`, `up`, `down` | —                       | —                                              |

Reglas de emisión:

- Pulsar un control emite `keydown` una vez. Si su dirección está en `repeat`, emite más `keydown` (con `repeat: true`) cada 100 ms tras un retraso inicial de 200 ms, hasta soltar. Los botones A/B nunca repiten.
- Al soltar, al salir el dedo del control (`pointerleave`/`pointercancel`), al pasar `disabled` a `true` y al desmontar, se emite `keyup` de toda tecla que siga pulsada.
- Se usan Pointer Events con captura del puntero, para soportar varios dedos a la vez (por ejemplo, mover y disparar).

---

## Implementation plan

> Borrador sin revisar. Cada paso deja el sistema funcional y sin cambios en escritorio.

1. **`TouchControls.tsx`.** Tipos, emisión de `KeyboardEvent`, auto-repeat, Pointer Events con captura, `keyup` al soltar, cancelar, deshabilitar y desmontar. Aún no se usa en ninguna página.
2. **Shell y CSS base.** Prop opcional `touch` en `GamePlayShell`, clase `av-player--touch`, render de `TouchControls`, y un pie móvil con PAUSA/REANUDAR y el `hudExtra` (selector de skins) renderizado una sola vez. Estilos del mando en `app/globals.css`. Todo bajo `@media (hover: none) and (pointer: coarse)`.
3. **Layout móvil.** Con la clase `av-player--touch` en móvil: ocultar Nav, footer del sitio, la franja de stats, JUGADOR, FIN, SALIR y `crt-bottom`; canvas escalado al espacio disponible (`dvh`) con su proporción.
4. **Landscape.** Aviso "gira el dispositivo" y pausa automática al entrar en landscape (el shell llama a `onTogglePause` si el juego no estaba pausado).
5. **Asteroids y Tetris.** Pasar `touch` en sus play-pages con el mapeo de la tabla (cruceta y botones A/B). Comprobar que la caída y el movimiento repetido de Tetris funcionan con `repeat`.
6. **Arkanoid y Snake.** Pasar `touch` en sus play-pages (solo cruceta). Comprobar que Snake no llena su cola de giros.
7. **Viewport y ajustes táctiles.** `viewport` en `app/layout.tsx`, `touch-action: none` y `user-select: none` en los controles. Verificación en emulación táctil y en móvil real con los 4 juegos y en escritorio (sin cambios). Actualizar el estado de la spec a `Implementado` y la mención en `CLAUDE.md` si procede.

---

## Acceptance criteria

> Borrador sin revisar.

- [x] En un dispositivo con `(hover: none) and (pointer: coarse)`, las 4 play-pages muestran el canvas arriba y el mando virtual debajo.
- [x] En escritorio (ratón), las 4 play-pages se ven y funcionan exactamente igual que antes.
- [x] Asteroids: ← → rotan la nave, ↑ y B dan empuje, ↓ no hace nada, A dispara, y se pueden mantener A y ← a la vez con dos dedos.
- [x] Tetris: ← → ↓ mueven la pieza y repiten al mantener pulsado, ↑ y A rotan sin repetirse, B hace caída rápida sin repetirse.
- [x] Arkanoid: ← → mueven el paddle mientras se mantienen pulsados y no hay botones A/B visibles.
- [x] Snake: las 4 direcciones giran la serpiente, y no hay botones A/B visibles.
- [x] Soltar el dedo, o sacarlo del control, detiene el movimiento: no quedan teclas "pegadas".
- [x] Al pausar o al terminar la partida, el mando no envía teclas al juego.
- [x] En móvil se ocultan por completo Nav (y su menú), footer, JUGADOR, FIN, SALIR y `crt-bottom`; no se ve la franja de stats y, debajo del mando, PAUSA/REANUDAR, REGRESAR y, si el juego lo tiene, el selector de skins.
- [x] REGRESAR lleva a `/games/<id>`.
- [x] El canvas no se corta ni desborda en un móvil de ~360×640 CSS px en portrait, y mantiene su proporción.
- [x] En landscape se muestra el aviso y el juego queda pausado.
- [x] Tocar los controles no hace zoom, scroll ni abre el menú contextual.
- [x] En móvil, el campo de nombre y todos los botones del modal quedan dentro del recuadro (360 px).
- [ ] El modal de fin de partida y el guardado del score siguen funcionando con el mando. _(El modal se ve por encima del mando y sus botones responden al toque; el guardado en Supabase no se probó para no insertar puntuaciones de prueba. Probarlo en un móvil real.)_
- [x] `/games/[id]/play` (genérica) no cambia.
- [ ] `npm run lint` y `npm run build` pasan. _(`build` pasa. `lint` da 8 errores previos a esta spec, en `app/page.tsx`, `app/games/[id]/play/page.tsx` y el efecto de `av_player_name` de `GamePlayShell.tsx`; ninguno es de esta spec.)_

---

## Decisiones tomadas y descartadas

- **Un solo componente `TouchControls` para los 4 juegos.** Descartado: un mando por juego o una spec por juego (duplica lógica y CSS).
- **`KeyboardEvent` sintéticos en `window`.** No hay que modificar la lógica de los 4 juegos. Descartado: un hook de input compartido que los juegos consuman (más limpio, pero obliga a tocar los 4 juegos).
- **Mando virtual (cruceta y 2 botones) en lugar de gestos.** Es consistente en los 4 juegos y fácil de extender. Los gestos quedan fuera de alcance.
- **Hasta 2 botones de acción.** La mayoría de los arcade necesitan 2 como máximo. Los juegos futuros declaran su mapeo en su propia spec.
- **Detección por `@media (hover: none) and (pointer: coarse)`.** Un portátil con ratón nunca ve el mando. Descartado: detección por ancho (`max-width`), que lo activaría al achicar una ventana de escritorio.
- **Solo portrait, con aviso y pausa automática en landscape.** Descartado: soportar landscape (fuera de alcance).
- **Ocultar Nav, footer, JUGADOR, FIN y SALIR en móvil.** Prioriza espacio de pantalla. Para salir a mitad de partida hay un botón REGRESAR en el pie, junto a PAUSA y al selector de skins (añadido tras probar el layout).
- **`repeat` explícito por dirección y no global.** Solo Tetris lo necesita. En Snake una repetición de la misma dirección llenaría la cola de giros.
- **Los botones sin uso se ocultan** en lugar de mostrarse deshabilitados.
- **`touch` opcional en el shell, con la clase `av-player--touch`.** Aísla el cambio y no afecta a la play-page genérica.
- **Definición rápida de las secciones 4–7:** redactadas por el asistente sin la revisión sección por sección del usuario, a petición de guardar la spec.

---

## Riesgos identificados

> Borrador sin revisar.

- **Salida a mitad de partida.** Resuelto con el botón REGRESAR del pie. Sigue sin haber FIN: terminar la partida a propósito no es posible en móvil.
- **Reubicar el selector de skins.** Hoy vive en el HUD (`hudExtra`). Moverlo al pie en móvil exige reordenar el DOM del shell (o usar `display: contents` y `order`) sin duplicar el `<select>` ni su `id`.
- **Tetris es un canvas alto (300×600).** Con HUD, mando y pie, el tablero quedará pequeño en móviles de pantalla baja. Hay que medir antes de dar por buena la escala.
- **Altura de viewport en móvil.** Las barras del navegador cambian `100vh`; usar `dvh` y probar en Chrome Android y en iOS Safari.
- **`:has()` para ocultar Nav y footer** desde `.av-player--touch`. Si no hay soporte suficiente, hay que marcar el `body` por otra vía.
- **Eventos sintéticos y `preventDefault`.** Los juegos llaman a `preventDefault` en las flechas. Verificar que no dependen de `isTrusted` ni de `e.repeat`.
- **Eventos de ratón emulados.** Arkanoid escucha `mousemove` en el canvas. Un toque sobre el canvas podría mover el paddle por los eventos de ratón emulados del navegador. Comprobar que no interfiere con el mando.
- **Teclas pegadas.** Una pérdida de foco, una llamada entrante o un cambio de pestaña con un dedo pulsado puede dejar una tecla activa. Mitigación: `keyup` en `pointercancel`, `visibilitychange` y desmontaje.
