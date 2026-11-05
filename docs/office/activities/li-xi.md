# Activity Spec: Lì xì Tết (`li-xi`)

> Hoạt động đầu tiên của khu **Tiệc nhóm** (`/party`, ADR-0008). Chạy trên hạ tầng phiên của khu Văn phòng và tuân thủ
> [O-04](../04-activity-spec.md). Gói: `packages/office/li-xi`.

## 1. Tổng quan

- Người lì xì (chủ trì) tạo phòng, đặt các mệnh giá và số tờ, gửi QR/link. Người không có điện thoại thì chủ trì tự thêm tên.
- Mọi người vào bằng điện thoại, đặt tên và chọn con vật đại diện (studio con vật dùng chung với khu Văn phòng).
- Chủ trì bấm **Bắt đầu**: màn sân khấu thành căn phòng ngày Tết có mọi người. Mỗi lượt, chủ trì bấm **Mời người tiếp theo**:
  một người được gọi lên phía trước, phong bao mở ra, tờ tiền xòe ra mệnh giá.
- Người tham gia: 1–200. Chủ trì mặc định không nhận (`hostReceives = false`).
- Mode hiệu ứng: `li-xi` (một mode duy nhất).

## 2. Cài đặt (`settingsSchema`)

| Field           | Kiểu                        | Mặc định                       | Mô tả                                                                  |
| --------------- | --------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `denominations` | 1–8 dòng `{ value, count }` | 1×500.000, 3×200.000, ∞×50.000 | `value` 1.000–10.000.000 đ; `count` 1–500 hoặc `null` (không giới hạn) |
| `order`         | `random` \| `joined`        | `random`                       | Ai được gọi tiếp: ngẫu nhiên, hay theo thứ tự vào phòng                |
| `hostReceives`  | boolean                     | false                          | Chủ trì cũng nhận lì xì                                                |

Mỗi mệnh giá một dòng; nhiều nhất một dòng không giới hạn. Không sửa được sau khi đã bắt đầu.

## 3. Chồng phong bao (luật chọn)

Như một chồng phong bao thật trên bàn, tính lại trước mỗi lượt:

1. Mọi tờ của các mệnh giá có giới hạn **chưa phát**: id `L<dòng>-<số>`.
2. Thêm phong bao mệnh giá không giới hạn cho đủ số người đang chờ: `max(0, người chờ − tờ có giới hạn còn lại)` cái, id `U<dòng>-<số>`.
3. Không có mệnh giá không giới hạn mà thiếu tờ: các phong bao còn thiếu là **lời chúc** (0 đ), id `B-<số>`.

Hệ quả: 12 người với 3×500k, 5×200k, ∞×50k ⇒ 3 người 500k, 5 người 200k, 4 người 50k (thứ tự ngẫu nhiên).
Ít người hơn số tờ có giới hạn ⇒ không ai nhận mệnh giá không giới hạn, một số tờ còn lại trên bàn. Màn chủ trì
cho xem trước tổng tiền theo số người hiện tại.

## 4. Hành động (chỉ chủ trì)

| Hành động   | Điều kiện                                             | Kết quả                                                                                                             |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `configure` | chưa bắt đầu                                          | đổi cài đặt                                                                                                         |
| `start`     | chưa bắt đầu, có ít nhất một người để nhận            | `started = true`                                                                                                    |
| `next`      | đã bắt đầu, còn người chờ, không có lần bốc đang chạy | xin hub một lần bốc: `n = 1`, ứng viên = người chờ (thứ tự `joined`: chỉ người kế tiếp), `prizes` = chồng phong bao |

Lỗi: `office.not_host`, `office.bad_action` (sai giai đoạn), `office.not_enough` (hết người chờ), `office.draw_running`.

## 5. Công bằng

Một lần bốc chọn **cả người lẫn phong bao** (docs/office/04 §5, `drawPrizes`): seed bí mật đến lúc reveal, chồng phong bao
công khai ngay từ đầu (ai cũng thấy còn mấy tờ 500k), phong bao của từng người chỉ lộ lúc reveal. Trang kiểm chứng
tính lại cả người được gọi lẫn phong bao.

## 6. State và view

```ts
type LiXiState = { settings; started: boolean; gifts: Gift[] };
type Gift = { drawId; recipient; name; avatar; envelope; value }; // name/avatar lúc nhận
type LiXiView = LiXiState & { left: (number | null)[]; waiting: number; total: number; done: boolean };
```

Không có thông tin ẩn: mọi màn thấy như nhau (A4).

## 7. Màn hình và hiệu ứng (docs/office/07)

- **Sân khấu:** căn phòng ngày Tết (tường đỏ, đèn lồng đung đưa, cành mai và cành đào, dây pháo, cánh hoa rơi), mọi người
  đứng thành hàng. Mỗi lượt: đèn rọi nhảy qua mọi người (trống), dừng ở người được gọi (chiêng), người đó bước lên bục,
  phong bao đỏ bay vào, rung, nắp mở, tờ tiền trượt ra và xòe, số tiền hiện lớn kèm một lời chúc Tết, pháo giấy và tiền
  vàng bung ra; mệnh giá lớn nhất có pháo hoa. Bên cạnh: chồng phong bao còn lại, danh sách đã nhận, tổng tiền.
- **Điện thoại:** "Đến lượt bạn!" khi được gọi (rung), rồi phong bao của mình và lời chúc; người khác thấy ai nhận bao nhiêu.
- **Chủ trì:** cài đặt và xem trước, Bắt đầu, Mời người tiếp theo (phím Space), danh sách đã nhận, tổng tiền.
- **Âm thanh:** nhạc nền Tết (ngũ cung, sáo, đàn tranh, trống lân, chũm chọe), trống dồn khi chọn, chiêng khi dừng,
  tiếng giấy khi mở phong bao, "ting" và pháo khi tiền xòe ra.
- Tờ tiền là **hình cách điệu** (màu, số tiền, hoa mai), không mô phỏng tiền thật.

## 8. Kiểm thử

`packages/office/li-xi/test`: quyền chủ trì, giai đoạn, chồng phong bao (có/không giới hạn, lời chúc), phát hết 20 người
đúng số tờ, người vào muộn, thứ tự `joined`, không mutate. `apps/server/test/office-socket.test.ts`: một lượt qua socket,
không lộ seed/phong bao trước reveal, `verifyDraw` đúng. E2E: `e2e/party-li-xi.spec.ts`.
