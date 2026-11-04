# 06 — Data Model

## 1. PostgreSQL (Prisma)

```prisma
model User {
  id           String   @id @default(cuid())
  kind         UserKind @default(GUEST)      // GUEST | REGISTERED
  displayName  String
  email        String?  @unique
  passwordHash String?
  avatarUrl    String?
  locale       String   @default("vi")
  createdAt    DateTime @default(now())
  players      MatchPlayer[]
  ratings      Rating[]
}

model GameSetting {                          // admin bật/tắt game, không chứa luật
  gameId    String  @id                      // trùng GameMeta.id
  enabled   Boolean @default(true)
  disabledVariants String[] @default([])
  sortOrder Int     @default(0)
}

model Match {
  id            String      @id @default(cuid())
  gameId        String
  rulesVersion  Int
  config        Json                         // đã parse qua configSchema
  timeControl   Json?
  mode          MatchMode                    // LOCAL | BOT | PRIVATE | QUICK | RANKED | CORRESPONDENCE
  seed          String                       // chỉ công khai khi ván đã kết thúc
  status        MatchStatus                  // PLAYING | FINISHED | ABORTED
  result        Json?                        // GameResult
  startedAt     DateTime    @default(now())
  endedAt       DateTime?
  players       MatchPlayer[]
  moves         MatchMove[]
  @@index([gameId, endedAt])
}

model MatchPlayer {
  matchId   String
  seat      Int
  userId    String?                          // null nếu là bot
  botLevel  String?
  outcome   String?                          // win | loss | draw
  ratingBefore Float?
  ratingAfter  Float?
  match     Match @relation(fields: [matchId], references: [id])
  user      User? @relation(fields: [userId], references: [id])
  @@id([matchId, seat])
  @@index([userId])
}

model MatchMove {
  matchId   String
  index     Int                              // 0-based, = moveIndex dùng cho createRng
  seat      Int
  move      Json
  elapsedMs Int                              // thời gian suy nghĩ cho nước này
  createdAt DateTime @default(now())
  match     Match @relation(fields: [matchId], references: [id])
  @@id([matchId, index])
}

model Rating {
  userId     String
  gameId     String
  rating     Float  @default(1500)
  deviation  Float  @default(350)            // Glicko-2
  volatility Float  @default(0.06)
  games      Int    @default(0)
  user       User @relation(fields: [userId], references: [id])
  @@id([userId, gameId])
  @@index([gameId, rating])
}
```

Ván `LOCAL` mặc định **không** lưu trên server. Ván `BOT` chỉ lưu khi người chơi đã đăng nhập.

## 2. Redis keys

| Key                                 | Kiểu       | Nội dung                                             | TTL                             |
| ----------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------- |
| `room:{roomId}`                     | JSON       | RoomSnapshot nội bộ (host, seats, status, config)    | 24 giờ kể từ lần hoạt động cuối |
| `room:code:{code}`                  | string     | → roomId                                             | như trên                        |
| `match:{matchId}`                   | JSON       | `{ state, seq, seed, clocks, moveCount }`            | 1 giờ sau khi kết thúc          |
| `lock:match:{matchId}`              | string     | khóa xử lý nước đi (SET NX PX 2000)                  | 2 giây                          |
| `queue:{gameId}:{variant}:{ranked}` | sorted set | userId, điểm = rating                                | —                               |
| `presence:{matchId}`                | hash       | seat → `online` hoặc timestamp hết hạn chờ reconnect | 1 giờ                           |

## 3. Quy tắc dữ liệu

- `Match.config` luôn là output của `configSchema.parse()`, đã điền đủ default.
- `MatchMove` chỉ chứa **nước đi đã được chấp nhận**, theo đúng thứ tự `index`.
- Dựng lại ván: `setup(config, players, {rng: createRng(seed, -1)})`, sau đó với mỗi move `i`: `applyMove(..., {rng: createRng(seed, i)})`.
- Xóa tài khoản: ẩn danh hóa `User` (đổi tên thành "Người chơi đã xóa"), giữ lại `Match` để không làm hỏng lịch sử của người khác.
