# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play and compete for points. Uses **Spec Driven Design** via the `/spec` and `/spec-impl` skills from `npx skills@latest add Klerith/fernando-skills`.

Games currently integrated: **Asteroids, Tetris, Arkanoid, Snake, Frogger**. Each has a playable canvas at `/games/<id>/play` and a leaderboard stored in Supabase. The source of truth for which games exist is the `games` table (Supabase MCP `list_tables` / `execute_sql`); `references/implemented-games.md` is a quick reference.

## Stack

- **Next.js 16.2.6** with App Router (`app/` directory) — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19.2.4**
- **Tailwind CSS v4** (PostCSS plugin via `@tailwindcss/postcss`)
- **TypeScript**
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — Supabase Auth, tables `games` and `scores`
- **Resend** — contact form email (`app/api/contact/route.ts`)
- **Prettier + ESLint** — formatting and linting

No test runner is configured yet.

## Commands

```bash
npm run dev           # dev server (port 3000)
npm run build         # production build
npm run start         # serve production build
npm run lint          # ESLint
npm run format        # Prettier write
npm run format:check  # Prettier check
```

## Environment

Copy `.env.template` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase client
- `SUPABASE_DB_PASSWORD` — database password
- `RESEND_API_KEY` — contact form

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario.

Project skills live in `.agents/skills/` (mirrored in `.claude/skills/`). `skills-lock.json` only tracks the external ones (`spec`, `spec-impl`, `supabase`, `supabase-postgres-best-practices`); the custom ones are not in the lock.

- `/spec` — writes a spec in `specs/` (phased method and format; source of truth for spec structure).
- `/spec-impl` — implements an existing spec step by step.
- `/add-game` — **custom**. Writes the spec to integrate a playable canvas game plus its leaderboard (reference folder from `references/started-games/` or a new game) in `specs/NN-<id>-game.md`; implementation comes afterwards. Technical contract: `.agents/skills/add-game/reference/integration.md`.
- `/spec-impl-game` — **custom**. Same as `/spec-impl` (delegates to `.agents/skills/spec-impl/SKILL.md`) but for game specs: after the implementation it launches, one after the other (never in parallel), `skin-designer` and then `mobile-porter` on the new game.
- `/supabase` and `/supabase-postgres-best-practices` — load before any database, RLS, migration or `@supabase/ssr` work.

Typical flow to add a game: `game-planner` → `/add-game <ref>` → review spec → `/spec-impl-game specs/NN-<id>-game.md` (implementation, then skins and mobile). Use plain `/spec-impl` if you only want the implementation. For a game born from a theme: `@game-jam <tema>` → review `specs/game-jam/<id>/` → `/spec-impl specs/game-jam/<id>/01-<id>-game.md`.

## Agents

Defined in `.claude/agents/<name>.md` (read the file for the full contract). Invoke with `@<name>`; the per-game ones work on **one game per invocation**.

- `game-planner` — recommends which game to add next (3 scored candidates). Memory: `references/game-suggestiones-todo.md`.
- `game-jam` — given a theme, designs a game and writes ≥2 specs in `specs/game-jam/<game-id>/`.
- `skin-designer` — gives a game the skins `classic`/`neon`/`retro` (dark-mode checked) and the selector. Memory: `references/game-with-themes.md`.
- `mobile-porter` — ports a game to mobile following SPEC 10. Memory: `references/game-mobile-status.md`.
- `game-performance-booster` — audits and fixes a game's canvas performance following SPEC 12. No memory.
- `security-auditor` — read-only security audit of the database (RLS, policies, grants, advisors) and the app (auth/session, protected routes, API routes, secrets, XSS, dependencies) against SPEC 13/14. Reports findings and proposes specs; never fixes. `@security-auditor [db|app|all]`. Memory: `references/security/security-status.md`.

## Architecture

Uses Next.js **App Router** exclusively — no `pages/` directory.

### Routes (`app/`)

