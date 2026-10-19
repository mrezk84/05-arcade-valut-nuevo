# SPEC 13 — Autenticación real con Supabase Auth

> **Estado:** Implementado · **Depende de:** SPEC 04 (integración de Supabase), SPEC 06 (tabla `scores`) · **Fecha:** 2026-10-19
> **Objetivo:** Sustituir la sesión local de `/auth` (`av_user` en `localStorage`) por autenticación real con Supabase Auth: registro e inicio de sesión con correo y contraseña (con verificación de correo y recuperación de contraseña) y acceso con Google y GitHub, con avatar de perfil y una pantalla para editar la cuenta, manteniendo el modo invitado y vinculando cada score a la cuenta con `scores.user_id`.

---

## Scope

**In:**

- **Registro con correo y contraseña** en la pestaña "CREAR CUENTA" de `/auth`:
  - Campos: usuario, correo y contraseña. El usuario se normaliza a mayúsculas, de 1 a 10 caracteres, y se guarda en `user_metadata.username`. No es único.
  - **Avatar opcional:** una fila de 8 avatares prediseñados en pixel-art para elegir uno. Se guarda su id en `user_metadata.avatar`. Si no se elige ninguno, se muestra la inicial del nombre.
  - Supabase envía el correo de verificación con su SMTP por defecto.
  - Tras registrarse, la pantalla muestra "Revisa tu correo" y **no inicia sesión** hasta que se abre el enlace.
- **Verificación de correo obligatoria:** sin correo confirmado no hay sesión. Si alguien intenta entrar sin verificar, ve un aviso con la opción de reenviar el correo.
- **Inicio de sesión con correo y contraseña** en la pestaña "INICIAR SESIÓN". El campo "usuario" se sustituye por "correo", porque Supabase autentica con el correo.
- **Recuperación de contraseña:**
  - Enlace "¿Olvidaste tu contraseña?" en la pestaña de inicio de sesión.
  - Pide el correo y envía el enlace de recuperación.
  - Pantalla `/auth/reset` para fijar la contraseña nueva.
- **Acceso con Google y GitHub (OAuth):** los botones que hoy no hacen nada pasan a funcionar. El nombre de usuario sale de `user_metadata.name` o `user_metadata.user_name`, en mayúsculas y recortado a 10 caracteres.
- **Ruta `/auth/callback`** que intercambia el código de los enlaces (verificación, recuperación y OAuth) por la sesión y redirige a la pantalla que corresponda.
- **Sesión por cookies con `@supabase/ssr`:** `proxy.ts` (en Next 16 sustituye a `middleware.ts`) refresca la sesión en cada petición.
- **`UserContext` sobre la sesión de Supabase:**
  - `useUser()` conserva `user: string | null` (el nombre de usuario) y `signOut`, para no tocar `GamePlayShell` ni la play-page genérica. `login` se elimina (ver Data model).
  - La sesión se lee y se escucha con `onAuthStateChange`.
  - Se elimina `av_user` de `localStorage`.
- **`Nav` con sesión:** muestra el avatar y el nombre de usuario, y un botón "Cerrar sesión" donde antes estaba "Iniciar Sesión".
  - Escritorio: avatar, nombre y botón en la barra.
  - Hasta 1000 px de ancho la barra pasa al menú hamburguesa y deja solo el avatar y el nombre. Hasta 840 px deja solo el avatar, y el nombre, el correo y "Cerrar sesión" van en el panel lateral.
  - Sin sesión no cambia, salvo que hasta 480 px el botón «Iniciar Sesión» se oculta de la barra (ya está en el panel lateral), porque con el hamburguesa no cabía y provocaba scroll horizontal.
- **`/auth` con sesión iniciada:** en lugar del formulario muestra "Ya iniciaste sesión" con "IR AL VAULT" y "CERRAR SESIÓN". Con `?error=` en la URL sigue mostrando el formulario y su error.
- **Pantalla `/account` («Mi cuenta»)** con la sesión iniciada. Sin sesión redirige a `/auth`.
  - Muestra el avatar, el nombre y el correo. **El correo no se edita.**
  - **Nombre de usuario:** se cambia con `updateUser({ data: { username } })`, con las mismas reglas del registro (1 a 10 caracteres, en mayúsculas). Pasa a tener prioridad sobre el nombre del proveedor en cuentas de Google o GitHub.
  - **Avatar:** se cambia entre los 8 prediseñados (o se quita) con `updateUser({ data: { avatar } })`. Si la cuenta tiene foto de Google o GitHub, esa foto tiene prioridad y el selector no se muestra.
  - **Contraseña:** se cambia con `updateUser({ password })` (mínimo 8 caracteres y confirmación coincidente). Si Supabase pide volver a autenticarse (`reauthentication_needed`), se muestra un aviso en español.
  - La Nav y el nombre del game-over reflejan los cambios sin recargar, porque `onAuthStateChange` emite `USER_UPDATED`.
- **Acceso a `/account`:** el avatar y el nombre de la Nav y el panel móvil enlazan a `/account`, y `/auth` con sesión ofrece «MI CUENTA».
- **Avatar visible:** el de la cuenta de Google o GitHub (`picture`, `avatar_url`) si existe, y si no el prediseñado elegido al registrarse (`user_metadata.avatar`). Si no hay ninguno, la inicial del nombre.
- **Estados reales en `/auth`**, sin rediseñar el aspecto: carga (botón deshabilitado), errores traducidos al español (credenciales inválidas, correo ya registrado, contraseña débil, correo sin verificar), validaciones de campos y mensajes de éxito.
- **Modo invitado:** "JUGAR COMO INVITADO" se conserva. Todas las rutas siguen siendo públicas.
- **Configuración manual previa (la hace el usuario en el dashboard de Supabase):** activar los proveedores Google y GitHub con sus credenciales, activar la confirmación de correo y registrar las URL de redirección (`/auth/callback`).
- **Vincular los scores a la cuenta:**
  - Columna `scores.user_id` (`uuid`, nullable, FK a `auth.users(id)` con `on delete set null`) con valor por defecto `auth.uid()`. El cliente no envía `user_id`: lo rellena la base de datos a partir de la sesión, y queda en `null` para los invitados. `GamePlayShell.tsx` no cambia.
  - Política RLS de INSERT nueva que sustituye a `scores_insert_public`: con sesión solo se puede insertar con el propio `user_id`, y un invitado solo con `user_id` nulo. Nadie puede insertar un score a nombre de otra cuenta.
  - Índice parcial sobre `user_id` y migración `scores_add_user_id`.
  - `ScoreRow` gana `user_id: string | null`.
- Variables de entorno: se reutilizan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No hay variables nuevas.

