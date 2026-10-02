# Plantilla de spec de juego

Forma que `/add-game` sigue al redactar. **No es texto para copiar tal cual**: adapta cada sección al juego, elimina los pasos condicionales que no apliquen y sustituye los `<placeholders>`. Las reglas generales (una idea por frase, nombres concretos, sin TODOs) son las de `.agents/skills/spec/template.md`.

---

## Cabecera

```markdown
# SPEC NN — Integración del juego <Title>

> **Estado:** Borrador · **Depende de:** SPEC 06 (+ SPEC <shell> si el shell ya existe) · **Fecha:** YYYY-MM-DD
> **Objetivo:** Integrar <Title> como juego jugable en `/games/<id>/play` con guardado de score en el leaderboard de Supabase.
```

Usa el set de estados de los specs existentes (los del repo están en español).

## Scope

```markdown
## Scope

**In:**

- Componente `components/games/<Pascal>Game.tsx` adaptado de `references/started-games/<NN-nombre>/` (o diseñado desde cero).
- Play-page `app/games/<id>/play/page.tsx` sobre `GamePlayShell`.
- (cond.) Extraer `components/games/GamePlayShell.tsx` desde la play-page de Asteroids y migrar Asteroids.
- Assets en `public/games/<id>/`. (cond.)
- Fila `<id>` en la tabla `games`. (cond.: migración de CHECK si hay `cat`/`color` nuevo)
- Cover `.cover-<id>` o reutilizar `<cover existente>`.

**Fuera de alcance:**

- Supabase Auth y RLS más estricto.
- Controles táctiles / mobile (salvo que se haya pedido).
- Leaderboards locales del juego original: los reemplaza el de la plataforma.
- Cambios en `/games`, `/games/[id]` y `/hall-of-fame` (ya leen de Supabase).
- <lo que salió en las preguntas y se difiere>
```

## Data model

```markdown
## Data model

Fila de `games`:

\`\`\`sql
insert into games (id, title, short, long, cat, cover, color, sort_order)
values (...);
\`\`\`

Props del componente:

\`\`\`ts
interface <Pascal>GameProps { paused: boolean; onScoreChange; ...; onGameOver }
\`\`\`

`scores` no cambia: se inserta `{ game_id: '<id>', name, score }` (name 1–10 chars, score 0–10 000 000).
```

Si el juego exige cambios de schema, descríbelos aquí con el SQL concreto.

## Implementation plan (esqueleto)

```markdown
1. (cond.) Extraer `GamePlayShell` de `app/games/asteroids/play/page.tsx` y migrar Asteroids.
   Verificación: `/games/asteroids/play` se comporta igual (HUD, pausa, modal, guardado).
2. (cond.) Migración de schema: ampliar CHECK de `cat`/`color` y actualizar `lib/supabase/types.ts`.
3. Copiar assets a `public/games/<id>/`. (cond.)
4. Crear `components/games/<Pascal>Game.tsx` (+ módulos en `components/games/<id>/`).
   Verificación: el juego carga y es jugable en una página de prueba o en el paso 5.
5. Crear `app/games/<id>/play/page.tsx` con `dynamic(..., { ssr: false })` y `GamePlayShell`.
   Verificación: HUD React sincronizado, pausa y "JUGAR DE NUEVO" funcionan.
6. (cond.) Cover CSS `.cover-<id>` (diseñar con /frontend-design).
7. Insertar la fila en `games` con `apply_migration`.
   Verificación: la card aparece en `/games` y `/games/<id>` carga con 404 descartado.
```

Cada paso deja la app ejecutable y es commiteable por sí solo. Para que el juego no aparezca antes de ser jugable, la fila de `games` va después de la play-page.

## Acceptance criteria (base)

```markdown
- [ ] La card de <Title> aparece en `/games` y `/games/<id>` carga con datos reales.
- [ ] `/games/<id>/play` carga sin errores de SSR ni de consola.
- [ ] El canvas renderiza el juego y responde a <controles>.
- [ ] El HUD React muestra <métricas> en tiempo real, iguales al juego.
- [ ] PAUSA congela el loop (y el audio); REANUDAR lo reanuda.
- [ ] Al terminar la partida aparece el modal de game over con la puntuación final.
- [ ] Ningún overlay/leaderboard del juego original se muestra.
- [ ] "JUGAR DE NUEVO" reinicia desde cero (score, métricas, estado del juego).
- [ ] El nombre se pre-rellena desde `av_player_name` y se persiste al guardar.
- [ ] Guardar inserta una fila en `scores` con `game_id = '<id>'`; el botón se deshabilita tras el primer envío.
- [ ] El score aparece en `/games/<id>` y en `/hall-of-fame` al recargar.
- [ ] Salir de la página no deja listeners ni loops activos (cleanup).
- [ ] `/games/asteroids/play` y el resto de rutas siguen funcionando.
- [ ] `npm run build` completa sin errores de TypeScript.
```

Añade criterios propios del juego (victoria, niveles, audio, mouse).

## Decisions

Registra siempre, con motivo:

- Extraer el shell compartido (o no) y por qué ahora.
- Qué UI original se elimina y qué HUD canvas se conserva.
- Pausa controlada por la plataforma; qué pasa con las teclas de pausa originales.
- Victoria dispara/no dispara `onGameOver`.
- Ubicación de assets y audio.
- Columnas reales de `scores` (`name`, no `player_name`) y límites de la base.

## Risks (solo si aplican)

| Riesgo                                                | Mitigación                                    |
| ----------------------------------------------------- | --------------------------------------------- |
| Score fuera de 0–10 000 000 rechazado por CHECK       | Acotar el score antes de insertar             |
| Listeners globales duplicados al reiniciar            | Cleanup en el efecto + reinicio por `key`     |
| Autoplay de audio bloqueado por el navegador          | Iniciar audio tras la primera interacción     |
| Cualquier cliente puede insertar scores (RLS abierto) | Aceptado; se resuelve en un spec de seguridad |

## What is **not** in this spec

Repite al final lo diferido: auth, táctil, records locales, cambios en páginas ya dinámicas y lo que salió en las preguntas.