- `/` — home landing (`page.tsx`, `RevealObserver.tsx` for scroll reveal)
- `/games` — game index (`GamesGrid.tsx`)
- `/games/[id]` — game detail + leaderboard
- `/games/<id>/play` — dedicated play-page per game (one folder each): `asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`. `app/games/[id]/play/page.tsx` is the generic fallback with simulated score, not a real game.
- `/hall-of-fame` — top scores per game (`HallOfFameClient.tsx`)
- `/about` — about page with contact form → `app/api/contact/route.ts` (Resend)
- `/auth` — sign in / sign up (email + password, Google, GitHub), optional avatar at sign up, "check your email" and "forgot password" states; with an active session it shows "Ya iniciaste sesión" instead of the form. See Auth below.
- `/auth/callback` — Route Handler that exchanges the `code` of email-verification, password-recovery and OAuth links for a session; `next` only accepts internal paths.
- `/auth/reset` — set a new password (needs the recovery session).
- `/account` — "Mi cuenta": edit username, avatar and password. Redirects to `/auth` without a session.

### Data layer

- `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (Server Components) — create clients with `@supabase/ssr`.
- `lib/supabase/types.ts` — `GameRow` and `ScoreRow`. Real schema:
  - `games`: `id`, `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `cover`, `color` (`cyan|magenta|yellow|green`), `sort_order`
  - `scores`: `id`, `game_id`, `name`, `score`, `created_at`, `user_id` (nullable uuid → `auth.users(id)`, `on delete set null`; `null` = guest or a score from before SPEC 13). `user_id` defaults to `auth.uid()`, so the client never sends it: `GamePlayShell` is unchanged. The INSERT policy `scores_insert_own_or_guest` only allows the caller's own `user_id` (or `null` for guests); there is no UPDATE or DELETE policy.
  - Limits: score 0–10 000 000; name 1–10 characters.
- `specs/06-games-table-leaderboard-supabase.md` is outdated vs. the real schema (it uses `player_name`). The real schema wins; check with the Supabase MCP (`list_tables`) when in doubt.
- `app/data/` — static data (`games.ts`, `scores.ts`) from the original visual MVP.
- The Supabase MCP server is configured in `.mcp.json`.

### Auth

Real authentication with **Supabase Auth** (SPEC 13): email + password (email verification required, password recovery), Google and GitHub. Guest mode stays: every route is public and signing in only gives identity.

- `proxy.ts` (Next 16 replacement for `middleware.ts`) runs `lib/supabase/proxy.ts` → `updateSession`, which refreshes the cookie session with `getClaims()`. Never use `getSession()` on the server: it reads the cookie without validating it.
- `app/context/UserContext.tsx` provides `useUser()` → `user` (display name, `string | null`), `email`, `avatar` (URL or `null`), `loading` and `signOut()` (async). It reads the session with `getSession()` and listens with `onAuthStateChange`. It is only for showing identity, never for security decisions. `GamePlayShell` only reads `user` to pre-fill the game-over name.
- `lib/auth/username.ts` — `normalizeUsername` (uppercase, max 10) and `getDisplayName`: `user_metadata.username ?? user_name ?? name ?? email prefix`, else `JUGADOR`. `getAvatarUrl`: provider photo (`avatar_url`/`picture`, `https` only) ?? preset avatar ?? `null` (the UI then shows the initial).
- `lib/auth/avatars.ts` — the 8 preset avatars (`ship`, `alien`, `ghost`, `joystick`, `coin`, `cartridge`, `star`, `heart`), SVGs in `public/avatars/`. `user_metadata` is user-editable, so `avatar` is always validated with `isAvatarId`. `components/AvatarPicker.tsx` is the shared picker.
- **Protected routes (SPEC 14):** `PROTECTED_ROUTES` in `lib/supabase/proxy.ts` (exact path → redirect when there are no valid claims): `/account` → `/auth`, `/auth/reset` → `/auth?error=reset_no_session`. Everything else stays public (guest mode). It is a navigation check, not authorization: data is protected by RLS. The client-side redirects in those pages stay (sign-out while already inside). To protect another route, add one line there.
- **Password rule (SPEC 14):** `lib/auth/password.ts` (`validatePassword`, `PASSWORD_REGEX`) — min 8 characters with lowercase, uppercase, digit and symbol. Applied at sign up, `/auth/reset` and `/account`; **not** at login (older accounts may have weak passwords). The regex is UX only: the real enforcement is the Supabase dashboard (Auth → Providers → Email: min length 8 + the same four requirements), which must stay in sync with the regex. Leaked password protection is Pro-only and stays off.
- **Security headers (SPEC 14):** `next.config.ts` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin` on every route. No CSP/HSTS yet. Sign-ups are limited to 10/hour per IP in the dashboard (Auth → Rate Limits). `public.rls_auto_enable()` has `EXECUTE` revoked from `anon`/`authenticated`; the `ensure_rls` event trigger still enables RLS on new tables.
- `lib/auth/errors.ts` — translates Supabase Auth error **codes** (not texts) to Spanish, with a generic fallback.
- The username lives in `user_metadata.username` (not unique); there is no `profiles` table. Uploading your own avatar is not implemented.
- The Nav shows avatar + name + "Cerrar sesión" with a session (hamburger menu below 1000 px, avatar only below 840 px).
- The last name used when saving a score is stored in `av_player_name`.
- Manual dashboard setup (Supabase → Auth): Email provider with "Confirm email", Google and GitHub providers, and `http://localhost:3000/auth/callback` plus the production URL as Redirect URLs. Default Supabase SMTP is rate-limited; custom SMTP (Resend) is a future spec.

