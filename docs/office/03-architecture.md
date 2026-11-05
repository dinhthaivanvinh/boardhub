# O-03 — Kiến trúc khu "Văn phòng"

## 1. Nguyên tắc

1. **Dùng chung hạ tầng, không dùng chung lõi luật.** Khu Văn phòng dùng lại: danh tính khách/tài khoản, JWT,
   Socket.IO gateway + Redis adapter, `store.withLock`, `JobScheduler`, Postgres/Kysely, i18n, `@bg/ui`.
   Nhưng hoạt động văn phòng **không** phải `GameDefinition`: có chủ trì, tới 200 người vào/ra tự do, không có lượt
   ([ADR-0005](../adr/0005-office-activities-contract.md)).
2. **Hoạt động là plugin thuần**, giống game: `ActivityDefinition` không I/O, không `Math.random`, không `Date`;
   ngẫu nhiên đến từ `seed` do server cấp ([O-04](04-activity-spec.md)).
3. **Server là nguồn sự thật**, ngẫu nhiên chỉ ở server, có commit–reveal ([ADR-0006](../adr/0006-fair-draw-commit-reveal.md)).
4. **Thêm hoạt động không sửa lõi**: một gói mới + một dòng đăng ký (như game).
5. **Gửi thay đổi, không gửi lại cả phiên**: danh sách 200 người chỉ gửi trọn khi vào/kết nối lại.

## 2. Sơ đồ

```
 Điện thoại (người tham gia)     Laptop chủ trì            Máy chiếu (Sân khấu)
 /office/s/ABC123                /office/s/ABC123/host     /office/s/ABC123/screen
        │  socket /office               │                          │
        └───────────────┬───────────────┴──────────────────────────┘
                        ▼
              apps/server (Fastify + Socket.IO)
              ├─ realtime/gateway.ts       namespace "/"       → GameHub (board game, giữ nguyên)
              └─ office/office-gateway.ts  namespace "/office" → OfficeHub
                    │  withLock(sessionCode) · JobScheduler (reveal, hết hạn)
                    │  OFFICE_ACTIVITIES registry (lucky-animal, …)
                    ▼
              LiveStore (memory | Redis): phiên + người tham gia + lần bốc đang chạy
              Postgres: users.avatar, office_sessions, office_draws (lịch sử, kiểm chứng)
```

## 3. Gói và thư mục mới

```
packages/
├─ avatars/                 @bg/avatars — dữ liệu + vẽ con vật (dùng chung web, thẻ PNG, kiểm thử)
│  ├─ src/schema.ts         AvatarSchema (zod), giới hạn, giá trị mặc định
│  ├─ src/catalog.ts        loài, hoa văn, mắt, phụ kiện, bảng màu (id ổn định)
│  ├─ src/render/*.tsx      <Avatar avatar size /> vẽ SVG theo lớp
│  ├─ src/random.ts         randomAvatar(rng) — rng truyền vào
│  └─ test/
├─ office-core/             @bg/office-core — hợp đồng hoạt động + bốc thăm công bằng
│  ├─ src/types.ts          ActivityDefinition, Participant, ActivityContext
│  ├─ src/fair-draw.ts      commitment(seed), drawWinners(seed, drawId, candidates, n), verify(...)
│  ├─ src/hash.ts           sha256/hmac (dùng @noble/hashes: chạy giống nhau ở Node và trình duyệt)
│  └─ src/testing/          trợ giúp test cho hoạt động
└─ office/
   └─ lucky-animal/         @bg/office-lucky-animal — hoạt động đầu tiên
      ├─ src/activity.ts    ActivityDefinition
      ├─ src/ui/            màn chủ trì, sân khấu, người tham gia; các hiệu ứng bốc (wheel, race…)
      ├─ src/i18n/{vi,en}.json
      └─ test/

apps/server/src/office/
├─ office-hub.ts            vòng đời phiên, quyền chủ trì, bốc thăm, hẹn giờ reveal/hết hạn
├─ office-gateway.ts        namespace /office: xác thực, rate limit, zod, ack
├─ registry.ts              OFFICE_ACTIVITIES: một dòng mỗi hoạt động
└─ store.ts                 phần lưu trữ phiên (memory / Redis)

packages/protocol/src/office.ts   schema zod + kiểu sự kiện của khu Văn phòng

apps/web/src/
├─ app/board-games/page.tsx       danh mục board game (chuyển từ "/")
├─ app/office/…                   /office, /office/new, /office/avatar, /office/s/[code](/host|/screen|/verify)
├─ features/office/*              màn hình, studio avatar, trình phát hiệu ứng
├─ office/use-office-session.ts   socket + đồng bộ phiên (giống useRoom)
└─ office/registry.ts             UI của từng hoạt động (giống client-registry)
```

