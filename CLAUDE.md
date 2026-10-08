# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play and compete for points. Uses **Spec Driven Design** via the `/spec` and `/spec-impl` skills from `npx skills@latest add Klerith/fernando-skills`.

Games currently integrated: **Asteroids, Tetris, Arkanoid, Snake**. Each has a playable canvas at `/games/<id>/play` and a leaderboard stored in Supabase.

## Stack

- **Next.js 16.2.6** with App Router (`app/` directory) — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19.2.4**
- **Tailwind CSS v4** (PostCSS plugin via `@tailwindcss/postcss`)
- **TypeScript**
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — tables `games` and `scores`
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

Project skills live in `.agents/skills/` (mirrored in `.claude/skills/`; versions tracked in `skills-lock.json`):

- `/spec` — writes a spec in `specs/` (phased method and format; source of truth for spec structure).
- `/spec-impl` — implements an existing spec step by step.
- `/add-game` — **custom skill**. Generates the spec to integrate a playable canvas game plus its leaderboard (reference folder from `references/started-games/` or a new game). It only writes the spec in `specs/NN-<id>-game.md`; implementation is done afterwards with `/spec-impl`. Its technical contract is in `.agents/skills/add-game/reference/integration.md`.
- `/supabase` and `/supabase-postgres-best-practices` — load before any database, RLS, migration or `@supabase/ssr` work.

Typical flow to add a game: `game-planner` → `/add-game <ref>` → review spec → `/spec-impl specs/NN-<id>-game.md`.

## Agents

- `game-planner` (`.claude/agents/game-planner.md`) — decides which game fits the platform and recommends the next one (3 candidates scored against a rubric). Read-only on the project; its only write target is `references/game-suggestiones-todo.md`, which is also its memory: every suggestion, its status (pending/accepted/rejected/implemented) and the user's preferences live there.
- `game-jam` (`.claude/agents/game-jam.md`) — given a theme, designs one game and writes at least two complete specs (`01-<id>-game.md` playable integration + `02-<id>-<extension>.md`) in `specs/game-jam/<game-id>/`, in `Borrador` state and in the same format as specs 07–09. Its only write target is that folder. Flow: `@game-jam <tema>` → review `specs/game-jam/<id>/` → `/spec-impl specs/game-jam/<id>/01-<id>-game.md`.
- `skin-designer` (`.claude/agents/skin-designer.md`) — works on **one game per invocation** (`@skin-designer <game-id>`): leaves it with at least the skins `classic` (default), `neon` and `retro`, all checked for dark mode (WCAG contrast), and implements the code (`components/games/<id>/skins.ts`, skin selector in the play-page). Never touches games it was not asked for. Its memory is `references/game-with-themes.md` (which games have skins and their dark-mode status); it only updates the row of the game it worked on.

- `mobile-porter` (`.claude/agents/mobile-porter.md`) — works on **one game per invocation** (`@mobile-porter <game-id>`): ports it to mobile following SPEC 10 (`touch` config in its play-page, mobile layout, landscape) without changing desktop. Never touches the game logic, `TouchControls.tsx` or `GamePlayShell.tsx`. Its memory is `references/game-mobile-status.md`; it only updates the row of the game it worked on.

## Architecture

Uses Next.js **App Router** exclusively — no `pages/` directory.

### Routes (`app/`)

- `/` — home landing (`page.tsx`, `RevealObserver.tsx` for scroll reveal)
- `/games` — game index (`GamesGrid.tsx`)+ per-game routes like `asteroids`, `tetris`, `arkanoid`, `snake` and more... (`/references/implemented-games.md` ) when you need to check rith games are implemented and how to implement new ones.

- `/games/[id]` — game detail + leaderboard
- `/games/<id>/play` — play-page per game: `asteroids`, `tetris`, `arkanoid`, `snake` (each a dedicated folder). `app/games/[id]/play/page.tsx` is the generic fallback with simulated score, not a real game.
- `/hall-of-fame` — top scores per game (`HallOfFameClient.tsx`)
- `/about` — about page with contact form → `app/api/contact/route.ts` (Resend)
- `/auth` — sign in/up UI; currently a local-only session (see Auth below)

