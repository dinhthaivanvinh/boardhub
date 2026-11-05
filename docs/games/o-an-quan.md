# Game Spec: Ô ăn quan (`o-an-quan`)

> Nguồn sự thật về luật chơi của `packages/games/o-an-quan`.

## 1. Tổng quan

- Số người chơi: 2
- Tags: `perfect-info`
- Thời lượng ước tính: 15 phút
- Nguồn luật tham khảo: trò chơi dân gian Việt Nam. Dùng "luật phổ biến" (người dùng chọn): quan = 10 dân,
  được ăn quan non, hết dân thì lấy 5 dân đã ăn ra rải (thiếu thì vay đối thủ), hết hai quan thì kết thúc.

## 2. Thành phần

- 12 ô xếp thành vòng: 10 **ô dân** (mỗi bên 5) và 2 **ô quan** hình bán nguyệt ở hai đầu.
- Đánh số theo vòng (`index`):
  - `0`: ô quan trái (nhìn từ bên Seat 0), `6`: ô quan phải.
  - `1..5`: ô dân của seat 0, trái → phải.
  - `7..11`: ô dân của seat 1, theo vòng (nhìn từ seat 0 là phải → trái).
- Hướng `+1` đi theo chiều tăng của index. Với **cả hai người**, `+1` là "rải sang phải" khi nhìn hàng ô của mình
  ở phía dưới (bàn của seat 1 được xoay 180°).
- 50 viên dân và 2 viên quan. Mỗi viên quan tính bằng **10 dân**.

## 3. Chuẩn bị (setup)

Mỗi ô dân có 5 dân. Mỗi ô quan có 1 quan, 0 dân. Seat 0 đi trước.

## 4. Lượt chơi

1. Chọn một ô dân **của mình** còn dân và một hướng (`+1` / `-1`).
2. Bốc hết dân trong ô, rải lần lượt mỗi ô một viên theo hướng đã chọn (kể cả ô quan, ô của đối thủ, và có thể
   vòng qua chính ô vừa bốc).
3. Sau viên cuối cùng, xét ô **kế tiếp** `n1`:
   - `n1` là ô dân còn dân → bốc hết và rải tiếp theo cùng hướng (quay lại bước 3).
   - `n1` là ô quan còn quan hoặc còn dân → **hết lượt**.
   - `n1` trống (kể cả ô quan đã bị ăn và không còn dân): xét ô sau nó `n2`.
     - `n2` có quân → **ăn** hết quân trong `n2` (quan và dân). Rồi xét tiếp: nếu ô sau `n2` trống và ô sau nữa có
       quân thì ăn tiếp (**ăn liên tiếp**), cứ thế cho đến khi không ăn được nữa → hết lượt.
     - `n2` cũng trống → hết lượt.
4. **Hết dân:** đến lượt mà cả 5 ô của mình đều trống thì tự động lấy 5 dân đã ăn, đặt mỗi ô 1 viên. Không đủ 5 thì
   **vay** phần còn thiếu từ số dân đối thủ đã ăn (ghi nợ, trả lại khi tính điểm). Nếu cả hai cộng lại vẫn không
   đủ 5 thì ván kết thúc ngay.
5. Phòng xa: một lượt rải tối đa 600 lần đặt quân (thực tế không xảy ra); quá thì hết lượt.

## 5. Điều kiện kết thúc

| Điều kiện                                         | Kết quả                            | `reason`     |
| ------------------------------------------------- | ---------------------------------- | ------------ |
| Cả hai quan đã bị ăn (cuối lượt đó)               | Tính điểm; cao hơn thắng, bằng hòa | `quan_taken` |
| Bên đến lượt hết dân và không đủ 5 dân để rải/vay | Tính điểm                          | `no_stones`  |
| 200 lượt đi                                       | Tính điểm                          | `move_limit` |

Khi kết thúc, dân còn trên các ô dân thuộc về bên sở hữu ô đó; dân trong ô quan không thuộc về ai.
**Điểm** = dân đã ăn + 10 × số quan đã ăn + dân còn trên ô mình − nợ mình vay + nợ đối thủ vay mình.
`reason` của kết quả: `more_points` (thắng) / `equal_points` (hòa); lý do kết thúc nằm trong `state.ended`.

