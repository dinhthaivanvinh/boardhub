# O-02 — Yêu cầu khu "Văn phòng"

> ID dùng trong code, PR và test. Ưu tiên: **M** = Must (MVP), **S** = Should, **C** = Could.

## 1. Yêu cầu chức năng

### 1.1 Điều hướng (NAV)

| ID        | Yêu cầu                                                                                                                                           | Ưu tiên |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-NAV-01 | Trang `/` là cổng với hai khu: Board game và Văn phòng                                                                                            | M       |
| FR-NAV-02 | Danh mục board game chuyển sang `/board-games`; mọi URL board game cũ (`/games`, `/play`, `/room`, `/live`, `/leaderboard`, `/replay`) giữ nguyên | M       |
| FR-NAV-03 | Thanh trên có menu thả xuống "Board game ▾" và "Văn phòng ▾"; trên điện thoại menu ☰ chia hai nhóm                                               | M       |
| FR-NAV-04 | Trang `/office`: danh sách hoạt động, "Tạo phiên", ô "Vào bằng mã", lối vào "Thú của tôi"                                                         | M       |

### 1.2 Con vật đại diện (AVA)

| ID        | Yêu cầu                                                                                  | Ưu tiên |
| --------- | ---------------------------------------------------------------------------------------- | ------- |
| FR-AVA-01 | Chọn loài trong ≥ 8 loài tự vẽ                                                           | M       |
| FR-AVA-02 | Tùy biến màu chính, màu phụ, hoa văn, mắt/biểu cảm, phụ kiện, màu nền; xem trước tức thì | M       |
| FR-AVA-03 | Nút "Ngẫu nhiên" tạo một con vật hợp lệ                                                  | M       |
| FR-AVA-04 | Lưu avatar vào hồ sơ người dùng (khách hoặc tài khoản), dùng lại ở mọi phiên             | M       |
| FR-AVA-05 | Trong phiên có thể đổi avatar/tên; thay đổi hiện trên sân khấu trong < 1 giây            | M       |
| FR-AVA-06 | Avatar hiển thị nét ở mọi cỡ (24 px trong danh sách đến 320 px trên sân khấu)            | M       |
| FR-AVA-07 | Tải thẻ con vật thành ảnh PNG                                                            | C       |

### 1.3 Phiên văn phòng (SES)

| ID        | Yêu cầu                                                                                          | Ưu tiên |
| --------- | ------------------------------------------------------------------------------------------------ | ------- |
| FR-SES-01 | Tạo phiên: chọn hoạt động, tiêu đề, cài đặt; nhận mã 6 ký tự + link + QR                         | M       |
| FR-SES-02 | Vào phiên bằng mã/link/QR không cần đăng ký (dùng danh tính khách sẵn có)                        | M       |
| FR-SES-03 | Ba màn: **Chủ trì** (điều khiển), **Sân khấu** (chiếu, chỉ xem), **Người tham gia** (điện thoại) | M       |
| FR-SES-04 | Danh sách người tham gia cập nhật trực tiếp; người mất kết nối hiện mờ, vào lại giữ nguyên chỗ   | M       |
| FR-SES-05 | Chủ trì: khoá/mở phiên, kick, đổi tên người tham gia, chuyển quyền chủ trì                       | M       |
| FR-SES-06 | Chủ trì thêm "người vắng mặt" (thú do chủ trì tạo, không có điện thoại)                          | S       |
| FR-SES-07 | Phiên hết hạn sau 24 giờ không hoạt động; dữ liệu phiên bị xoá sau 30 ngày                       | M       |
| FR-SES-08 | Tối đa 200 người mỗi phiên                                                                       | M       |
| FR-SES-09 | Thả cảm xúc (emoji) bay lên sân khấu, giới hạn tần suất                                          | S       |

### 1.4 Bốc thăm (DRAW) — dùng cho Thú may mắn và các hoạt động ngẫu nhiên sau này

| ID         | Yêu cầu                                                                                         | Ưu tiên |
| ---------- | ----------------------------------------------------------------------------------------------- | ------- |
| FR-DRAW-01 | Chọn số người được chọn N (1 ≤ N ≤ số người còn lại)                                            | M       |
| FR-DRAW-02 | Tuỳ chọn loại người đã được chọn ở các lần trước khỏi lần sau                                   | M       |
| FR-DRAW-03 | Kiểu hiệu ứng: Vòng quay, Đua thú (MVP); Đèn sân khấu, Gắp thú (đợt 2)                          | M / S   |
| FR-DRAW-04 | Mọi màn hình chạy cùng hiệu ứng, kết thúc cùng lúc (lệch < 200 ms), kết thúc ở đúng người thắng | M       |
| FR-DRAW-05 | Kết quả hiển thị lớn kèm con vật thắng, pháo hoa; có nút "Quay tiếp"                            | M       |
| FR-DRAW-06 | Lịch sử các lần bốc trong phiên (ai được chọn, lúc nào, kiểu hiệu ứng)                          | M       |
| FR-DRAW-07 | Có thể tắt hiệu ứng (giảm chuyển động) → hiện kết quả ngay                                      | M       |
| FR-DRAW-08 | Âm thanh có nút tắt                                                                             | C       |

### 1.5 Công bằng (FAIR)

| ID         | Yêu cầu                                                                                          | Ưu tiên |
| ---------- | ------------------------------------------------------------------------------------------------ | ------- |
| FR-FAIR-01 | Ngẫu nhiên sinh ở server bằng `crypto`, không bao giờ ở client                                   | M       |
| FR-FAIR-02 | Trước khi quay, công bố **commitment** `sha256(seed)` và danh sách ứng viên đã chốt              | M       |
| FR-FAIR-03 | Sau khi quay, công bố `seed`; trang **Kiểm chứng** tự tính lại người thắng ngay trên trình duyệt | M       |
| FR-FAIR-04 | Kết quả đã công bố không sửa/huỷ được; nằm trong lịch sử phiên                                   | M       |
| FR-FAIR-05 | Thuật toán chọn người thắng được mô tả công khai trong tài liệu và trang kiểm chứng              | M       |

## 2. Yêu cầu phi chức năng (NFR)

| ID         | Yêu cầu                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| NFR-OFF-01 | 200 người/phiên, 50 phiên đồng thời trên một server; vào phiên < 1 giây (p95) trong LAN               |
| NFR-OFF-02 | Danh sách người tham gia gửi theo **thay đổi** (diff), không gửi lại toàn bộ mỗi lần                  |
| NFR-OFF-03 | Màn Sân khấu đọc được từ cuối phòng họp: chữ ≥ 24 px ở 1080p, tương phản AA                           |
| NFR-OFF-04 | Điện thoại 360 px: chọn và sửa avatar không cần cuộn ngang; vùng chạm ≥ 44 px                         |
| NFR-OFF-05 | Không thu thập dữ liệu cá nhân ngoài tên hiển thị do người dùng nhập                                  |
| NFR-OFF-06 | i18n vi/en, không chuỗi hard-code (CLAUDE.md quy tắc 6)                                               |
| NFR-OFF-07 | Hiệu ứng ≥ 50 fps trên laptop phổ thông với 200 con vật (SVG/Canvas, không re-render React mỗi khung) |
| NFR-OFF-08 | Tôn trọng `prefers-reduced-motion` và cài đặt "Hiệu ứng"                                              |
