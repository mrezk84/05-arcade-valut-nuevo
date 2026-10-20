# Estado de seguridad

Memoria del agente `security-auditor`. Solo la edita ese agente. Última auditoría: _ninguna todavía_.

## Línea base (SPEC 13 y 14)

**RLS esperado en `public`**

| Tabla    | RLS | Políticas                                                              |
| -------- | --- | ---------------------------------------------------------------------- |
| `games`  | sí  | `games_select_public` (SELECT)                                         |
| `scores` | sí  | `scores_select_public` (SELECT), `scores_insert_own_or_guest` (INSERT) |

Sin políticas UPDATE ni DELETE. `public.rls_auto_enable()` sin `EXECUTE` para `anon`, `authenticated` y `PUBLIC`; el event trigger `ensure_rls` activo.

**Advisors de seguridad aceptados:** `auth_leaked_password_protection` (solo plan Pro).

**Headers (`next.config.ts`):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

**Rutas protegidas (`lib/supabase/proxy.ts`):** `/account` → `/auth`, `/auth/reset` → `/auth?error=reset_no_session`.

**Contraseña:** mínimo 8 con minúscula, mayúscula, dígito y símbolo (`lib/auth/password.ts`); no se aplica en login.

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

## Hallazgos

| id  | severidad | área | ubicación | estado | detectado | cerrado |
| --- | --------- | ---- | --------- | ------ | --------- | ------- |
|     |           |      |           |        |           |         |

## Riesgos aceptados

- Leaked password protection no disponible en Free.
- Sin antifraude de scores (un cliente puede enviar cualquier score de 0 a 10 000 000).
- `scores.user_id` legible públicamente.
- SMTP por defecto de Supabase (límite de envío bajo).
- Sin CSP, HSTS ni Permissions-Policy (spec propia pendiente).
- Sin CAPTCHA en el registro; solo el límite por IP del dashboard.
- Enumeración de cuentas en el registro con correo existente.

## Historial

| Fecha | Alcance | Resumen |
| ----- | ------- | ------- |
|       |         |         |
