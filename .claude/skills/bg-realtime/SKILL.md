---
name: bg-realtime
description: Add or change realtime multiplayer behavior — Socket.IO events, @bg/protocol schemas, GameHub (rooms, matches, clocks, bots, reconnect), the gateway, Redis/Postgres stores in apps/server, or useRoom / room screens in apps/web. Use for "chơi online", "phòng", socket events, sync/desync bugs, timers, or server persistence.
---

# Realtime / Multiplayer

Tham chiếu: `docs/05-realtime-protocol.md` (events, vòng đời phòng, reconnect), `docs/06-data-model.md` (Redis, Postgres),
`docs/03-architecture.md` §5 (luồng nước đi), ADR-0003, ADR-0004.

## Bản đồ code

| Việc                                                                             | File                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Schema payload, kiểu snapshot, mã lỗi                                            | `packages/protocol/src/schemas.ts`, `events.ts`, `rest.ts`                                              |
| Mọi logic phòng/ván (khóa, đồng hồ, bot, mất kết nối)                            | `apps/server/src/hub/game-hub.ts`                                                                       |
| Socket: xác thực handshake, rate limit, validate, ack, gửi view riêng từng người | `apps/server/src/realtime/gateway.ts`                                                                   |
| REST auth                                                                        | `apps/server/src/http/routes.ts`, `auth/*`                                                              |
| Lưu trữ                                                                          | `store/live-store.ts` (memory), `store/redis-live-store.ts`, `store/repos.ts` (memory), `db/*` (Kysely) |
| Game nào server hỗ trợ                                                           | `apps/server/src/registry.ts`                                                                           |
| Client: kết nối, phiên, đồng bộ phòng                                            | `apps/web/src/online/{socket,session,use-room}.ts`                                                      |
| Màn phòng                                                                        | `apps/web/src/features/room/*`                                                                          |

## Thêm hoặc sửa một socket event

1. Thêm schema zod vào `packages/protocol/src/schemas.ts` (dùng `z.strictObject`) và khai báo event trong `ClientToServerEvents` (`events.ts`) **trước**.
2. Thêm method vào `GameHub` (logic) rồi một dòng `on('<event>', Schema, (input) => hub.method(actor, input))` trong `gateway.ts`. Wrapper `on` đã lo: rate limit → zod → gọi handler → ack `{ok:true,data}` hoặc `{ok:false,code}`.
3. Lỗi nghiệp vụ: `throw new HubError('<namespace>.<code>')`. Thêm mã vào `ERROR_CODES`, vào bảng ở docs/05 §7 và vào `errors.*` trong `apps/web/src/i18n/{vi,en}.json`.
4. Client: thêm hàm trong `useRoom` (dùng `act(event, payload)`), cập nhật UI.
5. Test: `apps/server/test/hub.test.ts` (logic, đồng hồ giả) + `server.test.ts` (qua socket thật).
6. Cập nhật bảng event ở docs/05.

## Bất biến của GameHub (không được phá)

- Mọi thay đổi phòng hoặc ván nằm trong `store.withLock(roomId, …)`. Hẹn giờ và bot cũng vậy: bot **suy nghĩ ngoài khóa**, rồi vào khóa kiểm tra `seq` chưa đổi mới áp dụng.
- Nước đi chỉ đi qua `runMove` (kể cả của bot). Thứ tự: kiểm tra người chơi → `clientMoveId` đã xử lý? → hết giờ? → `seq` → `runMove` → đồng hồ → `seq++` → `commit` (lưu, ghi lịch sử, thông báo, hẹn giờ tiếp).
- Gửi `match:state` **riêng từng người** với `playerView(state, seat)`; người xem nhận bản `'spectator'`. Không bao giờ gửi full state hay `seed` (có test `hidden information`).
- Mọi thay đổi người chơi cần thấy phải `match.seq++`.
- Thời gian lấy từ `now()` được truyền vào (để test dùng đồng hồ giả), không gọi `Date.now()` trực tiếp trong hub.
- Ghi lịch sử là best effort (`this.history(...)`): lỗi DB không được làm hỏng ván.

## Phía client

- Server là nguồn sự thật; client **không** tự áp dụng nước đi (chưa có optimistic UI). Bàn cờ bị khóa khi đang chờ ack.
- `useRoom` tự `room:join` lại sau mỗi lần socket `connect`. Bỏ qua `match:state` có `seq` nhỏ hơn bản đang có. `match.stale_seq` → `match:resync`.
- Đồng hồ hiển thị đếm ngược từ thời điểm nhận snapshot (`receivedAt`), không dựa vào giờ máy client.
- Token không hợp lệ (server dev khởi động lại) → tự tạo khách mới và kết nối lại (`socket.ts`).

## Test bắt buộc

- `pnpm --filter @bg/server test`: hub (đồng hồ giả + `ManualScheduler`) và socket thật trong bộ nhớ.
- `docker compose up -d` rồi `pnpm --filter @bg/server test:integration`: Redis, Postgres, 2 server dùng chung Redis.
- `pnpm e2e`: `e2e/online.spec.ts` (2 trình duyệt chơi qua link mời).
