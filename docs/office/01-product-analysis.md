# O-01 — Phân tích sản phẩm: khu "Văn phòng"

> Giai đoạn 1 (Analyze & Planning) cho khu trò chơi dành cho nhân viên văn phòng. Tài liệu Board game giữ nguyên ở
> `docs/01…11`; mọi tài liệu của khu này nằm trong `docs/office/` và có tiền tố **O-**.

## 1. Tầm nhìn

Một chỗ để cả team **cùng vui trong 1–2 phút**, ngay trong cuộc họp hay giờ nghỉ, không cần cài đặt hay tài khoản:
mỗi người mở web trên điện thoại, chọn **một con vật đại diện** do mình tự trang trí, rồi cả phòng cùng xem trò chơi
**bốc ngẫu nhiên** ai là người "được chọn" (đi mua trà sữa, thuyết trình trước, trực cuối tuần, nhận quà…).

Câu then chốt: **"Vui, nhanh, và ai cũng tin là công bằng."**

## 2. Vấn đề & cơ hội

| Vấn đề hiện tại                                                        | Cơ hội                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Chọn người bằng "oẳn tù tì", rút giấy, hay web vòng quay gõ tên tay    | Mỗi người tự vào, tự có "nhân vật" của mình, không ai phải nhập danh sách  |
| Web vòng quay có sẵn: người điều khiển có thể bị nghi "chỉnh" kết quả  | Bốc thăm ở server + **commit–reveal**: ai cũng kiểm tra được               |
| Hoạt động phá băng nhàm chán, không có dấu ấn                          | Avatar con vật tự trang trí, giữ lại qua các buổi: tạo bản sắc, tiếng cười |
| Họp online/hybrid: người ở xa không tham gia được trò bốc thăm tại chỗ | Mọi người tham gia qua link/QR, màn chiếu và điện thoại thấy cùng một cảnh |

## 3. Personas

| Persona                                                 | Mô tả                                        | Nhu cầu chính                                                          |
| ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| **Chủ trì (Host)** — trưởng nhóm, HR, người dẫn sự kiện | Mở phiên, chiếu lên màn hình lớn, bấm "Quay" | Tạo phiên < 30 giây, điều khiển dễ trên laptop, chống bị nghi gian lận |
| **Người tham gia** — nhân viên                          | Vào bằng điện thoại, ít thời gian            | Vào bằng QR/mã 6 ký tự, chọn thú nhanh, thấy mình trên màn chiếu       |
| **Khán giả màn chiếu**                                  | Cả phòng nhìn màn hình lớn                   | Hiệu ứng to, rõ, kịch tính; tên và con vật dễ nhận ra                  |
| **Người tham gia từ xa**                                | Họp online                                   | Thấy cùng hiệu ứng, cùng lúc với phòng họp                             |

## 4. Tình huống sử dụng chính

1. **"Ai đi mua trà sữa?"** — chọn 1 người trong 5–15 người. Thường lặp lại mỗi tuần.
2. **Thứ tự thuyết trình / daily stand-up** — xáo thứ tự cả nhóm.
3. **Bốc thăm quà tất niên / sinh nhật công ty** — 50–200 người, nhiều vòng, nhiều giải, mỗi người trúng tối đa 1 lần.
4. **Chia đội** cho team building, hackathon.
5. **Phá băng** buổi onboarding: chọn ngẫu nhiên người trả lời câu hỏi.

## 5. Sản phẩm đề xuất

### 5.1 Kiến trúc thông tin (menu)

- `/` trở thành **cổng** với hai khu: **Board game** và **Văn phòng**.
- **Board game**: danh mục hiện tại chuyển sang `/board-games`; `/games/*`, `/play/*`, `/room/*`, `/live`,
  `/leaderboard` giữ nguyên URL (không làm hỏng link mời đang có).
- **Văn phòng** (`/office`): danh sách hoạt động, nút "Tạo phiên", ô "Vào bằng mã", và **"Thú của tôi"** (studio avatar).
- Thanh trên cùng có hai menu thả xuống: **Board game ▾** (Danh mục · Đang diễn ra · Xếp hạng) và
  **Văn phòng ▾** (Hoạt động · Thú của tôi). Trên điện thoại: menu ☰ chia hai nhóm.

