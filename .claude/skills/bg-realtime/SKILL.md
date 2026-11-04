---
name: bg-realtime
description: Add or change realtime multiplayer behavior — Socket.IO events, @bg/protocol schemas, RoomService, MatchService, clocks, reconnect, spectators, matchmaking in apps/server or the OnlineMatchClient in apps/web. Use for "chơi online", "phòng", socket events, sync/desync bugs, or timer issues.
---

# Realtime / Multiplayer

Tham chiếu: `docs/05-realtime-protocol.md` (events, vòng đời phòng), `docs/03-architecture.md` mục 5 (luồng nước đi), `docs/06-data-model.md` mục 2 (Redis keys).

## Thêm hoặc sửa một socket event

1. Định nghĩa schema zod trong `packages/protocol/src/events.ts` (payload + ack) **trước**. Event phải được export trong map `ClientToServer` / `ServerToClient` để có type ở cả hai phía.
2. Tên `domain:action`. Thêm field mới thì để optional. Thay đổi breaking thì tăng `PROTOCOL_VERSION` (xem docs/05 mục 7).
3. Handler ở server (`apps/server/src/realtime/handlers/<domain>.ts`):
   ```ts
   on('move:submit', MoveSubmit, async (socket, payload, ack) => { … })
   // wrapper `on` đã: parse zod → rate limit → kiểm tra auth → bắt lỗi → ack {ok:false, code:'internal'}
   ```
4. Lỗi nghiệp vụ thì `ack({ ok: false, code })`, không throw. Thêm mã lỗi mới vào bảng ở docs/05 mục 6 và vào i18n.
5. Cập nhật bảng event ở `docs/05-realtime-protocol.md`.

## Bất biến của MatchService (không được phá)

- Mọi thay đổi state của match đều nằm trong `withMatchLock(matchId, fn)` (Redis `SET NX PX`).
- Thứ tự: kiểm tra `seq` → `runMove` → cập nhật đồng hồ → `seq++` → lưu Redis → nhả lock → broadcast → ghi PG (bất đồng bộ qua hàng đợi).
- Idempotency: nếu `clientMoveId` đã được xử lý thì trả về lại ack cũ, không áp dụng lần nữa.
- Broadcast **từng socket một** với `playerView(state, seat)` của người đó; người xem nhận `playerView(state, 'spectator')`.
  Không bao giờ `io.to(room).emit('match:state', fullState)`.
- `seed` không bao giờ được gửi ra client khi ván chưa kết thúc.
- Đồng hồ: lưu `remainingMs` + `turnStartedAt` (giờ của server). Hết giờ được kiểm tra bằng timer ở server **và** kiểm tra lại khi nhận move (phòng trường hợp timer chạy trễ).
- Nước đi của bot đi qua đúng `runMove` như người chơi, không có đường tắt.

## Phía client (`OnlineMatchClient`)

- Optimistic: áp dụng move vào bản sao cục bộ bằng engine (chỉ với game perfect-info), đánh dấu `pending`. Nhận `move:rejected` thì rollback về snapshot cuối của server.
- Nhận `match:state` thì **thay thế** state cục bộ. Nếu `seq` nhảy cóc thì gửi `match:resync`.
- Đồng hồ hiển thị = `remainingMs - (Date.now() - (serverTime + clockOffset))`; `clockOffset` ước lượng từ ping.

## Test bắt buộc

- Integration (socket.io-client + Redis testcontainer): hai client chơi hết một ván; client gửi trùng `clientMoveId`; gửi `seq` cũ → `match.stale_seq`; ngắt kết nối rồi kết nối lại trong thời gian chờ → vẫn giữ ghế; quá thời gian chờ → bị xử lý theo cấu hình phòng.
- Với game hidden-info: chặn mọi payload gửi cho seat A và assert không chứa dữ liệu private của seat B.
