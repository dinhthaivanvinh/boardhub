# Game Spec: Cờ gánh (`co-ganh`)

> Nguồn sự thật về luật chơi của `packages/games/co-ganh`.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 10 phút
- Nguồn luật tham khảo: trò chơi dân gian Việt Nam (miền Trung). Dùng đủ ba luật truyền thống: **gánh**, **vây (chẹt)** và **mở**.

## 2. Thành phần

- Bàn 5 × 5 giao điểm. Mọi giao điểm nối với các điểm kề theo hàng và cột. Điểm có `(hàng + cột)` chẵn
  ("điểm mạnh") còn nối thêm theo hai đường chéo; điểm lẻ thì không có đường chéo.
- Tọa độ: `index = row * 5 + col`, hàng 0 ở phía bên đi sau (seat 1).
- Mỗi bên 8 quân. Seat 0 = **Đỏ** (đi trước, phía dưới), seat 1 = **Xanh**.

## 3. Chuẩn bị (setup)

```
hàng 0:  X X X X X
hàng 1:  X . . . X
hàng 2:  Đ . . . X
hàng 3:  Đ . . . Đ
hàng 4:  Đ Đ Đ Đ Đ
```

(X = Xanh, Đ = Đỏ.) Đỏ đi trước.

## 4. Lượt chơi

1. Mỗi lượt đi **một quân một bước** theo một đường kẻ tới điểm kề còn trống.
2. **Gánh:** nếu quân vừa đi đứng giữa hai quân đối phương trên cùng một đường thẳng (ngang, dọc, hoặc chéo
   nếu điểm đó có đường chéo), cả hai quân đó đổi sang màu mình. Một nước có thể gánh nhiều cặp cùng lúc.
   Tự đi vào giữa hai quân đối phương là gánh, không phải bị gánh.
3. **Vây (chẹt):** sau bước gánh, mọi nhóm quân đối phương (các quân nối nhau theo đường kẻ) không còn điểm
   trống kề nào bị vây và đổi sang màu mình.
4. **Mở:** nếu nước vừa rồi của đối thủ bỏ trống một điểm mà mình có thể đi một quân vào đó để **gánh**, thì
   mình **bắt buộc** phải đi một nước như vậy (được chọn quân nào nếu có nhiều cách).
5. Không có mất lượt: bên đến lượt luôn còn nước đi (một nhóm không còn đường đi đã bị vây và đổi màu ở bước 3).

## 5. Điều kiện kết thúc

| Điều kiện                                        | Kết quả       | `reason`     |
| ------------------------------------------------ | ------------- | ------------ |
| Một bên không còn quân nào                       | Bên kia thắng | `all_taken`  |
| 60 nước mỗi bên (120 lượt đi) không đổi màu quân | Hòa           | `move_limit` |

## 6. Biến thể (configSchema)

Không có tuỳ chọn (`{}`).

## 7. Mô hình dữ liệu

```ts
type CoGanhSeat = 0 | 1;
type CoGanhMove = { from: number; to: number };
type CoGanhState = {
  config: {};
  board: (CoGanhSeat | null)[]; // 25 điểm
  turn: CoGanhSeat;
  moveCount: number;
  lastMove: CoGanhMove | null;
  carried: number[]; // quân bị gánh ở nước vừa rồi (để làm hiệu ứng)
  surrounded: number[]; // quân bị vây ở nước vừa rồi
  forced: number | null; // điểm "mở" mà bên đến lượt bắt buộc phải đi vào
  sinceCapture: number; // số lượt đi liên tiếp không đổi màu quân
  status: 'playing' | 'all_taken' | 'move_limit';
  winner: CoGanhSeat | null;
};
```

## 8. Mã lỗi

| Code                     | Khi nào                                                  |
| ------------------------ | -------------------------------------------------------- |
| `co-ganh.out_of_bounds`  | `from` hoặc `to` nằm ngoài bàn                           |
| `co-ganh.no_piece`       | Không có quân ở `from`                                   |
| `co-ganh.not_your_piece` | Quân ở `from` là của đối thủ                             |
| `co-ganh.not_adjacent`   | `to` không nối với `from` bằng một đường kẻ              |
| `co-ganh.occupied`       | `to` đã có quân                                          |
| `co-ganh.must_open`      | Đang bị "mở" mà nước đi không phải nước gánh vào điểm đó |

## 9. playerView

Perfect information: trả về toàn bộ state.

## 10. Bot

- `easy`: greedy (1 nước) có nhiễu.
- `medium`: minimax độ sâu 4. `hard`: minimax độ sâu 6.
- Hàm đánh giá: hiệu số quân × 100 + số nước đi được (độ linh hoạt) + điểm nhỏ cho quân ở điểm mạnh.
- Sắp nước: nước gánh/vây nhiều quân trước. Nhánh tối đa ~40 nên không cần cắt nhánh.

## 11. UI

- Bàn vẽ bằng `GridBoard` (`gridLines = false`) với nền là các đường kẻ ngang/dọc/chéo.
- Chạm quân để chọn, các điểm đi được hiện chấm; chạm điểm để đi. Chạm lại quân đang chọn để bỏ chọn.
- Bên Xanh nhìn bàn xoay 180° (quân mình ở dưới).
- Quân vừa bị gánh/vây có hiệu ứng đổi màu; điểm "mở" bắt buộc được tô viền.
- Thông báo cho trình đọc màn hình: nước vừa đi, số quân bị gánh/vây.

## 12. Trường hợp biên cần test

- Điểm lẻ không đi chéo được; điểm chẵn đi chéo được.
- Gánh ngang, dọc, chéo; gánh hai cặp cùng lúc; không gánh qua điểm lẻ theo đường chéo.
- Đi vào giữa hai quân đối phương không làm mình bị mất quân.
- Vây một quân và vây một nhóm; nhóm còn một điểm trống thì không bị vây.
- Mở: bắt buộc gánh vào điểm vừa bỏ trống; không bắt buộc nếu không gánh được ở điểm đó.
- Hết quân → thắng; 120 lượt không đổi màu → hòa.
