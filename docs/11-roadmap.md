# 11 — Roadmap

> Ước lượng cho 1–2 dev. Mỗi milestone kết thúc bằng một bản demo chạy được.

## M0 — Nền móng (1 tuần)

- [x] Monorepo pnpm + Turborepo; tsconfig, eslint, prettier dùng chung ở gốc repo
- [x] `@bg/engine`: types, `runMove`, `createRng`, test harness
- [x] CI: lint, typecheck, test
- [x] docker compose: postgres, redis

## M1 — Chơi local (2 tuần)

- [x] `@bg/game-caro` đầy đủ (rules, UI, bot 3 cấp, test, i18n)
- [x] `@bg/game-four-in-a-row` (rules, UI, bot 3 cấp, test, E2E)
- [x] `apps/web`: trang danh mục, trang game, màn chơi với `LocalMatch` / `useLocalMatch`
- [x] `@bg/ui`: `GridBoard`, `BoardProps`, `VisuallyHidden`; i18n vi/en (next-intl, cookie)
- [x] `@bg/bots`: random / greedy / minimax (alpha-beta, iterative deepening), `playArena`
- [x] E2E Playwright (desktop + mobile) cho Caro
- [x] Bot chạy trong Web Worker
- **Demo:** chơi Caro và Bốn trong hàng, hot-seat và với bot.

## M2 — Online phòng riêng (3 tuần)

- [x] `@bg/protocol`, `apps/server` (Fastify + Socket.IO, Redis adapter)
- [x] Tài khoản khách + đăng ký/đăng nhập email, nâng cấp khách giữ lịch sử, JWT (Google OAuth: để sau, cần client ID)
- [x] `GameHub`: phòng, ghế, sẵn sàng, bot trong phòng, đồng hồ (Fischer / mỗi nước), xin hòa, đầu hàng, chơi lại, reconnect + thời gian chờ
- [x] Lưu users / matches / match_players / match_moves vào PostgreSQL (Kysely, ADR-0004)
- [x] Chat (lọc từ ngữ cơ bản)
- [x] Web: tạo phòng, link mời, vào bằng mã, sảnh chờ, ván online, trang tài khoản
- [x] Hẹn giờ dùng chung qua Redis: job lưu ở Redis, process nào cũng chạy được, sống sót qua khởi động lại (docs/06 §4)
- **Demo:** 2 người ở 2 máy chơi Caro qua link mời.

## M3 — Mở rộng game (3 tuần)

- [x] `@bg/game-reversi` (mất lượt tự động, 6/8/10)
- [x] `@bg/game-xiangqi` (đủ luật đi quân, lộ mặt tướng, chiếu bí/hết nước; lặp lại 3 lần và 60 nước không ăn quân = hòa, xem spec)
- [x] Xem lại ván (`/replay/[id]`), lịch sử và thống kê (`/profile`), API `GET /api/me/matches`, `GET /api/matches/:id`
- [ ] Luật chiếu/đuổi liên tục chính thức của Cờ tướng (hiện: lặp lại 3 lần = hòa)
- [ ] Lưu ván local / với máy vào IndexedDB (hiện: không lưu)
- **Demo:** 4 game MVP chơi được ở mọi mode → **phát hành MVP**.

## M4 — Cạnh tranh (3 tuần)

- [x] Quick-match, ranked, Glicko-2, bảng xếp hạng (`/queue`, `/leaderboard`, điểm trong hồ sơ và trong phòng)
- [x] Spectate: `/live` liệt kê ván ghép trận đang chơi; vào phòng bằng mã thì xem với view của người xem
- [ ] Admin: bật/tắt game, báo cáo người chơi
- [ ] Cờ vua, Cờ đam, Ô ăn quan, Cờ gánh

## M5 — Đa dạng cơ chế (4 tuần)

- [ ] Cá ngựa (chance, 2–4 người) → kiểm chứng RNG và multi-player
- [ ] Bắn tàu (hidden-info) → kiểm chứng `playerView` và test chống lộ thông tin
- [ ] Correspondence mode + thông báo

## Sau đó

Tournament · Tiến lên · PWA offline · Cấu hình biến thể luật nâng cao.
