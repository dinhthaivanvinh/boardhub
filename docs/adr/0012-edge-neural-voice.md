# ADR-0012: Giọng đọc thu sẵn dùng giọng thần kinh của Edge, đọc chậm hơn

- Trạng thái: Accepted · Ngày: 2026-11-25
- Thay: phần "giọng Piper" của [ADR-0011](0011-prerecorded-lesson-voice.md). Cách phát file mp3 thu sẵn giữ nguyên.

## Bối cảnh

Sau một ngày dùng thử, chủ sản phẩm nhận xét giọng Piper `vi_VN-vais1000-medium` đọc hơi nhanh và chưa hay; giọng "Đọc to"
của trình duyệt Edge nghe hay hơn. ADR-0011 đã loại Edge TTS vì không có giấy phép dùng cho sản phẩm.

## Quyết định

- Tạo file mp3 bằng giọng `vi-VN-HoaiMyNeural` của Edge qua gói `node-edge-tts` (dịch vụ đọc của Microsoft Edge), tốc độ
  `-25%` (đặt bằng `VOICE_RATE`, giọng bằng `VOICE_NAME`), 24 kHz, 48 kbps, một kênh.
- Chỉ gọi dịch vụ lúc **tạo file**, bằng tay, một câu mỗi lần và có nghỉ giữa các câu (dịch vụ trả 429 nếu gọi nhanh). Người
  dùng cuối không bao giờ gọi dịch vụ; file nằm trong git và được phát như cũ.
- Bỏ dòng ghi nguồn VAIS-1000 ở cuối bài học và trong `index.json`, vì giọng không còn lấy từ bộ dữ liệu đó.

## Rủi ro đã chấp nhận

- Đây là dịch vụ **không chính thức**: Microsoft không công bố nó là API cho bên thứ ba, điều khoản dùng cho sản phẩm không rõ,
  và nó có thể đổi hoặc ngừng. File đã tạo không bị ảnh hưởng, nhưng không tạo thêm được nếu dịch vụ ngừng.
- Chữ của bài học được gửi tới máy chủ Microsoft lúc tạo file (chỉ là nội dung bài học công khai).
- Cách rút lui: Azure Speech (có giá và hợp đồng rõ) có cùng tên giọng `vi-VN-HoaiMyNeural`; chỉ cần đổi lời gọi trong
  `tools/voice/build.mts`, phần còn lại không đổi. Nên đổi sang đó nếu dự án có mục đích thương mại.

## Hệ quả

- ✅ Giọng tự nhiên hơn, đọc chậm hơn cho trẻ 5 tuổi.
- ✅ Không cần mô hình 67 MB và thư viện native như Piper.
- ⚠️ Cần mạng và có thể bị giới hạn tốc độ khi tạo lại file (khoảng 400 câu mất hơn 30 phút).
