# 05 — Realtime Protocol (`@bg/protocol`)

> Cập nhật: 2026-11-05 (M2). Nguồn sự thật là code: `packages/protocol/src/{schemas,events,rest}.ts`.

Transport: Socket.IO (namespace mặc định), server `apps/server` cổng 4000. Mọi payload client → server được
định nghĩa bằng zod trong `@bg/protocol` và **dùng chung** giữa client và server. Không được emit event nào chưa có schema.

## 1. Quy ước

- Tên event: `<domain>:<action>`, ví dụ `room:join`, `move:submit`.
- Client → server **luôn** dùng ack: `socket.emit(event, payload, (res: Ack) => …)`.
- `Ack<T> = { ok: true, data: T } | { ok: false, code: string, params? }`. Nước đi bị từ chối cũng trả qua ack (không có event riêng).
- Mỗi ván có `seq` (tăng 1 sau mỗi thay đổi client cần thấy: nước đi, xin hòa, hết giờ…). `move:submit` gửi kèm `seq` client đang thấy; lệch thì `match.stale_seq` → client gọi `match:resync`.
- Mỗi nước đi có `clientMoveId` (8–64 ký tự, client sinh ngẫu nhiên) để chống áp dụng 2 lần khi gửi lại.
- Handshake: `auth = { token, protocolVersion }` (`HandshakeAuth`). Sai token → lỗi `auth.required`; tài khoản bị khoá → `auth.banned` (web hiện thông báo, không thử lại); sai phiên bản → `protocol.version`.
- Rate limit: 10 event/giây/socket (`rate.limited`). Payload sai schema → `invalid.payload`.

## 2. REST (`/api`)

