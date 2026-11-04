# 02 — Yêu cầu (Requirements)

> Mỗi yêu cầu có ID để tham chiếu trong code, PR và test. Mức ưu tiên: **M** = Must (MVP), **S** = Should, **C** = Could.

## 1. Yêu cầu chức năng (FR)

### 1.1 Tài khoản (AUTH)

| ID         | Yêu cầu                                                          | Ưu tiên |
| ---------- | ---------------------------------------------------------------- | ------- |
| FR-AUTH-01 | Vào chơi với tư cách **khách**, hệ thống tự sinh tên hiển thị    | M       |
| FR-AUTH-02 | Đăng ký/đăng nhập bằng email + mật khẩu hoặc OAuth (Google)      | M       |
| FR-AUTH-03 | Nâng cấp tài khoản khách lên tài khoản thật mà không mất lịch sử | S       |
| FR-AUTH-04 | Hồ sơ: avatar, tên hiển thị, thống kê theo từng game             | S       |

### 1.2 Danh mục game (CAT)

| ID        | Yêu cầu                                                            | Ưu tiên |
| --------- | ------------------------------------------------------------------ | ------- |
| FR-CAT-01 | Trang danh sách game, lọc theo số người chơi và thời lượng         | M       |
| FR-CAT-02 | Trang chi tiết game: luật chơi, biến thể, nút chọn chế độ chơi     | M       |
| FR-CAT-03 | Admin bật/tắt từng game hoặc từng biến thể mà không cần deploy lại | S       |

### 1.3 Chơi game (PLAY)

| ID         | Yêu cầu                                                                                  | Ưu tiên |
| ---------- | ---------------------------------------------------------------------------------------- | ------- |
| FR-PLAY-01 | Chơi `local` (hot-seat) hoàn toàn ở client, chơi được cả khi offline                     | M       |
| FR-PLAY-02 | Chơi với bot, chọn cấp độ (dễ / vừa / khó)                                               | M       |
| FR-PLAY-03 | Highlight nước đi hợp lệ (có thể tắt trong cài đặt)                                      | M       |
| FR-PLAY-04 | Hiển thị nước đi cuối, lượt hiện tại, đồng hồ                                            | M       |
| FR-PLAY-05 | Xin hòa, đầu hàng, xin đi lại (đối thủ phải đồng ý; chỉ áp dụng ở chế độ không xếp hạng) | M       |
| FR-PLAY-06 | Kết thúc ván: hiển thị kết quả, lý do, nút "Chơi lại"                                    | M       |
| FR-PLAY-07 | Biến thể luật và cấu hình thời gian chọn khi tạo ván                                     | M       |

### 1.4 Phòng & multiplayer (ROOM)

| ID         | Yêu cầu                                                                                                          | Ưu tiên |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| FR-ROOM-01 | Tạo phòng riêng, mời bằng link hoặc mã 6 ký tự                                                                   | M       |
| FR-ROOM-02 | Sảnh chờ: chọn ghế, sẵn sàng, chủ phòng bắt đầu ván                                                              | M       |
| FR-ROOM-03 | Chat trong phòng (có lọc từ ngữ cơ bản)                                                                          | M       |
| FR-ROOM-04 | Khi mất kết nối: giữ ghế **60 giây** (có thể cấu hình), sau đó xử thua hoặc cho bot đánh thay tùy cấu hình phòng | M       |
| FR-ROOM-05 | Ghép trận nhanh (`quick-match`) theo game, biến thể và khoảng Elo                                                | S       |
| FR-ROOM-06 | Xem trận (`spectate`), người xem không thấy thông tin ẩn                                                         | S       |
| FR-ROOM-07 | Chơi không đồng bộ (`correspondence`) kèm thông báo đến lượt                                                     | C       |

### 1.5 Lịch sử, xếp hạng (HIST)

| ID         | Yêu cầu                                                              | Ưu tiên |
| ---------- | -------------------------------------------------------------------- | ------- |
| FR-HIST-01 | Lưu mọi ván online: người chơi, cấu hình, danh sách nước đi, kết quả | M       |
| FR-HIST-02 | Replay ván đã kết thúc từng nước (tiến / lùi)                        | S       |
| FR-HIST-03 | Elo (Glicko-2) riêng cho từng game, chỉ tính ở chế độ `ranked`       | S       |
| FR-HIST-04 | Bảng xếp hạng theo game                                              | S       |

### 1.6 Quản trị (ADM)

| ID        | Yêu cầu                                               | Ưu tiên |
| --------- | ----------------------------------------------------- | ------- |
| FR-ADM-01 | Xem phòng đang hoạt động, đóng phòng                  | S       |
| FR-ADM-02 | Xử lý báo cáo người chơi, cấm chat hoặc cấm tài khoản | S       |

## 2. Yêu cầu phi chức năng (NFR)

| ID     | Nhóm             | Yêu cầu                                                                                                               |
| ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Hiệu năng        | p95 thời gian server xử lý một nước đi **< 20 ms** (không tính bot); p95 tổng độ trễ đến đối thủ **< 200 ms**         |
| NFR-02 | Hiệu năng        | Trang danh sách game: LCP **< 2,5 s** trên mạng 4G                                                                    |
| NFR-03 | Mở rộng          | Một node server chịu được **≥ 2.000 phòng** đồng thời; scale ngang bằng Redis adapter                                 |
| NFR-04 | Tin cậy          | Mất kết nối không làm mất trạng thái ván; restart server không làm mất ván đang chơi (state lưu ở Redis)              |
| NFR-05 | Bảo mật          | Server-authoritative: client không bao giờ tự quyết định kết quả nước đi ở chế độ online                              |
| NFR-06 | Bảo mật          | Không gửi thông tin ẩn ra ngoài `playerView` của người nhận                                                           |
| NFR-07 | Bảo mật          | Rate limit: tối đa 10 message/giây cho mỗi socket; mọi input đều validate bằng zod                                    |
| NFR-08 | Tính đúng        | Engine **deterministic**: cùng seed + cùng chuỗi nước đi thì luôn ra cùng trạng thái                                  |
| NFR-09 | Truy cập         | Bàn cờ dùng được bằng bàn phím; đạt WCAG 2.1 AA về tương phản; không chỉ dùng màu để phân biệt quân                   |
| NFR-10 | Đa ngôn ngữ      | Tiếng Việt (mặc định) và tiếng Anh; không hard-code chuỗi hiển thị                                                    |
| NFR-11 | Responsive       | Dùng tốt từ màn hình 360 px; hỗ trợ cả chạm và chuột                                                                  |
| NFR-12 | Khả năng bảo trì | Thêm game mới không được sửa code trong `packages/engine` hay `apps/server` (ngoại trừ một dòng đăng ký vào registry) |
| NFR-13 | Quan sát         | Log có cấu trúc (JSON), metrics (số phòng, độ trễ nước đi, lỗi), tracing cho luồng xử lý nước đi                      |
