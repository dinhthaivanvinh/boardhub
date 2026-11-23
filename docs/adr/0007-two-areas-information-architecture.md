# ADR-0007: Hai khu "Board game" và "Văn phòng"; danh mục board game sang `/board-games`

- Trạng thái: Accepted · Ngày: 2026-11-05 · Điều hướng được thay đổi bởi [ADR-0010](0010-chess-first-home-and-menus.md)

## Bối cảnh

Trang chủ `/` hiện là danh mục board game. Sản phẩm thêm khu "Văn phòng" với đối tượng và cách dùng khác (họp nhóm,
màn chiếu). Người dùng muốn board game nằm trong một menu riêng.

## Quyết định

- `/` là **cổng** giới thiệu hai khu (hai thẻ lớn) và lối tắt "Vào phiên bằng mã" cho cả hai loại mã.
- Danh mục board game chuyển sang `/board-games`. Các URL `/games/*`, `/play/*`, `/room/*`, `/live`, `/leaderboard`,
  `/replay/*`, `/queue`, `/profile`, `/account` **không đổi** (link mời và lịch sử cũ vẫn chạy).
- Khu Văn phòng dưới `/office/*`.
- Header: logo + hai menu thả xuống **Board game ▾** (Danh mục, Đang diễn ra, Xếp hạng) và **Văn phòng ▾**
  (Hoạt động, Thú của tôi) + Tài khoản + ngôn ngữ. Điện thoại: menu ☰ có hai nhóm.
- Mã phòng board game và mã phiên văn phòng đều 6 ký tự; ô "Vào bằng mã" ở cổng thử phiên văn phòng trước, không có
  thì sang phòng board game (một lượt gọi API kiểm tra).

## Phương án đã cân nhắc

- **Giữ `/` là danh mục board game, thêm `/office`:** khu Văn phòng bị chìm, không đúng yêu cầu → loại.
- **Đổi mọi URL board game sang `/board-games/*`:** làm hỏng link mời/replay đã chia sẻ → loại.
- **Hai subdomain:** cần cấu hình DNS/cookie, phiên đăng nhập tách rời → loại.

## Hệ quả

- ✅ Hai khu ngang hàng, dễ mở rộng thêm khu khác.
- ⚠️ E2E đang vào board game từ `/` phải đổi sang `/board-games` (hoặc qua thẻ ở cổng).
- ⚠️ Tiêu đề h1 của trang chủ đổi (test `caro.spec.ts` kiểm tra h1).
