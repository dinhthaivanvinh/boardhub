# Game Spec: Bắn tàu (`ban-tau`)

> Nguồn sự thật về luật chơi của `packages/games/ban-tau`. Trò chơi trên giấy quen thuộc; không dùng tên
> hay hình ảnh của bản thương mại (CLAUDE.md quy tắc 9). Tên tiếng Anh: "Sea Battle".

## 1. Tổng quan

- Số người chơi: 2
- Tags: `hidden-info`
- Thời lượng ước tính: 15 phút
- Luật (người dùng chọn): đội 5 tàu 5-4-3-3-2, **bắn trúng được bắn tiếp**, **báo chìm kèm loại tàu**.

## 2. Thành phần

- Mỗi bên một vùng biển 10 × 10, `index = row * 10 + col`. Cột A–J (trái → phải), hàng 1–10 (trên → dưới).
- Đội tàu (theo thứ tự `id`): 0 Tàu sân bay (5 ô), 1 Thiết giáp hạm (4), 2 Tuần dương hạm (3), 3 Tàu ngầm (3),
  4 Khu trục hạm (2). Tàu nằm ngang hoặc dọc, không chồng lên nhau; **được** đặt sát nhau.

## 3. Chuẩn bị (setup)

Pha `placing`: seat 0 xếp tàu, rồi seat 1 xếp tàu (lần lượt, để lõi engine vẫn chỉ có một người hành động
mỗi lúc; người xếp sau không thấy tàu của người xếp trước). Sau đó pha `battle`, seat 0 bắn trước.

## 4. Lượt chơi

- **Xếp tàu:** một nước `{ kind: 'place', ships: [{ cell, horizontal }] × 5 }` theo thứ tự `id`; `cell` là ô đầu
  (trái nhất / trên nhất).
- **Bắn:** `{ kind: 'fire', cell }` vào ô chưa bắn của đối thủ. Trúng → được bắn tiếp; trượt → mất lượt.
- Khi mọi ô của một tàu bị trúng, tàu **chìm**: cả hai bên được báo tên tàu và tàu hiện ra trên bàn đối thủ.

## 5. Điều kiện kết thúc

| Điều kiện                              | Kết quả            | `reason`     |
| -------------------------------------- | ------------------ | ------------ |
| Toàn bộ 5 tàu của một bên bị đánh chìm | Bên bắn chìm thắng | `fleet_sunk` |
| Đầu hàng / hết giờ / rời trận          | Do lõi xử lý       | —            |

Ván luôn kết thúc: mỗi lượt bắn dùng hết một ô, tối đa 200 phát.

## 6. Biến thể (configSchema)

Không có tuỳ chọn (`{}`).

## 7. Mô hình dữ liệu

```ts
type Seat01 = 0 | 1;
type Ship = { id: number; size: number; cells: number[] };
type Shot = { cell: number; hit: boolean };
type BanTauMove =
  { kind: 'place'; ships: { cell: number; horizontal: boolean }[] } | { kind: 'fire'; cell: number };
type BanTauState = {
  config: {};
  phase: 'placing' | 'battle' | 'over';
  turn: Seat01; // người đang xếp tàu / đang bắn
  fleets: [Ship[] | null, Ship[] | null]; // ẨN với đối thủ
  shots: [Shot[], Shot[]]; // các phát seat i bắn vào biển đối thủ (công khai)
  sunk: [number[], number[]]; // id tàu của seat i đã chìm
  lastShot: { seat: Seat01; cell: number; hit: boolean; sunk: number | null } | null;
  moveCount: number;
  winner: Seat01 | null;
};
```

## 8. Mã lỗi

| Code                    | Khi nào                             |
| ----------------------- | ----------------------------------- |
| `ban-tau.wrong_phase`   | Xếp tàu khi đang bắn hoặc ngược lại |
| `ban-tau.bad_fleet`     | Không đúng 5 tàu                    |
| `ban-tau.out_of_bounds` | Tàu hoặc phát bắn nằm ngoài biển    |
| `ban-tau.overlap`       | Hai tàu chồng lên nhau              |
| `ban-tau.already_shot`  | Bắn lại ô đã bắn                    |

## 9. playerView

Đây là game `hidden-info` (quy tắc E10):

- Người chơi thấy toàn bộ đội tàu **của mình**; của đối thủ chỉ thấy các tàu **đã chìm**.
- Mọi phát bắn (ô, trúng/trượt) và `lastShot` là công khai. Thấy được đối thủ đã xếp xong tàu hay chưa.
- Người xem (`spectator`): chỉ thấy phần công khai của cả hai bên.
- Khi ván kết thúc (`over`), mọi tàu được lộ ra cho tất cả.
- Nước `place` không bao giờ được gửi cho người khác: server chỉ gửi `playerView`.
- Test `assertNoHiddenLeak`: bốc lại ngẫu nhiên các tàu chưa chìm của đối thủ, view phải giữ nguyên.

## 10. Bot

Bot chỉ đọc `playerView` của mình (quy tắc B4; cả ở web lẫn server).

- Xếp tàu: ngẫu nhiên theo `rng`; bot `hard` tránh để tàu sát nhau.
- `easy`: bắn ngẫu nhiên; một nửa số lần nhắm cạnh ô đã trúng.
- `medium`: săn theo ô bàn cờ (chẵn lẻ) + nhắm theo đường khi đã trúng.
- `hard`: bản đồ xác suất: đếm mọi cách đặt các tàu còn lại khớp với ô trượt và tàu đã chìm; cách đặt đi qua ô
  đã trúng (chưa chìm) được nhân trọng số lớn. Bắn ô có điểm cao nhất (hòa thì chọn theo `rng`).

## 11. UI

- **Xếp tàu:** chọn tàu trong danh sách → chạm ô để đặt (xem trước xanh/đỏ khi rê chuột), nút "Xoay",
  chạm tàu đã đặt để nhấc lên, "Xếp ngẫu nhiên", "Xoá hết", "Xong". Nước `place` chỉ gửi khi đủ 5 tàu.
- **Đánh nhau:** hai vùng biển: "Biển đối thủ" (bắn) và "Hạm đội của bạn". Trượt: chấm nước; trúng: dấu nổ đỏ;
  tàu chìm: hiện hình tàu. Phát vừa bắn có hiệu ứng gợn sóng. Danh sách tàu đối thủ còn/chìm.
- **Chơi chung máy:** khi lượt chuyển sang người kia, một màn che "Đưa máy cho …" phủ lên bàn cho tới khi người
  đó bấm, để không ai thấy tàu của nhau.

## 12. Trường hợp biên cần test

- Xếp tàu: ngoài biển, chồng nhau, thiếu tàu, xếp hai lần, bắn khi đang xếp.
- Trúng → bắn tiếp; trượt → đổi lượt; bắn lại ô cũ bị từ chối.
- Chìm tàu: báo đúng `id`, tàu hiện ra cho đối thủ; chìm cả đội → thắng.
- `playerView` không lộ tàu chưa chìm (kể cả với người xem), lộ hết khi kết thúc.
- Bot chỉ dùng view; luôn đi nước hợp lệ; `hard` thắng `easy` phần lớn số ván.
