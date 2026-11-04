# Game Spec: Reversi (`reversi`)

> Luật Reversi phổ thông (còn gọi là "cờ lật"). Không dùng tên hay hình ảnh của sản phẩm thương mại tương tự.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 10 phút
- Nguồn luật: luật Reversi chuẩn (thế khai cuộc chéo ở 4 ô giữa)

## 2. Thành phần

Bàn `size × size` (mặc định 8). Tọa độ: index 1 chiều `i = row * size + col`, `(0, 0)` ở góc trên bên trái.
Seat 0 cầm quân **Đen** (đi trước), seat 1 cầm quân **Trắng**.

## 3. Chuẩn bị

Với `m = size / 2`: Trắng ở `(m-1, m-1)` và `(m, m)`, Đen ở `(m-1, m)` và `(m, m-1)`. Đen đi trước.

## 4. Lượt chơi

- Đặt một quân vào ô trống sao cho **kẹp** được ít nhất một dãy quân đối thủ (ngang, dọc, chéo) giữa quân mới và một quân của mình. Mọi dãy bị kẹp đều bị lật.
- Không có nước hợp lệ → **mất lượt** tự động (được xử lý ngay trong `applyMove`, không có nước "bỏ lượt"). State ghi `passed` để UI thông báo.
- Cả hai bên đều không có nước → ván kết thúc (kể cả khi bàn chưa đầy).

## 5. Điều kiện kết thúc

| Điều kiện                                   | Kết quả              | `reason`      |
| ------------------------------------------- | -------------------- | ------------- |
| Hết nước cho cả hai, một bên nhiều quân hơn | Bên nhiều quân thắng | `more_discs`  |
| Hết nước cho cả hai, số quân bằng nhau      | Hòa                  | `equal_discs` |

## 6. Biến thể (configSchema)

| Field  | Kiểu         | Mặc định | Mô tả          |
| ------ | ------------ | -------- | -------------- |
| `size` | 6 \| 8 \| 10 | 8        | Kích thước bàn |

## 7. Mô hình dữ liệu

```ts
type ReversiConfig = { size: 6 | 8 | 10 };
type ReversiMove = { cell: number };
type ReversiState = {
  config: ReversiConfig;
  board: (0 | 1 | null)[];
  turn: 0 | 1;
  moveCount: number;
  lastMove: number | null;
  flipped: number[]; // các ô vừa bị lật, để UI làm hiệu ứng
  passed: 0 | 1 | null; // bên vừa bị mất lượt
  over: boolean;
};
```

## 8. Mã lỗi

| Code                    | Khi nào                         |
| ----------------------- | ------------------------------- |
| `reversi.out_of_bounds` | Ô nằm ngoài bàn                 |
| `reversi.cell_occupied` | Ô đã có quân                    |
| `reversi.no_flips`      | Nước đi không lật được quân nào |

## 9. playerView

Trả về toàn bộ state (perfect-info).

## 10. Bot

- `evaluate`: trọng số vị trí (góc rất tốt; ô kề góc rất xấu; cạnh tốt), cộng chênh lệch số nước đi được (mobility). Khi bàn còn ít ô trống thì chủ yếu tính chênh lệch số quân.
- `orderMoves`: ô có trọng số cao trước (góc trước tiên).
- easy = greedy + 30% ngẫu nhiên; medium = minimax depth 3; hard = iterative deepening (tối đa 10), ngân sách 1500 ms.

## 11. UI

Bàn xanh lá; quân Đen/Trắng (tương phản cao). Chấm nhỏ đánh dấu các ô đi được khi đến lượt (`settings.showLegalMoves`).
Quân bị lật có hiệu ứng lật. Thanh điểm số phía trên bàn. Thông báo khi một bên mất lượt.

## 12. Trường hợp biên cần test

- Thế khai cuộc, 4 nước hợp lệ đầu tiên của Đen.
- Lật nhiều hướng cùng lúc; không lật qua ô trống hay ra ngoài mép.
- Mất lượt: bên kia không có nước → cùng một bên đi tiếp, `passed` được ghi.
- Cả hai không có nước trước khi bàn đầy → kết thúc.
- Thắng theo số quân, hòa khi bằng nhau.
- Mọi kích thước bàn.
