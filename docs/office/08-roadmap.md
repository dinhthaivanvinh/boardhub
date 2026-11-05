# O-08 — Lộ trình khu "Văn phòng"

> Mỗi mốc kết thúc bằng: lint + typecheck + test + e2e xanh, tài liệu khớp code, commit và gộp vào main.

## O0 — Nền móng (tài liệu & điều hướng)

- [x] Phân tích, yêu cầu, kiến trúc, đặc tả hoạt động, avatar, giao thức, UX, lộ trình (`docs/office/*`)
- [x] ADR-0005 (hợp đồng hoạt động), ADR-0006 (bốc thăm commit–reveal), ADR-0007 (hai khu, URL)
- [x] Skills `office-*`
- [x] Cổng `/` hai khu; danh mục board game sang `/board-games`; menu thả xuống Board game ▾ / Văn phòng ▾ (FR-NAV-01…04). `/office` và `/office/avatar` hiện các mục "Sắp ra mắt" cho tới O1–O3

## O1 — Con vật đại diện

- [x] `@bg/avatars`: schema, catalog (10 loài, 6 mắt, 5 miệng, 10 phụ kiện, 24 màu), renderer theo lớp, `randomAvatar`
- [x] `users.avatar` + `GET/PUT /api/me/avatar`
- [x] Studio `/office/avatar` (điện thoại + máy tính), lưu tự động; sửa tên hiển thị ngay trong studio
- **Demo:** mỗi người tạo và lưu con vật của mình; mở trên máy khác (cùng tài khoản) vẫn thấy.

## O2 — Phiên văn phòng

- [x] `@bg/office-core`: hợp đồng, `fair-draw` (+ test phân phối, verify), helper test
- [x] Protocol `office:*`, `OfficeHub`, namespace `/office`, lưu trữ memory/Redis/Postgres, job hết hạn
- [x] Màn Người tham gia / Chủ trì / Sân khấu (chờ + danh sách + QR), khoá, kick, đổi tên, thêm vắng mặt
- **Demo:** 10 điện thoại vào bằng QR, con vật hiện trên màn chiếu trong < 1 giây.

## O3 — Thú may mắn (MVP)

- [ ] Gói `@bg/office-lucky-animal`: cài đặt, hành động, view
- [ ] Bốc thăm commit–reveal hai pha, đồng bộ thời gian; hiệu ứng `race` và `wheel`
- [ ] Kết quả + pháo hoa, lịch sử, trang Kiểm chứng
- [ ] E2E: 3 trình duyệt (chủ trì, sân khấu, người tham gia) cùng thấy một kết quả; trang kiểm chứng ✓
- **Demo:** "Ai mua trà sữa?" với cả team, mọi màn hình về đích cùng lúc.

## O4 — Hoàn thiện trải nghiệm

- [ ] Hiệu ứng `spotlight`, `claw`; thả cảm xúc; âm thanh (tắt mặc định); tải thẻ con vật PNG
- [ ] Chế độ trình chiếu ở màn Chủ trì (phím Space)

## O5 — Thêm hoạt động

- [ ] Chia đội (`team-split`) · Thứ tự ngẫu nhiên (`random-order`) · Bốc quà (`prize-draw`)
- [ ] Bí mật Santa (`secret-santa`, thông tin ẩn) · Bình chọn nhanh · Câu hỏi phá băng
