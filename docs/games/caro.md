# Game Spec: Caro / Gomoku (`caro`)

> Game mẫu tham chiếu (reference implementation). Khi phân vân cách làm, hãy xem cách Caro làm.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 10 phút
- Nguồn luật: luật Caro phổ biến ở Việt Nam + luật Gomoku freestyle

## 2. Thành phần

Lưới vuông `size × size` (mặc định 15). Tọa độ: index 1 chiều `i = row * size + col`; `row`, `col` bắt đầu từ 0, góc trên bên trái.
Quân của seat 0 là **X** (đi trước), quân của seat 1 là **O**.

## 3. Chuẩn bị

Bàn trống, `turn = 0`.

## 4. Lượt chơi

Mỗi lượt, người chơi đặt một quân vào một ô trống. Không có nước bỏ lượt.

## 5. Điều kiện kết thúc

| Điều kiện                                                               | Kết quả        | `reason`      |
| ----------------------------------------------------------------------- | -------------- | ------------- |
| Có `winLength` quân liên tiếp (ngang, dọc, chéo) thỏa luật của biến thể | Người đó thắng | `five_in_row` |
| Bàn đầy mà không ai thắng                                               | Hòa            | `board_full`  |

## 6. Biến thể (configSchema)

| Field             | Kiểu       | Mặc định | Mô tả                                                                    |
| ----------------- | ---------- | -------- | ------------------------------------------------------------------------ |
| `size`            | 15 \| 19   | 15       | Kích thước bàn                                                           |
| `winLength`       | number (5) | 5        | Số quân liên tiếp để thắng                                               |
| `blockedEndsRule` | boolean    | true     | Luật Việt Nam: chuỗi bị chặn **cả hai đầu** thì không tính thắng         |
| `exactLength`     | boolean    | false    | Luật Gomoku chuẩn: chuỗi dài hơn `winLength` (overline) không tính thắng |

## 7. Mô hình dữ liệu

```ts
type CaroConfig = { size: 15 | 19; winLength: 5; blockedEndsRule: boolean; exactLength: boolean };
type CaroMove = { cell: number };
type CaroState = {
  config: CaroConfig;
  board: (0 | 1 | null)[];
  turn: 0 | 1;
  moveCount: number;
  lastMove: number | null;
  winner: 0 | 1 | null;
  winLine: number[] | null;
};
```

## 8. Mã lỗi

| Code                 | Khi nào                             |
| -------------------- | ----------------------------------- |
| `caro.out_of_bounds` | `cell < 0` hoặc `cell >= size*size` |
| `caro.cell_occupied` | Ô đã có quân                        |

## 9. playerView

Trả về toàn bộ state (perfect-info).

## 10. Bot

- Chỉ xét các ô trống trong bán kính 2 quanh các quân đã có (ô trung tâm nếu bàn trống).
- `evaluate`: tính điểm theo mẫu chuỗi (mở 4, bị chặn 4, mở 3, …) cho cả hai bên.
- easy = greedy + 30% ngẫu nhiên; medium = minimax depth 2; hard = iterative deepening, ngân sách 1500 ms.
- Luôn ưu tiên: thắng ngay > chặn nước thắng của đối thủ.

## 11. UI

SVG grid; quân đặt tại giao điểm hoặc trong ô (mặc định: trong ô). Hover hiện quân mờ. Highlight `lastMove` và `winLine`.
Bàn 19×19 trên mobile: pinch-zoom; cần chạm 2 lần để xác nhận nước đi (setting `confirmMove`).

## 12. Trường hợp biên cần test

- Thắng ở góc và cạnh bàn; thắng theo cả 2 đường chéo.
- `blockedEndsRule`: chuỗi 5 bị chặn 2 đầu thì không thắng; bị chặn 1 đầu thì vẫn thắng; chuỗi chạm mép bàn được tính là bị chặn ở đầu đó.
- `exactLength`: chuỗi 6 không thắng.
- Nước cuối cùng làm đầy bàn đồng thời tạo chuỗi thắng → kết quả là thắng, không phải hòa.
