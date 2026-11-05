# ADR-0006: Bốc thăm ở server với commit–reveal và thuật toán công khai

- Trạng thái: Accepted · Ngày: 2026-11-05

## Bối cảnh

Trò "ai được chọn" chỉ vui khi mọi người tin kết quả. Web vòng quay thông thường chạy ngẫu nhiên ở máy người điều
khiển: người đó có thể (hoặc bị nghi là) chọn trước kết quả. Ta cần: chủ trì không biết trước, không đổi được kết quả,
và ai cũng tự kiểm tra được.

## Quyết định

- Server sinh `seed` 32 byte bằng `crypto.randomBytes`, giữ bí mật; công bố `commitment = sha256(seed)` và danh sách
  ứng viên đã chốt **trước** khi chạy hiệu ứng.
- Người thắng tính bằng hàm công khai `drawWinners(seed, drawId, candidates, n)` (HMAC-SHA256, O-04 §5).
- Sau pha build-up, server công bố `seed` và `winners`; kết quả ghi vào lịch sử, không sửa/huỷ được.
- Trang Kiểm chứng chạy lại đúng hàm đó trong trình duyệt (cùng mã `@bg/office-core`, `@noble/hashes`).
- Kịch bản hiệu ứng suy ra từ `seed` để mọi màn giống nhau; kết quả chỉ rời server ~400 ms trước khi về đích.

## Phương án đã cân nhắc

- **Random ở client chủ trì:** không kiểm chứng được → loại.
- **Random ở server, không commit:** người dùng phải tin server; chủ trì có quyền admin server vẫn bị nghi → loại.
- **Cho mọi người góp entropy (commit của từng người):** công bằng hơn nữa nhưng phức tạp, chậm, người rời giữa chừng
  làm hỏng vòng → để dành nếu sau này cần.
- **Dùng nguồn ngẫu nhiên công khai (beacon):** phụ thuộc dịch vụ ngoài, mạng công ty có thể chặn → loại.

## Hệ quả

- ✅ Chủ trì không biết trước; kết quả kiểm chứng được; dễ giải thích ("dấu vân tay được công bố trước").
- ✅ Hiệu ứng đồng bộ trên mọi màn mà không cần stream từng khung.
- ⚠️ Server vẫn là bên sinh seed: người vận hành server có thể gian lận về lý thuyết (giảm nhẹ bằng việc ghi log và
  công bố commitment trước). Chấp nhận cho mục đích giải trí nội bộ.
- ⚠️ Cần thêm dependency `@noble/hashes` (nhỏ, được kiểm toán) để mã băm chạy giống nhau ở Node và trình duyệt.
