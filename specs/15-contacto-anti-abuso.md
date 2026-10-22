# SPEC 15 — Anti-abuso del formulario de contacto

> **Estado:** Implementado · **Depende de:** SPEC 03 (contacto con Resend), SPEC 04 (integración de Supabase), SPEC 14 (seguridad básica) · **Fecha:** 2026-10-22
> **Objetivo:** Proteger `POST /api/contact` contra el spam y el gasto de la cuota de Resend con un límite de envíos por IP y un tope global diario guardados en Supabase, más un campo honeypot que los bots rellenan.

---

## Por qué existe este spec

La auditoría de seguridad de 2026-10-22 encontró que `app/api/contact/route.ts` valida y escapa bien el contenido, pero no limita cuántas veces se puede llamar. Cualquiera puede hacer POST en bucle y llenar la bandeja de `mrezk84@gmail.com` o agotar la cuota gratuita de Resend.

SPEC 14 descartó **exigir sesión** en `/api/contact` (dejaría sin uso el formulario a los invitados) y descartó el CAPTCHA, pero solo para el registro. Este spec no reabre ninguna de las dos decisiones: limita el abuso sin cambiar quién puede escribir.

La segunda medida de la auditoría, el cambio de contraseña con reautenticación, es de otra zona del sistema (dashboard de Supabase, `/account` y `/auth/reset`) y va en un **SPEC 16** aparte.

---

## Scope

**In:**

- **Límite por IP:** como máximo **3 envíos por hora** desde la misma IP. El envío 4.º responde `429`.
- **Tope global:** como máximo **30 envíos por día** entre todas las IPs. Es un cortacircuitos para proteger la cuota de Resend si alguien rota IPs. Al superarlo responde `429`.
- **Almacenamiento en Supabase:** tabla `contact_attempts` y función `contact_rate_limit_check`, creadas con una migración. La función cuenta e inserta el intento de forma atómica.
- **Cliente de servidor con `service_role`:** `lib/supabase/admin.ts`, solo para el Route Handler. La tabla y la función no son accesibles para `anon` ni `authenticated`.
- **Identificación de la IP:** primer valor de `x-forwarded-for`, con `x-real-ip` como respaldo y el cubo `unknown` si no hay ninguno. La IP **no se guarda en claro**: se guarda su hash SHA-256 con una sal secreta.
- **Honeypot:** campo oculto `website` en el formulario de `/about`. Si llega con contenido, la ruta responde `{ ok: true }` sin enviar ningún correo y sin consumir el límite, para no darle pistas al bot.
- **Orden en la ruta:** parseo → validación → honeypot → límite → envío. Un envío cuenta para el límite aunque Resend falle después.
- **Respuesta `429`:** `{ error: "Has enviado demasiados mensajes. Inténtalo de nuevo más tarde." }` con la cabecera `Retry-After` en segundos. El formulario ya muestra `data.error`, así que no necesita cambios para ese caso.
- **Si Supabase no responde:** la ruta falla cerrada con `503` y un mensaje en español, en lugar de enviar sin límite.
- **Variables de entorno nuevas** en `.env.template` y `CLAUDE.md`: `SUPABASE_SERVICE_ROLE_KEY` y `CONTACT_IP_SALT`.
- **Verificación de advisors** de seguridad de Supabase tras la migración.

**Fuera de alcance (para specs futuros):**

- **Cambio de contraseña seguro** (Secure password change y reautenticación en `/account` y `/auth/reset`): es el SPEC 16.
- **Remitente de producción** (`from` distinto de `onboarding@resend.dev`): exige un dominio verificado en Resend y no se ha confirmado que exista. Queda documentado como limitación y como riesgo.
- **CAPTCHA (Turnstile o hCaptcha):** añade UI y una dependencia externa. Se retoma solo si el honeypot y el límite no bastan.
- **Exigir sesión en `/api/contact`:** descartado en SPEC 14.
- **Redis o Upstash:** no se añade un servicio nuevo mientras Supabase cubra el caso.
- **Panel o alertas** de intentos bloqueados.
- **Rate limit en otras rutas** (`/api/*` futuras, guardado de scores, auth). El de auth ya lo gestiona Supabase.
- Cambios en el diseño del formulario, en el contenido del correo o en la validación de campos existente.
- Tests automáticos: el proyecto no tiene test runner.

---

## Data model

### Tabla — `public.contact_attempts` (nueva)

