# 06 — Data Model

> Cập nhật: 2026-11-26 (vai trò admin, dữ liệu hoạt động). Dùng **Kysely + pg** thay cho Prisma, xem [ADR-0004](adr/0004-kysely-and-optional-services.md).

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
  avatar         jsonb     con vật đại diện (khu Văn phòng, Avatar v1 — docs/office/05), null nếu chưa tạo
  learn_progress jsonb     tiến độ học cờ { lessons, puzzles, days, daily } (`LearnProgress` trong @bg/protocol): id bài đã xong, id câu đố đã giải, ngày (YYYY-MM-DD) đã giải câu đố; null nếu chưa lưu. Chỉ gồm id và ngày, không có dữ liệu cá nhân
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

Thêm ở M4a (migration `2026_11_06_001_ratings`):

```
ratings                            PK (user_id, game_id)
  user_id, game_id, rating, rd, volatility (Glicko-2), games, wins, losses, draws, updated_at
  INDEX (game_id, rating desc)

matches.ranked                     boolean
match_players.rating_before/after  double (ván tính điểm)
```

Không có `DATABASE_URL`: `MemoryRatingRepo`.

Thêm ở M4b (migration `2026_11_10_001_admin`, repo `apps/server/src/db/pg-admin-repo.ts`):

```
game_settings                      admin bật/tắt game; không có dòng = đang bật
  game_id PK, enabled, updated_at, updated_by (uuid admin)

player_reports
  id uuid PK, reporter_id → users, target_id → users (cascade)
  reason text, note text, room_code text null
  evidence jsonb       [{ text, at }] tin nhắn của người bị báo cáo trong phòng lúc báo cáo (chat chỉ sống 24 giờ ở Redis)
  status 'open' | 'resolved', action 'dismiss' | 'mute' | 'ban' | null
  created_at, resolved_at, resolved_by
  INDEX (status, created_at desc), (target_id), (reporter_id, created_at)

user_sanctions                     PK user_id → users (cascade)
  muted_until, banned_until timestamptz null    đã qua = hết hạn; "đến khi gỡ" = năm 9999
  updated_at, updated_by

daily_visits                       PK (day, visitor_id)   thống kê người dùng cho trang admin
  day text             YYYY-MM-DD theo giờ Việt Nam (cố định +7)
  visitor_id text      mã ngẫu nhiên do trình duyệt tự tạo; không phải tên, email hay địa chỉ mạng
  kind text            anonymous | guest | registered: mức cao nhất của người đó trong ngày (đăng nhập sau thì nâng lên)
  Giữ 90 ngày; ngày cũ bị xoá khi có lượt vào đầu tiên của mỗi ngày.
```

Thêm ở migration `2026_11_26_001_admin_roles_activity` ([ADR-0013](adr/0013-admin-roles-and-activity-data.md)):

```
roles                              id text PK: super_admin | content_manager | moderator | analyst (migration tạo sẵn)

user_roles                         PK (user_id, role_id)   vai trò admin của từng tài khoản
  user_id → users (cascade), role_id → roles
  granted_by uuid null (null = server tự cấp Super Admin đầu tiên), granted_at       INDEX (role_id)

users.last_seen_at                 timestamptz null: lần dùng tài khoản gần nhất (ghi tối đa 5 phút một lần);
                                   null nếu chưa dùng từ khi có cột này

daily_visits.sessions              integer, mặc định 1: số phiên trong ngày (vắng từ 30 phút rồi quay lại là phiên mới).
                                   Dòng có trước migration được tính là 1

learn_events                       PK (actor, day, kind, item_id)   việc học đã hoàn thành, ghi lúc xảy ra
  day text                         YYYY-MM-DD theo giờ Việt Nam
  actor text                       'u:<user id>' khi đã đăng nhập, ngược lại 'v:<mã ngẫu nhiên của trình duyệt>'
  user_id uuid null → users (cascade)
  kind text                        lesson | practice | puzzle
  item_id text                     chỉ id có trong nội dung học
  created_at timestamptz           lần đầu trong ngày
  INDEX (day), (user_id)
  Giữ 400 ngày. Học trước khi có bảng này không được ghi lại.
```

Không có `DATABASE_URL`: `MemoryAdminRepo`, `MemoryVisitRepo` và `MemoryLearnEventRepo`.

Không có `DATABASE_URL` thì server dùng bản trong bộ nhớ (`MemoryUserRepo`, `MemoryHistoryRepo`): chỉ dành cho dev,
mất khi khởi động lại. Ván `local` và ván với bot ở trình duyệt không lưu lên server.

## 1b. Lịch sử ván trên trình duyệt (IndexedDB)

Code: `apps/web/src/game-runtime/local-history.ts`. Database `bg-local`, object store `matches` (keyPath `id`, index `endedAt`).
Ván với máy và 2 người cùng máy được lưu **khi kết thúc** (đi lại rồi kết thúc lần nữa thì ghi đè cùng `id`); giữ 200 ván mới nhất.

