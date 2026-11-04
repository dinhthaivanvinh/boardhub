# CLAUDE.md

Nền tảng web chơi nhiều board game với nhiều cách chơi (local, bot, online, replay).
TypeScript monorepo: `apps/web` (Next.js), `apps/server` (Fastify + Socket.IO), `packages/engine`, `packages/protocol`,
`packages/ui`, `packages/bots`, `packages/games/<id>`.

Giao tiếp với người dùng bằng **tiếng Việt**. Code, tên biến và commit message viết bằng tiếng Anh.

## Đọc trước khi làm

| Khi làm việc với…                                      | Đọc                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Bất kỳ việc gì                                         | [docs/glossary.md](docs/glossary.md), [docs/03-architecture.md](docs/03-architecture.md) |
| Luật game, `packages/games/*/rules`, `packages/engine` | [docs/04-game-engine-spec.md](docs/04-game-engine-spec.md)                               |
| Socket, phòng, ván online                              | [docs/05-realtime-protocol.md](docs/05-realtime-protocol.md)                             |
| DB, Redis                                              | [docs/06-data-model.md](docs/06-data-model.md)                                           |
| Bot                                                    | [docs/07-bots.md](docs/07-bots.md)                                                       |
| UI, bàn cờ                                             | [docs/08-frontend-guidelines.md](docs/08-frontend-guidelines.md)                         |
| Test                                                   | [docs/10-testing-strategy.md](docs/10-testing-strategy.md)                               |

## Skills — dùng skill tương ứng thay vì tự làm theo cách riêng

| Skill           | Khi nào                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| `bg-add-game`   | Thêm một game mới (từ spec đến lúc đăng ký vào registry)                     |
| `bg-game-rules` | Viết hoặc sửa luật trong `rules/`, hoặc sửa `@bg/engine`                     |
| `bg-board-ui`   | Viết hoặc sửa component bàn cờ, primitives trong `@bg/ui/board`              |
| `bg-realtime`   | Thêm hoặc sửa socket event, RoomService, MatchService, reconnect, đồng hồ    |
| `bg-bot`        | Viết hoặc tinh chỉnh bot                                                     |
| `bg-testing`    | Viết test cho game hoặc lõi; sửa bug luật                                    |
| `bg-docs-sync`  | Sau mọi thay đổi chạm đến hợp đồng (engine, protocol, data model, kiến trúc) |

## Quy tắc vàng (không được vi phạm)

1. **Engine thuần:** trong `rules/` và `@bg/engine` không có I/O, `Math.random`, `Date`; state phải JSON-serializable; không mutate state.
2. **Server-authoritative:** ở chế độ online, mọi nước đi phải qua `runMove` ở server. Client không tự quyết định kết quả.
3. **Không lộ thông tin ẩn:** chỉ gửi `playerView` cho client, không bao giờ gửi full state.
4. **Mọi dữ liệu từ network phải parse bằng zod** (schema nằm ở `@bg/protocol` hoặc `moveSchema` của game).
5. **Thêm game không được sửa lõi**, chỉ thêm một dòng vào registry.
6. **Không có chuỗi hiển thị hard-code**; dùng i18n với cả `vi` và `en`.
7. **Sửa bug luật thì viết fixture tái hiện bug trước.**
8. Đổi hợp đồng (engine interface, protocol, schema DB) thì phải cập nhật docs, và viết ADR nếu là breaking change.
9. Chỉ làm game có luật chơi dân gian/phổ thông hoặc tự thiết kế; không dùng tên thương hiệu hay tài sản của game thương mại.

## Game tham chiếu

`caro` là reference implementation ([spec](docs/games/caro.md)). Khi không chắc nên làm thế nào, hãy làm giống Caro.

## Lệnh

```bash
pnpm dev            # web http://localhost:3000
pnpm test | pnpm lint | pnpm typecheck
pnpm e2e            # Playwright (tự build + chạy server ở cổng 3123)
pnpm --filter @bg/game-<id> test
```

Trước khi báo hoàn thành: chạy `pnpm lint && pnpm typecheck && pnpm test` cho các package bị ảnh hưởng.