### Games (`components/games/`)

- `GamePlayShell.tsx` — common shell for every play-page: HUD (stats), pause, force end, restart, game-over modal that saves the score to `scores` (clamped to 0–10 000 000), and **redirects to `/games/<id>` (leaderboard) after saving**. Games do not implement their own game-over, pause overlay or local leaderboard.
- `TouchControls.tsx` — virtual gamepad (d-pad + up to 2 buttons A/B) for touch devices (SPEC 10), with the Gamepad MK-II neon look (SPEC 11; assets in `references/gamepad-assets/`). Each play-page passes a `touch` config (`TouchControlsConfig`) to `GamePlayShell`; the pad dispatches synthetic `KeyboardEvent`s on `window`, so games need no touch code. The mobile layout (hidden nav, pause/back/skin footer, portrait-only) only applies under `(hover: none) and (pointer: coarse)` and only when `touch` is set.
- `<Name>Game.tsx` — canvas component (`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame`, `FroggerGame`). It receives `paused` from the shell and reports state through callbacks (`onScoreChange`, `onGameOver(score)`, etc.).
- Per-game helper modules in subfolders `components/games/<id>/` (`asteroids/`, `tetris/`, `arkanoid/`, `snake/`, `frogger/`): constants, sprites/drawing, levels and `skins.ts`. Tetris also has `board.ts`, `draw.ts` and its own `useSkin.ts`.
- `skins/` — shared skin infra: `useGameSkin.ts` (persists the choice in localStorage) and `SkinSelect.tsx` (selector used by the play-pages).
- `perf/` — canvas performance helpers from SPEC 12: `probe.ts` (`?perf=1` FPS/memory probe) and `spriteCache.ts` (offscreen sprite/background cache).
- Skins: games that have them follow the contract in `.claude/agents/skin-designer.md` (`components/games/<id>/skins.ts`, ids `classic|neon|retro` + extras, `<id>-skin` in localStorage). Status per game: `references/game-with-themes.md`. Mobile status per game: `references/game-mobile-status.md`.
- Game assets go in `public/games/<id>/` (only needed by games with raster sprites: currently `arkanoid` and `snake`; the rest are vector).
- New `.cover-*` classes for game covers live in `app/globals.css`.

### Specs (`specs/`)

holds the spec-driven design history, plus `specs/game-jam` for thematic jams.

### Other directories

- `references/` — source material and agent memories: `started-games/` (original games to port), `source-assets/` (e.g. snake sprites), `templates/` (original HTML/JSX design), `gamepad-assets/` (MK-II pad design), plus `implemented-games.md`, `game-suggestiones-todo.md`, `game-with-themes.md`, `game-mobile-status.md`, plus `security/` (`security-checklist.md` and the `security-status.md` memory). Not part of the app.
- `demos/`, `.playwright-mcp/`, `.playwright-screenshots/` — scratch/verification material.

Server Components are the default; mark client components with `"use client"` only when needed. Shared UI goes in `components/` (`Nav.tsx`, `games/`).

## Tooling

- `.claude/settings.json` has a `PostToolUse` hook (`.claude/hooks/format-and-lint.sh`) that runs Prettier and `eslint --fix` on every file written or edited. Do not format manually.
- Prettier config in `.prettierrc`.

## Conventions

- UI text and specs are in Spanish; code identifiers are in English.
- Commit messages are in Spanish, conventional style (`feat: ...`, `docs: ...`). Each spec is developed on its own branch (`spec-NN-<name>`) and merged through a PR.
