---
name: bg-bot
description: Implement or tune an AI bot/opponent for a game (packages/games/<id>/src/bot or shared algorithms in @bg/bots — random, greedy, minimax, MCTS). Use for "bot", "máy chơi", "AI đối thủ", difficulty levels, evaluation functions, or bot performance/timeouts.
---

# Bot

Tham chiếu: `docs/07-bots.md` (interface, quy tắc B1–B7, cấp độ).

## Chọn thuật toán

| Game                                                                                     | Bắt đầu với                  |
| ---------------------------------------------------------------------------------------- | ---------------------------- |
| perfect-info, 2 người, có hàm đánh giá dễ viết (Caro, Bốn trong hàng, Reversi, Cờ tướng) | `minimaxBot` + `evaluate`    |
| Có yếu tố may rủi, nhiều người, hoặc khó viết hàm đánh giá (Cá ngựa)                     | `mctsBot`                    |
| Bất kỳ game nào, cấp easy                                                                | `greedyBot` hoặc `randomBot` |

**Không** viết lại thuật toán tìm kiếm trong package game; chỉ cung cấp phần riêng của game:

```ts
// packages/games/<id>/src/bot/index.ts
export const bot = createBot({
  id: '<id>.default',
  def: definition,
  evaluate, // (state, seat) => number, càng lớn càng tốt cho seat; dùng ±Infinity cho thắng/thua
  orderMoves, // tuỳ chọn: nước tốt xếp trước để alpha-beta cắt tỉa tốt hơn
  candidateMoves, // tuỳ chọn: thu hẹp legalMoves (Caro: chỉ các ô trong bán kính 2)
  levels: {
    easy: { algo: 'greedy', timeMs: 200, noise: 0.3 },
    medium: { algo: 'minimax', timeMs: 600, maxDepth: 3 },
    hard: { algo: 'minimax', timeMs: 1500 },
  },
});
```

## Quy tắc khi viết `evaluate`

- Thuần, nhanh (mục tiêu < 50 µs với game lưới nhỏ), không cấp phát bộ nhớ lớn.
- Đối xứng: `evaluate(s, 0) ≈ -evaluate(s, 1)` với game 2 người có tổng bằng 0.
- Thắng hoặc thua chắc chắn thì trả về giá trị cực lớn/cực nhỏ, có cộng/trừ theo độ sâu để bot ưu tiên thắng nhanh, thua chậm.
- Bot của game hidden-info chỉ đọc `playerView(state, seat)` (B4). Cần mô phỏng thì lấy mẫu (determinize) các phần ẩn bằng `rng`.

## Kiểm tra trước khi xong

- [ ] Test: ở 100 state ngẫu nhiên, bot mọi cấp đều trả về nước nằm trong `legalMoves`
- [ ] Test: bot luôn trả kết quả trước `deadlineMs + 50ms`
- [ ] Test: có nước thắng ngay → bot medium/hard chọn nước đó; đối thủ sắp thắng → bot chặn
- [ ] Đấu thử: `hard` thắng `random` ≥ 95% và thắng `easy` ≥ 70% (dùng `playArena` từ `@bg/bots` trong test; xem `packages/games/caro/test/bot.test.ts`)
- [ ] Không dùng `Math.random` (B1); cùng seed thì cùng nước đi
