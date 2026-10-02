---
name: add-game
description: Genera el spec para integrar un juego jugable (canvas) con su leaderboard en Supabase dentro de Arcade Vault. El juego puede venir de references/started-games/ o ser nuevo. Solo escribe el spec en specs/; la implementación se hace luego con /spec-impl.
disable-model-invocation: true
argument-hint: 'carpeta de referencia (ej. 04-arkanoid) o descripción del juego nuevo'
---

# /add-game — Spec de integración de un juego

Produce un spec en `specs/NN-<id>-game.md` que describe cómo integrar un juego en Arcade Vault: componente canvas, play-page, fila en `games` y guardado de score en `scores`. **No escribes código aquí.** Solo el `.md` final.

**La skill `/spec` es la fuente de verdad del método y del formato.** Antes de redactar o guardar cualquier spec debes leerla (Fase 1, paso 1 y Fase 5, paso 1). Este skill solo añade lo específico de juegos: `template.md` (esqueleto de spec de juego) y `reference/integration.md` (contrato técnico que el spec debe citar). Si algo de este skill contradice a `/spec`, manda `/spec`.

Responde en el idioma del prompt inicial.

## Argumentos

- `/add-game 04-arkanoid` → origen = `references/started-games/04-arkanoid`.
- `/add-game <descripción>` → juego nuevo sin referencia.
- Sin argumentos → pregunta: ¿carpeta de referencia o juego nuevo? (una frase).

## Fase 1 — Contexto (lee antes de preguntar)

1. **Lee completos, con Read, `.agents/skills/spec/SKILL.md` y `.agents/skills/spec/template.md`.** No los resumas de memoria. De ahí salen: el método por fases, la estructura y orden de secciones, la cabecera, las reglas de redacción (una idea por frase, sin TODOs, sin código largo), los estados válidos y las reglas de guardado.
2. Lee `CLAUDE.md` y `AGENTS.md`.
3. Lista `specs/`; lee los dos más recientes, más `05-asteroids-game.md` y `06-games-table-leaderboard-supabase.md`.
4. **Schema real**: `mcp__supabase__list_tables` (verbose) y `select id, sort_order from games order by sort_order`. El spec 06 está desactualizado respecto a la base (usa `player_name`/`user_id`; la tabla real usa `name`, sin `user_id`, y `games` tiene `sort_order`). Manda el schema real. Si MCP no está disponible, lee `lib/supabase/types.ts` y avisa al usuario.
5. Comprueba si existe `components/games/GamePlayShell.tsx`. Si no existe, el spec **debe incluir** su extracción como primer paso (ver `reference/integration.md`).
6. Lee `components/games/AsteroidsGame.tsx` y `app/games/asteroids/play/page.tsx` (o el shell, si ya existe) para citar el patrón vigente, no el de memoria.
7. Lista las clases `.cover-*` de `app/globals.css`.

## Fase 2 — Analizar el origen

**Con referencia:** lee README/CLAUDE.md/requirements, `index.html`, todos los `.js` y lista assets. Entrega al usuario un inventario corto:

- Tamaño del canvas y canvas secundarios (p. ej. "next piece").
- Input: teclado, mouse, ambos; teclas con `preventDefault`.
- Dónde viven score, vidas, nivel, líneas u otras métricas.
- Condiciones de fin: game over, victoria.
- Pausa propia (teclas, overlay) y reinicio propio.
- DOM fuera del canvas: overlays, HUD HTML, leaderboards en localStorage, menús, skins.
- Scripts múltiples y globals compartidos (orden de `<script>`).
- Assets y rutas relativas (imágenes, audio, spritesheets).
- Estilos CSS propios que deban sustituirse por los de la plataforma.

**Sin referencia:** pregunta concepto, mecánica, controles, condición de fin y métricas de HUD.

## Fase 3 — Preguntas

Bloques de 3–5 numeradas, con recomendación marcada. Cubre siempre:

1. **Identidad:** `id` (kebab-case, no repetido en `games`), `title`, `short`, `long`, `cat` (valores válidos según el CHECK real), `color`, `cover` (reutilizar clase o crear `.cover-<id>`), `sort_order` (siguiente libre).
2. **HUD React:** qué métricas se reflejan (score siempre) → define los callbacks `on<Stat>Change`.
3. **UI propia del juego:** recomendado eliminar overlays de game over, pausa y leaderboard local; el modal y el leaderboard de la plataforma los reemplazan. HUD dibujado en canvas se conserva salvo decisión contraria.
4. **Pausa:** la plataforma controla `paused`. ¿Se eliminan las teclas internas de pausa o se enrutan?
5. **Victoria:** ¿también dispara `onGameOver(score)`?
6. **Assets/audio:** destino `public/games/<id>/`; el audio debe respetar la pausa.
7. **Límites de la base:** score entre 0 y 10 000 000; nombre de 1 a 10 caracteres. ¿El juego puede exceder el límite?
8. **Cambios de schema:** ¿hace falta un valor nuevo de `cat`/`color`? Si sí, es un paso de migración explícito.

Si la respuesta abre otra feature (multijugador, táctil, modos de dificultad), propón spec aparte y déjala en "Fuera de alcance".

## Fase 4 — Redactar sección por sección

Orden estricto, el de `/spec` (Fase 3) y `.agents/skills/spec/template.md`: cabecera → scope → data model → implementation plan → acceptance criteria → decisions → risks → "What is not in this spec". Muestra cada sección, pregunta si se queda así y espera confirmación. Nunca generes el spec entero de una vez.

Respeta las reglas de `/spec`: objetivo en una sola frase, "Fuera de alcance" explícito, pasos del plan commiteables y que dejan la app ejecutable, criterios booleanos verificables, decisiones con motivo.

Parte de `template.md` de este skill (que especializa el de `/spec`): el esqueleto del plan y los criterios base ya están ahí; adáptalos al juego, quita pasos condicionales que no apliquen y añade los específicos (assets, módulos auxiliares, migración de schema).

## Fase 5 — Guardar

1. **Antes de crear el archivo, relee `.agents/skills/spec/SKILL.md` (Fase 4 y Hard rules) y `.agents/skills/spec/template.md`** y verifica el spec contra ellos: cabecera con el formato de `/spec`, todas las secciones obligatorias en orden, objetivo de una frase, "Fuera de alcance" presente, criterios booleanos, sin TODOs ni código largo. Corrige lo que no cumpla y avisa al usuario de los ajustes.
2. Siguiente número libre en `specs/`; slug `<id>-game`.
3. Confirma el nombre de archivo con el usuario antes de escribir.
4. Escribe `specs/NN-<id>-game.md` con estado `Borrador` (o el set de estados que use el repo; mira los specs previos). Nunca `Aprobado` automático.
5. Informa: ruta, estado, y sugiere `/spec-impl NN`.

## Reglas duras

- **No redactes ni guardes ningún spec sin haber leído `/spec` (SKILL.md y template.md) en esta sesión.**
- **No escribas código** ni toques archivos fuera de `specs/NN-*.md`.
- **No inventes columnas.** Todo lo de base de datos sale del schema leído en Fase 1.
- No planifiques cambios en `/games`, `/games/[id]` ni `/hall-of-fame`: ya leen de Supabase y el juego aparece al insertar la fila en `games`. Solo si el análisis demuestra lo contrario.
- La UI nueva (cover, estilos) se diseña con `/frontend-design` (regla de CLAUDE.md); anótalo en el plan.
- Next.js 16 difiere del conocimiento previo: el plan debe indicar leer `node_modules/next/dist/docs/` antes de escribir código de rutas.
- No TODOs en el spec: decide o registra la decisión pendiente con su motivo.
- Si el juego es demasiado grande (varios canvas, mucho DOM, muchos assets), propón partir en dos specs: primero shell/infra, luego juego.