```sql
create table public.contact_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index contact_attempts_ip_created_idx
  on public.contact_attempts (ip_hash, created_at desc);
create index contact_attempts_created_idx
  on public.contact_attempts (created_at desc);

alter table public.contact_attempts enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leer ni escribir.
revoke all on public.contact_attempts from anon, authenticated;
```

### Función — `public.contact_rate_limit_check` (nueva)

| Elemento       | Descripción                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Firma          | `contact_rate_limit_check(p_ip_hash text, p_ip_limit int, p_ip_window interval, p_global_limit int) returns text`             |
| Retorno        | `'ok'`, `'ip_limit'` o `'global_limit'`                                                                                       |
| Comportamiento | Toma un `pg_advisory_xact_lock`, borra filas de más de 2 días, cuenta por IP y global (24 h), e inserta el intento si es `ok` |
| Seguridad      | `security definer`, `set search_path = ''` y `revoke execute ... from public, anon, authenticated`. Solo `service_role`       |

Los valores `3`, `1 hour` y `30` los pasa la ruta desde constantes, para ajustarlos sin migración.

### Módulos de aplicación

| Archivo                      | Estado    | Contenido                                                                                                          |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/supabase/admin.ts`      | nuevo     | `createAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY`. Solo se importa desde Route Handlers.                       |
| `lib/contact/rate-limit.ts`  | nuevo     | `CONTACT_LIMITS`, `getClientIp(request)`, `hashIp(ip)` y `checkContactRateLimit(request)` que llama a la función.  |
| `app/api/contact/route.ts`   | modifica  | Añade honeypot y límite en el orden indicado, y la respuesta `429` con `Retry-After`.                              |
| `app/about/page.tsx`         | modifica  | Añade el input oculto `website` (`tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`) y lo incluye en el `fetch`. |
| `.env.template`, `CLAUDE.md` | modifican | Documentan `SUPABASE_SERVICE_ROLE_KEY` y `CONTACT_IP_SALT`.                                                        |

```ts
// lib/contact/rate-limit.ts
export const CONTACT_LIMITS = {
  perIp: 3,
  ipWindow: '1 hour',
  global: 30, // por día
} as const;

