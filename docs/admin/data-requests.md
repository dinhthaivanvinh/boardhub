# Xử lý yêu cầu về dữ liệu cá nhân

Chính sách quyền riêng tư (`/privacy`) hứa cho người dùng và phụ huynh xem, sửa, xóa dữ liệu. Hiện chưa có nút trong
`/admin`, nên làm thủ công.

1. **Xác minh:** yêu cầu phải gửi từ chính email đã đăng ký. Không chắc thì hỏi thêm, không gửi dữ liệu cho người chưa
   xác minh.
2. **Sao lưu** database (hoặc tạo branch trên Neon) trước khi xóa. Xóa bản sao tạm này sau khi kiểm tra xong, vì nó
   vẫn chứa dữ liệu vừa xóa.
3. **Xóa:** mở [delete-account.sql](delete-account.sql), thay địa chỉ email ở câu lệnh đầu, chạy trọn file trong
   SQL editor của Neon hoặc bằng `psql`. Script dừng và không đổi gì nếu không khớp đúng một tài khoản. **Không commit
   file đã điền email thật.**
4. **Phần script không làm:**
   - Tên trong kết quả bốc thăm nhóm (`office_draws.candidates`) và tiêu đề phiên (`office_sessions`) giữ nguyên để
     kiểm chứng. Nếu người yêu cầu muốn gỡ, sửa tay đúng bản ghi đó (phiên đã sửa tên sẽ không còn khớp cam kết).
   - Nhật ký máy chủ và bản sao lưu cũ tự hết hạn theo thời gian lưu.
   - Dữ liệu trong trình duyệt: người dùng tự xóa dữ liệu trang web.
5. **Trả lời** người yêu cầu những gì đã xóa và những gì còn lại.

**Xem dữ liệu:** xuất các dòng có `user_id` của người đó (và dòng trong `users`, trừ `password_hash`).

Khi thêm bảng hoặc cột chứa dữ liệu cá nhân, cập nhật script này, nội dung `/privacy` (cả `vi` và `en`) và
`LEGAL_UPDATED` trong `apps/web/src/features/legal/site-info.ts`.