**Fuera de alcance (para specs futuros):**

- **Backfill de los scores existentes** (hoy 27): quedan con `user_id` nulo. No hay forma fiable de saber de quién son.
- **Vistas «Mis puntuaciones», perfil o ranking por cuenta:** ninguna pantalla lee `user_id`.
- **Cambiar el nombre del score:** `name` sigue siendo un alias editable en el game-over, también con sesión.
- **Ocultar `user_id` en las lecturas públicas:** `scores_select_public` no cambia y las pantallas siguen usando `select('*')`.
- **Antifraude o validación del score en el servidor.**
- Tabla `profiles`, nombres de usuario únicos y perfiles públicos.
- **Pantalla intermedia para elegir el nombre** tras el primer acceso con OAuth.
- **SMTP propio con Resend** para los correos de Auth. Mientras tanto, el SMTP por defecto de Supabase limita el envío a pocos correos por hora.
- Rutas protegidas en el servidor: ninguna ruta exige sesión. `/account` y `/auth/reset` redirigen a `/auth` desde el cliente cuando no hay sesión, pero eso es comodidad y no una barrera de seguridad.
- Rediseño visual de `/auth`.
- Otros proveedores o métodos (magic link, Apple, teléfono) y MFA.
- Cambio de correo y eliminación de cuenta.
- **Subir fotos propias** (Supabase Storage con bucket y políticas RLS): el avatar se elige entre los prediseñados.
- Cambios en `GamePlayShell.tsx`, en los juegos, en `TouchControls.tsx`, en la tabla `games` y en los checks de `name` y `score` de `scores`.
- Tests automáticos: el proyecto no tiene test runner.

---

## Data model

**No hay tablas nuevas.** Supabase Auth gestiona `auth.users` y `auth.identities`. Hay una sola migración, que añade `user_id` a `scores` (ver «Vínculo de `scores` con la cuenta»). `games` no cambia, y `localStorage` pierde la clave `av_user`.

### Datos del usuario — `auth.users.raw_user_meta_data`

| Campo                | Origen                                 | Descripción                                                                              |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `username`           | Registro con correo (`options.data`)   | Texto en mayúsculas, de 1 a 10 caracteres. No es único. Es el nombre que muestra la app. |
| `avatar`             | Registro con correo (`options.data`)   | Id de un avatar prediseñado (ver «Avatares prediseñados»). Opcional. Es solo cosmético.  |
| `name` / `user_name` | Google (`name`) y GitHub (`user_name`) | Lo rellena el proveedor. Se usa solo como origen del nombre visible.                     |

**Nombre visible** = `normalizeUsername(user_metadata.username ?? user_metadata.user_name ?? user_metadata.name ?? email.split('@')[0])`, donde `normalizeUsername` pasa a mayúsculas, quita espacios de los extremos y recorta a 10 caracteres. Si el resultado queda vacío, se usa `JUGADOR`. Se calcula al leer la sesión: no se persiste en ningún otro sitio.

**Avatar visible** = `user_metadata.avatar_url` o `user_metadata.picture` (si es una URL `https://`) `?? /avatars/<avatar>.svg` (solo si `avatar` es un id de la lista) `?? null`. Con `null`, la Nav y `/auth` muestran la inicial del nombre. El id se valida siempre contra la lista fija, porque `user_metadata` lo puede editar el propio usuario.

### Avatares prediseñados — `lib/auth/avatars.ts`

Lista fija de 8 ids, con su imagen SVG en `public/avatars/<id>.svg`:

| Id          | Imagen                 |
| ----------- | ---------------------- |
| `ship`      | Nave espacial          |
| `alien`     | Invasor alienígena     |
| `ghost`     | Fantasma               |
| `joystick`  | Palanca de mando       |
| `coin`      | Moneda                 |
| `cartridge` | Cartucho de videojuego |
| `star`      | Estrella               |
| `heart`     | Corazón                |

`lib/auth/avatars.ts` exporta `AVATARS` (los ids), `isAvatarId(value)` y `avatarSrc(id)`. Los SVG son pixel-art con la paleta del proyecto (`--cyan`, `--magenta`, `--yellow`, `--green`) y se ven bien sobre el fondo oscuro de la Nav.

### Contrato de `UserContext` — `app/context/UserContext.tsx`

| Elemento      | Antes            | Después                                                                              |
| ------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `user`        | `string \| null` | `string \| null`: el nombre visible de la sesión de Supabase, o `null` si no hay.    |
| `loading`     | no existía       | `boolean`. Es `true` hasta que se resuelve la sesión inicial, para evitar parpadeos. |
| `email`       | no existía       | `string \| null`. El correo de la sesión, para mostrarlo en la Nav.                  |
| `avatar`      | no existía       | `string \| null`. La URL del avatar visible (ver «Avatar visible»), o `null`.        |
| `signOut()`   | borra `av_user`  | `() => Promise<void>`. Llama a `supabase.auth.signOut()`.                            |
| `login(name)` | guarda `av_user` | **Se elimina.** Solo lo usaba `/auth`, que ahora llama a Supabase directamente.      |

- La sesión inicial se lee con `getSession()` y los cambios se escuchan con `onAuthStateChange`. Esa suscripción se cancela al desmontar el proveedor.
- Las decisiones de seguridad no confían en esta lectura del cliente. En esta spec no hay rutas protegidas, así que solo se usa para mostrar la identidad.
- `GamePlayShell.tsx` y `app/games/[id]/play/page.tsx` solo leen `user`, así que no cambian.

### Rutas

| Ruta             | Tipo                  | Función                                                                                                           |
| ---------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/auth`          | Página (existente)    | Pestañas de inicio de sesión y registro, estado "Revisa tu correo", "Olvidé mi contraseña" y botones OAuth.       |
| `/auth/callback` | Route Handler (nuevo) | Recibe `?code=` y `?next=`, llama a `exchangeCodeForSession` y redirige. Si falla, vuelve a `/auth` con un error. |
| `/auth/reset`    | Página (nueva)        | Formulario de contraseña nueva (`updateUser`). Solo es útil con la sesión de recuperación activa.                 |
| `/account`       | Página (nueva)        | «Mi cuenta»: nombre, avatar y contraseña con la sesión iniciada. Sin sesión redirige a `/auth`.                   |

- `next` solo admite rutas internas que empiecen por `/` (y no por `//`). Cualquier otro valor se ignora y se redirige a `/`, para evitar redirecciones abiertas.
- Redirecciones tras el callback: verificación de correo y OAuth van a `/`; recuperación va a `/auth/reset`.

### Vínculo de `scores` con la cuenta — `public.scores`