### 5.2 Hoạt động đầu tiên: **Thú may mắn** (bốc thăm bằng con vật)

1. Chủ trì tạo phiên, đặt tiêu đề ("Ai mua trà sữa hôm nay?"), chiếu màn **Sân khấu** có mã + QR.
2. Mọi người quét QR → chọn/sửa con vật (lấy sẵn con vật đã lưu nếu có) → con vật xuất hiện trên sân khấu.
3. Chủ trì chọn kiểu bốc (Đua thú, Vòng quay, Đèn sân khấu, Gắp thú) và số người được chọn, bấm **Quay**.
4. Mọi màn hình chạy **cùng một hiệu ứng, cùng lúc**, kết thúc ở người được chọn → pháo hoa, thẻ con vật thắng.
5. Có lịch sử các lần bốc và trang **kiểm chứng** (xem §6).

### 5.3 Con vật đại diện (avatar)

- ~10 loài tự vẽ (mèo, chó, cáo, gấu trúc, thỏ, gấu, chim cánh cụt, ếch, cú, hổ…), mỗi loài vẽ bằng SVG theo lớp.
- Tùy biến: màu lông chính/phụ, hoa văn (trơn, sọc, đốm), mắt/biểu cảm, phụ kiện (mũ, kính, khăn, nơ, tai nghe),
  màu nền, tên hiển thị. Có nút **Ngẫu nhiên**.
- Lưu vào hồ sơ (khách hay tài khoản đều được) → dùng lại ở mọi phiên. Tự vẽ, không dùng nhân vật thương mại
  (CLAUDE.md quy tắc 9).

### 5.4 Bổ sung đề xuất sau phân tích

| #   | Bổ sung                                                                                               | Vì sao                                                                          | Ưu tiên          |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| B1  | **Commit–reveal + trang kiểm chứng**                                                                  | Lý do lớn nhất khiến người ta nghi trò bốc thăm; khác biệt so với web vòng quay | Must             |
| B2  | **Màn Sân khấu riêng** cho máy chiếu + QR                                                             | Phòng họp nhìn một màn lớn, điện thoại chỉ để tham gia                          | Must             |
| B3  | Chọn **N người**, **loại người đã trúng**                                                             | Bốc quà nhiều giải, thứ tự thuyết trình                                         | Must             |
| B4  | Nhiều **kiểu hiệu ứng** bốc thăm                                                                      | Dùng hằng tuần vẫn không chán                                                   | Should           |
| B5  | Chủ trì **thêm người vắng mặt** (thú do chủ trì tạo)                                                  | Có người không mang điện thoại / nghỉ phép vẫn cần được tính                    | Should           |
| B6  | **Thả cảm xúc** (emoji bay lên sân khấu)                                                              | Tăng không khí, người từ xa cũng "có mặt"                                       | Should           |
| B7  | **Âm thanh** (trống, tiếng reo) có nút tắt                                                            | Kịch tính khi chiếu                                                             | Could            |
| B8  | **Tải thẻ con vật** (ảnh PNG)                                                                         | Chia sẻ lên chat nhóm, tạo bản sắc                                              | Could            |
| B9  | Thêm hoạt động: Chia đội, Thứ tự ngẫu nhiên, Bốc quà, Bí mật Santa, Bình chọn nhanh, Câu hỏi phá băng | Một nơi cho mọi hoạt động nhỏ của team                                          | Could (lộ trình) |

### 5.5 Danh mục hoạt động & lộ trình

| Đợt   | Hoạt động                              | Cơ chế                                                             |
| ----- | -------------------------------------- | ------------------------------------------------------------------ |
| MVP   | **Thú may mắn** (`lucky-animal`)       | Bốc N người, loại người đã trúng, 2 kiểu hiệu ứng                  |
| Đợt 2 | Thêm hiệu ứng, thả cảm xúc, âm thanh   |                                                                    |
| Đợt 2 | **Chia đội** (`team-split`)            | Chia K đội đều nhau, hiệu ứng thú chạy về sân đội                  |
| Đợt 2 | **Thứ tự ngẫu nhiên** (`random-order`) | Xáo cả danh sách, thú xếp hàng                                     |
| Đợt 3 | **Bốc quà** (`prize-draw`)             | Danh sách giải, nhiều vòng, mỗi người trúng 1 lần                  |
| Đợt 3 | **Bí mật Santa** (`secret-santa`)      | Ghép cặp bí mật, mỗi người chỉ thấy người mình tặng (thông tin ẩn) |
| Sau   | Bình chọn nhanh, Câu hỏi phá băng      | Không ngẫu nhiên; dùng chung avatar và phiên                       |

