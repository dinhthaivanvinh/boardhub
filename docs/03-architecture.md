# 03 — Kiến trúc hệ thống

## 1. Nguyên tắc kiến trúc

1. **Engine thuần (pure) & deterministic.** Luật game là các hàm thuần, không I/O, không `Date`, không `Math.random`. Xem [ADR-0001](adr/0001-pure-engine-plugin.md).
2. **Server-authoritative.** Ở chế độ online, client chỉ gửi _ý định_ (intent); server kiểm tra, áp dụng và phát trạng thái mới.
3. **Game là plugin.** Mỗi game là một package độc lập, tuân theo interface `GameDefinition`. Lõi không biết đến game cụ thể nào.
4. **Dùng chung code client/server.** Cùng một engine chạy ở client (local, bot, highlight nước hợp lệ, optimistic UI) và ở server (nguồn sự thật).
5. **Ẩn thông tin ở server.** Client chỉ nhận `playerView`, không bao giờ nhận full state.

## 2. Tech stack

| Lớp                | Lựa chọn                                                                             | Lý do                                                                            |
| ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Ngôn ngữ           | TypeScript 6.0 (strict); chưa lên 7.0 vì typescript-eslint chưa hỗ trợ               | Một ngôn ngữ cho cả client, server và engine                                     |
| Monorepo           | pnpm workspaces + Turborepo                                                          | Chia package rõ ràng, build cache                                                |
| Frontend           | Next.js (App Router) + React                                                         | SSR cho trang danh mục/SEO, SPA cho phòng chơi                                   |
| Styling            | Tailwind CSS + CSS variables cho theme                                               | Nhanh, nhất quán                                                                 |
| State client       | Zustand (UI state), TanStack Query (REST)                                            | Nhẹ, đơn giản                                                                    |
| Bàn cờ             | SVG (mặc định); Canvas/PixiJS khi cần nhiều hiệu ứng                                 | SVG dễ responsive và hỗ trợ truy cập                                             |
| Realtime           | Socket.IO (Node) + `@socket.io/redis-adapter`                                        | Reconnect, room, fallback sẵn có. Xem [ADR-0003](adr/0003-realtime-transport.md) |
| API server         | Fastify                                                                              | Nhanh, có sẵn schema validation                                                  |
| Validation         | zod (dùng chung qua `@bg/protocol`)                                                  | Một schema dùng cho cả hai phía                                                  |
| Database           | PostgreSQL + Kysely (ADR-0004); không có `DATABASE_URL` thì dùng bộ nhớ khi dev      | Dữ liệu quan hệ (user, match, rating)                                            |
| Cache / live state | Redis                                                                                | Lưu state phòng đang chơi, pub/sub, khóa phân tán, hàng đợi ghép trận            |
| Bot                | Chạy trong worker thread (server) / Web Worker (client)                              | Không chặn event loop                                                            |
| Test               | Vitest, fast-check (property test), Playwright (E2E)                                 |                                                                                  |
| Hạ tầng            | Docker; web trên Vercel hoặc container; game server trên container có sticky session |                                                                                  |

## 3. Sơ đồ tổng thể

```
┌──────────────────────────── Browser ────────────────────────────┐
│  apps/web (Next.js)                                             │
│   ├─ Trang danh mục, hồ sơ (SSR)                                │
│   ├─ Màn chơi: <GameBoard> từ packages/games/<id>/ui            │
│   ├─ LocalMatchRunner ── @bg/engine + game def (local/bot)      │
│   └─ OnlineMatchClient ── socket.io-client ── @bg/protocol      │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ HTTPS (REST)                  │ WebSocket
┌───────────────▼───────────────────────────────▼─────────────────┐
│  apps/server (Fastify + Socket.IO)                              │
│   ├─ REST: auth, users, games catalog, match history            │
│   ├─ Gateway: auth socket, rate limit, validate envelope (zod)  │
│   ├─ RoomService: lobby, seat, ready, lifecycle                 │
│   ├─ MatchService: runMove() qua @bg/engine, clock, seq         │
│   ├─ BotService: worker pool chạy bot                           │
│   └─ Matchmaker: hàng đợi theo (gameId, variant, eloBucket)     │
└──────┬─────────────────────────┬────────────────────────────────┘
       │                         │
┌──────▼──────┐          ┌───────▼──────┐
│ PostgreSQL  │          │    Redis     │
│ users,      │          │ room state,  │
│ matches,    │          │ pub/sub,     │
│ moves,      │          │ locks, queue │
│ ratings     │          └──────────────┘
└─────────────┘
```

## 4. Cấu trúc monorepo