| Columna   | Tipo                         | Nulo | Notas                                                                       |
| --------- | ---------------------------- | ---- | --------------------------------------------------------------------------- |
| `user_id` | `uuid`, default `auth.uid()` | sí   | **Nueva.** FK a `auth.users(id)` con `on delete set null`. Nulo = invitado. |

El resto de columnas y sus checks (`name` de 1 a 10 caracteres, `score` de 0 a 10 000 000) no cambian.

```sql
alter table public.scores
  add column user_id uuid default auth.uid()
  references auth.users (id) on delete set null;

create index scores_user_id_idx on public.scores (user_id)
  where user_id is not null;

drop policy scores_insert_public on public.scores;

create policy scores_insert_own_or_guest on public.scores
  for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
```

- `auth.uid()` es `STABLE`, no volátil: Postgres evalúa el default una sola vez al ejecutar el `alter table`. Como la migración no lleva sesión, las 27 filas existentes quedan en `null`, sin reescribir la tabla.
- `scores_select_public` no cambia. No hay política de UPDATE ni de DELETE, así que ningún cliente puede modificar o borrar scores.

| Quién inserta                        | `user_id` enviado | Resultado                                         |
| ------------------------------------ | ----------------- | ------------------------------------------------- |
| Invitado (`anon`)                    | no envía          | Se guarda con `user_id` nulo.                     |
| Invitado (`anon`)                    | un UUID           | Rechazado por RLS.                                |
| Usuario con sesión (`authenticated`) | no envía          | Se guarda con su `auth.uid()`.                    |
| Usuario con sesión                   | su propio UUID    | Se guarda.                                        |
| Usuario con sesión                   | el UUID de otro   | Rechazado por RLS.                                |
| Usuario con sesión                   | `null` explícito  | Rechazado por RLS: con sesión siempre se vincula. |

```ts
// lib/supabase/types.ts
export interface ScoreRow {
  id: string;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
  user_id: string | null;
}
```

### Archivos que cambian

| Archivo                               | Cambio                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `proxy.ts` (nuevo)                    | Refresca la sesión por cookies en cada petición con `@supabase/ssr`. Excluye los estáticos.                               |
| `lib/supabase/proxy.ts` (nuevo)       | Función `updateSession(request)` que usa `proxy.ts`.                                                                      |
| `lib/auth/username.ts` (nuevo)        | `normalizeUsername`, `getDisplayName(user)` y `getAvatarUrl(user)`.                                                       |
| `lib/auth/avatars.ts` (nuevo)         | Lista de ids de avatares, `isAvatarId` y `avatarSrc`.                                                                     |
| `public/avatars/<id>.svg` (nuevo)     | Los 8 avatares prediseñados.                                                                                              |
| `lib/auth/errors.ts` (nuevo)          | Traduce los códigos de error de Supabase Auth a mensajes en español (incluido `reauthentication_needed`).                 |
| `app/context/UserContext.tsx`         | Pasa a la sesión de Supabase y expone `email` y `avatar` (contrato de arriba).                                            |
| `app/auth/page.tsx`                   | Formularios reales, selector de avatar, estados de carga, error y éxito, OAuth y estado «ya iniciaste sesión».            |
| `app/auth/callback/route.ts` (nuevo)  | Intercambio de código por sesión.                                                                                         |
| `app/auth/reset/page.tsx` (nuevo)     | Pantalla de contraseña nueva.                                                                                             |
| `app/account/page.tsx` (nuevo)        | «Mi cuenta»: nombre, avatar y contraseña. Reutiliza el selector de avatar de `/auth`.                                     |
| `components/Nav.tsx`                  | Usa `user`, `email`, `avatar`, `loading` y `signOut()` async: avatar, nombre y "Cerrar sesión" con sesión, y panel móvil. |
| `lib/supabase/types.ts`               | `ScoreRow` gana `user_id: string \| null`.                                                                                |
| Migración `scores_add_user_id`        | Columna `user_id`, índice parcial y política de INSERT nueva (se aplica con `apply_migration`).                           |
| `CLAUDE.md`                           | Sección Auth, descripción de `UserContext` y columnas y política de `scores`.                                             |
| `lib/supabase/client.ts`, `server.ts` | **Sin cambios.**                                                                                                          |
| `GamePlayShell.tsx`, juegos           | **Sin cambios.**                                                                                                          |

### Reglas de validación (cliente)

| Campo      | Regla                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usuario    | Solo en el registro. 1–10 caracteres tras recortar. Se envía en mayúsculas.                                                                       |
| Correo     | Formato válido (`type="email"`), obligatorio.                                                                                                     |
| Contraseña | Mínimo 8 caracteres. Supabase aplica además su propia política, y su error se traduce.                                                            |
| Avatar     | Opcional. Si se elige, debe ser uno de los 8 ids de `AVATARS`. Si no, no se envía.                                                                |
| Cuenta     | En `/account`: el nombre sigue la regla de Usuario, el avatar la de Avatar, y la contraseña nueva exige 8 caracteres y una confirmación idéntica. |

---

## Plan de implementación

> Cada paso deja la app funcionando y se puede revisar y commitear por separado. Antes de escribir código de Next.js se lee la guía correspondiente en `node_modules/next/dist/docs/` (en especial `proxy.md`), y antes de tocar Auth se carga la skill `/supabase`. La UI se diseña con `/frontend-design`.

0. **Configuración manual en el dashboard de Supabase (la hace el usuario, sin código).**
   - Auth → Providers: activar **Email** con "Confirm email" y activar **Google** y **GitHub** con las credenciales de sus apps OAuth.
   - Auth → URL Configuration: fijar `Site URL` y añadir como Redirect URLs `http://localhost:3000/auth/callback` y la de producción.
   - Auth → Email Templates: comprobar que los enlaces de verificación y recuperación usan `{{ .ConfirmationURL }}`.
   - Auth → Sign In / Providers → Email: comprobar el ajuste «Secure password change». Si está activo, cambiar la contraseña en `/account` exige haber iniciado sesión hace poco, y la pantalla lo explica con el aviso de reautenticación.
   - _Verificación:_ el usuario confirma que los tres proveedores aparecen activos y que las URL están registradas. Los pasos 4 a 6 dependen de esto.

1. **Sesión por cookies.**
   - Crear `lib/supabase/proxy.ts` con `updateSession(request)` y `proxy.ts` en la raíz, siguiendo la guía de `proxy.md` de Next 16. El matcher excluye `_next/static`, `_next/image`, el favicon y los archivos de `public/`.
   - Usa `getClaims()` o `getUser()` para refrescar la sesión, nunca `getSession()` en el servidor.
   - _Verificación:_ `npm run build` y `npm run lint` pasan. Sin sesión, la app se comporta igual que antes y no hay errores en consola.

