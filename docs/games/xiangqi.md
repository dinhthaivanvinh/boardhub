# Game Spec: Cờ tướng (`xiangqi`)

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 30 phút
- Nguồn luật: luật Cờ tướng phổ thông, **có đơn giản hoá** ở mục 5 (lặp lại, giới hạn nước)

## 2. Thành phần

Bàn 9 cột × 10 hàng giao điểm. Tọa độ: `i = row * 9 + col`, `row 0` là hàng trên cùng (phía Đen), `row 9` là hàng dưới cùng (phía Đỏ).
Sông nằm giữa hàng 4 và 5. Cung: cột 3–5, hàng 0–2 (Đen) và hàng 7–9 (Đỏ).
Seat 0 cầm **Đỏ** (đi trước), seat 1 cầm **Đen**.

Quân được lưu bằng mã 2 ký tự `<màu><loại>`: màu `r` (Đỏ) / `b` (Đen); loại `K` Tướng, `A` Sĩ, `E` Tượng, `H` Mã, `R` Xe, `C` Pháo, `P` Tốt.

## 3. Chuẩn bị

Hàng 0: `R H E A K A E H R` (Đen); hàng 2: Pháo ở cột 1 và 7; hàng 3: Tốt ở cột 0, 2, 4, 6, 8. Đỏ đối xứng ở hàng 9, 7, 6. Đỏ đi trước.

## 4. Lượt chơi

Mỗi lượt đi một quân `{ from, to }`. Luật đi:

| Quân  | Luật                                                                                     |
| ----- | ---------------------------------------------------------------------------------------- |
| Tướng | 1 bước ngang/dọc, trong cung                                                             |
| Sĩ    | 1 bước chéo, trong cung                                                                  |
| Tượng | 2 bước chéo, không qua sông, bị chặn nếu điểm giữa ("mắt tượng") có quân                 |
| Mã    | 1 bước thẳng rồi 1 bước chéo ra ngoài; bị chặn nếu điểm thẳng kề bên ("chân mã") có quân |
| Xe    | Đi thẳng bao xa cũng được, không nhảy qua quân                                           |
| Pháo  | Đi như Xe khi không ăn; khi ăn phải nhảy qua **đúng một** quân (ngòi)                    |
| Tốt   | 1 bước tiến; sau khi qua sông được đi thêm ngang 1 bước; không bao giờ lùi               |

- Không được ăn quân mình.
- **Lộ mặt tướng:** hai Tướng không được đứng cùng cột mà không có quân nào ở giữa.
- Không được đi nước khiến Tướng mình bị chiếu (hoặc lộ mặt tướng).

## 5. Điều kiện kết thúc

| Điều kiện                                                    | Kết quả       | `reason`     |
| ------------------------------------------------------------ | ------------- | ------------ |
| Bên đến lượt bị chiếu và không có nước đi                    | Bên kia thắng | `checkmate`  |
| Bên đến lượt không bị chiếu nhưng không có nước đi           | Bên kia thắng | `stalemate`  |
| Cùng một thế cờ (kể cả bên đến lượt) xuất hiện lần thứ 3     | Hòa           | `repetition` |
| 120 nửa nước (60 nước mỗi bên) liên tiếp không có quân bị ăn | Hòa           | `move_limit` |

> **Đơn giản hoá:** luật thi đấu chính thức xử thua bên chiếu/đuổi bắt liên tục thay vì cho hòa khi lặp lại.
> Phần đó chưa làm; nếu cần sẽ tăng `rulesVersion`.

## 6. Biến thể (configSchema)

Không có (`{}`).

## 7. Mô hình dữ liệu

```ts
type XiangqiMove = { from: number; to: number };
type XiangqiState = {
  config: {};
  board: (PieceCode | null)[]; // 90 ô
  turn: 0 | 1;
  moveCount: number;
  lastMove: XiangqiMove | null;
  captured: PieceCode[]; // các quân đã bị ăn, theo thứ tự
  inCheck: 0 | 1 | null; // bên đến lượt đang bị chiếu
  positions: number[]; // hash các thế cờ từ lần ăn quân gần nhất (để phát hiện lặp lại)
  sinceCapture: number;
  status: 'playing' | 'checkmate' | 'stalemate' | 'repetition' | 'move_limit';
  winner: 0 | 1 | null;
};
```

Kết thúc ván được tính ngay trong `applyMove` (vì phải sinh nước đi của bên kế tiếp), nên `result()` chỉ đọc `status`.

## 8. Mã lỗi

| Code                     | Khi nào                                             |
| ------------------------ | --------------------------------------------------- |
| `xiangqi.out_of_bounds`  | `from`/`to` ngoài bàn                               |
| `xiangqi.no_piece`       | Không có quân ở `from`                              |
| `xiangqi.not_your_piece` | Quân ở `from` là của đối thủ                        |
| `xiangqi.illegal_move`   | Quân không đi được như vậy                          |
| `xiangqi.self_check`     | Nước đi khiến Tướng mình bị chiếu hoặc lộ mặt tướng |

## 9. playerView

Trả về toàn bộ state (perfect-info).

## 10. Bot

- `evaluate`: vật chất (Xe 90, Pháo 45, Mã 40, Tượng 20, Sĩ 20, Tốt 10 → 20 khi đã qua sông) + điểm nhỏ cho Mã/Tốt tiến gần trung tâm.
- `orderMoves`: ăn quân giá trị cao bằng quân giá trị thấp trước (MVV-LVA), sau đó nước chiếu.
- easy = greedy + 30% ngẫu nhiên; medium = minimax depth 3; hard = iterative deepening (tối đa 5), ngân sách 2000 ms, `maxBranching` 14.

## 11. UI

Quân đặt **trên giao điểm**; vẽ sông (楚河 漢界), cung (đường chéo). Quân hình tròn với chữ Hán truyền thống
(Đỏ: 帥仕相傌俥炮兵, Đen: 將士象馬車砲卒) và `aria-label` tiếng Việt. Bấm quân mình → hiện các điểm đi được → bấm điểm đến.
Bàn tự xoay để quân của người chơi ở phía dưới. Tướng bị chiếu có viền đỏ.
`confirmMove` không áp dụng (chọn quân rồi chọn điểm đến vốn đã là 2 bước).

## 12. Trường hợp biên cần test

- Thế khai cuộc có đúng 44 nước hợp lệ cho Đỏ.
- Chân mã, mắt tượng, Tượng không qua sông, Pháo ăn qua ngòi, Tốt trước/sau sông, Tướng/Sĩ trong cung.
- Lộ mặt tướng; không được để Tướng mình bị chiếu.
- Chiếu bí, hết nước (stalemate), lặp lại 3 lần, giới hạn 120 nửa nước.