## 6. Biến thể (configSchema)

Không có tuỳ chọn (`{}`).

## 7. Mô hình dữ liệu

```ts
type Seat01 = 0 | 1;
type OAnQuanMove = { cell: number; dir: 1 | -1 };
type OAnQuanState = {
  config: {};
  cells: number[]; // 12 ô: số dân
  quan: [boolean, boolean]; // ô 0 / ô 6 còn viên quan không
  stash: { dan: number; quan: number }[]; // đã ăn, theo seat
  debt: [number, number]; // số dân mỗi seat đã vay của đối thủ
  turn: Seat01;
  moveCount: number;
  lastMove: OAnQuanMove | null;
  sown: number[]; // các ô nhận quân ở nước vừa rồi, theo thứ tự (để làm hiệu ứng)
  taken: number[]; // các ô bị ăn ở nước vừa rồi
  refill: { seat: Seat01; borrowed: number } | null; // tự rải lại đầu lượt này
  ended: 'quan_taken' | 'no_stones' | 'move_limit' | null;
};
```

## 8. Mã lỗi

| Code                      | Khi nào                         |
| ------------------------- | ------------------------------- |
| `o-an-quan.not_your_cell` | Ô không phải ô dân của người đi |
| `o-an-quan.empty_cell`    | Ô đã chọn không còn dân         |

## 9. playerView

Perfect information: trả về toàn bộ state.

## 10. Bot

- `easy`: greedy có nhiễu. `medium`: minimax độ sâu 3. `hard`: minimax độ sâu 5.
- Hàm đánh giá: hiệu số điểm hiện có (dân + 10 × quan − nợ) + 0,3 × hiệu số dân trên ô mỗi bên.
- Nhánh tối đa 10 (5 ô × 2 hướng).

## 11. UI

- Không phải lưới: bàn là 2 hàng × 5 ô dân, hai ô quan bán nguyệt ở hai đầu, vẽ bằng HTML/CSS (mỗi ô là một nút).
- Chạm một ô của mình để chọn → hiện hai nút "◀ Rải sang trái" / "Rải sang phải ▶". Ô của mình luôn ở hàng dưới.
- Mỗi ô hiện số dân (chấm nhỏ khi ít, kèm con số); ô quan có viên quan lớn.
- Ô bắt đầu và các ô bị ăn của nước vừa rồi được tô; thông báo cho trình đọc màn hình số quân ăn được.
- Hai hộp "Đã ăn" (dân, quan, nợ) cho hai bên.
- **Rải chậm từng viên:** mỗi nước (kể cả của máy và đối thủ online) được diễn lại từ các bước `sow().events`
  (bốc, thả từng viên, ăn), có huy hiệu "✋ n" cho số dân còn trên tay. Nước tới trong lúc đang diễn thì xếp hàng chờ.
  Không nhận nước đi trong lúc diễn. Trong lúc diễn có chọn tốc độ (🐢 Chậm ×0,5 · Thường · ⏩ Nhanh ×3, đổi được giữa chừng) và nút "Bỏ qua"; sau đó nút "↺ Xem lại nước vừa đi" phát lại nước cuối từng viên (kể cả khi đã bỏ qua hoặc tắt hiệu ứng). Tắt khi tắt "Hiệu ứng" hoặc hệ thống bật giảm chuyển động.
  Nước rất dài được tăng tốc để không quá ~12 giây.

## 12. Trường hợp biên cần test

- Rải qua ô quan, rải vòng qua ô vừa bốc.
- Gặp ô dân có quân → rải tiếp; gặp ô quan → dừng.
- Ăn một ô, ăn liên tiếp hai ô, ăn ô quan (quan + dân), ô trống trước ô quan đã bị ăn.
- Hai ô trống liền nhau → dừng, không ăn.
- Hết dân: lấy 5 dân của mình; vay đối thủ khi thiếu; không đủ để vay → kết thúc.
- Kết thúc khi hai quan bị ăn; tính dân còn lại và nợ.