type RateLimitResult = 'ok' | 'ip_limit' | 'global_limit';
```

Convenciones:

- La sal `CONTACT_IP_SALT` no lleva el prefijo `NEXT_PUBLIC_`: nunca llega al navegador.
- `SUPABASE_SERVICE_ROLE_KEY` ignora RLS. Solo se usa en `lib/supabase/admin.ts` y no se importa desde componentes cliente.
- Antes de escribir la ruta hay que leer en `node_modules/next/dist/docs/` la guía de Route Handlers y `headers()`, porque esta versión de Next difiere de lo conocido.

---

## Implementation plan

Rama: `spec-15-contacto-anti-abuso`. Cada paso deja la app funcionando.

1. **Línea base** (solo lectura).
   - Confirmar con `list_tables` que no existe `contact_attempts`.
   - Ejecutar `get_advisors` de seguridad y anotar el estado inicial (hoy solo `auth_leaked_password_protection`).
   - Verificar que el formulario de `/about` envía y recibe `{ ok: true }`.
2. **Migración `contact_attempts_rate_limit`.**
   - Crea la tabla, los índices, RLS sin políticas, la función y los `revoke`.
   - Comprobar con `execute_sql` que `anon` y `authenticated` no tienen `EXECUTE` ni acceso a la tabla.
   - Llamar a la función 4 veces con el mismo hash y comprobar `ok, ok, ok, ip_limit`. Limpiar las filas de prueba.
3. **Variables de entorno.**
   - Añadir `SUPABASE_SERVICE_ROLE_KEY` y `CONTACT_IP_SALT` a `.env.template` (sin valores) y a la sección Environment de `CLAUDE.md`.
   - El usuario copia la clave del dashboard a `.env.local` y genera la sal (por ejemplo con `openssl rand -hex 32`).
4. **`lib/supabase/admin.ts` y `lib/contact/rate-limit.ts`.**
   - Aún no se usan en la ruta, así que el comportamiento no cambia.
   - `npm run lint` sin errores.
5. **Límite en la ruta.**
   - Llamar a `checkContactRateLimit` después de la validación y antes de `resend.emails.send`.
   - `ip_limit` y `global_limit` devuelven `429` con `Retry-After`. Un error de Supabase devuelve `503`.
   - Comprobar con `curl` repetido: los 3 primeros envíos responden `200` y el 4.º `429`.
6. **Honeypot.**
   - Leer `website` del cuerpo en la ruta: si es una cadena no vacía, responder `{ ok: true }` sin límite ni envío.
   - Añadir el input oculto a `app/about/page.tsx` y mandarlo en el `fetch`. Antes de tocar la UI se carga `/frontend-design`, como pide `CLAUDE.md`. El aspecto no cambia.
7. **Verificación final.**
   - `npm run lint` y `npm run build` sin errores.
   - Recorrer los criterios de aceptación.
   - Ejecutar `get_advisors` de nuevo.
   - Actualizar `CLAUDE.md` (sección Auth o nueva sección Contacto) con el límite y las variables.

---

## Acceptance criteria

**Base de datos**

- [ ] `relrowsecurity` es `true` en `public.contact_attempts` y la tabla no tiene políticas.
- [ ] `anon` y `authenticated` no tienen `SELECT`, `INSERT` ni `EXECUTE` sobre `contact_attempts` ni sobre `contact_rate_limit_check`.
- [ ] Llamar a la función 4 veces seguidas con el mismo hash devuelve `ok`, `ok`, `ok`, `ip_limit`.
- [ ] Con 30 intentos de hashes distintos en 24 h, el siguiente devuelve `global_limit`.
- [ ] `get_advisors` de seguridad no añade avisos nuevos respecto a la línea base.

**Ruta `POST /api/contact`**

- [ ] Los 3 primeros envíos válidos desde la misma IP responden `200` con `{ ok: true }`.
- [ ] El 4.º envío en la misma hora responde `429` con `{ error }` en español y una cabecera `Retry-After` numérica.
- [ ] Un POST con `website` no vacío responde `200 { ok: true }`, no llama a Resend y no inserta ninguna fila en `contact_attempts`.
- [ ] Un POST con campos inválidos sigue respondiendo `400` y no consume el límite.
- [ ] Si la llamada a Supabase falla, la ruta responde `503` y no envía el correo.
- [ ] Las peticiones sin `x-forwarded-for` ni `x-real-ip` comparten el cubo `unknown` y también quedan limitadas.
- [ ] `contact_attempts.ip_hash` no contiene IPs en claro: ningún valor coincide con el formato de una IP.

**Formulario `/about`**

- [ ] El input `website` no es visible ni alcanzable con el teclado, y un lector de pantalla no lo anuncia.
- [ ] Un envío normal sigue mostrando el estado de éxito.
- [ ] Al recibir `429`, el formulario muestra el mensaje de `data.error` en su estado de error actual.

**Seguridad y cierre**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` y `CONTACT_IP_SALT` no aparecen en ningún archivo versionado ni en el bundle del cliente (`grep` sobre `.next/static`).
- [ ] `lib/supabase/admin.ts` no se importa desde ningún componente con `'use client'`.
- [ ] `.env.template` y `CLAUDE.md` documentan las dos variables nuevas.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions taken and discarded

**Decisiones tomadas**

- **Definición rápida sin aclaración detallada.** El usuario pidió guardar el spec tras el primer bloque de preguntas, sin responderlas. Se tomaron como valores por defecto las recomendaciones propuestas: dos specs separados, almacenamiento en Supabase, 3 por IP por hora y 30 globales por día, solo honeypot y remitente fuera de alcance. Hay que revisarlas antes de pasar a `Aprobado`.
- **Dos specs en lugar de uno.** El contacto toca código y base de datos, y la contraseña segura es sobre todo configuración del dashboard y UI de auth. Separarlos permite verificarlos y hacer commit por separado.
- **Supabase como almacén del contador.** No añade servicios ni cuentas, y encaja con el stack. Un `Map` en memoria no sirve en serverless, porque cada instancia tendría su propio contador.
- **Función SQL atómica con advisory lock** en vez de contar e insertar desde la ruta. Evita que dos peticiones simultáneas pasen el límite a la vez.
- **`service_role` solo para esta ruta.** Mantener la función cerrada a `anon` evita que cualquiera pueda llamar al RPC desde el navegador para llenar el contador y bloquear el formulario a otros.
- **Hash de la IP con sal**, en vez de guardar la IP. El límite no necesita la IP en claro, y así no se almacena un dato personal.
- **Tope global de 30 al día.** Si alguien rota IPs, el daño máximo en cuota de Resend queda acotado.
- **Falla cerrada (`503`).** El contacto no es crítico y la cuota sí lo es, así que si el límite no se puede comprobar, no se envía.
- **El honeypot responde `200` sin enviar.** Un `4xx` le diría al bot que lo detectaron.
- **Validar antes de limitar.** Las peticiones inválidas son baratas y no deben gastar el cupo de un usuario real.
- **Contar el intento antes de enviar.** Si Resend falla, el intento sigue contando, para que reintentar en bucle no evite el límite.

