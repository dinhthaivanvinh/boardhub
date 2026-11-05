# O-07 — Hướng dẫn UX & giao diện khu "Văn phòng"

> Bổ sung cho [docs/08-frontend-guidelines.md](../08-frontend-guidelines.md) (vẫn áp dụng: i18n, a11y, giảm chuyển động).

## 1. Ba màn hình

| Màn                | URL                                | Thiết bị     | Nội dung chính                                                                                                                               |
| ------------------ | ---------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Người tham gia** | `/office/s/[code]`                 | Điện thoại   | Con vật của mình (sửa được), trạng thái ("Đang chờ chủ trì quay…"), nút thả cảm xúc, kết quả khi bốc xong                                    |
| **Chủ trì**        | `/office/s/[code]/host`            | Laptop       | Danh sách người (kick/đổi tên/thêm vắng mặt), cài đặt lần bốc (N, kiểu, loại người đã trúng), nút **Quay**, khoá phiên, mở Sân khấu, lịch sử |
| **Sân khấu**       | `/office/s/[code]/screen`          | Máy chiếu/TV | Tiêu đề lớn, mã + QR + link khi đang chờ, đàn thú, hiệu ứng bốc, kết quả, cảm xúc bay lên. Không có nút điều khiển                           |
| Kiểm chứng         | `/office/s/[code]/verify/[drawId]` | Bất kỳ       | Commitment, seed, danh sách ứng viên, thuật toán, kết quả tự tính lại ✓/✗                                                                    |

Chủ trì mở Sân khấu bằng nút "Mở màn chiếu" (tab mới) hoặc chiếu luôn màn Chủ trì ở **chế độ trình chiếu**
(ẩn danh sách điều khiển, phím Space = Quay).

## 2. Sân khấu

- Nền tối có gradient, chữ ≥ 24 px ở 1080p (≥ 48 px cho tiêu đề và tên người thắng).
- Khi chờ: QR to ở góc, mã 6 ký tự cỡ lớn có khoảng cách chữ, số người đã vào; thú mới vào **nhảy vào** đàn.
- Đàn thú xếp lưới tự co giãn: 1–12 người cỡ 160 px; 13–60 cỡ 96 px; 61–200 cỡ 56 px (bỏ tên, hiện tên khi trúng).
- Thú offline mờ 50%; người vắng mặt có biểu tượng 📵.

## 3. Hiệu ứng bốc (mode)

Mỗi mode có hai pha: **build-up** (chưa biết kết quả, có thể lặp) và **landing** (biết kết quả, thời lượng cố định,
kết thúc đúng người thắng). Mọi số ngẫu nhiên của hiệu ứng lấy từ `createRng(seed, 'anim')` sau reveal, hoặc từ
`drawId` trong build-up ⇒ giống nhau trên mọi màn.

| Mode        | Build-up                                                               | Landing                                                               | Đợt   |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| `wheel`     | Vòng quay chia ô theo con vật, quay nhanh dần                          | Giảm tốc theo đường cong, kim dừng ở ô người thắng, ô phóng to        | MVP   |
| `race`      | Thú xếp vạch xuất phát, chạy với tốc độ dao động, dẫn đầu đổi liên tục | Người thắng tăng tốc về đích; với N > 1, N người về trước theo thứ tự | MVP   |
| `spotlight` | Đèn sân khấu quét qua đàn thú, nhanh dần                               | Đèn chậm lại, dừng trên người thắng, các con khác tối đi              | Đợt 2 |
| `claw`      | Gắp thú di chuyển qua lại trên đàn thú                                 | Hạ càng, gắp người thắng lên                                          | Đợt 2 |

Với nhiều người (> 60) `wheel` chuyển thành vòng quay theo **nhóm 12** rồi phóng to nhóm thắng (đọc được), `race`
chỉ chạy 12 con có thứ hạng ngẫu nhiên trong build-up, người thắng luôn có mặt trong landing.

## 4. Kết quả

- Thẻ người thắng giữa màn: avatar 320 px, tên, tiêu đề phiên ("đi mua trà sữa 🧋"), pháo hoa (giống
  `ResultOverlay` của board game: tắt khi giảm chuyển động).
- Điện thoại của người thắng rung (`navigator.vibrate`, nếu có) và hiện "🎉 Bạn được chọn!".
- Liên kết nhỏ "Kiểm chứng kết quả" trên màn Chủ trì và lịch sử.

## 5. Đồng bộ thời gian

- Dùng `serverOffset` (như đồng hồ board game) để đổi `startsAt`/`revealAt`/`landAt` sang giờ máy.
- Trình phát hiệu ứng là **hàm của thời gian**: `frameAt(tServer)` ⇒ tab bị ẩn rồi hiện lại vẫn đúng vị trí; người vào
  giữa chừng nhảy đúng chỗ.
- Không dựa vào `setTimeout` để đổi pha; mỗi khung `requestAnimationFrame` tính pha theo giờ.

## 6. Điện thoại (người tham gia)

- Vào phiên lần đầu: studio rút gọn (Loài · Màu · Phụ kiện + Ngẫu nhiên), nút lớn "Vào phiên".
- Màn chính: avatar lớn, tên, số người đang có, trạng thái phiên, nút cảm xúc (👏 😂 😮 🎉 ❤️ 🙈).
- Khi đang bốc: hiện cùng hiệu ứng ở cỡ nhỏ (tùy chọn) hoặc chỉ "Đang quay…" + kết quả (mặc định: kết quả + thẻ thú).

## 7. Âm thanh (đợt 2)

Trống dồn khi build-up, "ting" khi về đích, tiếng reo; chỉ phát ở Sân khấu/Chủ trì, mặc định tắt, nút 🔇/🔊 nhớ trong
localStorage. Âm thanh tự tạo hoặc giấy phép CC0, ghi nguồn trong `docs/office/assets.md`.

## 8. Truy cập

- Mọi điều khiển dùng được bằng bàn phím; nút Quay có phím tắt Space ở màn Chủ trì.
- Kết quả bốc được thông báo qua vùng `aria-live` ("Đã chọn: Mèo Cam — An").
- Con vật có `aria-label` "{tên}: {loài} {màu}".
