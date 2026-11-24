# ADR-0011: Giọng đọc của bài học là file mp3 thu sẵn, giọng trình duyệt chỉ để dự phòng

- Trạng thái: Accepted · Ngày: 2026-11-24

## Bối cảnh

Các bài học cho bé 5 tuổi đọc to câu hỏi và kết quả (docs/games/chess-learn.md, "Giọng đọc"). Bản đầu dùng
`speechSynthesis` của trình duyệt: máy nào không cài giọng tiếng Việt thì không đọc được, hoặc đọc chữ Việt bằng giọng
Anh; chất lượng và tốc độ cũng khác nhau giữa trình duyệt. Cần một giọng nghe giống nhau trên mọi trình duyệt.

## Quyết định

- Mỗi câu một bài học có thể nói là một **file mp3 thu sẵn** trong `apps/web/public/audio/vi/`, đặt tên theo
  `voiceKey(câu)` (hàm băm cố định) cùng `index.json` liệt kê file có sẵn. Trình duyệt chỉ phát file bằng `Audio`.
- Danh sách câu (`speechTexts`) sinh từ i18n và dữ liệu bài, không viết tay. Công cụ `tools/voice` đọc danh sách đó và tạo
  file bằng Piper `vi_VN-vais1000-medium` qua `sherpa-onnx` (offline, không gửi chữ ra ngoài). Tools nằm ngoài workspace
  pnpm nên CI không phải cài thư viện native.
- Giấy phép dữ liệu giọng VAIS-1000 là **CC BY 4.0**: ghi nguồn ở `/learn/chess` và `index.json`.
- Câu không có file (hoặc ngôn ngữ chưa thu, hiện là tiếng Anh) vẫn dùng giọng của trình duyệt; không bao giờ đọc chữ Việt
  bằng giọng ngôn ngữ khác.
- Hai test giữ cho file và bài không lệch nhau: `voice-pack.test.ts` (file đúng bằng danh sách câu) và `setup-speech.ts`
  (mọi test component báo lỗi nếu bài đọc một câu không có trong danh sách).

## Phương án đã cân nhắc

- **Chỉ dùng giọng trình duyệt:** không chắc có giọng tiếng Việt, khác nhau giữa máy → loại (là vấn đề cần giải quyết).
- **Dịch vụ đọc giọng chính thức (Azure, Google) qua API có khoá:** giọng tự nhiên hơn nhưng cần khoá, tốn phí và gửi chữ ra
  ngoài; có thể đổi sang sau mà không đổi phần phát (chỉ cần tạo lại file).
- **Dịch vụ không chính thức (Edge TTS):** không có giấy phép dùng cho sản phẩm, có thể bị chặn → loại.
- **Tổng hợp giọng trong trình duyệt (WASM):** vài chục MB, nặng cho điện thoại → loại.

## Hệ quả

- ✅ Nghe giống nhau trên mọi trình duyệt, kể cả không có `speechSynthesis`; không phụ thuộc mạng ngoài; không tốn phí.
- ✅ Tải nhẹ: ~4,6 MB cho 276 câu, mỗi file 2–3 giây, cache trình duyệt 1 ngày.
- ⚠️ Đổi chữ bài học thì phải tạo lại file (xem tools/voice/README.md); test sẽ báo.
- ⚠️ Chất lượng giọng Piper tiếng Việt chưa được kiểm chứng bằng tai; đổi giọng chỉ cần chạy lại công cụ với `--force`.
- ⚠️ Chưa có file tiếng Anh; chỉ có giọng một người (VAIS-1000), tốc độ 0,9.