`pnpm-workspace.yaml` thêm `packages/office/*`.

## 4. Luồng vào phiên

1. Điện thoại mở `/office/s/ABC123` → `ensureToken()` (khách) → lấy avatar đã lưu (`GET /api/me/avatar`), chưa có thì
   mở studio rút gọn.
2. Kết nối namespace `/office`, gửi `office:join { code, avatar, name }`.
3. `OfficeHub.join` trong `withLock(code)`: phiên tồn tại, chưa khoá, < 200 người → thêm/cập nhật người tham gia
   (một `userId` = một người; tab thứ hai của cùng người không tạo bản sao).
4. Ack trả **snapshot đầy đủ** cho người vào; những người khác nhận `office:participant` (một bản ghi thay đổi).
5. Mất kết nối: người đó được đánh dấu `online: false` (không xoá); vào lại giữ nguyên.

## 5. Luồng bốc thăm (đồng bộ + công bằng)

```
Chủ trì  ──office:action {kind:'draw', n, mode}──▶  OfficeHub (withLock)
                                                    1. chốt candidates (sắp theo participantId)
                                                    2. seed = randomBytes(32); commitment = sha256(seed)
                                                    3. winners = drawWinners(seed, drawId, candidates, n)  (giữ bí mật)
                                                    4. startsAt = now + 1.2 s; revealAt = startsAt + buildUp(mode)
                                                    5. lưu, hẹn job "reveal" lúc revealAt − 400 ms
Mọi màn ◀── office:draw-started {drawId, mode, candidates, commitment, startsAt, revealAt}
           (chạy pha "dồn dập" vô hạn: thú chạy, vòng quay nhanh — chưa biết ai thắng)
Job reveal ─▶ OfficeHub: ghi kết quả vào lịch sử
Mọi màn ◀── office:draw-revealed {drawId, seed, winners, landAt: revealAt}
           (pha "về đích" dài cố định, bắt đầu đúng landAt theo giờ server, kết thúc ở người thắng)
```

- Kết quả chỉ rời server ~400 ms trước khi hiệu ứng về đích: không ai (kể cả chủ trì) biết trước.
- Kịch bản hiệu ứng (đường chạy, số vòng quay, ai dẫn trước) suy ra từ `seed` ⇒ mọi màn hình giống hệt nhau.
- Client đổi giờ server sang giờ máy bằng `serverOffset` (đã có ở board game) ⇒ lệch < 200 ms.
- Người vào giữa lúc đang bốc nhận trạng thái bốc hiện tại và nhảy vào đúng thời điểm.

## 6. Lưu trữ

- **Live (Redis/memory):** phiên, người tham gia, lần bốc đang chạy. Khoá theo `office:{code}`.
- **Postgres:** `users.avatar` (jsonb), `office_sessions`, `office_draws` (commitment, seed, candidates, winners) cho
  lịch sử và trang kiểm chứng. Chi tiết: [O-06](06-protocol-and-data.md).
- **Hẹn giờ** dùng `JobScheduler` sẵn có (kind mới: `office-reveal`, `office-expire`), idempotent.

## 7. Quy mô

- Snapshot đầy đủ ~200 × 300 byte ≈ 60 KB, chỉ gửi khi vào/kết nối lại; sau đó chỉ gửi diff ~300 byte.
- Sửa avatar: tối đa 1 lần/giây/người (gộp phía client), cảm xúc: 3 lần/2 giây/người.
- Màn Sân khấu vẽ 200 con vật bằng một `<svg>` có `<symbol>`/`<use>` cho từng con vật đã dựng sẵn; hiệu ứng chạy bằng
  `requestAnimationFrame` cập nhật `transform`, không re-render React mỗi khung.
- Nhiều server: Redis adapter phát sự kiện tới mọi process; khoá và job đã chạy được đa process.

## 8. Bảo mật & riêng tư

- Quyền chủ trì kiểm tra ở server cho mọi `office:action`.
- Phiên khoá: chỉ người đã từng vào mới vào lại được.
- Tên hiển thị ≤ 24 ký tự, cắt khoảng trắng; avatar chỉ chứa id có trong catalog (zod) ⇒ không chèn được nội dung lạ.
- Không gửi `seed` trước khi reveal; `office_draws.seed` chỉ đọc được sau khi reveal.
- Rate limit theo socket như gateway board game.
