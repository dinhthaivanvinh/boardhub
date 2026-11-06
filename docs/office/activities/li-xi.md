# Activity Spec: Lì xì Tết (`li-xi`)

> Hoạt động đầu tiên của khu **Tiệc nhóm** (`/party`, ADR-0008). Chạy trên hạ tầng phiên của khu Văn phòng và tuân thủ
> [O-04](../04-activity-spec.md). Gói: `packages/office/li-xi`.

## 1. Tổng quan

- Người lì xì (chủ trì) tạo phòng, đặt các mệnh giá và số tờ, gửi QR/link. Người không có điện thoại thì chủ trì tự thêm tên.
- Mọi người quét QR/mở link là vào thẳng căn phòng Tết trên điện thoại (tự vào phiên bằng con vật đã lưu; đổi tên/con
  vật ngay trong phòng, studio con vật dùng chung với khu Văn phòng).
- Chủ trì bấm **Bắt đầu**: màn sân khấu thành căn phòng ngày Tết có mọi người. Mỗi lượt, chủ trì bấm **Mời người tiếp theo**:
  một người được gọi lên phía trước, phong bao mở ra, tờ tiền được rút ra, phóng to và xoay ngang.
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
  phong bao đỏ bay vào, rung, nắp mở; tờ tiền nằm dọc, nhỏ hơn phong bao nên bị che hoàn toàn, được rút lên, rồi phóng to,
  xoay ngang và rung lắc; số tiền hiện lớn kèm một lời chúc Tết, pháo giấy và tiền
  vàng bung ra; mệnh giá lớn nhất có pháo hoa. Bên cạnh: chồng phong bao còn lại, danh sách đã nhận, tổng tiền.
- **Điện thoại:** chính căn phòng Tết (cỡ nhỏ, thấy mọi người và bàn phong bao), phía trên là dòng của riêng mình:
  "Đến lượt bạn!" khi được gọi (rung), rồi số tiền của mình; người khác thấy ai nhận bao nhiêu. Âm thanh tắt mặc định
  (TV phát cho cả phòng), bật bằng nút loa.
- **Chủ trì:** cài đặt và xem trước, Bắt đầu, Mời người tiếp theo (phím Space), danh sách đã nhận, tổng tiền.
- **Âm thanh:** nhạc nền Tết nhanh, vui (138 BPM, ngũ cung trưởng; sáo, đàn tranh, bass nhún, trống tùng–cắc, mõ, chũm chọe), trống dồn khi chọn, chiêng khi dừng,
  tiếng giấy khi mở phong bao, tiếng vút khi rút tiền, "ting" và pháo khi tiền xòe ra.
- Tờ tiền là **hình cách điệu** (màu, số tiền, hoa mai), không mô phỏng tiền thật.

> Đã làm (`apps/web/src/features/party/li-xi`): `timeline.ts` (các bước sau landing: walk 1,4 s, envelope 0,8 s,
> shake 1 s, open 0,6 s, pull 0,7 s, note 1,3 s, rồi shown), `LiXiStage` (sân khấu, cũng dùng cỡ nhỏ ở màn chủ trì), `LiXiHostPanel`,
> `LiXiMember` (màn điện thoại: tự vào phiên, `LiXiStage` cỡ nhỏ + `LiXiPhone`), `tet-audio.ts` (âm thanh và nhạc), `view.ts` (giấu quà của lượt đang chạy, số người chờ tính từ danh
> sách người trong phòng vì view của hoạt động chỉ gửi lại sau mỗi hành động). Nút "Mời người tiếp theo" chỉ bật khi
> phong bao trước đã mở xong. Lời chúc chọn theo `drawId` (không ngẫu nhiên) nên mọi màn giống nhau.

## 8. Kiểm thử

`packages/office/li-xi/test`: quyền chủ trì, giai đoạn, chồng phong bao (có/không giới hạn, lời chúc), phát hết 20 người
đúng số tờ, người vào muộn, thứ tự `joined`, không mutate. `apps/server/test/office-socket.test.ts`: một lượt qua socket,
không lộ seed/phong bao trước reveal, `verifyDraw` đúng. `apps/web/test/li-xi.test.ts`: khu của phiên, xem trước tiền, dòng thời gian, giấu quà. E2E:
`e2e/party-li-xi.spec.ts` (chủ trì + sân khấu + điện thoại + người vắng mặt, hết tờ có giới hạn, kiểm chứng; và bản
không hiệu ứng).
