# O-06 — Giao thức & dữ liệu khu "Văn phòng"

## 1. Socket.IO namespace `/office`

- Handshake giống board game: `auth = { token, protocolVersion }`. Rate limit 10 sự kiện/giây/socket; riêng
  `office:react` 3 lần/2 giây, `office:update-me` 1 lần/giây.
- Mọi payload parse bằng zod (`packages/protocol/src/office.ts`); ack `{ ok: true, data } | { ok: false, code }`.

### 1.1 Client → server

| Sự kiện            | Payload                                                                                                        | Ai gửi         | Ack trả về                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------- |
| `office:create`    | `{ activityId, title, settings }`                                                                              | bất kỳ         | `OfficeSnapshot` (bạn là chủ trì) |
| `office:join`      | `{ code, screen: 'participant' \| 'stage' \| 'host', name?, avatar? }`                                         | bất kỳ         | `OfficeSnapshot`                  |
| `office:leave`     | `{ code }`                                                                                                     | người tham gia | `{}`                              |
| `office:update-me` | `{ code, name?, avatar? }`                                                                                     | người tham gia | `{}`                              |
| `office:host`      | `{ code, op: 'lock' \| 'unlock' \| 'close' \| 'kick' \| 'rename' \| 'add-absent' \| 'transfer', … }`           | chủ trì        | `{}`                              |
| `office:action`    | `{ code, action }` (`action` theo `actionSchema` của hoạt động)                                                | tùy hoạt động  | `{}`                              |
| `office:react`     | `{ code, emoji }`, emoji ∈ `OFFICE_REACTIONS` (👏 😂 😮 🎉 ❤️ 🙈); chỉ socket đang ở màn participant của phiên | người tham gia | `{}`                              |
| `office:resync`    | `{ code }`                                                                                                     | bất kỳ         | `OfficeSnapshot`                  |

Màn `stage` và `host` không chiếm chỗ người tham gia (chủ trì muốn tham gia thì vào thêm bằng điện thoại, hoặc bật
`hostParticipates`).

### 1.2 Server → client

| Sự kiện                      | Payload                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `office:participant`         | `{ code, seq, participant }` (vào mới / đổi tên / đổi avatar / online-offline)                                                          |
| `office:participant-removed` | `{ code, seq, id, reason: 'left' \| 'kicked' }`                                                                                         |
| `office:session`             | `{ code, seq, session: { code, activityId, title, status, hostId } }`                                                                   |
| `office:activity`            | `{ code, seq, view }` (view của hoạt động cho màn của bạn)                                                                              |
| `office:kicked`              | `{ code }` chỉ gửi cho người bị mời ra; socket của họ rời các kênh của phiên                                                            |
| `office:draw-started`        | `{ code, seq, draw: { drawId, round, mode, n, candidates: [{ id, name, avatar }], commitment, startsAt, revealAt } }` — không có `seed` |
| `office:draw-revealed`       | `{ code, seq, draw: DrawRecord }` = phần trên + `seed, winners, revealedAt`; landing kết thúc ở `revealAt + DRAW_LANDING_MS`            |
| `office:reaction`            | `{ code, from, emoji }` chỉ gửi tới màn stage và host (không có `seq`, không lưu)                                                       |

Kênh Socket.IO: `office:{code}` (mọi màn), `office:{code}:{screen}` (view theo màn), `office-user:{userId}`.
Người tham gia chưa bấm "Vào phiên" xem trước bằng màn `stage`.

`seq` tăng mỗi thay đổi; client thấy khoảng trống `seq` thì gọi `office:resync`.

### 1.3 `OfficeSnapshot`

```ts
{
  code, activityId, title, status: 'open' | 'locked' | 'closed', hostId, me: { id, isHost } ,
  participants: Participant[],           // tối đa 200
  activity: View,                        // view của hoạt động theo màn
  draw: DrawRunning | DrawRevealed | null,  // lần bốc đang chạy/vừa xong (để người vào giữa chừng bắt nhịp)
  history: DrawRecord[],                 // các lần bốc đã reveal, mới nhất trước (tối đa 50 trong snapshot)
  seq, serverTime,
}
```

## 2. REST

| Method + path                         | Trả về                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/office/:code`               | `{ exists, status }` — ô nhập mã ở cổng thử mã phiên trước                                                                    |
| `GET /api/me/avatar`                  | `{ avatar: Avatar \| null }`                                                                                                  |
| `PUT /api/me/avatar`                  | body `{ avatar }` → `{ avatar }` (zod, chỉ catalog)                                                                           |
| `GET /api/office/:code/draws`         | `{ draws: DrawRecord[] }` mới nhất trước: phiên còn sống lấy từ snapshot, phiên đã hết hạn lấy từ Postgres (404 nếu không có) |
| `GET /api/office/:code/draws/:drawId` | `DrawRecord` đầy đủ cho trang kiểm chứng (404 nếu chưa reveal)                                                                |

## 3. Mã lỗi

| Code                    | Khi nào                                |
| ----------------------- | -------------------------------------- |
| `office.not_found`      | Mã phiên không tồn tại hoặc đã hết hạn |
| `office.locked`         | Phiên đã khoá, bạn chưa từng vào       |
| `office.full`           | Đủ 200 người                           |
| `office.closed`         | Phiên đã đóng                          |
| `office.not_host`       | Không phải chủ trì                     |
| `office.draw_running`   | Đang có lần bốc chạy                   |
| `office.not_enough`     | Số người còn lại < N                   |
| `office.invalid_avatar` | Avatar ngoài catalog                   |
| `office.rate_limited`   | Gửi quá nhanh                          |

Thêm vào `ERROR_CODES` (protocol) và `errors.*` của i18n web (cả vi và en).

## 4. Postgres (migration `YYYY_MM_DD_NNN_office`)

```
users
  avatar          jsonb      null — Avatar v1

office_sessions
  code            text PK    6 ký tự
  activity_id     text
  title           text
  settings        jsonb
  host_user_id    uuid
  status          text       'open' | 'locked' | 'closed'
  created_at      timestamptz
  closed_at       timestamptz null

office_draws
  id              uuid PK
  session_code    text       → office_sessions.code
  round           integer    thứ tự trong phiên
  mode            text
  n               integer
  candidates      jsonb      [{ id, name, avatar }] tại thời điểm chốt
  commitment      text       hex sha256(seed)
  seed            text       hex; chỉ trả ra API sau revealed_at
  winners         jsonb      [id]
  starts_at       timestamptz  lúc build-up bắt đầu
  reveal_at       timestamptz  lúc landing bắt đầu
  revealed_at     timestamptz  lúc server công bố seed (= reveal_at − 400 ms)
```

Xoá `office_*` cũ hơn 30 ngày bằng job dọn dẹp hằng ngày.

## 5. Redis (live)

| Key                  | Kiểu   | Nội dung                                                                                                                                                                    |
| -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `office:{code}`      | string | JSON **cả phiên** (`OfficeSessionRecord`): trạng thái, chủ trì, người tham gia (≤ 200, ~60 KB), người bị mời ra, state hoạt động, lần bốc đang chạy (O3, gồm `seed` bí mật) |
| `lock:office:{code}` | string | khoá `withLock` (dùng chung cơ chế khoá của LiveStore)                                                                                                                      |
| TTL                  |        | 25 giờ, đặt lại mỗi lần lưu; job `office-expire` đóng phiên sau 24 giờ không hoạt động                                                                                      |
