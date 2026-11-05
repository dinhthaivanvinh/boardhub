---
name: bg-add-game
description: Add a new board game to the platform end-to-end — spec, rules package, board UI, bot, i18n, tests, and registry. Use when the user asks to "thêm game", "add a game", "làm game X", or create a new packages/games/<id> package.
---

# Thêm một game mới

Mục tiêu: một game mới chạy được ở mọi mode **mà không sửa code lõi** (`@bg/engine`, `apps/server`, `apps/web`),
ngoại trừ một dòng trong registry.

## Bước 0 — Kiểm tra trước khi làm

- Game có luật dân gian/phổ thông hoặc tự thiết kế không? Nếu là game thương mại: không dùng tên thương hiệu và tài sản của họ; dùng tên chung (xem `docs/01-product-analysis.md` mục 4).
- `gameId` đã có chưa? `ls packages/games/`. Id là kebab-case và **không đổi được** sau khi phát hành.
- Xác định tags: `perfect-info` / `chance` / `hidden-info` / `simultaneous` / `multi-player`. Mỗi tag kéo theo yêu cầu riêng (bảng ở cuối).

## Bước 1 — Viết spec (bắt buộc, trước khi viết code)

Copy `docs/games/_template.md` → `docs/games/<id>.md` và điền **đủ 12 mục**.
Nếu luật có chỗ mơ hồ (có nhiều luật địa phương khác nhau), hãy **hỏi người dùng** hoặc đưa thành một field trong `configSchema`.
Xem `docs/games/caro.md` làm ví dụ.

## Bước 2 — Tạo package

Tạo cấu trúc như `docs/09-conventions.md` mục 3. Code khởi đầu nằm trong [templates.md](templates.md).

## Bước 3 — Rules

Dùng skill **`bg-game-rules`**. Thứ tự viết: `types` → `config` → `setup` → `moves` (validate/apply/legalMoves) → `result` → `view` → `definition`.

## Bước 4 — Tests

Dùng skill **`bg-testing`**. Viết song song với Bước 3, không để đến cuối. Phải có đủ test bắt buộc trong `docs/10-testing-strategy.md` mục 2.

## Bước 5 — Board UI

Dùng skill **`bg-board-ui`**. Component nhận `BoardProps<View, Move>`.

## Bước 6 — Bot

Dùng skill **`bg-bot`**. Tối thiểu phải có cấp `easy` (randomBot hoặc greedy).

## Bước 7 — i18n

`src/i18n/vi.json` và `en.json` cần có: `name`, `shortDescription`, `rules` (markdown), mọi mã lỗi, mọi `reason` kết thúc ván, nhãn của các field config (và `config.<key>Options.<value>` cho giá trị cần tên đẹp, ví dụ `"19": "19 × 19"`).

`rules` được hiển thị **ngay trong ván** qua nút "Luật chơi" (FR-PLAY-08), nên phải đầy đủ và ngắn gọn: người chơi đọc nó giữa ván. Chỉ dùng đoạn văn (cách nhau bằng dòng trống) và `**đậm**`.

## Bước 8 — Đăng ký

- Web (3 file trong `apps/web/src/games/`): `catalog.ts` (definition + i18n, không React), `client-registry.ts` (Board + configFields + PieceIcon), `bots.ts` (bot, chạy trong Web Worker).
- Web: thêm `@import '@bg/game-<id>/theme.css';` vào `apps/web/src/app/globals.css` và id vào `transpilePackages` trong `apps/web/next.config.ts`.
- Server: thêm definition và bot vào 2 map trong `apps/server/src/registry.ts`.
- Thêm dependency `@bg/game-<id>` vào `apps/web` và `apps/server` (`pnpm --filter @bg/web add "@bg/game-<id>@workspace:*"`, tương tự cho server).
- Nếu game đang nằm trong `UPCOMING_GAMES` (`apps/web/src/games/catalog.ts`) thì xoá khỏi đó và xoá key `upcoming.<id>` trong i18n của web.
- Thêm một file E2E `e2e/<id>.spec.ts` (ít nhất: một nước đi ở chế độ 2 người, bot trả lời).
- Seed `GameSetting` cho game (enabled = false nếu chưa muốn công khai).

## Bước 9 — Hoàn thành khi

- [ ] `docs/games/<id>.md` đầy đủ và khớp với code
- [ ] `pnpm lint` (chạy ở gốc) và `pnpm --filter @bg/game-<id> typecheck test` pass, coverage `rules/` ≥ 90%
- [ ] Chơi thử được bằng `local` và `bot` trên giao diện (desktop + viewport 360px)
- [ ] Có E2E smoke test cho `private-room`
- [ ] Không có file nào trong `packages/engine` hoặc `apps/server/src` (ngoài registry) bị sửa. Nếu thấy cần sửa lõi → dừng lại và đề xuất ADR với người dùng
- [ ] Chạy skill `bg-docs-sync`

## Yêu cầu thêm theo tag

| Tag            | Phải làm thêm                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chance`       | Mọi xúc xắc, xáo bài đều qua `ctx.rng`; test "cùng seed → cùng kết quả"; UI có animation xúc xắc mà không lộ kết quả trước                                                  |
| `hidden-info`  | State tách `public` / `private[seat]`; `playerView` chỉ trả phần được phép; test `assertNoHiddenLeak`; bot chỉ đọc view (B4); `lastMove` gửi cho đối thủ phải được làm sạch |
| `multi-player` | `activePlayers` xử lý cả trường hợp người chơi bị loại; `onPlayerEliminated` không làm kết thúc ván nếu vẫn còn ≥ 2 người; UI hiển thị được N người                         |
| `simultaneous` | `activePlayers` trả về nhiều ghế; state lưu nước đi đang chờ của từng ghế; chỉ "lật" kết quả khi đã nhận đủ; `playerView` ẩn nước đi đang chờ của người khác                |