2. **Utilidades de Auth.**
   - Crear `lib/auth/username.ts` (`normalizeUsername`, `getDisplayName`) y `lib/auth/errors.ts` (traducción de errores de Supabase al español, con un mensaje genérico para códigos desconocidos).
   - _Verificación:_ `npm run build` y `npm run lint` pasan. Sin consumidores todavía, así que no hay cambios visibles.

3. **`UserContext` sobre Supabase.**
   - Reescribir `app/context/UserContext.tsx` con el contrato del Data model: `getSession()` inicial, `onAuthStateChange` con cancelación al desmontar, `loading` y `signOut()` async. Se elimina `login` y la lectura de `av_user`.
   - Adaptar `/auth` solo lo mínimo para que compile (el formulario deja de llamar a `login`). Ajustar `Nav.tsx` al `signOut()` async y a `loading`.
   - _Verificación:_ la app compila, sin sesión se ve "Iniciar Sesión" y `GamePlayShell` sigue guardando scores como `INVITADO`.

4. **Registro, verificación e inicio de sesión con correo y contraseña.**
   - En `app/auth/page.tsx`: `signUp` con `options.data.username` y `emailRedirectTo` apuntando a `/auth/callback`, y `signInWithPassword` para entrar. Pestaña de inicio de sesión con correo (en lugar de usuario).
   - Estados: botón deshabilitado mientras carga, errores traducidos, validaciones de la tabla del Data model, pantalla "Revisa tu correo" tras registrarse (con "Reenviar correo" mediante `auth.resend`) y aviso de correo sin verificar al intentar entrar.
   - Crear `app/auth/callback/route.ts`: `exchangeCodeForSession`, validación de `next` como ruta interna, redirección a `/`, y vuelta a `/auth` con un error si falla.
   - _Verificación:_ registrar un correo de prueba, abrir el enlace del correo, quedar con sesión iniciada y ver el nombre en la Nav. Entrar sin verificar muestra el aviso. Con una contraseña incorrecta, el mensaje es "Correo o contraseña incorrectos".

5. **Recuperación de contraseña.**
   - Enlace "¿Olvidaste tu contraseña?" en la pestaña de inicio de sesión: pide el correo y llama a `resetPasswordForEmail` con `redirectTo` a `/auth/callback?next=/auth/reset`. El mensaje de confirmación es el mismo exista o no el correo, para no revelar qué cuentas existen.
   - Crear `app/auth/reset/page.tsx`: contraseña nueva y confirmación, `updateUser({ password })`, y redirección a `/` con la sesión iniciada. Si se entra sin sesión de recuperación, redirige a `/auth` con un aviso.
   - _Verificación:_ pedir el enlace, abrirlo, fijar una contraseña nueva, entrar con ella, y comprobar que la contraseña anterior ya no sirve.

6. **Acceso con Google y GitHub.**
   - Conectar los dos botones a `signInWithOAuth` con `redirectTo` a `/auth/callback`. Estado de carga y manejo del error si el usuario cancela o el proveedor falla.
   - _Verificación:_ entrar con cada proveedor, volver a `/` con sesión y ver el nombre visible en mayúsculas y recortado a 10 caracteres.

7. **Avatar, Nav con sesión y estado en `/auth`.**
   - Crear `lib/auth/avatars.ts` y los 8 SVG de `public/avatars/`. Añadir `getAvatarUrl` a `lib/auth/username.ts` y exponer `email` y `avatar` en `UserContext`.
   - En la pestaña «CREAR CUENTA» de `app/auth/page.tsx`, selector de avatar (componente `components/AvatarPicker.tsx`, un grupo de botones con `aria-pressed`, opcional) y envío de `options.data.avatar` en `signUp`.
   - `Nav.tsx`: avatar, nombre y botón «Cerrar sesión» con sesión, con el comportamiento responsive del Scope. `/auth` con sesión muestra «Ya iniciaste sesión».
   - _Verificación:_ registrar un correo de prueba con un avatar, verificar el correo y ver ese avatar en la Nav. Sin avatar se ve la inicial. Con Google o GitHub se ve la foto del proveedor. La Nav se ve bien a 1280, 1000, 860 y 390 px sin scroll horizontal, y «Cerrar sesión» funciona en escritorio y en el panel móvil.

8. **Mi cuenta (`/account`).**
   - Crear `app/account/page.tsx`: sin sesión redirige a `/auth`. Formularios de perfil (nombre y avatar, con el selector de `/auth` extraído a un componente compartido) y de contraseña, con estados de carga, errores traducidos y mensajes de éxito, igual que `/auth/reset`.
   - Añadir `reauthentication_needed` a `lib/auth/errors.ts` y enlazar el avatar y el nombre de la Nav, el panel móvil y el estado «Ya iniciaste sesión» de `/auth` a `/account`.
   - _Verificación:_ cambiar el nombre y el avatar y verlos en la Nav sin recargar y en el nombre del game-over. Cambiar la contraseña, cerrar sesión y entrar con la nueva, y comprobar que la anterior ya no sirve. Abrir `/account` sin sesión redirige a `/auth`.

9. **Vincular los scores a la cuenta (`scores.user_id`).**
   - Cargar `/supabase` y `/supabase-postgres-best-practices`. Aplicar con `apply_migration` la migración `scores_add_user_id` (SQL del Data model) y añadir `user_id: string | null` a `ScoreRow`.
   - Probar la RLS desde SQL, en una transacción que se revierte (`begin … rollback`), simulando los roles con `set local role` y `set_config('request.jwt.claims', …)`, para los seis casos de la tabla de comportamiento.
   - _Verificación:_ `list_tables` muestra `user_id` y `pg_policies` solo `scores_select_public` y `scores_insert_own_or_guest`. Las 27 filas existentes tienen `user_id` nulo. Los seis casos dan el resultado de la tabla y no queda ninguna fila de prueba. `get_advisors` no reporta avisos nuevos sobre `scores`. Sin sesión y con sesión, guardar un score desde el game-over funciona y deja `user_id` nulo o el id de la cuenta, respectivamente.

10. **Cierre de sesión, invitado y limpieza.**

- Comprobar el cierre de sesión desde la Nav y que "JUGAR COMO INVITADO" funciona con la sesión real: `signOut` y redirección a `/`.
- Limpiar los restos de `av_user` en el código y actualizar `CLAUDE.md` (sección Auth, descripción de `UserContext` y columnas y política de `scores`).
- _Verificación:_ `npm run lint`, `npm run format:check` y `npm run build` pasan, y se repite el recorrido completo de los criterios de aceptación.

---

## Criterios de aceptación

