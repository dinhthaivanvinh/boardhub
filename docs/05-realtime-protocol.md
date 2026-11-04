# 05 — Realtime Protocol (`@bg/protocol`)

Transport: Socket.IO, namespace `/play`. Mọi payload được định nghĩa bằng zod trong `packages/protocol/src/events.ts`
và được **dùng chung** giữa client và server. Không được emit event nào chưa có schema.

## 1. Quy ước

- Tên event: `<domain>:<action>`, ví dụ `room:join`, `move:submit`.
- Client → server dùng **ack callback**: `socket.emit(event, payload, (res: Ack) => …)`.
- `Ack = { ok: true, data? } | { ok: false, code: string, params? }`.
- Mỗi ván có `seq` (số nguyên, tăng 1 sau mỗi thay đổi state). Client gửi `seq` mà nó đang thấy để server phát hiện xung đột.
- Mỗi nước đi có `clientMoveId` (uuid do client sinh) để chống gửi trùng (idempotency).

## 2. Client → Server

| Event                        | Payload                                                                                                             | Ghi chú                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `room:create`                | `{ gameId, config, timeControl, visibility: 'private'\|'public', seats }`                                           | Ack trả về `{ roomId, code }`                         |
| `room:join`                  | `{ code }` hoặc `{ roomId }`                                                                                        | Ack trả về `RoomSnapshot`                             |
| `room:leave`                 | `{ roomId }`                                                                                                        |                                                       |
| `room:take-seat`             | `{ roomId, seat }`                                                                                                  |                                                       |
| `room:set-ready`             | `{ roomId, ready: boolean }`                                                                                        |                                                       |
| `room:add-bot`               | `{ roomId, seat, level }`                                                                                           | Chỉ chủ phòng                                         |
| `room:start`                 | `{ roomId }`                                                                                                        | Chỉ chủ phòng, khi đủ người và tất cả đã sẵn sàng     |
| `move:submit`                | `{ matchId, seq, clientMoveId, move }`                                                                              | `move` được parse bằng `moveSchema` của game ở server |
| `match:action`               | `{ matchId, action: 'resign'\|'offer-draw'\|'accept-draw'\|'decline-draw'\|'request-takeback'\|'accept-takeback' }` |                                                       |
| `match:resync`               | `{ matchId }`                                                                                                       | Yêu cầu snapshot đầy đủ sau khi reconnect             |
| `chat:send`                  | `{ roomId, text }`                                                                                                  | Tối đa 300 ký tự                                      |
| `queue:join` / `queue:leave` | `{ gameId, variant, ranked }`                                                                                       | Đợt 2                                                 |

## 3. Server → Client

| Event             | Payload                                                           | Gửi cho                                          |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| `room:updated`    | `RoomSnapshot` (ghế, ready, người xem, cấu hình)                  | Mọi người trong phòng                            |
| `match:started`   | `{ matchId, seat \| null, snapshot: MatchSnapshot }`              | Từng người (mỗi người một `seat` riêng)          |
| `match:state`     | `MatchSnapshot`                                                   | Từng người, với `view = playerView(state, seat)` |
| `move:rejected`   | `{ clientMoveId, code, params? }`                                 | Chỉ người gửi                                    |
| `match:ended`     | `{ matchId, result, ratingChanges? }`                             | Mọi người                                        |
| `match:offer`     | `{ type: 'draw'\|'takeback', from: seat }`                        | Đối thủ                                          |
| `player:presence` | `{ seat, status: 'online'\|'reconnecting'\|'left', graceUntil? }` | Mọi người                                        |
| `chat:message`    | `{ id, from, text, at }`                                          | Mọi người                                        |
| `error`           | `{ code }`                                                        | Lỗi chung, không gắn với ack                     |

```ts
interface MatchSnapshot {
  matchId: string;
  gameId: string;
  rulesVersion: number;
  seq: number;
  view: unknown; // playerView của người nhận
  activeSeats: Seat[];
  lastMove?: { seat: Seat; move: unknown }; // chỉ có khi game là perfect-info, hoặc nước đi đã được làm sạch
  clocks?: { seat: Seat; remainingMs: number; running: boolean }[];
  serverTime: number; // để client tự tính lại đồng hồ
  result: GameResult | null;
}
```

## 4. Vòng đời phòng (state machine)

```
          create
            │
            ▼
   ┌──── LOBBY ◄─────────────┐
   │        │ start          │ rematch
   │        ▼                │
   │    PLAYING ──── end ──► FINISHED ── timeout 10' ──► CLOSED
   │        │                                              ▲
   └─ all leave ───────────────────────────────────────────┘
```

- `LOBBY`: chọn ghế, thêm bot, đổi cấu hình.
- `PLAYING`: chỉ nhận `move:submit`, `match:action`, `chat:send`.
- `FINISHED`: hiển thị kết quả; "Chơi lại" đưa phòng về `LOBBY`, giữ nguyên người chơi, đổi lượt đi trước.

## 5. Reconnect

1. Socket.IO tự kết nối lại → client gửi `match:resync`.
2. Server trả về `MatchSnapshot` đầy đủ; client **thay thế** state cục bộ (không merge).
3. Nếu `seq` trong `match:state` nhảy cóc (lớn hơn `local.seq + 1`), client tự gửi `match:resync`.
4. Server giữ ghế trong `graceMs` (mặc định 60000). Đồng hồ của người mất kết nối **vẫn chạy**.

## 6. Mã lỗi chung

| Code                                                                 | Ý nghĩa                                     |
| -------------------------------------------------------------------- | ------------------------------------------- |
| `auth.required`                                                      | Chưa xác thực                               |
| `rate.limited`                                                       | Gửi quá nhiều message                       |
| `room.not_found`, `room.full`, `room.not_host`, `room.invalid_state` | Lỗi phòng                                   |
| `match.stale_seq`                                                    | `seq` của client đã cũ → client cần resync  |
| `engine.*`, `<gameId>.*`                                             | Lỗi luật (xem [04](04-game-engine-spec.md)) |

## 7. Thay đổi protocol

- Chỉ được **thêm** field optional. Đổi hoặc xóa field thì phải tăng `PROTOCOL_VERSION`, và server phải hỗ trợ song song phiên bản cũ trong ít nhất một lần release.
- Client gửi `protocolVersion` trong handshake; server từ chối và yêu cầu tải lại trang nếu phiên bản không tương thích.
