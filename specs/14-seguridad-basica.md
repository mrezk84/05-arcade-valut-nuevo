# SPEC 14 — Seguridad básica (RLS, headers y contraseñas)

> **Estado:** Aprobado · **Depende de:** SPEC 04 (integración de Supabase), SPEC 06 (tabla `scores`), SPEC 13 (autenticación y `proxy.ts`) · **Fecha:** 2026-10-20
> **Objetivo:** Cerrar el checklist de seguridad básico de `references/security/security-checklist.md`: verificar RLS en `games` y `scores`, añadir headers de seguridad en Next.js, exigir en el registro y en los cambios de contraseña una contraseña de al menos 8 caracteres con minúsculas, mayúsculas, dígitos y símbolos (validada en la UI antes de llamar a Supabase), proteger `/account` y `/auth/reset` desde `proxy.ts` para que sin sesión se redirijan en el servidor, cerrar los avisos de seguridad de Supabase que se puedan resolver en el plan Free, y documentar los ajustes manuales del dashboard (límite de registros por IP).

---

## Scope

**In:**

- **RLS (verificación):** comprobar que `games` y `scores` tienen RLS activo y que sus políticas son las esperadas (lectura pública en ambas, INSERT de `scores` solo con el propio `user_id` o `null`, sin UPDATE ni DELETE). No se crea ninguna política nueva. Si el estado difiere, el paso falla y se corrige antes de seguir.
- **Headers de seguridad en `next.config.ts`:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`, aplicados a todas las rutas (`/(.*)`), tal como pide el checklist.
- **Protección de rutas en `proxy.ts`:** las rutas `/account` y `/auth/reset` exigen sesión.
  - `updateSession` ya valida el JWT con `getClaims()`. Se usa su resultado para decidir: sin claims válidos, redirige en el servidor antes de renderizar la página.
  - `/account` sin sesión → `/auth`.
  - `/auth/reset` sin sesión → `/auth?error=reset_no_session` (el mismo destino que el redirect actual del cliente, así que `/auth` no cambia).
  - La redirección conserva las cookies que `updateSession` haya refrescado, para no perder una sesión que se acaba de renovar.
  - Es un chequeo de navegación, no de autorización: los datos siguen protegidos por RLS.
  - Este spec **reabre** la decisión del SPEC 13 («ninguna ruta exige sesión») solo para estas dos rutas.
- **Redirects del cliente se mantienen** en `app/account/page.tsx` y `app/auth/reset/page.tsx`. El proxy es la barrera al cargar la página, y el cliente cubre el cierre de sesión estando ya dentro de `/account`, donde la navegación no pasa por el proxy.
- **Validación de contraseña en la UI** con una expresión regular: mínimo 8 caracteres, con al menos una minúscula, una mayúscula, un dígito y un símbolo.
  - Se aplica donde se **define** una contraseña: registro (pestaña "CREAR CUENTA" de `/auth`), `/auth/reset` y `/account`.
  - Si no cumple, se muestra un mensaje de error en español bajo el campo y **no se llama a Supabase**.
  - La regex y el mensaje viven en un solo módulo compartido, que sustituye a las comprobaciones de longitud actuales.
  - En el login no se aplica la regex, para no bloquear a cuentas con contraseñas anteriores a este spec. Solo se exige que el campo no esté vacío.
- **Ajuste de servidor para las reglas de contraseña (manual en el dashboard):** en Auth → Providers → Email, longitud mínima 8 y los requisitos de minúsculas, mayúsculas, dígitos y símbolos, con el mismo conjunto de reglas que la regex. La regex del cliente es solo UX. La protección real es la del servidor. Si Supabase rechaza con `weak_password`, el mensaje ya traducido se sigue mostrando.
- **Advisor `rls_auto_enable()`:** migración que revoca `EXECUTE` de `public.rls_auto_enable()` a `anon`, `authenticated` y `PUBLIC`. La función sigue existiendo y el event trigger `ensure_rls` sigue activando RLS en las tablas nuevas. Se verifica creando y borrando una tabla de prueba.
- **Límite de registros por IP (manual en el dashboard):** en Auth → Rate Limits, limitar los registros por IP a **10 por hora**. El spec lo documenta como paso del usuario con el valor recomendado.
- **Revisión final de advisors de seguridad** con el Supabase MCP (`get_advisors`) después de aplicar los cambios.

**Fuera de alcance (para specs futuros):**

- **Leaked password protection** (el aviso `auth_leaked_password_protection`): solo existe en el plan Pro y el proyecto está en Free. Queda documentado como «no aplicable en Free» y sigue apareciendo en los advisors hasta que se suba de plan.
- **CAPTCHA (Turnstile o hCaptcha) en el registro:** por ahora solo se usa el límite por IP del dashboard.
- **Advisors de rendimiento** de Supabase: este spec se limita a seguridad.
- **Proteger otras rutas** (`/api/contact`, `/games/*`, `/hall-of-fame`, etc.): el modo invitado se mantiene y todo lo demás sigue público.
- **Redirigir desde `/auth` cuando ya hay sesión:** `/auth` sigue mostrando «Ya iniciaste sesión» con sus botones, y con `?error=` sigue mostrando el formulario.
- **`?next=` para volver a la ruta original tras iniciar sesión:** exigiría cambiar `/auth` y los flujos de correo y OAuth, y queda para otro spec.
- **Content-Security-Policy, `Strict-Transport-Security` y `Permissions-Policy`:** la CSP es delicada con canvas, Supabase, OAuth y avatares externos y merece su propio spec.
- Cambios en las políticas RLS, el esquema, `games`, `scores` o los checks de `name` y `score`.
- Validar con la regex las contraseñas existentes o forzar su cambio.
- Antifraude de scores, MFA, SMTP propio con Resend y protección contra fuerza bruta más allá de los límites por defecto de Supabase.
- Tests automáticos: el proyecto no tiene test runner.

---

## Data model

**No hay tablas ni columnas nuevas.** Los cambios de base de datos son una sola migración de permisos (`EXECUTE`), `localStorage` y `user_metadata` no cambian, y las estructuras nuevas son un módulo de validación, la configuración de headers y la lista de rutas protegidas del proxy.

### Módulo de contraseña — `lib/auth/password.ts` (nuevo)

Único lugar donde viven la regla y el mensaje. Sustituye a las comprobaciones `pass.length < PASSWORD_MIN` de `app/auth/page.tsx`, `app/auth/reset/page.tsx` y `app/account/page.tsx`.

| Elemento                 | Tipo                         | Descripción                                                                                                      |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PASSWORD_MIN`           | `8`                          | Longitud mínima. Hoy se declara en cada pantalla; pasa a exportarse desde aquí.                                  |
| `PASSWORD_REGEX`         | `RegExp`                     | Ver abajo.                                                                                                       |
| `PASSWORD_RULES_MESSAGE` | `string`                     | `"La contraseña debe tener al menos 8 caracteres, con minúsculas, mayúsculas, números y símbolos."`              |
| `validatePassword(pass)` | `(string) => string \| null` | Devuelve `PASSWORD_RULES_MESSAGE` si no cumple y `null` si cumple. Las pantallas lo usan para el error de campo. |

**Expresión regular:**

```ts
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,./`~]).{8,}$/;
```

- El conjunto de símbolos es el que documenta Supabase para sus «Password requirements». Así, lo que la UI acepta no lo rechaza después el servidor con `weak_password`.
- Un espacio o una letra con acento (`ñ`, `é`) **no** cuentan como símbolo.
- La regex solo valida la forma. No hay lista de contraseñas comunes.

### Headers — `next.config.ts` (modifica)

| Clave                    | Valor                             |
| ------------------------ | --------------------------------- |
| `X-Content-Type-Options` | `nosniff`                         |
| `X-Frame-Options`        | `DENY`                            |
| `Referrer-Policy`        | `strict-origin-when-cross-origin` |

Se declaran como `securityHeaders` y se aplican con `headers: async () => [{ source: '/(.*)', headers: securityHeaders }]`. Antes de escribirlo hay que leer `node_modules/next/dist/docs/` para confirmar la forma de `headers()` en esta versión de Next.

### Rutas protegidas — `proxy.ts` y `lib/supabase/proxy.ts` (modifican)

| Elemento                 | Tipo                                                | Descripción                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROTECTED_ROUTES`       | `Record<string, string>` en `lib/supabase/proxy.ts` | Ruta protegida → destino sin sesión. Dos entradas: `/account` → `/auth` y `/auth/reset` → `/auth?error=reset_no_session`.                                                          |
| `updateSession(request)` | `(NextRequest) => Promise<NextResponse>`            | Mantiene su firma. Tras `getClaims()`, si la ruta está en `PROTECTED_ROUTES` y no hay claims, devuelve un `NextResponse.redirect` que copia las cookies de la respuesta de sesión. |

- La comparación es por ruta exacta (`request.nextUrl.pathname`). `/auth/callback` y `/auth` **no** están en la lista: el callback intercambia el `code` antes de que haya sesión, y `/auth` es el destino de la redirección.
- El `matcher` de `proxy.ts` no cambia: ya cubre `/account` y `/auth/reset` y excluye estáticos.
- Se usa `getClaims()`, nunca `getSession()`, porque en el servidor este último lee la cookie sin validarla.
- No hay cambios en `UserContext`, `app/account/page.tsx` ni `app/auth/reset/page.tsx`: conservan su redirect del cliente.

**Referencias:**

- Next.js, «Proxy» (guía): https://nextjs.org/docs/app/getting-started/proxy
- Next.js, `proxy.js` (API reference): https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Copia local de la versión instalada: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` y `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

De ahí salen las reglas que sigue el spec: un solo `proxy.ts` con la lógica en módulos importados, uso para chequeos optimistas y no para autorización completa, y nada de trabajo lento en el proxy.

### Migración — `revoke_execute_rls_auto_enable`

```sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

- `service_role` y `postgres` conservan el permiso. No se cambia el cuerpo de la función ni el event trigger `ensure_rls`.
- Reversible con el `grant execute` equivalente.

### Ajustes manuales en el dashboard (no son código)

| Ajuste                        | Dónde                    | Valor                                      |
| ----------------------------- | ------------------------ | ------------------------------------------ |
| Longitud mínima de contraseña | Auth → Providers → Email | 8                                          |
| Requisitos de contraseña      | Auth → Providers → Email | minúsculas, mayúsculas, dígitos y símbolos |
| Límite de registros por IP    | Auth → Rate Limits       | 10 por hora                                |
| Leaked password protection    | Auth → Providers → Email | No disponible en Free. Queda sin activar.  |

---

## Implementation plan

Rama: `spec-14-seguridad-basica`. Cada paso deja la app funcionando.

1. **Verificar RLS y fijar la línea base** (solo lectura).
   - Con el Supabase MCP: `relrowsecurity = true` en `games` y `scores`, y las 3 políticas esperadas (`games_select_public`, `scores_select_public`, `scores_insert_own_or_guest`).
   - Ejecutar `get_advisors` de seguridad y anotar los 3 avisos iniciales. No se cambia nada.
2. **Headers de seguridad.**
   - Leer la guía de `headers()` en `node_modules/next/dist/docs/`.
   - Añadir `securityHeaders` y `headers()` a `next.config.ts`, conservando `turbopack` y `allowedDevOrigins`.
   - Comprobar con `curl -I http://localhost:3000/` que la home y `/games` devuelven los 3 headers.
3. **Migración `revoke_execute_rls_auto_enable`.**
   - Aplicarla con `apply_migration`.
   - Verificar que `anon` y `authenticated` ya no tienen `EXECUTE`.
   - Crear una tabla de prueba en `public`, comprobar que nace con RLS activo (`ensure_rls` sigue funcionando) y borrarla.
4. **Módulo `lib/auth/password.ts`.**
   - Exporta `PASSWORD_MIN`, `PASSWORD_REGEX`, `PASSWORD_RULES_MESSAGE` y `validatePassword`.
   - Aún no se usa en ninguna pantalla, así que el comportamiento no cambia.
5. **Registro en `/auth`.**
   - Sustituir la comprobación `pass.length < PASSWORD_MIN` (línea 70) por `validatePassword`.
   - Mostrar el error bajo el campo con el estilo de error que ya usa la pantalla, y cortar antes de llamar a `supabase.auth.signUp`.
   - Login: solo exigir que correo y contraseña no estén vacíos, sin regex.
   - Antes de tocar la UI se carga `/frontend-design`, como pide `CLAUDE.md`. El aspecto no cambia, solo se añade el mensaje.
   - El error aparece **al enviar el formulario** y se limpia cuando la persona vuelve a editar el campo. No hay validación en vivo ni checklist de requisitos.
6. **`/auth/reset` y `/account`.**
   - Mismo cambio en `app/auth/reset/page.tsx:35` y `app/account/page.tsx:106`.
   - La confirmación de contraseña coincidente se mantiene como está.
7. **Protección de rutas en el proxy.**
   - Releer la guía de `proxy` en `node_modules/next/dist/docs/` (enlazada en el Data model).
   - En `lib/supabase/proxy.ts`, definir `PROTECTED_ROUTES` y hacer que `updateSession` use el resultado de `getClaims()`.
   - Si la ruta es exacta en `PROTECTED_ROUTES` y no hay claims, devolver `NextResponse.redirect` al destino, copiando a esa respuesta las cookies que `setAll` haya escrito, para no perder una sesión recién refrescada.
   - `proxy.ts` y su `matcher` no cambian. Este paso no toca la UI.
   - Comprobar sin sesión con `curl -I`: `/account` responde 307 a `/auth` y `/auth/reset` a `/auth?error=reset_no_session`. Las rutas públicas (`/`, `/games`, `/games/snake/play`, `/auth`) siguen respondiendo 200.
   - Comprobar en el navegador con sesión: `/account` y `/auth/reset` cargan, y el flujo de recuperación de contraseña (enlace del correo → `/auth/callback` → `/auth/reset`) sigue funcionando.
8. **Ajustes manuales en el dashboard (los hace el usuario).**
   - Longitud mínima 8 y requisitos de contraseña en Auth → Providers → Email.
   - Límite de registros por IP en 10 por hora en Auth → Rate Limits.
   - Se confirman en el chat antes del paso 9.
9. **Verificación final.**
   - `npm run lint` y `npm run build` sin errores.
   - Probar en el navegador los casos de contraseña de los criterios de aceptación en las tres pantallas.
   - Cerrar sesión estando en `/account` sigue redirigiendo por el cliente. Recargar `/account` ya cerrada la sesión redirige por el proxy a `/auth`.
   - Con el ajuste del paso 8 activo, comprobar que una contraseña débil enviada directamente a Supabase se rechaza con `weak_password`.
   - Ejecutar `get_advisors` de nuevo y comprobar que solo queda el aviso de contraseñas filtradas.
   - Actualizar la sección Auth de `CLAUDE.md` con los headers, la regla de contraseña y las rutas protegidas por `proxy.ts`.

---

## Acceptance criteria

**RLS**

- [ ] `relrowsecurity` es `true` en `public.games` y `public.scores`.
- [ ] `pg_policies` de `public` contiene exactamente `games_select_public`, `scores_select_public` y `scores_insert_own_or_guest`, sin políticas UPDATE ni DELETE.
- [ ] Una tabla de prueba creada en `public` nace con RLS activo (el event trigger `ensure_rls` sigue funcionando) y se borra después.

**Advisor `rls_auto_enable()`**

- [ ] `anon` y `authenticated` no tienen `EXECUTE` sobre `public.rls_auto_enable()`.
- [ ] `get_advisors` de seguridad ya no devuelve `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] El único aviso de seguridad que queda es `auth_leaked_password_protection`, documentado como no aplicable en Free.

**Headers**

- [ ] `curl -I` a `/`, `/games` y `/auth` devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] La app sigue cargando en el navegador, con los juegos jugables, el login con Google y GitHub y los avatares, sin errores nuevos en consola.

**Contraseña (registro, `/auth/reset` y `/account`)**

- [ ] Rechazan, con `PASSWORD_RULES_MESSAGE` y sin llamar a Supabase (comprobado en la pestaña de red), estas contraseñas: `Ab1!xyz` (7 caracteres), `abcdefg1!` (sin mayúscula), `ABCDEFG1!` (sin minúscula), `Abcdefgh!` (sin dígito), `Abcdefg12` (sin símbolo) y `Abcdef 12` (el espacio no cuenta como símbolo).
- [ ] Aceptan `Abcdef1!` y siguen el flujo normal.
- [ ] El mensaje de error aparece bajo el campo al enviar y desaparece al editarlo.
- [ ] En `/auth/reset` y `/account`, la confirmación que no coincide sigue mostrando su propio error.
- [ ] El login con correo y contraseña **no** aplica la regex: una cuenta existente con contraseña débil sigue entrando.
- [ ] No queda ninguna comprobación `pass.length < PASSWORD_MIN` fuera de `lib/auth/password.ts`.

**Protección de rutas (proxy)**

- [ ] Sin sesión, `curl -I http://localhost:3000/account` responde `307` con `location` hacia `/auth`.
- [ ] Sin sesión, `curl -I http://localhost:3000/auth/reset` responde `307` con `location` hacia `/auth?error=reset_no_session`.
- [ ] Sin sesión, `/`, `/games`, `/games/snake`, `/games/snake/play`, `/hall-of-fame`, `/about` y `/auth` responden `200`: el modo invitado sigue intacto.
- [ ] Un invitado puede jugar una partida y guardar su score como antes.
- [ ] Con sesión iniciada, `/account` y `/auth/reset` cargan sin redirección.
- [ ] El flujo completo de recuperación (enlace del correo → `/auth/callback` → `/auth/reset` → contraseña nueva) funciona de principio a fin.
- [ ] `/auth/callback` y `/auth` no están en `PROTECTED_ROUTES`.
- [ ] Una cookie de sesión manipulada o expirada se trata como sin sesión (`getClaims()` no devuelve claims) y redirige.
- [ ] La respuesta de redirección conserva las cookies refrescadas por `updateSession`.
- [ ] Cerrar sesión estando en `/account` redirige por el cliente. Recargar `/account` después redirige por el proxy a `/auth`.
- [ ] `proxy.ts` conserva un `matcher` que excluye estáticos, y no hay ningún `getSession()` en código de servidor.

**Ajustes manuales y cierre**

- [ ] Con los requisitos de contraseña activos en el dashboard, una llamada directa a `signUp` con una contraseña débil devuelve `weak_password` y la UI muestra el mensaje traducido.
- [ ] El límite de registros por IP está en 10 por hora, confirmado por el usuario.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La sección Auth de `CLAUDE.md` menciona los headers y la regla de contraseña.

---

## Decisions taken and discarded

**Decisiones tomadas**

- **Regex en la UI y reglas en el servidor.** La regex evita enviar contraseñas que se sabe que van a fallar. Los requisitos del dashboard son la protección real, porque la UI se puede saltar llamando a Supabase directamente. Se usan las dos con las mismas reglas.
- **Símbolos con el conjunto de Supabase**, en vez de «cualquier carácter que no sea letra o dígito». Así, la UI no acepta algo que el servidor luego rechaza (por ejemplo espacios o `ñ`).
- **Sin regex en el login.** Las cuentas anteriores a este spec pueden tener contraseñas débiles, y validarlas ahí las dejaría sin acceso. Solo se aplica donde se define una contraseña.
- **Error al enviar el formulario**, sin validación en vivo ni checklist de reglas. Mantiene el diseño actual de `/auth`, y una lista de requisitos visible sería un cambio de UI.
- **Una sola fuente de la regla** en `lib/auth/password.ts`, en lugar de repetirla en las tres pantallas.
- **Revocar `EXECUTE` en `rls_auto_enable()` en vez de borrar la función.** Es un event trigger (`ensure_rls`) que protege las tablas nuevas, y no necesita que lo ejecuten `anon` ni `authenticated`. Se conserva la función y se verifica con una tabla de prueba.
- **RLS solo se verifica.** Ya está activo en `games` y `scores` con las políticas correctas, así que el spec no las modifica.
- **Límite de registros: 10 por hora por IP.** Es lo bastante bajo para frenar bots y no molesta a un usuario real.
- **Solo los 3 headers del checklist.** Son los que no pueden romper nada.
- **Solo advisors de seguridad**, para mantener un único objetivo.
- **Reabrir «sin rutas protegidas» del SPEC 13 solo para `/account` y `/auth/reset`.** Esas dos pantallas no tienen sentido sin cuenta, y el redirect del cliente se puede evitar desactivando JavaScript. El resto de rutas sigue público para no romper el modo invitado.
- **Proteger con el proxy que ya existe** (`updateSession`), en vez de crear otro archivo o una capa nueva. Next admite un solo `proxy.ts`, y `getClaims()` ya valida el JWT en cada petición.
- **El proxy es un chequeo de navegación, no de autorización.** Los datos siguen protegidos por RLS; el proxy solo evita renderizar pantallas sin sesión.
- **Mismo destino que el redirect del cliente** (`/auth` y `/auth?error=reset_no_session`), para no tocar `/auth`.
- **Los redirects del cliente se quedan.** El proxy cubre la carga de la página; el cliente cubre el cierre de sesión dentro de la página, donde la navegación no pasa por el proxy.
- **Ruta exacta, no prefijos.** `PROTECTED_ROUTES` compara el `pathname` completo, para no proteger sin querer `/auth/callback` ni `/auth`.

**Decisiones descartadas**

- **Leaked password protection:** solo existe en el plan Pro y el proyecto es Free. Se documenta como no aplicable y se retoma si se sube de plan.
- **CAPTCHA en el registro:** añade una dependencia externa y UI nueva. Por ahora basta el límite por IP, y queda para un spec futuro si aparecen bots.
- **Content-Security-Policy, `Strict-Transport-Security` y `Permissions-Policy`:** la CSP puede romper el canvas, OAuth o los avatares externos y merece su propio spec. Los otros dos no están en el checklist.
- **Advisors de rendimiento de Supabase:** fuera del objetivo del spec.
- **Forzar el cambio de contraseña a las cuentas existentes:** invasivo y sin necesidad demostrada.
- **Lista de contraseñas comunes en el cliente:** pesa y la cubre mejor el servidor con leaked password protection si se pasa a Pro.
- **Proteger `/api/contact`:** es un formulario público de contacto y exigir sesión lo dejaría sin uso para invitados.
- **Redirigir desde `/auth` con sesión activa:** `/auth` ya muestra «Ya iniciaste sesión» con sus botones, y con `?error=` debe seguir mostrando el formulario.
- **`?next=` para volver a la ruta original:** exige cambiar `/auth` y los flujos de correo y OAuth. Queda para otro spec.
- **Proteger todo salvo una lista de rutas públicas:** invierte el modelo de invitado del SPEC 13.
- **`getSession()` en el proxy:** lee la cookie sin validarla, así que cualquiera podría saltarse la barrera con una cookie falsa.
- **Config `redirects` de `next.config.ts`:** no tiene acceso a la sesión.

---

## Identified risks

| Riesgo                                                                                                                                                                      | Efecto                                                                                                   | Mitigación                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Revocar `EXECUTE` rompe el event trigger `ensure_rls`.** Los event triggers normalmente no comprueban el permiso del llamador, pero no está garantizado.                  | Las tablas nuevas dejarían de nacer con RLS activo, sin ningún aviso.                                    | El paso 3 crea y borra una tabla de prueba y comprueba `relrowsecurity`. Si falla, se revierte con `grant execute` y se valida otra opción, por ejemplo mover la función a un esquema no expuesto. |
| **`X-Frame-Options: DENY` bloquea un iframe legítimo**, por ejemplo una vista previa embebida.                                                                              | La página no carga dentro de ese iframe.                                                                 | Hoy la app no se embebe en ningún sitio. Se comprueba en el paso 2 y se puede relajar a `SAMEORIGIN`.                                                                                              |
| **La regex del cliente y las reglas del servidor se desincronizan** si alguien cambia el dashboard o `password.ts` por separado.                                            | La UI acepta una contraseña que el servidor rechaza con `weak_password`, o al revés.                     | El mensaje traducido de `weak_password` ya existe como respaldo. El conjunto de reglas queda anotado en `lib/auth/password.ts` y en `CLAUDE.md`.                                                   |
| **Contraseñas con caracteres fuera del conjunto de símbolos**, por ejemplo `ñ` o `€` como único «símbolo».                                                                  | La UI las rechaza aunque otro validador las daría por buenas.                                            | El mensaje nombra las categorías pero no lista los símbolos. Conviene revisar el texto si genera confusión.                                                                                        |
| **Los requisitos del servidor también afectan a `/auth/reset`.**                                                                                                            | Una persona con enlace de recuperación válido no puede fijar una contraseña que solo cumpla la longitud. | Es el comportamiento buscado. `/auth/reset` aplica la misma regex, y el login sigue permitiendo contraseñas antiguas.                                                                              |
| **El límite de 10 registros por hora por IP afecta a redes compartidas** (colegio, evento, NAT de la operadora).                                                            | Varias personas legítimas detrás de la misma IP pueden quedar sin poder registrarse durante una hora.    | Se acepta para un proyecto de este tamaño. Se puede subir el valor desde el dashboard sin tocar código.                                                                                            |
| **Los ajustes manuales del dashboard se olvidan.**                                                                                                                          | La seguridad real depende de pasos que el código no puede forzar.                                        | Son el paso 8 del plan y un criterio de aceptación explícito. El spec no pasa a «Implementado» hasta que el usuario los confirma.                                                                  |
| **La redirección del proxy pierde las cookies refrescadas.** `updateSession` escribe cookies nuevas en su respuesta, y un `NextResponse.redirect` nuevo no las hereda.      | La sesión recién renovada se pierde y la persona queda deslogueada tras la redirección.                  | La redirección copia las cookies de la respuesta de sesión antes de devolverla. Es un criterio de aceptación explícito.                                                                            |
| **Bloquear `/auth/reset` en el flujo de recuperación.** Si la sesión de recuperación aún no está en la cookie cuando se pide la página, el proxy redirige un enlace válido. | Una persona con enlace válido ve `reset_no_session`.                                                     | `/auth/callback` intercambia el `code` en el servidor y deja la cookie antes de redirigir. El flujo completo de recuperación es un criterio de aceptación.                                         |
| **El proxy da una falsa sensación de seguridad.**                                                                                                                           | Alguien podría asumir que las pantallas protegidas están blindadas y exponer datos sensibles sin RLS.    | El spec lo declara como chequeo de navegación. Los datos siguen protegidos por RLS, y `getClaims()` se usa siempre en lugar de `getSession()`.                                                     |
| **Una ruta protegida nueva se olvida en `PROTECTED_ROUTES`.**                                                                                                               | Una pantalla nueva con datos de cuenta quedaría pública.                                                 | La lista está en un solo sitio, documentada en `CLAUDE.md`. Añadir una ruta es una línea.                                                                                                          |
| **Caída o lentitud de `getClaims()`** al validar el JWT.                                                                                                                    | Las rutas protegidas tardan o fallan al cargar.                                                          | `getClaims()` valida el JWT con claves cacheadas y no consulta la base de datos. Si falla, se trata como sin sesión y redirige.                                                                    |
