# BoardHub

Board games and team activities that run in the browser. No install, no download.

BoardHub has three areas:

- **Board games**: classic and Vietnamese folk games. You can play with a friend on one screen, against the computer, or
  online in a private room. Quick match comes with ratings and a leaderboard, and you can watch live games and replay
  finished ones.
- **Office**: activities for a team gathered around a projector. Everyone joins from their phone with their own animal
  avatar, and a fair, verifiable lucky draw picks winners ("Thú may mắn") with race, wheel, spotlight and claw-machine
  animations.
- **Party games**: games for family and friends in one room, on the same session machinery as the office area.
  The first is **Lì xì Tết** (New Year lucky money): the host sets the notes and how many of each, everyone joins by
  QR code (the host adds anyone without a phone), and one by one people are called up to open a red envelope in a Tết
  room with lanterns, music and firecrackers. Who is called and which envelope they get come from one fair,
  verifiable draw.

The interface is in Vietnamese (default) and English.

## Games

| Game                           | Players | Notes                                                                  |
| ------------------------------ | ------- | ---------------------------------------------------------------------- |
| Caro (gomoku)                  | 2       | five in a row on 15×15 or 19×19; blocked-ends and exactly-five options |
| Bốn trong hàng (four in a row) | 2       | drop discs, connect four                                               |
| Reversi                        | 2       | 6×6, 8×8 or 10×10; a player with no move passes automatically          |
| Cờ tướng (xiangqi)             | 2       | full rules, flying general, repetition and move-limit draws            |
| Cờ vua (chess)                 | 2       | full FIDE rules, checked with perft                                    |
| Cờ gánh                        | 2       | Vietnamese folk game: "gánh" and "vây" captures                        |
| Ô ăn quan                      | 2       | Vietnamese folk game, sowing shown stone by stone                      |
| Bắn tàu (battleship)           | 2       | hidden information: each player only ever receives their own view      |

Every game has a computer opponent at three levels. The bots run in a Web Worker in the browser, and on the server for
online rooms.

## Features

- **Ways to play:** on one screen, against the computer, private online rooms (invite link or 6-character code), and
  quick match (casual or ranked, Glicko-2).
- **Spectating, replays and history:** watch live games, replay any finished game move by move, and see your history
  in your profile. Games against the computer are saved in the browser too.
- **Accounts:** play as a guest or register with email. A guest who registers keeps their history.
- **Sound:** move, capture and win/lose effects, plus quiet orchestral background music. All of it is generated in the
  browser with Web Audio, with no audio files.
- **Admin:** turn games off, handle player reports, mute or ban accounts.
- **Accessibility:** boards can be played with the keyboard, and pieces are never told apart by colour alone.

## Tech stack

TypeScript monorepo with pnpm workspaces and Turborepo.

