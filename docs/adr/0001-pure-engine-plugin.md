# ADR-0001: Engine thuần, deterministic, game dạng plugin

- Trạng thái: Accepted · Ngày: 2026-11-04

## Bối cảnh

Nền tảng cần hỗ trợ nhiều game có luật rất khác nhau, chạy ở nhiều mode (local, bot, online, replay).
Nếu luật bị trộn với code mạng hoặc UI, mỗi game mới sẽ phải sửa nhiều chỗ, và rất khó chống gian lận.

## Quyết định

- Mỗi game được viết dưới dạng một object `GameDefinition` gồm các hàm thuần (xem [04](../04-game-engine-spec.md)).
- Engine không có I/O, không dùng thời gian thực, chỉ dùng RNG có seed do runner cung cấp.
- Cùng một definition chạy ở client và server; server là nguồn sự thật ở chế độ online.

## Hệ quả

- ✅ Replay, undo, debug, bot search, test property đều dễ làm.
- ✅ Thêm game không cần sửa lõi.
- ⚠️ Game có luật phụ thuộc thời gian (ví dụ phản xạ nhanh) không hợp với mô hình này; nếu cần thì phải có ADR riêng.
- ⚠️ State phải JSON-serializable, nên đôi khi phải biểu diễn kém tự nhiên hơn (mảng thay cho Set).
