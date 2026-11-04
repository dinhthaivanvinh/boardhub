# Game Spec: Bốn trong hàng (`four-in-a-row`)

> Game "thả quân" theo trọng lực, luật phổ thông. Không dùng tên hay hình ảnh thương mại của các sản phẩm tương tự.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 5 phút
- Nguồn luật: luật "connect four" phổ thông (gravity, 4 quân liên tiếp)

## 2. Thành phần

Khung đứng gồm `columns` cột × `rows` hàng (mặc định 7 × 6). Tọa độ: index 1 chiều `i = row * columns + col`,
`row = 0` là hàng **trên cùng**. Seat 0 cầm quân **Vàng** (đi trước), seat 1 cầm quân **Đỏ**.

## 3. Chuẩn bị

Khung trống, `turn = 0`.

## 4. Lượt chơi

Mỗi lượt, người chơi chọn một cột chưa đầy; quân rơi xuống ô trống thấp nhất của cột đó. Không có nước bỏ lượt.

## 5. Điều kiện kết thúc

| Điều kiện                                                 | Kết quả        | `reason`      |
| --------------------------------------------------------- | -------------- | ------------- |
| Có ≥ 4 quân liên tiếp (ngang, dọc, chéo) qua quân vừa thả | Người đó thắng | `four_in_row` |
| Khung đầy mà không ai thắng                               | Hòa            | `board_full`  |

Xét thắng trước hòa. Chuỗi dài hơn 4 vẫn tính thắng.

## 6. Biến thể (configSchema)

| Field     | Kiểu        | Mặc định | Mô tả   |
| --------- | ----------- | -------- | ------- |
| `columns` | 7 \| 8 \| 9 | 7        | Số cột  |
| `rows`    | 6 \| 7      | 6        | Số hàng |

## 7. Mô hình dữ liệu

```ts
type FourConfig = { columns: 7 | 8 | 9; rows: 6 | 7 };
type FourMove = { col: number };
type FourState = {
  config: FourConfig;
  board: (0 | 1 | null)[]; // row 0 = top
  turn: 0 | 1;
  moveCount: number;
  lastMove: number | null; // cell index của quân vừa thả
  winner: 0 | 1 | null;
  winLine: number[] | null; // các ô của chuỗi thắng, theo thứ tự
};
```

## 8. Mã lỗi

| Code                          | Khi nào                         |
| ----------------------------- | ------------------------------- |
| `four-in-a-row.out_of_bounds` | `col < 0` hoặc `col >= columns` |
| `four-in-a-row.column_full`   | Cột đã đầy                      |

## 9. playerView

Trả về toàn bộ state (perfect-info).

## 10. Bot

- `evaluate`: chấm điểm mọi cửa sổ 4 ô (ngang, dọc, chéo) chỉ chứa quân một bên; cộng điểm cho quân ở cột giữa.
- `orderMoves`: thắng ngay > chặn thắng ngay > gần cột giữa.
- easy = greedy + 30% ngẫu nhiên; medium = minimax depth 4; hard = iterative deepening (tối đa depth 10), ngân sách 1500 ms.

## 11. UI

Khung màu xanh với các "lỗ" tròn. Bấm/chạm vào **bất kỳ ô nào** của một cột để thả quân vào cột đó; hover hiện quân mờ
tại vị trí sẽ rơi xuống. Quân rơi có hiệu ứng trượt từ trên xuống (tắt khi `prefers-reduced-motion`).
Hai bên phân biệt bằng **màu và hình**: Vàng là đĩa đặc, Đỏ là đĩa có vòng tròn bên trong.

## 12. Trường hợp biên cần test

- Quân rơi xuống ô thấp nhất; cột đầy thì báo `column_full`.
- Thắng ngang, dọc, chéo xuôi, chéo ngược; thắng ở mép và góc khung.
- Chuỗi 5 vẫn thắng; 3 quân không thắng.
- Nước cuối vừa làm đầy khung vừa tạo chuỗi 4 → thắng, không phải hòa.
- Khung đầy không ai thắng → hòa.
- Mọi biến thể kích thước (7×6, 8×7, 9×7).