| Method + path                  | Body                               | Trả về                                                                                                                                 |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/guest`         | `{ displayName? }`                 | `AuthResponse { token, user }`                                                                                                         |
| `POST /api/auth/register`      | `{ email, password, displayName }` | `AuthResponse`. Có token khách trong `Authorization` thì **nâng cấp** tài khoản khách đó (giữ id, FR-AUTH-03)                          |
| `POST /api/auth/login`         | `{ email, password }`              | `AuthResponse`                                                                                                                         |
| `GET /api/me`                  | —                                  | `PublicUser`                                                                                                                           |
| `PATCH /api/me`                | `{ displayName }`                  | `PublicUser`                                                                                                                           |
| `GET /api/me/avatar`           | —                                  | `{ avatar: Avatar                                                                                                                      | null }` con vật đại diện (docs/office/05) |
| `PUT /api/me/avatar`           | `{ avatar }`                       | `{ avatar }`; chỉ nhận avatar thuộc catalog, sai → 400 `office.invalid_avatar`                                                         |
| `GET /api/me/progress`         | —                                  | `{ progress: LearnProgress }` bài đã học, câu đố đã giải, các ngày đã chơi (rỗng nếu chưa lưu)                                         |
| `PUT /api/me/progress`         | `{ progress: LearnProgress }`      | `{ progress }` đã **gộp (hợp)** với bản đang lưu, nên máy offline không xoá được thứ máy khác đã đạt; sai dạng → 400 `invalid.payload` |
| `GET /api/me/matches?limit=`   | —                                  | `{ matches: MatchSummary[] }` ván của người gọi, mới nhất trước (tối đa 100)                                                           |
| `GET /api/matches/:id`         | —                                  | `MatchDetail` (gồm `seed` + danh sách nước) **chỉ khi ván đã kết thúc**; đang chơi → 409 `match.not_finished`; không có → 404          |
| `GET /api/leaderboard/:gameId` | —                                  | `{ gameId, minGames, entries: LeaderboardEntry[] }`: điểm cao nhất, chỉ người có ≥ 5 ván tính điểm                                     |
| `GET /api/me/ratings`          | —                                  | `{ ratings: UserRating[] }` điểm của người gọi theo từng game                                                                          |
| `GET /api/live`                | —                                  | `{ rooms: LiveRoom[] }` các ván công khai (ghép trận) đang chơi, mới nhất trước                                                        |
| `GET /health`                  | —                                  | `{ ok: true }`                                                                                                                         |

Token: JWT HS256, hạn 30 ngày, gửi bằng `Authorization: Bearer …`. Lỗi: `{ code }` với HTTP 400/401/409/429/500.
Giới hạn: `POST /api/auth/guest`, `/register`, `/login` tối đa `AUTH_RATE_LIMIT` (mặc định 20) yêu cầu/phút/địa chỉ, quá thì HTTP 429 `rate.limited`. Ở production server tin `X-Forwarded-For` (`trustProxy`) để tính địa chỉ thật sau proxy của Render.
CORS cho phép `GET, HEAD, POST, PATCH, PUT`.

### 2.1 Quản trị và báo cáo (M4b)

Admin là tài khoản **đã đăng ký** có vai trò `super_admin` (bảng `user_roles`, [ADR-0013](adr/0013-admin-roles-and-activity-data.md)). Khi chưa có Super Admin nào, server cấp vai trò này lúc khởi động cho các tài khoản đã đăng ký có email trong `ADMIN_EMAILS`; không ai đăng ký mới được bằng email trong danh sách đó (trả `auth.email_taken`).
`PublicUser.admin` cho web biết để hiện link "Quản trị". Mọi route `/api/admin/*` kiểm tra lại ở server → 403 `admin.required`.
Schema ở `packages/protocol/src/admin.ts`.

| Method + path                         | Body                                         | Trả về                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/games/status`               | —                                            | `{ disabled: string[] }` công khai; web làm mờ game bị tắt                                                                                                                                                                                              |
| `POST /api/reports`                   | `{ targetUserId, reason, note?, roomCode? }` | `{ id }`. Có `roomCode` thì server lưu kèm ≤ 20 tin nhắn cuối của người bị báo cáo trong phòng                                                                                                                                                          |
| `GET /api/admin/games`                | —                                            | `{ games: AdminGameSetting[] }`                                                                                                                                                                                                                         |
| `PUT /api/admin/games/:gameId`        | `{ enabled }`                                | `AdminGameSetting`                                                                                                                                                                                                                                      |
| `GET /api/admin/reports?status=`      | —                                            | `{ reports: AdminReport[] }` `open` (mặc định) hoặc `resolved`, mới nhất trước, tối đa 100                                                                                                                                                              |
| `POST /api/admin/reports/:id/resolve` | `{ action: dismiss/mute/ban, hours? }`       | `{ report }`. `hours` null = đến khi gỡ; chế tài dài hơn đang có thì giữ nguyên                                                                                                                                                                         |
| `GET /api/admin/sanctions`            | —                                            | `{ users: SanctionedUser[] }` người đang bị cấm chat hoặc khoá                                                                                                                                                                                          |
| `POST /api/visit`                     | `{ visitorId, newSession? }`                 | `{ ok }`. Công khai. Trình duyệt gửi mỗi ngày một lần, khi đăng nhập, và khi bắt đầu phiên mới (vắng từ 30 phút) với `newSession: true`; có `Authorization` thì tính là khách/đã đăng ký, không thì chưa đăng nhập (token sai cũng tính chưa đăng nhập) |
| `POST /api/learn-events`              | `{ visitorId, kind, itemId }`                | `{ ok }`. Công khai, gửi ngay khi xong một bài, một phần luyện tập hay một câu đố (`kind`: `lesson` \| `practice` \| `puzzle`); id không có trong nội dung học → 400. Có token thì lưu theo tài khoản, không thì theo `visitorId`                       |
| `GET /api/admin/stats?from=&to=`      | —                                            | `AdminStats`: `today`, `days` (mới nhất trước), `unique` (người truy cập duy nhất cả khoảng, và số phiên), `previous` (kỳ trước cùng độ dài, `null` nếu dữ liệu không đủ), `since`. Vẫn nhận `?days=` (1–90, mặc định 14)                               |
| `GET /api/admin/overview?from=&to=`   | —                                            | `AdminOverview` cho trang Tổng quan: thẻ số kèm kỳ trước, số liệu từng ngày, số người hoàn thành mỗi bài, 15 hoạt động mới nhất (có tên hiển thị), `learningSince`                                                                                      |
| `PUT /api/admin/users/:id/sanctions`  | `{ mutedUntil?, bannedUntil? }`              | `{ sanctions }`. `null` = gỡ                                                                                                                                                                                                                            |

- `from`, `to`: ngày `YYYY-MM-DD` theo giờ Việt Nam, tính cả hai đầu; tối đa 90 ngày, không ở tương lai, sai thì 400.
  Ngày chưa thu thập dữ liệu trả `null` (khác với 0).
- `reason`: `cheating | abuse | spam | name | other`. Mỗi người tối đa 10 báo cáo/giờ (`report.too_many`), một báo cáo
  đang mở cho mỗi người bị báo cáo (`report.duplicate`), không tự báo cáo mình (`report.self`).
- **Game bị tắt** (FR-CAT-03): `room:create`, `room:start` và `queue:join` trả `game.disabled`; ván đang chơi vẫn tiếp tục;
  người đã đứng chờ ghép trận không được ghép cho tới khi bật lại. Mỗi process đọc lại danh sách sau tối đa 2 giây.
  Web ẩn nút bắt đầu (cả chơi local/với máy); không gọi được server thì coi như game đang bật.
- **Cấm chat:** `chat:send` → `chat.muted`. **Khoá tài khoản:** mọi request → 403 `auth.banned`, đăng nhập cũng vậy;
  socket đang mở (cả `/office`) bị ngắt ngay và người đó rời hàng chờ. Khách bị khoá vẫn có thể tạo khách mới (giới hạn đã biết).
- "Đến khi gỡ" lưu là năm 9999 (`SANCTION_FOREVER`).

**Hỏi trước khi tạo khách:** web không còn tự tạo khách. Lần đầu một màn cần tài khoản (tạo phòng, ghép trận, hồ sơ,
phiên văn phòng…) mà trình duyệt chưa có phiên, `ensureToken()` mở hộp thoại: đăng nhập, đăng ký hoặc chơi với tên khách
(tên tuỳ chọn). Đóng hộp thoại → lỗi `auth.cancelled` (chỉ ở client). Ô "Lần sau không hỏi lại" lưu `bg-auth-choice=guest`
trong `localStorage`, khi đó khách được tạo luôn; đăng xuất xoá lựa chọn này. Chơi với máy / 2 người cùng máy không cần tài khoản.

**Danh tính khách:** web lưu token trong `localStorage` (`bg-session`), nên mọi tab của một trình duyệt là
**cùng một người** (mở link mời ở tab mới vẫn giữ ghế). Muốn thêm người chơi trên cùng máy: dùng trình duyệt
khác/cửa sổ ẩn danh, hoặc nút "Chơi với tên khách mới" ở trang tài khoản (gọi lại `POST /api/auth/guest`;
các tab khác nhận sự kiện `storage` và tự tải lại). Tên hiển thị **không duy nhất** (id mới định danh người);
trong phòng, hai người khác nhau trùng tên được hiển thị kèm 4 ký tự đầu của id: `An #3f2a`.

## 3. Client → Server

| Event             | Payload                                                                            | Ack `data`                      | Ai được gọi                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `room:create`     | `{ gameId, config?, timeControl?, disconnectPolicy?, hostSeat? }`                  | `{ room }`                      | Mọi người                                                                       |
| `room:join`       | `{ code }` (6 ký tự, tự viết hoa)                                                  | `{ room, match \| null, chat }` | Mọi người (chưa ngồi = người xem)                                               |
| `room:leave`      | `{ roomId }`                                                                       | `{}`                            |                                                                                 |
| `room:take-seat`  | `{ roomId, seat \| null }` (`null` = đứng dậy)                                     | `{}`                            | Chỉ khi phòng ở `lobby`                                                         |
| `room:set-ready`  | `{ roomId, ready }`                                                                | `{}`                            | Người đang ngồi                                                                 |
| `room:add-bot`    | `{ roomId, seat, level }`                                                          | `{}`                            | Chủ phòng, `lobby`                                                              |
| `room:remove-bot` | `{ roomId, seat }`                                                                 | `{}`                            | Chủ phòng, `lobby`                                                              |
| `room:start`      | `{ roomId }`                                                                       | `{}`                            | Chủ phòng; ghế liền nhau từ 0, đủ `minPlayers`, mọi người khác đã sẵn sàng      |
| `room:rematch`    | `{ roomId }`                                                                       | `{}`                            | Người chơi hoặc chủ phòng, khi `finished`; ghế xoay vòng để người khác đi trước |
| `move:submit`     | `{ matchId, seq, clientMoveId, move }`                                             | `{ seq }`                       | Người chơi của ván                                                              |
| `match:action`    | `{ matchId, action: 'resign' \| 'offer-draw' \| 'accept-draw' \| 'decline-draw' }` | `{}`                            | Người chơi của ván                                                              |
| `match:resync`    | `{ matchId }`                                                                      | `{ match }`                     | Người trong phòng                                                               |
| `chat:send`       | `{ roomId, text }` (1–300 ký tự, server che từ ngữ thô tục)                        | `{}`                            | Người trong phòng                                                               |
| `queue:join`      | `{ gameId, timeControl: 'blitz'\|'rapid'\|'perMove30', ranked }` (luôn có đồng hồ) | `{}`                            | Mọi người. Vào hàng đợi ghép trận; vào lại thì chuyển sang hàng mới             |
| `queue:leave`     | `{}`                                                                               | `{}`                            | Rời hàng đợi (đóng tab cuối cùng cũng vậy)                                      |

`timeControl`: `{type:'none'}` · `{type:'fischer', baseMs, incrementMs}` · `{type:'per-move', moveMs}`; preset ở `TIME_CONTROL_PRESETS`.
`disconnectPolicy`: `'forfeit'` (mặc định, xử thua với reason `abandon`) hoặc `'bot'` (máy cấp `medium` đánh thay).

## 4. Server → Client

| Event           | Payload                | Gửi cho                                                                                                           |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `room:updated`  | `RoomSnapshot`         | Mọi socket trong phòng. Gồm ghế (kèm `ready`, `connected`, `graceUntil`), số người xem, trạng thái                |
| `match:state`   | `MatchSnapshot`        | **Từng người chơi riêng** (kênh `user:{id}`) với `view = playerView(state, seat)`; người xem nhận bản `spectator` |
| `chat:message`  | `ChatMessage`          | Mọi socket trong phòng                                                                                            |
| `queue:matched` | `{ roomId, roomCode }` | Hai người vừa được ghép. Ván **đã bắt đầu**; client chuyển tới `/room/<roomCode>`                                 |

```ts
interface MatchSnapshot {
  matchId: string;
  roomId: string;
  gameId: string;
  rulesVersion: number;
  seq: number;
  moveCount: number;
  view: unknown; // playerView của người nhận, không bao giờ là full state
  mySeat: number | null; // null = người xem
  activeSeats: number[];
  clocks: { seat: number; remainingMs: number; running: boolean }[] | null;
  serverTime: number; // để client tự đếm ngược
  result: { kind: 'win'; winners: number[]; reason: string } | { kind: 'draw'; reason: string } | null;
  pendingOffer: { type: 'draw'; from: number } | null;
  ratingChanges: { seat: number; before: number; after: number }[] | null; // ván tính điểm, khi đã kết thúc
}
```

Seed của ván **không bao giờ** nằm trong snapshot (có test kiểm tra).

## 5. Ghép trận và xếp hạng

- Hàng đợi chia theo `game + thời gian + tính điểm/không`. Người chờ lâu nhất được ghép trước, với người có điểm gần nhất.
- Ván tính điểm chỉ ghép khi chênh lệch điểm ≤ cửa sổ của **cả hai** người: 150 điểm, cộng 50 mỗi 5 giây chờ, tối đa 600. Ván không tính điểm ghép ngay.
- Phòng do ghép trận tạo: `ranked` theo yêu cầu, `public = true` (hiện ở `/api/live`), luật mặc định của game, xử thua khi mất kết nối, không thêm bot được. Ai đi trước được bốc thăm.
- Điểm: Glicko-2 (`apps/server/src/ratings/glicko2.ts`), mỗi ván là một kỳ tính điểm. Điểm "tạm" (`provisional`, hiện kèm "?") khi RD > 110.
- `RoomSnapshot` có thêm `ranked`, `public`; ghế người chơi có thể có `rating`.

## 6. Vòng đời phòng

```
   create ──► LOBBY ──start──► PLAYING ──(thắng/hòa/đầu hàng/hết giờ/bỏ cuộc)──► FINISHED
                ▲                                                                   │
                └────────────────────────── rematch ────────────────────────────────┘
```

Phòng (và ván) sống trong live store 24 giờ kể từ lần thay đổi cuối.

## 7. Mất kết nối và kết nối lại

1. Khi socket **cuối cùng** của một người trong phòng ngắt: người ngồi ghế được đánh dấu `connected=false`, `graceUntil = now + GRACE_MS` (mặc định 60 s); người xem bị bỏ khỏi danh sách xem.
2. Đồng hồ của người mất kết nối **vẫn chạy**.
3. Kết nối lại trong thời gian chờ: client tự gửi lại `room:join` khi socket `connect` → giữ nguyên ghế, nhận lại snapshot đầy đủ.
4. Hết thời gian chờ: `lobby/finished` → ghế được giải phóng (chủ phòng chuyển cho người khác); `playing` → áp dụng `disconnectPolicy`.
5. `match:state` có `seq` nhỏ hơn bản đang có thì client bỏ qua; `match.stale_seq` thì client gọi `match:resync`.

## 8. Mã lỗi chung

| Code                                                                                                            | Ý nghĩa                                     |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `auth.required`, `auth.invalid_credentials`, `auth.email_taken`, `auth.banned`                                  | Xác thực                                    |
| `admin.required`, `chat.muted`, `game.disabled`, `user.not_found`                                               | Quản trị (§2.1)                             |
| `report.self`, `report.duplicate`, `report.too_many`, `report.not_found`                                        | Báo cáo người chơi (§2.1)                   |
| `protocol.version`, `rate.limited`, `invalid.payload`, `internal`                                               | Chung                                       |
| `room.not_found`, `room.not_host`, `room.invalid_state`, `room.seat_taken`, `room.not_seated`, `room.not_ready` | Phòng                                       |
| `game.not_found`                                                                                                | `gameId` không có trong registry server     |
| `match.not_found`, `match.stale_seq`, `match.not_player`, `match.no_offer`, `match.not_finished`                | Ván                                         |
| `queue.unsupported`                                                                                             | Game hoặc thời gian không hỗ trợ ghép trận  |
| `engine.*`, `<gameId>.*`                                                                                        | Lỗi luật (xem [04](04-game-engine-spec.md)) |

Client map mã lỗi sang i18n bằng `apps/web/src/game-runtime/error-key.ts` (`errors.*`, `engine.*`, `games.<id>.errors.*`).

## 9. Thay đổi protocol

- Chỉ được **thêm** field optional. Đổi hoặc xóa field thì tăng `PROTOCOL_VERSION`, và server phải hỗ trợ song song phiên bản cũ ít nhất một lần release.
- Chưa có (để sau): xin đi lại online.
