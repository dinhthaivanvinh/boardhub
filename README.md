# BoardHub (tên tạm)

Nền tảng web chơi nhiều loại board game (Caro, Cờ tướng, Reversi, Bốn trong hàng, …) với nhiều cách chơi:
chơi cùng máy, chơi với bot, phòng riêng online, ghép trận, xem trận và xem lại.

> **Trạng thái:** đang ở giai đoạn thiết kế, chưa có code. Bắt đầu từ [Roadmap M0](docs/11-roadmap.md).

## Tài liệu

| #   | Tài liệu                                                                     | Nội dung                                                 |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| 01  | [Phân tích sản phẩm](docs/01-product-analysis.md)                            | Tầm nhìn, personas, danh mục game, các cách chơi, rủi ro |
| 02  | [Yêu cầu](docs/02-requirements.md)                                           | FR/NFR có ID                                             |
| 03  | [Kiến trúc](docs/03-architecture.md)                                         | Tech stack, sơ đồ, monorepo, luồng nước đi               |
| 04  | [Game Engine Spec](docs/04-game-engine-spec.md)                              | Interface `GameDefinition`, quy tắc E1–E11               |
| 05  | [Realtime Protocol](docs/05-realtime-protocol.md)                            | Socket events, vòng đời phòng, reconnect                 |
| 06  | [Data Model](docs/06-data-model.md)                                          | PostgreSQL, Redis                                        |
| 07  | [Bots](docs/07-bots.md)                                                      | Interface bot, thuật toán, quy tắc B1–B7                 |
| 08  | [Frontend](docs/08-frontend-guidelines.md)                                   | Runtime, hợp đồng Board component, a11y, i18n            |
| 09  | [Conventions](docs/09-conventions.md)                                        | Code style, đặt tên, cấu trúc package, git               |
| 10  | [Testing](docs/10-testing-strategy.md)                                       | Test bắt buộc, fixtures, CI                              |
| 11  | [Roadmap](docs/11-roadmap.md)                                                | Các milestone M0–M5                                      |
| —   | [Glossary](docs/glossary.md) · [ADRs](docs/adr/) · [Game specs](docs/games/) |                                                          |

## Lệnh (dự kiến, sau M0)

```bash
pnpm install
docker compose up -d        # postgres + redis
pnpm dev                    # web :3000, server :4000
pnpm test                   # toàn bộ test
pnpm --filter @bg/game-caro test
```

## Làm việc với Claude Code

Xem [CLAUDE.md](CLAUDE.md) và các skill trong [.claude/skills/](.claude/skills/).
