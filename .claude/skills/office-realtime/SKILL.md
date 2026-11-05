---
name: office-realtime
description: Build or change the realtime side of the office area — OfficeHub (session lifecycle, host permissions, participants, draws, timers), the /office Socket.IO namespace and gateway, @bg/protocol office schemas, live/Redis/Postgres storage for sessions and draws, and use-office-session on the web. Use for "phiên văn phòng", "office:*" events, join/reconnect bugs, host controls (khoá, kick), scaling to 200 participants.
---

# Realtime khu Văn phòng

Đọc trước: `docs/office/03-architecture.md` §4–§8, `docs/office/06-protocol-and-data.md`, ADR-0005.
Nhiều thứ giống board game: xem thêm skill `bg-realtime` (gateway pattern, khoá, job idempotent, `seq`).

## Bản đồ code (theo O-03)

| Việc                                            | File                                             |
| ----------------------------------------------- | ------------------------------------------------ |
| Schema payload, sự kiện, mã lỗi                 | `packages/protocol/src/office.ts`                |
| Logic phiên, quyền chủ trì, bốc thăm            | `apps/server/src/office/office-hub.ts`           |
| Namespace `/office`: auth, rate limit, zod, ack | `apps/server/src/office/office-gateway.ts`       |
| Hoạt động server hỗ trợ                         | `apps/server/src/office/registry.ts`             |
| Lưu phiên/người tham gia (memory, Redis)        | `apps/server/src/office/store.ts`                |
| Postgres: avatar, sessions, draws               | `apps/server/src/db/database.ts` (migration mới) |
| Client: kết nối, đồng bộ `seq`, resync          | `apps/web/src/office/use-office-session.ts`      |

## Thêm/sửa một sự kiện `office:*`

1. Schema zod `z.strictObject` trong `packages/protocol/src/office.ts` + khai báo kiểu sự kiện **trước**.
2. Method trong `OfficeHub`, một dòng `on(...)` trong `office-gateway.ts` (rate limit → zod → handler → ack).
3. Lỗi: `throw new HubError('office.<code>')` → `ERROR_CODES`, bảng mã lỗi O-06 §3, i18n `errors.*` (vi + en).
4. Client: hàm trong `use-office-session`; UI.
5. Test hub (đồng hồ giả, `ManualScheduler`) + socket thật trong bộ nhớ; cập nhật bảng sự kiện O-06.

## Bất biến (không được phá)

- Mọi thay đổi phiên nằm trong `store.withLock('office:' + code, …)`.
- Quyền chủ trì kiểm tra ở hub cho **mọi** `office:host` và hành động chủ trì của hoạt động.
- Một `userId` = một người tham gia; tab thứ hai chỉ thêm socket, không thêm người. Mất kết nối ⇒ `online:false`,
  không xoá; vào lại giữ chỗ.
- **Gửi diff:** người vào nhận snapshot đầy đủ (ack); mọi người khác chỉ nhận `office:participant`/`-removed`.
  Không phát lại cả danh sách 200 người cho mỗi thay đổi (NFR-OFF-02).
- Mọi thay đổi người khác cần thấy ⇒ `seq++`; client thấy hụt `seq` ⇒ `office:resync`.
- Hoạt động chỉ được gọi qua hợp đồng (`validate`/`apply`/`onDrawResult`/`view`); hub không biết chi tiết hoạt động.
- Mỗi màn nhận `view(state, screen, viewerId)` riêng; **không** gửi state đầy đủ, **không** gửi `seed` trước reveal
  (skill `office-fair-draw`).
- Hẹn giờ: `JobScheduler` kind `office-reveal`, `office-expire`; job JSON thuần, idempotent. Không `setTimeout` trong hub.
- Thời gian từ `now()` được truyền vào (test dùng đồng hồ giả).
- Giới hạn: 200 người (`office.full`), tên ≤ 24 ký tự, `update-me` 1/giây, `react` 3/2 giây.

## Test bắt buộc

- Hub: vào/rời/vào lại, khoá, kick, chuyển chủ trì, người không phải chủ trì bị từ chối, 200 người + người 201 bị từ
  chối, hết hạn phiên, job reveal chạy lại không bốc hai lần.
- Socket thật: 3 client (chủ trì, sân khấu, người tham gia) nhận đúng sự kiện; người tham gia không nhận view của chủ trì.
- Integration (Redis, 2 server): sự kiện tới client ở server kia; job reveal chạy đúng một lần.