> Se verifican a mano en `npm run dev` con el proyecto de Supabase configurado (paso 0). Los correos de prueba deben ser buzones reales a los que se tenga acceso.

**Registro y verificación de correo**

- [ ] Registrarse con usuario, correo y contraseña válidos muestra la pantalla "Revisa tu correo" y **no** inicia sesión.
- [ ] Llega un correo de verificación al buzón. Al abrir su enlace, la app queda con sesión iniciada en `/` y la Nav muestra el nombre de usuario en mayúsculas.
- [ ] `user_metadata.username` del usuario nuevo en Supabase contiene el nombre en mayúsculas y recortado a 10 caracteres (se comprueba con `execute_sql` sobre `auth.users`).
- [ ] Intentar entrar con un correo sin verificar muestra un aviso en español y ofrece "Reenviar correo"; el reenvío llega al buzón.
- [ ] Registrar un correo que ya existe muestra un error en español y no crea un usuario duplicado.
- [ ] Una contraseña de menos de 8 caracteres, un correo con formato inválido o un usuario vacío o de más de 10 caracteres se rechazan en el cliente, con un mensaje junto al campo, sin llamar a Supabase.

**Inicio y cierre de sesión**

- [ ] Con un correo verificado, "ENTRAR AL VAULT" inicia sesión y redirige a `/` con el nombre en la Nav.
- [ ] Con una contraseña incorrecta se muestra "Correo o contraseña incorrectos" y no se inicia sesión.
- [ ] Durante cualquier petición de Auth el botón queda deshabilitado, para impedir envíos dobles.
- [ ] La sesión sobrevive a recargar la página y a cerrar y reabrir el navegador (cookies de `@supabase/ssr`).
- [ ] Cerrar sesión desde la Nav deja la Nav con "Iniciar Sesión", y `useUser().user` es `null`.
- [ ] Iniciar o cerrar sesión en una pestaña se refleja en otra pestaña abierta, sin recargar.

**Recuperación de contraseña**

- [ ] "¿Olvidaste tu contraseña?" pide el correo, y el mensaje de confirmación es idéntico para un correo registrado y para uno que no lo está.
- [ ] El correo de recuperación llega, y su enlace lleva a `/auth/reset` con la sesión de recuperación activa.
- [ ] Fijar una contraseña nueva (mínimo 8 caracteres, con confirmación coincidente) permite entrar con ella, y la contraseña anterior deja de funcionar.
- [ ] Abrir `/auth/reset` sin venir de un enlace de recuperación redirige a `/auth` con un aviso.

**Google y GitHub**

- [ ] "◆ GOOGLE" y "▣ GITHUB" inician el flujo OAuth del proveedor y, al volver, dejan la sesión iniciada en `/`.
- [ ] El nombre visible de una cuenta OAuth sale de `name` (Google) o `user_name` (GitHub), en mayúsculas y recortado a 10 caracteres.
- [ ] Cancelar el flujo en el proveedor o un fallo del proveedor vuelve a `/auth` con un error en español, sin dejar la pantalla bloqueada en estado de carga.

**Callback y seguridad**

- [ ] `/auth/callback` sin `code`, o con un código inválido o caducado, redirige a `/auth` con un error y no deja sesión.
- [ ] `/auth/callback?code=…&next=https://otro-sitio.com` redirige a `/` y no al sitio externo.
- [ ] `proxy.ts` refresca la sesión sin errores en consola, y no se ejecuta sobre `_next/static`, `_next/image`, el favicon ni los archivos de `public/`.
- [ ] No hay claves secretas en el código ni en `.env.template`. Solo se usa la clave publishable.

**Invitado y compatibilidad**

- [ ] "JUGAR COMO INVITADO" funciona con la sesión real: cierra una sesión activa si la hay y redirige a `/`.
- [ ] Todas las rutas siguen siendo accesibles sin sesión, incluidas `/games/<id>/play` y `/hall-of-fame`.
- [ ] Jugar con sesión iniciada rellena el nombre del game-over con el nombre de usuario (`GamePlayShell` lee `user`), y sin sesión, con `INVITADO`. Guardar el score sigue funcionando en ambos casos.
- [ ] `GamePlayShell.tsx` y los juegos no aparecen en el diff.
- [ ] `localStorage` no contiene `av_user` tras iniciar sesión, y el código no hace referencia a `av_user`.

**Mi cuenta**

- [ ] `/account` sin sesión redirige a `/auth`, y con sesión muestra avatar, nombre y correo. El correo no es editable.
- [ ] Cambiar el nombre (1 a 10 caracteres) lo guarda en mayúsculas en `user_metadata.username`, y la Nav y el nombre del game-over lo reflejan sin recargar.
- [ ] Un nombre vacío o de más de 10 caracteres se rechaza en el cliente, con un mensaje junto al campo, sin llamar a Supabase.
- [ ] Cambiar el avatar a otro de los 8, o quitarlo, se refleja en la Nav sin recargar. En una cuenta con foto de Google o GitHub no se muestra el selector.
- [ ] Cambiar la contraseña (mínimo 8 caracteres, confirmación idéntica) permite entrar con la nueva y la anterior deja de funcionar.
- [ ] Si Supabase exige reautenticar, se muestra un aviso en español y no se queda el botón bloqueado.
- [ ] Durante cualquier petición los botones quedan deshabilitados, y los errores se anuncian con `role="alert"`.
- [ ] El avatar y el nombre de la Nav y el panel móvil enlazan a `/account`, y `/auth` con sesión ofrece «MI CUENTA».

**Avatar y Nav con sesión**

- [ ] La pestaña «CREAR CUENTA» muestra 8 avatares para elegir uno, el elegido queda marcado, y no elegir ninguno no impide registrarse.
- [ ] `user_metadata.avatar` del usuario nuevo contiene el id elegido, o no existe si no eligió (se comprueba con `execute_sql` sobre `auth.users`).
- [ ] Tras verificar el correo, la Nav muestra el avatar elegido. Sin avatar muestra la inicial del nombre.
- [ ] Con Google o GitHub, la Nav muestra la foto del proveedor, y si la imagen no carga vuelve a la inicial.
- [ ] Un `user_metadata.avatar` que no es uno de los 8 ids (por ejemplo `../x`) se ignora y se muestra la inicial.
- [ ] Con sesión, la Nav muestra avatar, nombre y un botón «Cerrar sesión». Pulsar el nombre no cierra la sesión, y el botón la cierra y lleva a `/`.
- [ ] La Nav no produce scroll horizontal a 1280, 1000, 860 y 390 px. Hasta 1000 px usa el menú hamburguesa, y hasta 840 px el panel lateral muestra avatar, nombre, correo y «Cerrar sesión».
- [ ] `/auth` con sesión muestra «Ya iniciaste sesión» con «IR AL VAULT» y «CERRAR SESIÓN», y con `?error=` en la URL sigue mostrando el formulario.

