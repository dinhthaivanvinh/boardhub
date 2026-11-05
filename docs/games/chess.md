# Game Spec: Cờ vua (`chess`)

> Nguồn sự thật về luật chơi của `packages/games/chess`.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 20 phút
- Nguồn luật: Luật cờ vua FIDE (đi quân, nhập thành, bắt tốt qua đường, phong cấp, chiếu, chiếu bí, hết nước).

## 2. Thành phần

- Bàn 8 × 8, `index = row * 8 + col`; `row 0` là hàng 8 (phía Đen), `col 0` là cột a. Ô `a1` = 56, `h8` = 7.
- Quân: `${color}${type}`, `color` ∈ `w` (Trắng, seat 0) / `b` (Đen, seat 1),
  `type` ∈ `K` Vua, `Q` Hậu, `R` Xe, `B` Tượng, `N` Mã, `P` Tốt.

## 3. Chuẩn bị (setup)

Thế cờ ban đầu chuẩn. Trắng đi trước.

## 4. Lượt chơi

Một nước: `{ from, to, promotion? }`. Mọi luật đi quân FIDE, gồm:

- **Nhập thành** (vua đi 2 ô về phía xe): vua và xe chưa từng đi, các ô giữa trống, vua không đang bị chiếu,
  không đi qua hay đến ô bị tấn công.
- **Bắt tốt qua đường** ngay sau khi tốt đối phương tiến 2 ô.
- **Phong cấp:** tốt tới hàng cuối phải có `promotion` ∈ `Q R B N` (UI hỏi người chơi).
- Không được đi nước để vua mình bị chiếu.

## 5. Điều kiện kết thúc

| Điều kiện                                                                 | Kết quả       | `reason`       |
| ------------------------------------------------------------------------- | ------------- | -------------- |
| Bên đến lượt bị chiếu và không còn nước                                   | Bên kia thắng | `checkmate`    |
| Bên đến lượt không bị chiếu và không còn nước                             | Hòa           | `stalemate`    |
| Cùng một thế cờ (cùng lượt, quyền nhập thành, bắt qua đường) lần thứ 3    | Hòa           | `repetition`   |
| 50 nước mỗi bên không đi tốt và không ăn quân                             | Hòa           | `fifty_moves`  |
| Không bên nào đủ quân để chiếu bí (V–V, V+M–V, V+T–V, V+T–V+T cùng màu ô) | Hòa           | `insufficient` |

Lặp 3 lần và 50 nước được áp dụng **tự động** (không cần đòi hòa), như phần lớn web cờ online.

## 6. Biến thể (configSchema)

Không có tuỳ chọn (`{}`).

## 7. Mô hình dữ liệu

```ts
type Piece = `${'w' | 'b'}${'K' | 'Q' | 'R' | 'B' | 'N' | 'P'}`;
type ChessMove = { from: number; to: number; promotion?: 'Q' | 'R' | 'B' | 'N' };
type ChessState = {
  config: {};
  board: (Piece | null)[]; // 64 ô
  turn: 0 | 1;
  castling: string; // như FEN: tập con của "KQkq", "" khi hết quyền
  enPassant: number | null; // ô đích của bắt tốt qua đường
  halfmove: number; // cho luật 50 nước
  fullmove: number;
  moveCount: number;
  lastMove:
    | (ChessMove & { piece: Piece; captured: Piece | null; castle: 'K' | 'Q' | null; enPassant: boolean })
    | null;
  positions: number[]; // hash các thế cờ kể từ nước không thể đảo ngược gần nhất
  inCheck: 0 | 1 | null;
  status: 'playing' | 'checkmate' | 'stalemate' | 'repetition' | 'fifty_moves' | 'insufficient';
  winner: 0 | 1 | null;
};
```

## 8. Mã lỗi

| Code                    | Khi nào                                    |
| ----------------------- | ------------------------------------------ |
| `chess.out_of_bounds`   | Ô ngoài bàn                                |
| `chess.no_piece`        | Không có quân ở `from`                     |
| `chess.not_your_piece`  | Quân của đối thủ                           |
| `chess.illegal_move`    | Quân không đi được như vậy                 |
| `chess.self_check`      | Nước đi để vua mình bị chiếu               |
| `chess.needs_promotion` | Tốt tới hàng cuối mà thiếu/sai `promotion` |

## 9. playerView

Perfect information: trả về toàn bộ state.

## 10. Bot

- Hàm đánh giá: vật chất + bảng vị trí theo ô (simplified evaluation), cộng điểm nhỏ khi đối thủ bị chiếu.
- Sắp nước: ăn quân giá trị cao bằng quân rẻ trước (MVV-LVA), phong cấp, rồi nước thường.
- `easy`: greedy có nhiễu; `medium`: minimax độ sâu 3; `hard`: minimax độ sâu 5 (giới hạn thời gian 2,5 giây).

## 11. UI

- Bàn ô sáng/tối, quân vẽ bằng SVG, toạ độ a–h / 1–8 ở mép.
- Chạm quân → các ô đi được (chấm; vòng tròn nếu ăn quân) → chạm ô đích. Phong cấp: hộp chọn 4 quân.
- Đen nhìn bàn xoay 180°. Nước cuối được tô, vua bị chiếu tô đỏ. Quân trượt tới chỗ mới (`SlidingPiece`);
  khi nhập thành, xe cũng trượt.

## 12. Trường hợp biên cần test

- **Perft** (đếm mọi chuỗi nước hợp lệ) khớp số chuẩn ở thế cờ ban đầu, "Kiwipete" và thế cờ tàn số 3.
- Nhập thành: bị chặn khi bị chiếu, đi qua ô bị tấn công, sau khi vua/xe đã đi hoặc xe bị ăn.
- Bắt tốt qua đường chỉ ngay nước sau; không được nếu làm lộ vua.
- Phong cấp 4 loại; thiếu `promotion` bị từ chối.
- Chiếu bí (Scholar's mate), hết nước, lặp 3 lần, 50 nước, không đủ quân.