| Part                                                            | Tech                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web`                                                      | Next.js 16 (App Router), React 19, Tailwind CSS 4, next-intl, zustand                    |
| `apps/server`                                                   | Fastify 5 + Socket.IO 4, Kysely + PostgreSQL, Redis (ioredis)                            |
| `packages/engine`                                               | pure, deterministic game engine (`runMove`, seeded RNG); every game is a plugin          |
| `packages/games/*`                                              | one package per game: rules, board UI, bot, i18n, sounds                                 |
| `packages/bots`, `packages/ui`, `packages/protocol`             | bot algorithms, shared board components, zod schemas for every network message           |
| `packages/office-core`, `packages/office/*`, `packages/avatars` | office activities, fair draw (commit–reveal), animal avatars                             |
| Tests                                                           | Vitest, Playwright (desktop + mobile), integration tests against real Postgres and Redis |

The server is the only authority online: every move is checked there, and a player only ever receives what they are
allowed to see.

## Getting started

### Requirements

- **Node.js 22** or newer
- **pnpm 10**: run `corepack enable` and the pinned version is picked up from `package.json`
- **Docker** (optional): only needed to keep data in PostgreSQL and Redis

### 1. Install

```bash
git clone https://github.com/dinhthaivanvinh/boardhub.git
cd boardhub
pnpm install
```

### 2. Run (quick start, everything in memory)

Open two terminals:

```bash
pnpm dev:server   # game server on http://localhost:4000
pnpm dev          # web app on http://localhost:3000
```

Open <http://localhost:3000>. Local and computer games work right away. Online rooms, quick match and the office area
use the game server.

Without a database, the server keeps users, rooms and history in memory, so they are lost when it restarts. That is
fine for trying things out.

### 3. Run with PostgreSQL and Redis (data is kept)

```bash
docker compose up -d   # postgres:17 on 5432, redis:7 on 6379
```

Then start the server with their addresses (bash):

```bash
REDIS_URL=redis://localhost:6379 \
DATABASE_URL=postgres://boardhub:boardhub@localhost:5432/boardhub \
pnpm dev:server
```

On Windows PowerShell:

```powershell
$env:REDIS_URL = 'redis://localhost:6379'
$env:DATABASE_URL = 'postgres://boardhub:boardhub@localhost:5432/boardhub'
pnpm dev:server
```

The server creates and migrates the tables on start-up. Start `pnpm dev` as before.

### Play on other devices on your network

The web app looks for the game server on port 4000 of the same host. Open `http://<your-computer-ip>:3000` on a
phone or another computer on the same network, and online rooms and office sessions work across devices.

## Configuration

The server reads environment variables. Every one is optional in development. See
[`apps/server/.env.example`](apps/server/.env.example).

| Variable                       | Default            | Purpose                                                                       |
| ------------------------------ | ------------------ | ----------------------------------------------------------------------------- |
| `PORT` / `HOST`                | `4000` / `0.0.0.0` | where the game server listens                                                 |
| `DATABASE_URL`                 | in memory          | PostgreSQL for users, history, ratings, reports                               |
| `REDIS_URL`                    | in memory          | live rooms, timers, quick-match queue; needed to run several server processes |
| `JWT_SECRET`                   | dev value          | **required in production**, 32+ characters                                    |
| `CORS_ORIGIN`                  | any origin         | **required in production**: the web app's origin(s), comma-separated          |
| `ADMIN_EMAILS`                 | none               | comma-separated emails of registered accounts allowed to open `/admin`        |
| `GRACE_MS`                     | `60000`            | how long a disconnected player keeps their seat                               |
| `BOT_DELAY_MS` / `BOT_WORKERS` | `400` / `2`        | bot pause before moving / bot worker threads (`0` = main thread)              |
| `LOG_LEVEL`                    | `info`             | `fatal` … `trace`, or `silent`                                                |

The web app reads these at build time:

| Variable                      | Default                 | Purpose                                                                           |
| ----------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GAME_SERVER_URL` | same host, port 4000    | game server address seen by the browser                                           |
| `NEXT_PUBLIC_SITE_URL`        | `http://localhost:3000` | public address for canonical links, sitemap and social cards                      |
| `GAME_SERVER_INTERNAL_URL`    | the public one          | game server address used by the web server itself (e.g. inside a private network) |

## Production build

```bash
# Web
NEXT_PUBLIC_SITE_URL=https://your-domain NEXT_PUBLIC_GAME_SERVER_URL=https://api.your-domain \
pnpm build
pnpm --filter @bg/web start        # serves on port 3000

# Game server
NODE_ENV=production JWT_SECRET=<32+ random characters> CORS_ORIGIN=https://your-domain \
DATABASE_URL=postgres://… REDIS_URL=redis://… \
pnpm --filter @bg/server start
```

## Commands

```bash
pnpm dev                 # web app (http://localhost:3000)
pnpm dev:server          # game server (http://localhost:4000)
pnpm test                # unit tests for every package
pnpm lint                # ESLint
pnpm typecheck           # TypeScript in every package
pnpm format              # Prettier
pnpm e2e                 # Playwright: builds the web app and starts both servers on ports 3123 and 4000

pnpm --filter @bg/game-caro test             # one package
docker compose up -d && pnpm --filter @bg/server test:integration   # Postgres + Redis integration tests
```

CI (GitHub Actions) runs lint, format check, typecheck and unit tests, then the integration tests against real
Postgres and Redis.

## Project layout

```
apps/
  web/                 Next.js app: pages, match screens, sound, i18n
  server/              Fastify + Socket.IO: rooms, matches, matchmaking, office sessions, admin
packages/
  engine/              GameDefinition contract, runMove, seeded RNG, test helpers
  games/<id>/          rules · ui (Board, sounds) · bot · i18n · tests, one package per game
  bots/  ui/  protocol/
  office-core/  office/<id>/  avatars/
docs/                  product, architecture, protocol, data model, per-game specs, ADRs
e2e/                   Playwright tests
```

## Documentation

Most documents are written in Vietnamese.

| Topic                    | Document                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Product and requirements | [01 Product analysis](docs/01-product-analysis.md) · [02 Requirements](docs/02-requirements.md)                        |
| Architecture             | [03 Architecture](docs/03-architecture.md) · [ADRs](docs/adr/)                                                         |
| Game engine and rules    | [04 Game engine spec](docs/04-game-engine-spec.md) · [Game specs](docs/games/)                                         |
| Realtime and data        | [05 Realtime protocol](docs/05-realtime-protocol.md) · [06 Data model](docs/06-data-model.md)                          |
| Bots, frontend, testing  | [07 Bots](docs/07-bots.md) · [08 Frontend](docs/08-frontend-guidelines.md) · [10 Testing](docs/10-testing-strategy.md) |
| Conventions and roadmap  | [09 Conventions](docs/09-conventions.md) · [11 Roadmap](docs/11-roadmap.md) · [Glossary](docs/glossary.md)             |
| Office area              | [docs/office](docs/office/README.md)                                                                                   |
| Party games              | [ADR-0008](docs/adr/0008-party-area-on-office-sessions.md) · [Lì xì Tết](docs/office/activities/li-xi.md)              |

## Adding a game

A new game is a new package under `packages/games/<id>`, and the core does not change. The game provides:

- pure rules (`GameDefinition`)
- a board component
- a bot
- vi/en strings
- move sounds

It is then registered with one line in each of the web and server registries. See
[04 Game engine spec](docs/04-game-engine-spec.md) and use `caro` as the reference implementation.

## Working with Claude Code

Project rules for AI-assisted work are in [CLAUDE.md](CLAUDE.md), and task guides are in
[.claude/skills/](.claude/skills/).