**Scores vinculados a la cuenta**

- [ ] `public.scores` tiene `user_id uuid` nullable, con FK a `auth.users(id)` y `on delete set null`, y existe el índice parcial `scores_user_id_idx`.
- [ ] `pg_policies` para `scores` muestra solo `scores_select_public` (SELECT) y `scores_insert_own_or_guest` (INSERT). `scores_insert_public` ya no existe.
- [ ] Los 27 scores previos conservan sus datos y tienen `user_id` nulo.
- [ ] Como `anon`, insertar sin `user_id` funciona y lo deja nulo, e insertar con cualquier `user_id` es rechazado por RLS.
- [ ] Como `authenticated`, insertar sin `user_id` deja `user_id = auth.uid()`. Insertar con el de otra cuenta o con `null` explícito es rechazado por RLS.
- [ ] Un cliente sigue sin poder hacer UPDATE ni DELETE sobre `scores`.
- [ ] Borrar un usuario de `auth.users` deja sus scores en la tabla con `user_id` nulo (se comprueba con un usuario de prueba creado y borrado para el caso).
- [ ] Sin sesión, guardar un score desde el game-over funciona, redirige al leaderboard y la fila tiene `user_id` nulo.
- [ ] Con sesión, guardar un score funciona y la fila tiene el id del usuario en `user_id`. El nombre del game-over sigue siendo editable y se guarda en `name` tal cual.
- [ ] El leaderboard y el Salón de la Fama muestran los scores igual que antes, con y sin sesión.
- [ ] `get_advisors` no reporta avisos nuevos sobre `scores`, y `ScoreRow` incluye `user_id`.

**Aspecto y accesibilidad**

- [ ] `/auth` conserva el aspecto actual (tarjeta, pestañas, botones) en escritorio y en móvil, y solo se añaden los estados nuevos (errores, carga, éxito, "Revisa tu correo", «Ya iniciaste sesión») y el selector de avatar.
- [ ] Los errores se anuncian con `role="alert"` y cada campo tiene su `<label>` asociado.

**Calidad**

- [ ] `npm run lint`, `npm run format:check` y `npm run build` pasan sin errores nuevos.
- [ ] `CLAUDE.md` describe la autenticación real, ya no menciona la sesión local, y describe `scores.user_id` y su política de INSERT en lugar de decir que `scores` no lo tiene.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Supabase Auth en lugar de un sistema propio.** El proyecto ya usa Supabase (SPEC 04) y `@supabase/ssr`. Auth da hash de contraseñas, verificación de correo, recuperación y OAuth sin escribir ni mantener esa lógica.
- **Una sola spec para correo y OAuth.** Decisión del usuario. La skill sugiere partir una feature así, pero todo comparte la pantalla `/auth`, el callback y `UserContext`. El plan ordena los pasos por riesgo: OAuth va al final y depende de configuración externa.
- **Correo y contraseña, Google y GitHub.** Decisión del usuario. El magic link y otros proveedores quedan fuera.
- **Verificación de correo obligatoria.** Decisión del usuario. Sin correo confirmado no hay sesión, y el registro termina en "Revisa tu correo".
- **Recuperación de contraseña dentro de la spec.** Decisión del usuario, dentro del mismo callback y con una pantalla propia (`/auth/reset`).
- **El nombre de usuario vive en `user_metadata`, sin unicidad.** Decisión del usuario. Es la opción más simple y no añade tablas. Dos jugadores pueden llamarse igual, igual que hoy en `scores.name`. Si hace falta unicidad o perfiles públicos, será otra spec con una tabla `profiles`.
- **Nombre en OAuth tomado del proveedor** (`name` o `user_name`), en mayúsculas y recortado a 10 caracteres, para respetar el límite de `scores.name`.
- **`scores.user_id` nullable, rellenado por la base de datos.** Decisión del usuario: los scores se vinculan a la cuenta dentro de esta spec, que antes lo dejaba fuera. La columna es nullable porque los invitados siguen guardando, y su default `auth.uid()` sale del JWT validado por Supabase. Así `GamePlayShell.tsx` no cambia y el cliente no puede mentir sobre su identidad.
- **Con sesión siempre se vincula.** Decisión del usuario. La política rechaza un `null` explícito de un usuario autenticado, así que no se puede esquivar el vínculo.
- **`scores.name` sigue editable.** Decisión del usuario. `user_id` identifica al dueño y `name` es solo el alias que se muestra, así que el modal de game-over no cambia.
- **Scores previos sin dueño, sin backfill; `on delete set null`.** Decisión del usuario. No hay forma fiable de saber de quién son los 27 existentes, y si se borra una cuenta el Salón de la Fama no pierde puntuaciones.
- **Una sola política de INSERT para `anon` y `authenticated`,** con `user_id is not distinct from (select auth.uid())`, que cubre ambos casos porque `auth.uid()` es nulo para `anon`. Se envuelve en `(select …)` para que Postgres lo evalúe una vez por consulta.
- **Índice parcial `where user_id is not null`.** Por la regla de indexar las claves foráneas. La mayoría de las filas serán nulas, así que es más pequeño que uno completo.
- **Migración con `apply_migration`,** que es como el proyecto versiona su esquema (`games_and_scores`, `add_snake_game`…). No hay carpeta `supabase/` local.
- **Todo sigue público, con modo invitado.** Decisión del usuario. Iniciar sesión da identidad (nombre en la Nav y en el game-over), no acceso.
- **Se mantiene el diseño actual de `/auth`.** Decisión del usuario. Solo se añaden estados reales (carga, error, éxito y "Revisa tu correo"), y el aspecto no cambia.
- **`useUser()` conserva `user: string | null`.** Así `GamePlayShell` y la play-page genérica no cambian. Se añade `loading` y `signOut` pasa a ser async.
- **`login(name)` se elimina del contexto.** Solo lo usaba `/auth`, que ahora llama a Supabase directamente. Es un cambio de contrato, pero con un único consumidor.
- **Iniciar sesión con correo y no con usuario.** Supabase autentica con el correo, y el usuario no es único. El campo "usuario" solo se pide en el registro.
- **SMTP por defecto de Supabase.** Decisión del usuario. No requiere configuración, pero limita el envío a pocos correos por hora y no es apto para producción.
- **`proxy.ts` y no `middleware.ts`.** Es la convención de Next 16, según `node_modules/next/dist/docs/`. Refresca la sesión por cookies en cada petición.
- **Contraseña mínima de 8 caracteres** en la validación del cliente. Supabase usa 6 por defecto, así que además se traduce su propio error.
- **Mensaje de recuperación idéntico exista o no el correo**, para no revelar qué cuentas existen.
- **`next` del callback solo admite rutas internas** (empiezan por `/`). Evita redirecciones abiertas.
- **Servidor: `getClaims()` o `getUser()`, nunca `getSession()`.** `getSession()` lee la cookie sin validarla, así que no es de fiar para decisiones de seguridad.
- **La configuración del dashboard es un paso manual (paso 0).** El código no puede activar proveedores ni registrar URL de redirección, y los pasos 4 a 6 dependen de ella.

