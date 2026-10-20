# Estado de seguridad

Memoria del agente `security-auditor`. Solo la edita ese agente. Última auditoría: **2026-10-20** (alcance `all`, rama `spec-14-seguridad-basica`, commit `892d0cf`).

## Línea base (SPEC 13 y 14)

**RLS esperado en `public`**

| Objeto       | Tipo  | RLS                           | Políticas / grants                                                                              |
| ------------ | ----- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `games`      | tabla | sí                            | `games_select_public` (SELECT). Grants: SELECT a `anon`/`authenticated`.                        |
| `scores`     | tabla | sí                            | `scores_select_public` (SELECT), `scores_insert_own_or_guest` (INSERT). Grants: SELECT, INSERT. |
| `game_stats` | vista | n/a (`security_invoker=true`) | Grants: SELECT. Detectada el 2026-10-20 (ver SEC-008): no está en ninguna spec ni migración.    |

Sin políticas UPDATE ni DELETE. `public.rls_auto_enable()` (`SECURITY DEFINER`, `search_path=pg_catalog`) con `EXECUTE` solo para `postgres` y `service_role`; el event trigger `ensure_rls` habilitado (`O`) sobre `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`.

`scores`: `user_id uuid` nullable, default `auth.uid()`, FK `auth.users(id) on delete set null`; checks `scores_name_check` (1–10) y `scores_score_check` (0–10 000 000); índice parcial `scores_user_id_idx`.

Extensiones fuera de `public` (`extensions`, `vault`, `pg_catalog`). Sin buckets de Storage.

**Migraciones conocidas (2026-10-20):** `games_and_scores`, `keep_only_asteroids`, `add_tetris_game`, `add_arkanoid_game`, `add_snake_game`, `scores_add_user_id`, `revoke_execute_rls_auto_enable`.

**Advisors de seguridad aceptados:** `auth_leaked_password_protection` (solo plan Pro).

**Headers (`next.config.ts`):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

**Rutas protegidas (`lib/supabase/proxy.ts`):** `/account` → `/auth`, `/auth/reset` → `/auth?error=reset_no_session`. Validación con `getClaims()`; la redirección copia las cookies.

**Contraseña:** mínimo 8 con minúscula, mayúscula, dígito y símbolo (`lib/auth/password.ts`); se aplica en registro, `/auth/reset` y `/account`; no en login.

## Ajustes manuales del dashboard

El agente no puede verlos. Solo se marcan como confirmados cuando el usuario lo dice.

| Ajuste                                               | Valor esperado                             | Confirmado | Fecha |
| ---------------------------------------------------- | ------------------------------------------ | ---------- | ----- |
| Email provider con «Confirm email»                   | activo                                     | no         | —     |
| Longitud mínima de contraseña                        | 8                                          | no         | —     |
| Requisitos de contraseña                             | minúsculas, mayúsculas, dígitos y símbolos | no         | —     |
| Límite de registros por IP (Auth → Rate Limits)      | 10 por hora                                | no         | —     |
| Redirect URLs (`/auth/callback`, local y producción) | registradas                                | no         | —     |
| Proveedores Google y GitHub                          | activos                                    | no         | —     |
| «Secure password change» (SPEC 13, paso 0)           | revisado (recomendado: activo)             | no         | —     |

## Hallazgos

| id      | severidad | área | ubicación                                                                                                                                                   | estado  | detectado  | cerrado |
| ------- | --------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | ------- |
| SEC-001 | Alta      | app  | `package.json:16` (`next` 16.2.6; `npm audit`: critical, incl. GHSA-6gpp-xcg3-4w24 bypass de Proxy; `sharp` high transitivo)                                | abierto | 2026-10-20 | —       |
| SEC-002 | Alta      | app  | `app/api/contact/route.ts:5-27` (sin límite de frecuencia ni anti-bot)                                                                                      | abierto | 2026-10-20 | —       |
| SEC-003 | Media     | app  | `app/api/contact/route.ts:7-9`, `:17-23` (sin validar tipo/longitud; HTML sin escapar en el correo)                                                         | abierto | 2026-10-20 | —       |
| SEC-004 | Baja      | app  | `app/api/contact/route.ts:6`, `:14-27`, `:28-30`; `app/about/page.tsx:173` (JSON inválido sin tratar, `error` de Resend ignorado, `err.message` al cliente) | abierto | 2026-10-20 | —       |
| SEC-005 | Baja      | app  | `package-lock.json` (`nanoid` ≤3.3.17 y `source-map-js` 1.0.0–1.2.1, high, transitivos de build)                                                            | abierto | 2026-10-20 | —       |
| SEC-006 | Baja      | app  | `.env.template:9` (clave publishable con aspecto real en vez de marcador)                                                                                   | abierto | 2026-10-20 | —       |
| SEC-007 | Baja      | app  | `next.config.ts:10-18` (sin `poweredByHeader: false` → `X-Powered-By: Next.js`)                                                                             | abierto | 2026-10-20 | —       |
| SEC-008 | Baja      | db   | vista `public.game_stats` y fila `games.frogger` sin migración ni documentación                                                                             | abierto | 2026-10-20 | —       |
| SEC-009 | Baja      | db   | `pg_default_acl` de `public`: `anon`/`authenticated` reciben `arwdDxtm` en tablas/vistas nuevas y `EXECUTE` en funciones nuevas                             | abierto | 2026-10-20 | —       |

## Riesgos aceptados

- Leaked password protection no disponible en Free.
- Sin antifraude de scores (un cliente puede enviar cualquier score de 0 a 10 000 000).
- `scores.user_id` legible públicamente.
- SMTP por defecto de Supabase (límite de envío bajo).
- Sin CSP, HSTS ni Permissions-Policy (spec propia pendiente).
- Sin CAPTCHA en el registro; solo el límite por IP del dashboard.
- Enumeración de cuentas en el registro con correo existente.
- `UserContext` usa `getSession()` en el cliente solo para mostrar identidad (SPEC 13).
- `/auth/reset` es accesible con cualquier sesión, no solo la de recuperación (SPEC 14: chequeo de navegación).

## Historial

| Fecha      | Alcance | Resumen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-20 | all     | Primera auditoría. BD conforme a SPEC 13/14 (RLS, 3 políticas, grants mínimos, `rls_auto_enable` revocada, `ensure_rls` activo, solo queda el advisor aceptado). Nuevos: 2 Altas (SEC-001 `next` 16.2.6 vulnerable; SEC-002 `/api/contact` sin freno), 1 Media (SEC-003), 6 Bajas (SEC-004 a SEC-009). Sin regresiones (no había hallazgos previos). `npm run build` OK; `npm run lint` falla con 8 errores no relacionados con seguridad. Headers verificados solo en código (no había servidor local). Ajustes del dashboard sin confirmar. |