```
LocalMatchRecord
  id            32 ký tự hex (route /replay/local/[id])
  gameId, rulesVersion, mode 'bot' | 'local'
  config, seed, moves [{ seat, move }]     đủ để dựng lại mọi thế cờ, như ván online (§3)
  players [{ seat, botLevel | null }]       null = người chơi ở máy này
  result GameResult (kể cả đầu hàng), startedAt, endedAt
```

Chỉ ở trình duyệt này, không gửi lên server; không có IndexedDB (một số chế độ ẩn danh) thì không lưu và danh sách trống.
`rulesVersion` khác bản hiện tại mà không dựng lại được thì màn xem lại báo "luật chơi có thể đã thay đổi".

## 2. Redis (live store)

Code: `apps/server/src/store/redis-live-store.ts`. Giá trị là JSON, TTL 24 giờ kể từ lần ghi cuối.

| Key                | Kiểu          | Nội dung                                                                                     |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `room:{roomId}`    | string (JSON) | `Room`: ghế, người xem, trạng thái, cấu hình, `matchId`                                      |
| `room:code:{code}` | string        | → `roomId`                                                                                   |
| `match:{matchId}`  | string (JSON) | `MatchRecord`: full state, `seq`, seed, danh sách nước, đồng hồ, `processedMoveIds`, kết quả |
| `chat:{roomId}`    | list          | 50 tin nhắn cuối (JSON)                                                                      |
| `lock:{roomId}`    | string        | khóa `SET NX PX 5000` + token, nhả bằng Lua compare-and-delete                               |
| `jobs:due`         | sorted set    | khóa job → thời điểm đến hạn (ms)                                                            |
| `jobs:data`        | hash          | khóa job → `{ v, job }` (JSON). `job` là `{kind: clock\|grace\|bot, …}`                      |
| `queue:{bucket}`   | hash          | userId → `QueueEntry` (tên, điểm, lúc vào hàng). `bucket` = `gameId\|preset\|ranked\|casual` |
| `queue:buckets`    | set           | các bucket đang có người                                                                     |
| `queue:user:{id}`  | string        | → bucket hiện tại của người đó (mỗi người ở tối đa một hàng)                                 |
| `rooms:live`       | set           | id các phòng công khai đang có ván                                                           |

Mọi thay đổi phòng/ván chạy trong `withLock(roomId)`, kể cả hẹn giờ và bot. Socket.IO dùng `@socket.io/redis-adapter`
để broadcast giữa nhiều process (có test tích hợp với 2 server).

Không có `REDIS_URL` thì dùng `MemoryLiveStore` (một process, mất khi khởi động lại).

## 3. Quy tắc dữ liệu

- `matches.config` luôn là output của `configSchema.parse()`.
- Dựng lại ván: `setupMatch(def, config, players, seed)` rồi lần lượt `runMove` với `createRng(seed, idx)` (`replayMatch`).
- Ghi lịch sử là "best effort": lỗi DB được log nhưng không làm hỏng ván đang chơi.
- Xóa tài khoản (sau này): ẩn danh hóa `users`, giữ `matches` để không làm hỏng lịch sử của người khác.

## 4. Hẹn giờ dùng chung (`apps/server/src/hub/scheduler.ts`)

Đồng hồ, thời gian chờ kết nối lại và lượt của bot là **job dạng dữ liệu** (không phải closure), lưu ở `jobs:due` / `jobs:data`.

- Mỗi process quét job đến hạn mỗi 100 ms bằng một script Lua nguyên tử, nên hai process không nhận trùng một job.
- Job được nhận bị đẩy lùi một **lease** (15 s): nếu process chết khi đang chạy, hết lease thì process khác chạy lại.
  Vì thế handler (`GameHub.runJob`) phải **idempotent**: mọi nhánh tự kiểm tra lại trạng thái (đã có kết quả? còn đúng `seq`? đã hết giờ thật chưa?).
- Hẹn lại cùng khóa thì thay job cũ; mỗi lần hẹn có `v` riêng, nên việc xác nhận của một lần chạy cũ không xoá job mới.
- Handler lỗi thì log rồi bỏ job (không thử lại mãi); trường hợp process chết hẳn là việc của lease.
- Đồng hồ các máy chủ phải đồng bộ (NTP) vì thời điểm đến hạn so với giờ của từng process.
- Không có `REDIS_URL`: dùng `TimerJobScheduler` (setTimeout trong process, mất khi khởi động lại).

Có test tích hợp: 2 process chia việc và mỗi job chạy đúng 1 lần; process sập giữa chừng thì process khác chạy lại;
server tạo ván bị tắt thì server còn lại vẫn xử thua người hết giờ.