**Descartadas**

- **Tabla `profiles` con `username` único.** Es más completa, pero añade tabla, trigger y RLS. El usuario eligió `user_metadata`.
- **Pantalla intermedia para elegir nombre tras el primer acceso con OAuth.** Añade una pantalla y un estado de "perfil incompleto". Se descartó a favor de tomar el nombre del proveedor.
- **Avatares prediseñados en el registro, y foto del proveedor con prioridad en OAuth.** Decisión del usuario. Es opcional y de bajo coste: son ocho SVG estáticos, sin Storage ni migraciones, y encajan con la estética arcade. El id se guarda en `user_metadata.avatar` y se valida contra una lista fija.
- **Nav con avatar, nombre y «Cerrar sesión» visibles,** en lugar de un botón con el nombre que cerraba la sesión sin avisar. Con sesión pasa al menú hamburguesa a 1000 px, porque la barra lleva más elementos.
- **`/auth` con sesión muestra «Ya iniciaste sesión»** en lugar del formulario, para no dejar sin salida a quien llega a esa ruta ya identificado.
- **Pantalla `/account` dentro de esta spec.** Decisión del usuario, en lugar de una spec aparte. Comparte con `/auth` el selector de avatar, la validación y el contexto de sesión, y sin ella no hay forma de corregir el nombre o el avatar tras registrarse.
- **`/account` edita nombre, avatar y contraseña, y no el correo.** Cambiar el correo exige un flujo de confirmación propio (`secure email change`) y queda para otra spec.
- **El nombre editado se guarda en `user_metadata.username`,** que ya tiene prioridad sobre `user_name` y `name`. Así una cuenta de Google o GitHub puede cambiar el nombre sin tocar lo que dice el proveedor.
- **En cuentas con foto de Google o GitHub no se ofrece elegir avatar.** La foto del proveedor tiene prioridad en el avatar visible, así que elegir uno no tendría efecto. Se evita un control que no hace nada.
- **El aviso de reautenticación se explica y no se resuelve.** Si Supabase exige una sesión reciente para cambiar la contraseña, la pantalla pide volver a iniciar sesión, en lugar de implementar el flujo de `reauthenticate()` con código por correo.
- **Exigir sesión para guardar un score.** Cambia el flujo de juego y rompe el modo invitado.
- **Subir una foto propia como avatar.** Requiere un bucket de Supabase Storage con políticas RLS, validar tipo y tamaño, y que el correo esté verificado antes de subir. Es mucho más trabajo y superficie de seguridad.
- **Que el cliente envíe `user_id` desde `GamePlayShell`.** Obliga a tocar un archivo que esta spec mantiene intacto y a exponer el id en `UserContext`, y depende de que el cliente envíe el valor correcto.
- **Permitir a un usuario con sesión guardar como invitado.** Es una política más laxa y necesita un control en la UI.
- **Bloquear `scores.name` al nombre de la cuenta.** Cambia el modal de game-over y obliga a decidir qué pasa al editar el nombre de usuario más adelante.
- **`on delete cascade` en `scores.user_id`.** Respeta mejor el borrado de datos, pero el ranking pierde entradas cuando alguien elimina su cuenta.
- **Backfill de scores por coincidencia de `name`.** El nombre no es único, así que se asignarían scores a la cuenta equivocada.
- **Ocultar `user_id` con privilegios por columna o una vista.** Rompería los `select('*')` de las pantallas actuales. Va en la spec de perfiles.
- **Rutas protegidas en el servidor.** Ninguna ruta exige sesión, así que `proxy.ts` no lleva lógica de redirección. `/account` y `/auth/reset` redirigen desde el cliente porque sin sesión no tienen nada que mostrar.
- **SMTP propio con Resend.** Es lo correcto para producción, pero añade configuración de dominio y registros DNS. Queda como paso futuro.
- **Magic link, Apple, teléfono y MFA.** Fuera del alcance acordado.
- **Rediseñar `/auth`.** El usuario eligió mantener el diseño actual.
- **Dejar la verificación de correo desactivada.** Era más cómodo de probar, pero el usuario decidió exigirla.
- **Mantener `av_user` en `localStorage` junto a Supabase.** Dos fuentes de verdad de la sesión producirían estados incoherentes.
- **Guardar el nombre en `localStorage` o en una cookie propia.** Se calcula desde la sesión y no se persiste aparte.
- **Probar con un test runner.** El proyecto no tiene uno y la verificación es manual.