### Data layer

- `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (Server Components) — create clients with `@supabase/ssr`.
- `lib/supabase/types.ts` — `GameRow` and `ScoreRow`. Real schema:
  - `games`: `id`, `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `cover`, `color` (`cyan|magenta|yellow|green`), `sort_order`
  - `scores`: `id`, `game_id`, `name`, `score`, `created_at` — no `user_id`
  - Limits: score 0–10 000 000; name 1–10 characters.
- `specs/06-games-table-leaderboard-supabase.md` is outdated vs. the real schema (it uses `player_name`/`user_id`). The real schema wins; check with the Supabase MCP (`list_tables`) when in doubt.
- `app/data/` — static data (`games.ts`, `scores.ts`) from the original visual MVP.
- The Supabase MCP server is configured in `.mcp.json`.

### Auth

`app/context/UserContext.tsx` provides `useUser()` (`user`, `login`, `signOut`). The session is only a username stored in `localStorage` (`av_user`); there is no Supabase Auth yet. The last name used when saving a score is stored in `av_player_name`.

### Games (`components/games/`)

- `GamePlayShell.tsx` — common shell for every play-page: HUD (stats), pause, force end, restart, game-over modal that saves the score to `scores` (clamped to 0–10 000 000), and **redirects to `/games/<id>` (leaderboard) after saving**. Games do not implement their own game-over, pause overlay or local leaderboard.
- `TouchControls.tsx` — virtual gamepad (d-pad + up to 2 buttons A/B) for touch devices (SPEC 10). Each play-page passes a `touch` config (`TouchControlsConfig`) to `GamePlayShell`; the pad dispatches synthetic `KeyboardEvent`s on `window`, so games need no touch code. The mobile layout (hidden nav, pause/back/skin footer, portrait-only) only applies under `(hover: none) and (pointer: coarse)` and only when `touch` is set.
- `<Name>Game.tsx` — canvas component (`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame`). It receives `paused` from the shell and reports state through callbacks (`onScoreChange`, `onGameOver(score)`, etc.).
- Per-game helper modules in subfolders: `tetris/` (board, pieces, draw, skins, `useSkin` — 4 skins persisted in localStorage), `arkanoid/` (levels, sprites), `snake/` (constants, sprites).
- Skins: games that have them follow the contract in `.claude/agents/skin-designer.md` (`components/games/<id>/skins.ts`, ids `classic|neon|retro` + extras, `<id>-skin` in localStorage). Which games have them: `references/game-with-themes.md`.
- Game assets go in `public/games/<id>/`.
- New `.cover-*` classes for game covers live in `app/globals.css`.

### Specs (`specs/`)

Numbered `NN-name.md`, each with a status header (Aprobado / Implementado). 01 MVP visual, 02 home, 03 about + Resend, 04 Supabase, 05 Asteroids, 06 games table + leaderboard, 07 Tetris (with skins), 08 Arkanoid, 09 Snake. Write specs in Spanish and update the status to `Implementado` when done.

### Other directories

- `references/` — source material: `started-games/` (original games to port), `source-assets/` (e.g. snake sprites), `templates/` (original HTML/JSX design). Not part of the app.
- `demos/`, `.playwright-mcp/`, `.playwright-screenshots/` — scratch/verification material.

Server Components are the default; mark client components with `"use client"` only when needed. Shared UI goes in `components/` (`Nav.tsx`, `games/`).

## Tooling

- `.claude/settings.json` has a `PostToolUse` hook (`.claude/hooks/format-and-lint.sh`) that runs Prettier and `eslint --fix` on every file written or edited. Do not format manually.
- Prettier config in `.prettierrc`.

## Conventions

- UI text and specs are in Spanish; code identifiers are in English.
- Commit messages are in Spanish, conventional style (`feat: ...`, `docs: ...`). Each spec is developed on its own branch (`spec-NN-<name>`) and merged through a PR.
