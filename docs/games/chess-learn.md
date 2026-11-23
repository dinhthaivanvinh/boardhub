# Cờ vua: chế độ Học (spec)

Trạng thái: Đã làm bản đầu (6 bài quân cờ, 3 khai cuộc). Mã: `packages/games/chess/src/learn`, route `/learn/chess`. Quyết định kiến trúc: [ADR-0009](../adr/0009-chess-learn-area.md). Đối tượng: trẻ mới biết cờ.

## 1. Nguyên tắc

- Một bài = một ý. Câu ngắn, từ đơn giản, mỗi bước chỉ làm một việc.
- Học bằng cách làm: sau khi xem animation thì trẻ tự bấm hoặc tự đi.
- Sai không bị phạt: hiện gợi ý, cho thử lại không giới hạn.
- Dùng lại `Board`/`PieceIcon`; ô đi được lấy từ `legalPositionMoves`.
- Hỗ trợ bàn phím, đọc màn hình và `prefers-reduced-motion` (thay animation bằng ảnh tĩnh kèm mũi tên).

## 2. Tính năng 1: Giới thiệu quân cờ

Thứ tự bài: Tốt → Xe → Tượng → Mã → Hậu → Vua. Sau đó các bài đặc biệt: bắt tốt qua đường, nhập thành, phong cấp.

Mỗi bài gồm các bước:

1. **Gặp quân:** tên, hình, một câu mô tả ("Xe đi thẳng như đường ray").
2. **Xem:** animation quân đi trên bàn trống, lần lượt qua các hướng; ô đến sáng lên. Nút phát lại, tạm dừng.
3. **Thử:** đặt quân lên bàn, trẻ bấm ô quân có thể đi tới. Đúng thì ô sáng, sai thì rung nhẹ và nhắc lại quy tắc.
4. **Thử thách:** vài thế nhỏ (ví dụ "ăn quân đỏ bằng 1 nước", "đi tới ô sao"). Hoàn thành thì được 1 sao.

Dữ liệu một bài (ý tưởng):

```ts
type PieceLesson = {
  id: 'rook';
  piece: 'R';
  fen: string; // thế để thử
  demo: { from: string; path: string[] }[]; // animation
  challenges: { fen: string; goal: { type: 'reach' | 'capture'; square: string } }[];
};
```

## 3. Tính năng 2: Bài học khai cuộc

Lượt đầu 3 khai cuộc: **Ý (Italian)**, **Gambit Hậu**, **Phòng thủ Sicilia**. Về sau thêm Ruy Lopez, Phòng thủ Pháp.

Mỗi khai cuộc là một chuỗi nước, mỗi nước kèm lời giải thích:

```ts
type OpeningLesson = {
  id: 'italian';
  side: 'w' | 'b'; // trẻ cầm bên nào
  steps: {
    move: string; // SAN hoặc 'e2e4'
    who: 'student' | 'opponent';
    why: string; // khóa i18n: lý do (kiểm soát trung tâm, phát triển quân...)
    hint?: string; // khóa i18n
    arrows?: [string, string][];
    highlights?: string[];
  }[];
};
```

Luồng: máy giải thích nước → trẻ tự đi nước đó (ô đúng nhấp nháy khi bấm "Gợi ý") → đối thủ đi → lặp đến hết.
Cuối bài có tóm tắt 3 ý chính ("Chiếm trung tâm", "Phát triển quân", "Nhập thành sớm") và tuỳ chọn "Chơi tiếp với bot từ thế này".

## 4. Tiến độ

- Mỗi bài chỉ có hai trạng thái: chưa xong / đã xong (✓), lưu `localStorage` khóa `learn.chess.v1` (danh sách id bài đã xong).
- Không khoá bài: trẻ học theo thứ tự tuỳ ý. Chưa có sao 0–3 hay chế độ phụ huynh.
- Mỗi bài quân cờ có đúng một thử thách; bản đầu chưa có bài nước đặc biệt (bắt tốt qua đường, nhập thành, phong cấp).

## 5. Kiểm thử

- Test dữ liệu: mọi `fen` hợp lệ; mọi nước trong `OpeningLesson.steps` hợp lệ khi phát lại từ thế đầu.
- Test thử thách: mỗi `goal` đạt được bằng đúng nước hợp lệ theo `legalPositionMoves`.
- Test i18n: mọi khóa có đủ `vi` và `en`.
- Test UI: bấm ô đúng/sai, reduced-motion, bàn phím.
- E2E: hoàn thành một bài quân cờ và một bài khai cuộc.

## 6. Ngoài phạm vi lượt đầu

Đồng bộ tiến độ theo tài khoản, giọng đọc, bài tập tàn cuộc/chiến thuật, huy hiệu, chế độ phụ huynh.