---

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                   | Probabilidad | Impacto | Mitigación                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **El SMTP por defecto de Supabase limita el envío a pocos correos por hora**, y solo entrega a miembros del equipo del proyecto si no se configura un SMTP propio. Con usuarios reales, la verificación y la recuperación fallarían de forma silenciosa. | Alta         | Alto    | Se acepta para esta spec (decisión del usuario) y se limita a pruebas. Antes de abrir el registro a usuarios reales hay que configurar SMTP propio con Resend (spec futura). La UI muestra un error genérico en español si el envío falla. |
| **Los pasos 4 a 6 no se pueden probar sin la configuración manual del paso 0.** Sin proveedores activos ni URL de redirección registradas, los enlaces y el OAuth fallan con errores poco claros.                                                        | Alta         | Medio   | El paso 0 va primero y requiere confirmación explícita del usuario. Los criterios de OAuth se marcan como "pendientes" si no se pueden comprobar, y no bloquean el resto.                                                                  |
| **Redirecciones mal configuradas.** Si falta `localhost:3000` o la URL de producción en las Redirect URLs, el enlace del correo lleva a un destino equivocado o Supabase lo rechaza.                                                                     | Media        | Medio   | El paso 0 las lista de forma explícita. `emailRedirectTo` y `redirectTo` se construyen con `window.location.origin`, sin URLs fijas en el código.                                                                                          |
| **Redirección abierta en `/auth/callback`** mediante el parámetro `next`.                                                                                                                                                                                | Baja         | Alto    | `next` solo se acepta si empieza por `/` y no por `//`. Cualquier otro valor se ignora y se redirige a `/`. Hay un criterio de aceptación que lo comprueba.                                                                                |
| **Confiar en la sesión del cliente para decisiones de seguridad.** `getSession()` lee la cookie sin validarla.                                                                                                                                           | Baja         | Alto    | En el servidor y en `proxy.ts` se usa `getClaims()` o `getUser()`. En esta spec no hay rutas protegidas, así que `useUser()` solo se usa para mostrar la identidad.                                                                        |
| **Parpadeo de la Nav** (muestra "Iniciar Sesión" un instante y luego el nombre) por resolver la sesión en el cliente.                                                                                                                                    | Alta         | Bajo    | `UserContext` expone `loading` y la Nav no pinta el estado de sesión hasta que se resuelve.                                                                                                                                                |
| **Cambiar el contrato de `UserContext` rompe a algún consumidor.** `login` se elimina y `signOut` pasa a ser async.                                                                                                                                      | Media        | Medio   | Se comprobó con `grep`: solo `/auth` usa `login`, y `GamePlayShell`, la play-page genérica y `Nav` solo leen `user` o llaman a `signOut`. El paso 3 revisa los consumidores y `npm run build` detecta cualquier uso restante.              |
| **Vinculación automática de identidades.** Si alguien se registra con correo y contraseña y luego entra con Google con el mismo correo, Supabase puede fusionar las cuentas, y alguien que controle un correo sin verificar podría tomar la cuenta.      | Baja         | Alto    | Se exige correo verificado, y Supabase solo vincula identidades con correo verificado. Se deja el comportamiento por defecto y se revisa en el paso 6. Si se ve algún caso raro, se abre una spec propia.                                  |
| **Enumeración de cuentas.** Los mensajes de registro y de login pueden revelar qué correos existen.                                                                                                                                                      | Media        | Bajo    | La recuperación muestra siempre el mismo mensaje. En el login, el error es genérico ("Correo o contraseña incorrectos"). El registro con correo existente sí avisa: es una limitación asumida del flujo de verificación.                   |
| **Fuerza bruta contra el login.**                                                                                                                                                                                                                        | Media        | Medio   | Supabase aplica límites de frecuencia por IP y por correo en sus endpoints de Auth. No se añade lógica propia en esta spec.                                                                                                                |
| **Nombres duplicados o confusos.** `username` no es único, así que dos jugadores pueden tener el mismo nombre visible, y un nombre de OAuth puede salir recortado de forma poco legible.                                                                 | Alta         | Bajo    | Se asume (decisión del usuario). Si se necesita unicidad, va en la spec de `profiles`.                                                                                                                                                     |
| **La sesión local anterior queda huérfana.** Quien tenía `av_user` en `localStorage` deja de aparecer como "logueado" tras actualizar.                                                                                                                   | Alta         | Bajo    | Es el efecto buscado: esa sesión no era real. Se elimina el código que la lee. Los datos de `av_player_name` (último nombre usado al guardar un score) no se tocan.                                                                        |
| **`user_id` queda legible públicamente.** `scores_select_public` y los `select('*')` lo devuelven a cualquiera, así que se puede ver qué scores comparten cuenta.                                                                                        | Alta         | Bajo    | El UUID no revela correo ni nombre real, y no hay tabla `profiles` que lo cruce. Se asume. Si hace falta ocultarlo, va en la spec de perfiles.                                                                                             |
| **La sesión caduca sin que el usuario lo note.** Si el JWT vence y no se puede refrescar, la petición llega como `anon` y el score se guarda con `user_id` nulo, aunque la Nav siga mostrando el nombre.                                                 | Media        | Bajo    | El score no se pierde, solo queda sin vincular. `proxy.ts` refresca la sesión en cada petición, lo que lo hace poco frecuente.                                                                                                             |
| **Eliminar `scores_insert_public` deja la tabla sin política de INSERT si la nueva falla.**                                                                                                                                                              | Baja         | Alto    | Todo va en una sola migración transaccional, y el paso 9 prueba los seis casos antes de seguir.                                                                                                                                            |
| **Antifraude inexistente.** Un cliente con sesión puede enviar cualquier `score` (0–10 000 000), solo que ligado a su cuenta.                                                                                                                            | Alta         | Medio   | Se asume. La validación del lado del servidor es una spec propia.                                                                                                                                                                          |
| **`user_metadata.avatar` lo puede editar el propio usuario**, así que podría contener un valor arbitrario.                                                                                                                                               | Media        | Bajo    | El id se valida contra la lista fija con `isAvatarId` antes de construir la ruta `/avatars/<id>.svg`, y si no coincide se ignora. Es solo cosmético y nunca se usa para autorizar.                                                         |
| **La foto del proveedor se carga desde un dominio externo** (Google o GitHub), que ve la IP del visitante.                                                                                                                                               | Alta         | Bajo    | Solo se acepta `https://`, la etiqueta usa `referrerPolicy="no-referrer"` y, si la imagen falla, se muestra la inicial. Se asume.                                                                                                          |
| **La Nav con sesión desborda en pantallas intermedias.** Con avatar, nombre, botón y enlaces, la barra no cabe entre 840 y 1100 px.                                                                                                                      | Alta         | Medio   | Con sesión se oculta el contador de créditos hasta 1100 px y se pasa al menú hamburguesa hasta 1000 px. Se verifica a 1280, 1000, 860 y 390 px.                                                                                            |
| **«Secure password change» activo en Supabase.** Cambiar la contraseña exige haber iniciado sesión hace poco, y quien lleva días con la sesión abierta recibe un error.                                                                                  | Media        | Bajo    | El paso 0 pide revisar el ajuste. Se traduce `reauthentication_needed` con un aviso que pide volver a iniciar sesión, y los criterios lo comprueban.                                                                                       |
| **Quien entra solo con Google o GitHub fija una contraseña** y añade una identidad de correo a su cuenta, lo que le permite entrar también con ella.                                                                                                     | Baja         | Bajo    | Es el comportamiento estándar de Supabase y el correo ya está verificado. Se deja así y se revisa en el paso 8.                                                                                                                            |
| **`updateUser` con `data` reemplaza claves de primer nivel de `user_metadata`.** Si se envía un objeto incompleto podría borrar otros campos.                                                                                                            | Media        | Medio   | Solo se envían las claves que cambian (`username`, `avatar`), y Supabase fusiona `data` por clave. Se comprueba con `execute_sql` que el resto de `user_metadata` se conserva.                                                             |
| **Los errores de Supabase cambian de código o de texto entre versiones**, y la traducción en `lib/auth/errors.ts` deja de coincidir.                                                                                                                     | Media        | Bajo    | La traducción usa `error.code` (estable) y no el texto, y tiene un mensaje genérico en español para códigos desconocidos.                                                                                                                  |
