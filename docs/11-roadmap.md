# 11 — Roadmap

> Ước lượng cho 1–2 dev. Mỗi milestone kết thúc bằng một bản demo chạy được.

## M0 — Nền móng (1 tuần)

- [x] Monorepo pnpm + Turborepo; tsconfig, eslint, prettier dùng chung ở gốc repo
- [x] `@bg/engine`: types, `runMove`, `createRng`, test harness
- [x] CI: lint, typecheck, test
- [x] docker compose: postgres, redis

## M1 — Chơi local (2 tuần)

- [x] `@bg/game-caro` đầy đủ (rules, UI, bot 3 cấp, test, i18n)
- [ ] `@bg/game-four-in-a-row`
- [x] `apps/web`: trang danh mục, trang game, màn chơi với `LocalMatch` / `useLocalMatch`
- [x] `@bg/ui`: `GridBoard`, `BoardProps`, `VisuallyHidden`; i18n vi/en (next-intl, cookie)
- [x] `@bg/bots`: random / greedy / minimax (alpha-beta, iterative deepening), `playArena`
- [x] E2E Playwright (desktop + mobile) cho Caro
- [x] Bot chạy trong Web Worker
- **Demo:** chơi Caro và Bốn trong hàng, hot-seat và với bot.

## M2 — Online phòng riêng (3 tuần)

- [ ] `@bg/protocol`, `apps/server` (Fastify + Socket.IO)
- [ ] Tài khoản khách + đăng ký, JWT
- [ ] RoomService, MatchService, đồng hồ, reconnect
- [ ] Lưu Match/MatchMove vào PostgreSQL
- [ ] Chat
- **Demo:** 2 người ở 2 máy chơi Caro qua link mời.

## M3 — Mở rộng game (3 tuần)

- [ ] `@bg/game-reversi` (kiểm chứng lượt bỏ qua)
- [ ] `@bg/game-xiangqi` (kiểm chứng luật phức tạp, bot minimax)
- [ ] Replay, lịch sử ván, hồ sơ người chơi
- **Demo:** 4 game MVP chơi được ở mọi mode → **phát hành MVP**.

## M4 — Cạnh tranh (3 tuần)

- [ ] Quick-match, ranked, Glicko-2, bảng xếp hạng
- [ ] Spectate
- [ ] Admin: bật/tắt game, báo cáo người chơi
- [ ] Cờ vua, Cờ đam, Ô ăn quan, Cờ gánh

## M5 — Đa dạng cơ chế (4 tuần)

- [ ] Cá ngựa (chance, 2–4 người) → kiểm chứng RNG và multi-player
- [ ] Bắn tàu (hidden-info) → kiểm chứng `playerView` và test chống lộ thông tin
- [ ] Correspondence mode + thông báo

## Sau đó

Tournament · Tiến lên · PWA offline · Cấu hình biến thể luật nâng cao.
