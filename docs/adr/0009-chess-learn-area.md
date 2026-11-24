# ADR-0009: Khu "Học cờ vua" là trang con của game cờ vua, bài học là dữ liệu thuần

- Trạng thái: Accepted · Ngày: 2026-11-23

## Bối cảnh

Muốn biến cờ vua thành nền tảng học cho trẻ mới chơi, với hai tính năng: (1) giới thiệu từng quân và cách đi bằng
animation; (2) bài học khai cuộc tương tác, giải thích từng nước. Engine cờ vua đã có `fromFen`, `legalPositionMoves`,
`Board` và `PieceIcon`, nên không cần luật mới.

## Quyết định

- Đặt tại `/learn/chess/<bài>` (trang con của game, có nút "Học cờ" ở trang game). Không có trang danh sách: trang chủ có lộ trình (ADR-0010) và `/learn/chess` chuyển về trang chủ. Không thêm khu thứ tư vào điều hướng.
- Bài học là **dữ liệu JSON thuần** (`packages/games/chess/src/learn/`), không chứa logic luật. Mọi nước đi và ô đi được
  lấy từ `legalPositionMoves`, không viết lại luật (quy tắc 1, 5).
- Văn bản bài học qua i18n `vi` và `en` (quy tắc 6). Khóa i18n nằm trong `chess/src/i18n`.
- Có test kiểm tra mọi nước trong mọi bài khai cuộc đều hợp lệ theo engine (viết fixture trước, quy tắc 7).
- Tiến độ học lưu `localStorage` ở lượt đầu; đồng bộ theo tài khoản là việc sau, cần ADR riêng nếu đổi schema DB.
- Không có server, socket hay ngẫu nhiên mới. Animation chỉ ở client và tôn trọng `prefers-reduced-motion`.

## Phương án đã cân nhắc

- **Khu thứ tư "Học" ở điều hướng:** đúng hướng dài hạn nhưng sửa IA khi mới có một game → hoãn, làm lại được sau.
- **Viết lại luật đi quân riêng cho phần học:** lệch với engine, tốn bảo trì → loại.
- **Bài học là mã React riêng cho từng bài:** khó thêm khai cuộc, khó dịch → loại, dùng dữ liệu + trình phát chung.

## Hệ quả

- ✅ Thêm khai cuộc hay quân mới chỉ là thêm một mục dữ liệu và chuỗi i18n.
- ✅ Không đụng engine, protocol, DB.
- ⚠️ Nếu sau này có nhiều game học, phải chuyển lên khu "Học" chung (di chuyển route, giữ redirect).
- ⚠️ Nội dung khai cuộc cần người biết cờ duyệt về độ chính xác và giọng văn cho trẻ.
