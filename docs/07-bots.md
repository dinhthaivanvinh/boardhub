# 07 — Bot / AI

## 1. Interface

```ts
// packages/bots/src/types.ts
export interface Bot<S, M> {
  id: string; // 'caro.minimax'
  levels: BotLevel[]; // ['easy','medium','hard']
  chooseMove(input: {
    state: S; // bot ở server nhận full state; xem quy tắc B4 cho game hidden-info
    seat: Seat;
    level: BotLevel;
    rng: Rng; // dùng để bot có tính ngẫu nhiên nhưng vẫn tái tạo được
    deadlineMs: number; // ngân sách thời gian, bot phải trả kết quả trước mốc này
  }): Promise<M> | M;
}
```

## 2. Thuật toán chung trong `@bg/bots`

| Thuật toán                                     | Dùng khi                                    | Game cần cung cấp                                   |
| ---------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `randomBot`                                    | Cấp "dễ" của mọi game, fallback khi hết giờ | `legalMoves`                                        |
| `greedyBot`                                    | Cấp "dễ/vừa"                                | `legalMoves` + `evaluate(state, seat)`              |
| `minimaxBot` (alpha-beta, iterative deepening) | Game perfect-info 2 người                   | `legalMoves`, `evaluate`, tuỳ chọn `orderMoves`     |
| `mctsBot`                                      | Game có chance hoặc khó viết hàm đánh giá   | `legalMoves`, `applyMove` (dùng playout ngẫu nhiên) |

Game chỉ viết phần **riêng** của mình trong `games/<id>/src/bot/`: hàm đánh giá, cách sắp xếp nước, giới hạn
không gian tìm kiếm (ví dụ Caro chỉ xét các ô trong bán kính 2 quanh quân đã có), rồi gộp lại bằng
`createBot({ id, def, evaluate, orderMoves?, candidateMoves?, levels })` từ `@bg/bots`. Ví dụ ở skill `bg-bot`.

`playArena(def, config, [botA, botB], games)` từ `@bg/bots` cho hai bot đấu N ván (đổi bên mỗi ván) và trả về tỷ lệ thắng; dùng trong test để kiểm tra độ khó của các cấp.

`deadlineMs` là mốc thời gian tuyệt đối theo cùng đồng hồ với `now` (mặc định `Date.now`). Mỗi level có thêm `timeMs` riêng; bot dừng ở mốc sớm hơn. Ở web, bot chạy trong Web Worker (`apps/web/src/game-runtime/bot.worker.ts`) với RNG `createRng("bot:" + seed, moveIndex)`.

Ở server, `WorkerBotRunner` chạy bot trong worker thread qua `bot-worker-boot.mjs`: file JS này đăng ký tsx **bên trong** worker
rồi mới import `bot-worker.ts` (loader truyền qua `--import` chưa có hiệu lực với file đầu vào của worker). Worker chết trước
khi trả lời thì việc được xếp lại; chết liền 3 lần thì runner thôi tạo worker mới, ghi log một lần và cho bot nghĩ trên luồng
chính (`degraded`), không bao giờ lặp tạo worker vô hạn hay đi nước ngẫu nhiên.

## 3. Quy tắc

| #   | Quy tắc                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| B1  | Bot chỉ dùng `ctx.rng`, không dùng `Math.random`, để tái hiện được lỗi                                             |
| B2  | Bot phải tôn trọng `deadlineMs`; iterative deepening trả về kết quả tốt nhất tìm được khi hết giờ                  |
| B3  | Bot luôn trả về một nước nằm trong `legalMoves`; khi gặp lỗi thì fallback sang `randomBot`                         |
| B4  | Bot của game `hidden-info` chỉ được đọc `playerView(state, seat)`, không được "nhìn trộm"                          |
| B5  | Bot ở server chạy trong worker thread; bot ở client chạy trong Web Worker                                          |
| B6  | Cấp độ "dễ" phải thua được: thêm xác suất chọn nước kém (ví dụ 30%)                                                |
| B7  | Bot trả lời sau ít nhất 1,2 giây (web và phòng online), để trẻ nhỏ kịp nhận ra máy đang đi (không làm ở trong bot) |

## 4. Cấu hình cấp độ gợi ý

| Level  | Thời gian | Ví dụ minimax                       |
| ------ | --------- | ----------------------------------- |
| easy   | 200 ms    | depth 1, 30% chọn nước ngẫu nhiên   |
| medium | 600 ms    | depth 2–3                           |
| hard   | 1500 ms   | iterative deepening đến khi hết giờ |