**Decisiones descartadas**

- **Upstash Redis:** es lo habitual para rate limit, pero añade cuenta, dependencia y variables de entorno para un solo endpoint.
- **`Map` en memoria:** no es fiable en serverless.
- **CAPTCHA (Turnstile o hCaptcha):** más fuerte, pero añade UI y dependencia externa. SPEC 14 ya lo dejó fuera para el registro. Se retoma si aparecen bots que superen el honeypot.
- **Función accesible para `anon` con la clave publicable:** evita la clave `service_role`, pero permite agotar el contador desde fuera. Se descarta por seguridad.
- **Exigir sesión para enviar:** descartado en SPEC 14, porque dejaría sin contacto a los invitados.
- **Fallar abierto si Supabase cae:** deja la cuota de Resend sin protección justo cuando el control no funciona.
- **Cambiar el remitente en este spec:** depende de un dominio verificado que no consta.

---

## Identified risks

| Riesgo                                                                                    | Efecto                                                                      | Mitigación                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`x-forwarded-for` falsificable** si la app no está detrás de un proxy que lo reescriba. | Un atacante cambia la cabecera en cada petición y evita el límite por IP.   | El tope global de 30 al día acota el daño. En Vercel la cabecera la fija la plataforma. Se confirma el despliegue antes de pasar a `Implementado`. |
| **`SUPABASE_SERVICE_ROLE_KEY` se filtra o se importa en código cliente.** Ignora RLS.     | Acceso total a la base de datos.                                            | Solo se usa en `lib/supabase/admin.ts`, sin prefijo `NEXT_PUBLIC_`, y hay criterios de aceptación que comprueban el bundle y las importaciones.    |
| **Un atacante agota el tope global.**                                                     | El formulario queda bloqueado para usuarios reales hasta el día siguiente.  | Se acepta: es el coste de proteger la cuota. Los límites están en `CONTACT_LIMITS` y se pueden ajustar sin migración.                              |
| **IPs compartidas** (colegio, evento, NAT de la operadora).                               | Varias personas legítimas comparten el límite de 3 por hora.                | Se acepta para un proyecto de este tamaño. El mensaje `429` indica que se puede reintentar más tarde.                                              |
| **Remitente `onboarding@resend.dev`** sigue siendo el de pruebas.                         | Solo entrega al correo dueño de la cuenta de Resend y puede acabar en spam. | Fuera de alcance de este spec. Hoy funciona porque `to` es el correo del dueño. Se retoma cuando haya dominio verificado.                          |
| **La tabla `contact_attempts` crece sin control.**                                        | Más almacenamiento y consultas más lentas.                                  | La función borra las filas de más de 2 días en cada llamada, y los índices cubren las dos consultas.                                               |
| **El advisory lock serializa las llamadas.**                                              | Si el formulario recibe mucho tráfico, las peticiones esperan en cola.      | El volumen esperado del contacto es mínimo y el lock dura milisegundos. El tope global limita el volumen real.                                     |
| **El honeypot lo ignoran bots sofisticados** y puede rellenarlo un gestor de contraseñas. | Falso negativo (spam que pasa) o falso positivo (usuario real descartado).  | `autoComplete="off"` y `tabIndex={-1}` reducen los falsos positivos. El límite por IP y el tope global cubren a los bots que lo eviten.            |

---

## What is **not** in this spec

- Cambio de contraseña con reautenticación ni "Secure password change" (SPEC 16).
- Cambio del remitente de Resend ni verificación de dominio.
- CAPTCHA, Redis o Upstash.
- Exigir sesión en `/api/contact`.
- Rate limit en otras rutas o en autenticación.
- Panel o alertas de intentos bloqueados.
- Cambios de diseño o de contenido en el formulario de contacto.

Cada una de esas cosas, si se hace, va en su propio spec.