```
boardgame/
├─ apps/
│  ├─ web/                      # Next.js
│  │  └─ src/
│  │     ├─ app/                # routes: /, /games/[gameId], /play/[matchId], /room/[code]
│  │     ├─ features/           # lobby, match, profile, auth...
│  │     ├─ games/              # catalog.ts, client-registry.ts, bots.ts, covers.ts: đăng ký game
│  │     ├─ game-runtime/       # LocalMatch, useLocalMatch, bot worker; sau này OnlineMatchClient
│  │     └─ i18n/
│  └─ server/
│     └─ src/
│        ├─ http/               # Fastify routes
│        ├─ realtime/           # socket gateway, handlers
│        ├─ rooms/  matches/  bots/  matchmaking/
│        ├─ hub/                # GameHub: phòng, ván, đồng hồ, bot, mất kết nối
│        ├─ store/  db/         # live store (memory | Redis), repos (memory | Postgres/Kysely)
│        └─ registry.ts         # danh sách game được bật
├─ packages/
│  ├─ engine/                   # @bg/engine: types, runMove, rng, test harness
│  ├─ protocol/                 # @bg/protocol: zod schemas cho socket events + REST DTO
│  ├─ ui/                       # @bg/ui: design system, primitive bàn cờ (Grid, Piece, Cell)
│  ├─ bots/                     # @bg/bots: thuật toán chung (random, greedy, minimax, MCTS)
│  └─ games/
│     ├─ caro/                  # @bg/game-caro
│     │  ├─ src/rules/          # pure logic
│     │  ├─ src/ui/             # React board component
│     │  ├─ src/bot/            # heuristic/evaluator riêng của game
│     │  ├─ src/i18n/           # vi.json, en.json (tên, luật)
│     │  ├─ src/index.ts        # export definition + ui + bot
│     │  └─ test/
│     ├─ xiangqi/  reversi/  four-in-a-row/
├─ docs/
└─ .claude/skills/
```

**Quy tắc phụ thuộc** (ESLint `import/no-restricted-paths` sẽ ép buộc các quy tắc này):

```
games/*/rules  → chỉ được import @bg/engine (types, rng, helpers)
games/*/ui     → được import @bg/ui, React, rules của chính game đó
games/*/bot    → được import @bg/bots, rules của chính game đó
apps/*         → được import mọi package
@bg/engine     → KHÔNG được import gì của apps/ hoặc games/
```

## 5. Luồng xử lý một nước đi online

```
Client A                      Server                                   Client B
   │  move:submit {roomId,     │                                          │
   │  clientMoveId, seq, move} │                                          │
   ├──────────────────────────►│ 1. zod validate envelope                 │
   │                           │ 2. acquire lock(roomId)                  │
   │                           │ 3. check seq == room.seq                 │
   │                           │ 4. runMove(def, state, seat, move, ctx)  │
   │                           │    ├─ moveSchema.parse                   │
   │                           │    ├─ seat ∈ activePlayers               │
   │                           │    ├─ validateMove                       │
   │                           │    ├─ applyMove                          │
   │                           │    └─ result                             │
   │                           │ 5. update clock, seq++                   │
   │                           │ 6. save state → Redis, move → PG (async) │
   │                           │ 7. release lock                          │
   │◄──── match:state ─────────┤──────────── match:state ────────────────►│
   │  (playerView của A)       │             (playerView của B)           │
```

Khi nước đi bị từ chối, server gửi `move:rejected {clientMoveId, code}` cho riêng người gửi, và client rollback optimistic UI.

## 6. Quản lý state

| State                                        | Nơi lưu                                                 | Vòng đời                     |
| -------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Ván đang chơi (full state, seq, clock, seed) | Redis `match:{id}`                                      | Đến khi ván kết thúc + 1 giờ |
| Danh sách nước đi                            | PostgreSQL `match_moves` (ghi bất đồng bộ qua hàng đợi) | Vĩnh viễn                    |
| Kết quả ván, rating                          | PostgreSQL                                              | Vĩnh viễn                    |
| Ván local / bot                              | IndexedDB ở client                                      | Đến khi người dùng xóa       |

Có thể dựng lại state từ đầu bằng `setup(config, seed)` rồi áp dụng lần lượt `moves`. Đây là nền tảng cho replay, debug và kiểm tra tranh chấp.

## 7. Scale & triển khai

- Game server **stateless ở tầng process**: mọi state nằm ở Redis, nên process nào cũng xử lý được phòng nào (cần lock theo `roomId`).
- Sticky session ở load balancer cho WebSocket; Socket.IO Redis adapter để broadcast giữa các node.
- Hẹn giờ (đồng hồ, chờ kết nối lại, lượt bot) là job trong Redis, node nào cũng chạy được, không mất khi một node khởi động lại (docs/06 §4).
- Bot chạy trong worker pool; bot ở cấp độ khó có ngân sách thời gian cố định (ví dụ 1–2 giây).
- Môi trường: `local` (docker compose: postgres, redis) → `staging` → `production`.

## 8. Bảo mật

- Socket handshake xác thực bằng JWT ngắn hạn (lấy qua REST).
- Mọi payload đi qua zod schema trong `@bg/protocol`; payload không hợp lệ thì từ chối và tính vào rate limit.
- Server không bao giờ gửi full state; test bắt buộc cho game có thẻ `hidden-info` (xem [10-testing-strategy](10-testing-strategy.md)).
- Seed RNG chỉ nằm ở server, không gửi về client cho đến khi ván kết thúc.
