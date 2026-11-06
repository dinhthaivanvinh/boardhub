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

- [x] Gói `@bg/office-lucky-animal`: cài đặt, hành động, view
- [x] Bốc thăm commit–reveal hai pha, đồng bộ thời gian; hiệu ứng `race` và `wheel`
- [x] Kết quả + pháo hoa, lịch sử, trang Kiểm chứng (`/office/s/:code/verify/:drawId`, tính lại ngay trong trình duyệt)
- [x] E2E: chủ trì, 2 sân khấu (1 tắt hiệu ứng), 2 điện thoại cùng thấy một kết quả; trang kiểm chứng ✓
- **Demo:** "Ai mua trà sữa?" với cả team, mọi màn hình về đích cùng lúc.

## O4 — Hoàn thiện trải nghiệm

- [x] Hiệu ứng `spotlight`, `claw`; thả cảm xúc; âm thanh (tắt mặc định, tổng hợp bằng Web Audio); tải thẻ con vật PNG
- [x] Chế độ trình chiếu ở màn Chủ trì (toàn màn hình, Space quay, Esc thoát)
- [x] `wheel` > 60 người quay theo nhóm 12 (O-07 §3); `GET /api/office/:code/draws`
- [x] Điện thoại: sau lượt đầu hiện "Chờ chủ trì quay lượt tiếp theo"

## P1 — Khu Tiệc nhóm: Lì xì Tết (ADR-0008)

- [x] Bốc thăm có phần thưởng: `DrawRequest.prizes`, `drawPrizes`, `verifyDraw` kiểm cả phần thưởng; cột `prizes`,
      `awarded` trong `office_draws`
- [x] Gói `@bg/office-li-xi`: mệnh giá và số tờ (có/không giới hạn), chồng phong bao, thứ tự ngẫu nhiên/theo lúc vào
- [x] Khu `/party` (cổng, menu, trang danh sách), form tạo phòng có xem trước tổng tiền, phiên ở `/party/s/:code`
- [x] Sân khấu căn phòng Tết: đèn rọi, bước lên bục, phong bao mở, tờ tiền cách điệu, lời chúc, pháo giấy/tiền
      vàng/pháo hoa; âm thanh và nhạc nền Tết tổng hợp bằng Web Audio
- [x] Chủ trì (Bắt đầu, Mời người tiếp theo / Space, trình chiếu), điện thoại ("Đến lượt bạn!"), trang kiểm chứng
- [x] E2E `e2e/party-li-xi.spec.ts`
- **Demo:** cả nhà quét QR, ông bà không có điện thoại được thêm tên; từng người lên nhận phong bao trên TV.

## O5 — Thêm hoạt động

- [ ] Chia đội (`team-split`) · Thứ tự ngẫu nhiên (`random-order`) · Bốc quà (`prize-draw`)
- [ ] Bí mật Santa (`secret-santa`, thông tin ẩn) · Bình chọn nhanh · Câu hỏi phá băng
