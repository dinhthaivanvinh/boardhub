# 06 — Data Model

> Cập nhật: 2026-11-05 (M2). Dùng **Kysely + pg** thay cho Prisma, xem [ADR-0004](adr/0004-kysely-and-optional-services.md).

## 1. PostgreSQL

Schema và migration nằm trong code: `apps/server/src/db/database.ts` (server tự chạy migration khi khởi động).
**Không sửa migration đã chạy**; thêm migration mới với tên `YYYY_MM_DD_NNN_<mô tả>`.

```
users
  id             uuid PK
  kind           text      'guest' | 'registered'
  display_name   text
  email          text      UNIQUE, null với khách
  password_hash  text      scrypt$N$r$p$salt$hash, null với khách
  created_at     timestamptz default now()

matches
  id             uuid PK
  room_code      text
  game_id        text
  rules_version  integer
  config         jsonb     output của configSchema (đã điền default)
  time_control   jsonb
  seed           text      bí mật cho đến khi ván kết thúc
  status         text      'playing' | 'finished'
  result         jsonb     GameResult, null khi đang chơi
  started_at     timestamptz
  ended_at       timestamptz
  INDEX (game_id, ended_at)

match_players                      PK (match_id, seat)
  match_id   uuid → matches (cascade)
  seat       integer
  user_id    uuid → users, null nếu là bot      INDEX
  bot_level  text, null nếu là người

match_moves                        PK (match_id, idx)
  match_id   uuid → matches (cascade)
  idx        integer   = moveIndex dùng cho createRng(seed, idx)
  seat       integer
  move       jsonb     chỉ nước đi đã được chấp nhận
  elapsed_ms integer   thời gian suy nghĩ cho nước này
  created_at timestamptz
```

Rating (Glicko-2) và cài đặt game của admin sẽ thêm ở M4.

Không có `DATABASE_URL` thì server dùng bản trong bộ nhớ (`MemoryUserRepo`, `MemoryHistoryRepo`): chỉ dành cho dev,
mất khi khởi động lại. Ván `local` và ván với bot ở trình duyệt không lưu lên server.

## 2. Redis (live store)

Code: `apps/server/src/store/redis-live-store.ts`. Giá trị là JSON, TTL 24 giờ kể từ lần ghi cuối.

| Key                | Kiểu          | Nội dung                                                                                     |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `room:{roomId}`    | string (JSON) | `Room`: ghế, người xem, trạng thái, cấu hình, `matchId`                                      |
| `room:code:{code}` | string        | → `roomId`                                                                                   |
| `match:{matchId}`  | string (JSON) | `MatchRecord`: full state, `seq`, seed, danh sách nước, đồng hồ, `processedMoveIds`, kết quả |
| `chat:{roomId}`    | list          | 50 tin nhắn cuối (JSON)                                                                      |
| `lock:{roomId}`    | string        | khóa `SET NX PX 5000` + token, nhả bằng Lua compare-and-delete                               |

Mọi thay đổi phòng/ván chạy trong `withLock(roomId)`, kể cả hẹn giờ và bot. Socket.IO dùng `@socket.io/redis-adapter`
để broadcast giữa nhiều process (có test tích hợp với 2 server).

Không có `REDIS_URL` thì dùng `MemoryLiveStore` (một process, mất khi khởi động lại).

## 3. Quy tắc dữ liệu

- `matches.config` luôn là output của `configSchema.parse()`.
- Dựng lại ván: `setupMatch(def, config, players, seed)` rồi lần lượt `runMove` với `createRng(seed, idx)` (`replayMatch`).
- Ghi lịch sử là "best effort": lỗi DB được log nhưng không làm hỏng ván đang chơi.
- Xóa tài khoản (sau này): ẩn danh hóa `users`, giữ `matches` để không làm hỏng lịch sử của người khác.

## 4. Giới hạn hiện tại

- Hẹn giờ (đồng hồ, thời gian chờ kết nối lại, lượt của bot) nằm trong process đã tạo ra nó. Process đó khởi động lại thì
  hẹn giờ mất; đồng hồ vẫn được kiểm tra lại khi có nước đi tiếp theo. Cần một hàng đợi hẹn giờ dùng chung (Redis) trước khi chạy nhiều node thật.
