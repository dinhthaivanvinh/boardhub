# ADR-0010: Trang chủ là giới thiệu cờ vua; menu chỉ giữ Học cờ, Chơi cờ vua và Board game

- Trạng thái: Accepted · Ngày: 2026-11-24

## Bối cảnh

Trọng tâm của sản phẩm chuyển sang cờ vua cho người mới (học quân, nước đặc biệt, khai cuộc; ADR-0009). Cổng `/` cũ
đặt ba khu ngang hàng (Board game, Văn phòng, Tiệc nhóm; ADR-0007, ADR-0008), nên người đến để học cờ phải chọn giữa
những thứ không liên quan, và menu có hai nhóm họ không dùng.

## Quyết định

- `/` là **trang giới thiệu cờ vua**: hero với hai nút (Bắt đầu học, Chơi với máy), "Cờ vua là gì?", lộ trình học 4
  bước, sáu quân cờ dẫn vào bài học, và một thẻ dẫn sang các board game khác kèm ô "Có mã phòng?".
- Header và menu điện thoại: **Học cờ**, **Chơi cờ vua** và nhóm **Board game ▾** (danh mục, đang diễn ra, xếp hạng).
- Văn phòng và Tiệc nhóm **chỉ ẩn khỏi menu và trang chủ**: route `/office/*`, `/party/*`, socket `/office`, mã phiên và
  ô nhập mã vẫn hoạt động; không xoá code. Cờ `SHOW_WORKPLACE_AREAS` trong `features/settings/nav-links.ts` đưa chúng
  trở lại menu.
- Các game khác vẫn ở `/board-games` như cũ.

## Phương án đã cân nhắc

- **Xoá hẳn hai khu:** mất công đã làm, người đang dùng phiên Văn phòng/Tiệc mất đường vào → loại.
- **Giữ cổng ba khu, thêm thẻ Học cờ:** không đạt mục tiêu "trang chủ là cờ vua" → loại.
- **Chuyển cờ vua thành sản phẩm riêng:** chia đôi hạ tầng; chưa cần → hoãn.

## Hệ quả

- ✅ Người mới thấy ngay cách học và chơi; menu gọn.
- ✅ Bật lại hai khu chỉ bằng một cờ.
- ⚠️ Hai khu không còn lối đi từ giao diện; ai cần phải có đường dẫn (sitemap vẫn liệt kê). Cân nhắc `noindex` nếu muốn ẩn khỏi tìm kiếm.
- ⚠️ Từ nay ADR-0007 chỉ còn đúng về cấu trúc route, không còn đúng về điều hướng.
