# ADR-0013: Vai trò admin gắn với tài khoản, và dữ liệu hoạt động cho thống kê

- Trạng thái: Accepted · Ngày: 2026-11-26

## Bối cảnh

Quyền admin trước đây là phép so email của tài khoản với `ADMIN_EMAILS`. Đăng ký không xác minh email, nên ai đăng ký
trước một địa chỉ trong danh sách mà chưa có tài khoản sẽ thành admin. Trang admin sắp hiển thị dữ liệu của trẻ em và cần
nhiều vai trò. Thống kê học tập theo thời gian cũng cần dữ liệu mà hệ thống chưa ghi: tiến độ chỉ lưu id đã xong.
Server production chạy trên Render gói free, không có shell để cấp quyền bằng lệnh.

## Quyết định

1. Vai trò nằm trong DB: `roles` và `user_roles` (một tài khoản có thể có nhiều vai trò). Quyền của từng vai trò sẽ khai
   báo trong code. Cho đến khi có phân quyền, chỉ `super_admin` dùng được `/admin`.
2. Super Admin đầu tiên: lúc khởi động, **nếu chưa ai có vai trò này**, server cấp cho tài khoản **đã đăng ký** có email
   trong `ADMIN_EMAILS`. Đăng ký mới bằng email trong danh sách bị từ chối. `ADMIN_SELF_REGISTER` mở lại cho dev và
   test, và bị cấm ở production.
3. Sự kiện học (`learn_events`) được client gửi **lúc hoàn thành**, kể cả khi không đăng nhập. Đã đăng nhập thì lưu theo
   tài khoản, chưa thì theo mã ngẫu nhiên của trình duyệt; hai loại không được nối với nhau. Chỉ lưu id nội dung học và
   thời điểm. Giữ 400 ngày.
4. Thêm `users.last_seen_at` và số phiên trong `daily_visits`.
5. Để admin biết ai đã truy cập, lượt vào của người dùng tài khoản được ghi thêm vào `account_visits` (ngày, tài
   khoản), tách khỏi `daily_visits`: hai bảng không có khoá chung, nên mã trình duyệt không bị gắn với tài khoản. Người
   chưa đăng nhập vẫn không có danh tính. Tên và email chỉ trả cho admin. Giữ 90 ngày.

## Phương án đã cân nhắc

- Giữ cách so email, thêm xác minh email: cần dịch vụ gửi thư, và vẫn không có vai trò.
- Một cột `users.role`: đơn giản hơn nhưng mỗi người chỉ một vai trò, và không lưu được ai cấp, lúc nào.
- Cấp Super Admin bằng lệnh chạy trên server: không làm được trên gói hosting đang dùng.
- Suy sự kiện học từ phần mới thêm khi đồng bộ tiến độ: thời điểm là lúc đồng bộ, tiến độ cũ bị tính thành học hôm nay,
  và không đếm được người không đăng nhập.

## Hệ quả

- ✅ Không chiếm được quyền admin bằng cách đăng ký trước một email.
- ✅ Có dữ liệu cho các biểu đồ của trang Tổng quan, kể từ ngày triển khai.
- ⚠️ Bỏ email khỏi `ADMIN_EMAILS` không thu hồi quyền; trước khi có trang vai trò phải xoá dòng trong `user_roles`.
- ⚠️ Sự kiện gửi lúc mất mạng bị bỏ qua, và endpoint công khai nên có thể bị gửi số liệu giả (giới hạn tần suất, chỉ nhận
  id có thật, mỗi người một lần mỗi ngày cho mỗi id). Số liệu dùng để theo dõi xu hướng, không dùng để chấm điểm.
- ⚠️ Khi làm chức năng xoá tài khoản phải xoá cả `learn_events` của tài khoản đó.
