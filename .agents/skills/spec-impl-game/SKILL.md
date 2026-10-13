---
name: spec-impl-game
description: Implementa un spec de juego aprobado siguiendo /spec-impl y, al terminar, lanza en secuencia los agentes skin-designer y mobile-porter sobre ese juego.
disable-model-invocation: true
argument-hint: '<NN-<id>-game | ruta al spec>'
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementa un spec de juego + skins + móvil

Hace lo mismo que `/spec-impl` y, al terminar la implementación, lanza **uno después del otro** (nunca en paralelo) los agentes `skin-designer` y `mobile-porter` sobre el juego implementado.

Responde en español.

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ specs/game-jam/* 2>/dev/null || echo "No existe la carpeta specs/"`

---

## Fuente de verdad: /spec-impl

**Lee completo, con Read, `.agents/skills/spec-impl/SKILL.md`** y sigue sus Fases 1–4 al pie de la letra, usando como argumento `$ARGUMENTS`: validación del estado "Aprobado", rama `spec-NN-slug`, resumen del spec, e implementación paso a paso con pausa y confirmación tras cada paso. No las resumas de memoria.

Si algo de este skill contradice a `/spec-impl`, manda `/spec-impl`. La única parte propia es la Fase 5 y las dos extensiones siguientes.

### Extensión de Fase 1 — rutas

`/spec-impl` busca en `specs/`. Aquí también se acepta una ruta completa, p. ej. `specs/game-jam/<id>/01-<id>-game.md`. Si el argumento es una ruta, léela con Read en lugar de `cat specs/$ARGUMENTS.md`. Para specs de `specs/game-jam/`, si el nombre de rama no es evidente (`spec-<id>-NN-slug`), pregunta al usuario antes de crearla.

### Fase 1b — Determinar el `game-id`

Deduce el `game-id` del spec (ruta `app/games/<id>/play`, fila de `games` o slug `NN-<id>-game`). Si no puedes deducirlo con certeza, pregunta.

Si el spec no crea ni modifica `app/games/<id>/play/`, no es un spec de juego: avisa de que corresponde usar `/spec-impl` y detente.

---

## Fase 5 — Skins y móvil (propia de este skill)

Solo cuando `/spec-impl` haya llegado a su mensaje final ("✅ All steps of the plan are implemented") con todos los pasos confirmados por el usuario. Si el spec no se llegó a implementar (estado no Aprobado, usuario cancela, etc.), **no lances ningún agente**.

1. Comprueba que existe `app/games/<id>/play/page.tsx`. Si no, avisa y detente.
2. Anuncia: `Lanzo @skin-designer <id>; cuando termine, @mobile-porter <id>.`
3. Lanza la herramienta `Agent` con `subagent_type: "skin-designer"` y como prompt el `game-id`, más contexto breve: spec implementado, rama activa, sin commits. **Espera a que termine** y resume su informe al usuario (skins creadas, contrastes en modo oscuro, archivos tocados).
4. Si `skin-designer` falló o se detuvo, para y pregunta al usuario antes de continuar.
5. Solo entonces lanza `Agent` con `subagent_type: "mobile-porter"`, mismo prompt y contexto. Espera y resume su informe (config `touch`, CSS móvil, fila en `references/game-mobile-status.md`).
6. **Nunca** los lances en la misma respuesta ni en paralelo: ambos tocan `app/games/<id>/play/page.tsx`. El segundo empieza después de que el primero haya terminado.
7. Cierra con:

```
✅ Juego implementado, con skins y adaptado a móvil.

Siguiente paso: verifica los criterios de aceptación del spec uno por uno.
Si todos pasan, cambia el estado del spec a "Implementado" y haz el commit
final (en español, estilo convencional) antes de mergear la rama.
```

---

## Resumen de comportamiento esperado

```
/spec-impl-game 12-frogger-game

  Fases 1–4 →  igual que /spec-impl (rama, resumen, pasos con pausa)
  Fase 5    →  @skin-designer frogger  → espera informe
               @mobile-porter frogger  → espera informe
               recordatorio de criterios de aceptación y commit

/spec-impl-game specs/game-jam/frogger/01-frogger-game.md  (Borrador)

  Fase 2    →  estado "Borrador" → ❌ mensaje estándar de /spec-impl
               sin rama, sin código, sin agentes
```