## 6. Công bằng (vì sao cần commit–reveal)

Ngẫu nhiên ở **server** bằng `crypto` (không phải `Math.random`, không ở máy chủ trì). Trước khi quay, server công bố
**dấu vân tay** `sha256(seed)` của hạt giống bí mật cùng danh sách người tham gia bị "chốt". Sau khi quay, server công
bố `seed`; ai cũng tính lại được người thắng bằng thuật toán công khai. Chủ trì **không thể** biết trước kết quả, và
kết quả đã công bố không thể đổi hay huỷ (nằm trong lịch sử). Chi tiết: [O-04 §5](04-activity-spec.md), [ADR-0006](../adr/0006-fair-draw-commit-reveal.md).

## 7. Phạm vi

- **Trong phạm vi (MVP):** menu hai khu, studio avatar, phiên văn phòng (tạo/vào/rời/kick/khoá), màn Sân khấu, Thú may
  mắn với 2 hiệu ứng, chọn N người, loại người đã trúng, lịch sử + kiểm chứng, vi/en, điện thoại + máy chiếu.
- **Ngoài phạm vi (MVP):** đăng nhập SSO công ty, phân quyền theo tổ chức, phát trực tiếp âm thanh/video, quà thật,
  tích hợp Slack/Teams (để sau), tính phí.

## 8. Rủi ro & cách giảm thiểu

| Rủi ro                                                           | Giảm thiểu                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bị nghi gian lận                                                 | Commit–reveal, trang kiểm chứng, lịch sử không xoá được trong phiên                                                            |
| 200 người vào cùng lúc làm nghẽn (mỗi thay đổi gửi cả danh sách) | Gửi **sự kiện thay đổi** (diff), giới hạn tần suất sửa avatar, snapshot chỉ khi vào/kết nối lại                                |
| Hiệu ứng lệch nhau giữa các màn hình                             | Server gửi `startsAt` theo giờ server + kịch bản hiệu ứng suy ra từ `seed`; client bù lệch giờ                                 |
| Tên/hình phản cảm trên màn chiếu                                 | Chủ trì đổi tên/kick; giới hạn độ dài tên; avatar chỉ từ bộ phận có sẵn (không tải ảnh lên)                                    |
| Người lạ vào phiên công ty                                       | Mã 6 ký tự + chủ trì **khoá phiên**; phiên tự hết hạn sau 24 giờ                                                               |
| Mạng công ty chặn WebSocket                                      | Socket.IO tự lùi về long-polling (đã có ở nền tảng)                                                                            |
| Làm phình lõi Board game                                         | Hợp đồng `ActivityDefinition` riêng, gói riêng; chỉ dùng chung hạ tầng ([ADR-0005](../adr/0005-office-activities-contract.md)) |

## 9. Chỉ số thành công (KPI)

- Thời gian từ "Tạo phiên" đến lần quay đầu tiên **< 2 phút** với 10 người.
- ≥ 90% người tham gia vào phiên thành công bằng QR trong lần đầu.
- Hiệu ứng trên các màn hình kết thúc lệch nhau **< 200 ms**.
- Phiên lặp lại hằng tuần: ≥ 40% chủ trì tạo phiên lần 2 trong 14 ngày.

## 10. Câu hỏi mở (cần người dùng xác nhận)

1. Khu Văn phòng có cần **giới hạn truy cập** (mật khẩu phiên, chỉ email công ty) hay mã phiên + khoá là đủ?
2. Chủ trì có mặc định **tham gia bốc** không (mặc định đề xuất: không, có thể bật)?
3. Số người tối đa mỗi phiên: đề xuất **200**.
4. Có cần đăng nhập Google/Microsoft của công ty ở giai đoạn sau không?
