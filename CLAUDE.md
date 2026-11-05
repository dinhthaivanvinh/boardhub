# CLAUDE.md

Nền tảng web có **hai khu**: **Board game** (nhiều game, chơi local/bot/online/replay) và **Văn phòng** (hoạt động cho
nhân viên: con vật đại diện, bốc thăm công bằng, chia đội…).
TypeScript monorepo: `apps/web` (Next.js), `apps/server` (Fastify + Socket.IO), `packages/engine`, `packages/protocol`,
`packages/ui`, `packages/bots`, `packages/games/<id>`; khu Văn phòng: `packages/avatars`, `packages/office-core`,
`packages/office/<id>`.

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
| Khu Văn phòng (bất kỳ việc gì)                         | [docs/office/README.md](docs/office/README.md) (mục lục O-01…O-08)                       |
| Hoạt động văn phòng, `@bg/office-core`, bốc thăm       | [docs/office/04-activity-spec.md](docs/office/04-activity-spec.md), ADR-0005, ADR-0006   |
| Con vật đại diện, `@bg/avatars`                        | [docs/office/05-avatar-system.md](docs/office/05-avatar-system.md)                       |
| Phiên văn phòng, socket `/office`                      | [docs/office/06-protocol-and-data.md](docs/office/06-protocol-and-data.md)               |
| Màn chủ trì / sân khấu / điện thoại, hiệu ứng bốc      | [docs/office/07-ux-guidelines.md](docs/office/07-ux-guidelines.md)                       |

## Skills — dùng skill tương ứng thay vì tự làm theo cách riêng

| Skill                 | Khi nào                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `bg-add-game`         | Thêm một game mới (từ spec đến lúc đăng ký vào registry)                       |
| `bg-game-rules`       | Viết hoặc sửa luật trong `rules/`, hoặc sửa `@bg/engine`                       |
| `bg-board-ui`         | Viết hoặc sửa component bàn cờ, primitives trong `@bg/ui/board`                |
| `bg-realtime`         | Thêm hoặc sửa socket event, RoomService, MatchService, reconnect, đồng hồ      |
| `bg-bot`              | Viết hoặc tinh chỉnh bot                                                       |
| `bg-testing`          | Viết test cho game hoặc lõi; sửa bug luật                                      |
| `office-add-activity` | Thêm một hoạt động văn phòng mới (spec → gói → đăng ký → test)                 |
| `office-avatar`       | Thêm/sửa loài, phụ kiện, màu, renderer hoặc studio con vật                     |
| `office-realtime`     | `OfficeHub`, socket `/office`, phiên, quyền chủ trì, lưu trữ, quy mô 200 người |
| `office-fair-draw`    | Bất cứ thứ gì chọn ngẫu nhiên trong khu Văn phòng: commit–reveal, kiểm chứng   |
| `office-stage-ui`     | Màn sân khấu/chủ trì/điện thoại, hiệu ứng bốc đồng bộ thời gian                |
| `bg-docs-sync`        | Sau mọi thay đổi chạm đến hợp đồng (engine, protocol, data model, kiến trúc)   |

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
10. **Văn phòng — ngẫu nhiên chỉ ở server, có commit–reveal:** hoạt động không tự random; xin hub `draw`; không gửi `seed` trước reveal; kết quả đã reveal không sửa/huỷ (ADR-0006).
11. **Văn phòng — hoạt động là plugin thuần** theo `ActivityDefinition` (như quy tắc 1); thêm hoạt động không sửa `OfficeHub`, chỉ thêm một dòng registry (ADR-0005).
12. **Văn phòng — gửi thay đổi, không gửi lại cả phiên** (200 người); quyền chủ trì luôn kiểm tra ở server.
13. **Avatar chỉ chứa id/màu thuộc catalog** (zod); không tải ảnh lên, không nhân vật thương mại.

## Game tham chiếu

`caro` là reference implementation ([spec](docs/games/caro.md)). Khi không chắc nên làm thế nào, hãy làm giống Caro.

## Lệnh

```bash
pnpm dev            # web http://localhost:3000
pnpm dev:server     # game server http://localhost:4000 (bộ nhớ; thêm REDIS_URL/DATABASE_URL để dùng Redis/Postgres)
docker compose up -d && pnpm --filter @bg/server test:integration
pnpm test | pnpm lint | pnpm typecheck
pnpm e2e            # Playwright (tự build + chạy server ở cổng 3123)
pnpm --filter @bg/game-<id> test
```

Trước khi báo hoàn thành: chạy `pnpm lint && pnpm typecheck && pnpm test` cho các package bị ảnh hưởng.
