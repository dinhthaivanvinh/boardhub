# Giọng đọc thu sẵn cho các bài học

Các bài học đọc to bằng **file mp3 thu sẵn** (`apps/web/public/audio/vi-edge/`) nên nghe giống nhau trên mọi trình duyệt
và thiết bị; câu nào không có file thì dùng giọng của trình duyệt (xem `packages/games/chess/src/learn/speech.ts`).

- Giọng: **Edge neural `vi-VN-HoaiMyNeural`**, lấy từ dịch vụ đọc của Microsoft Edge qua gói `node-edge-tts` (xem
  [ADR-0012](../../docs/adr/0012-edge-neural-voice.md) về rủi ro: dịch vụ không chính thức, chữ được gửi lên máy chủ
  Microsoft lúc tạo file).
- Tốc độ `-25%` so với tốc độ thường (người nghe là trẻ 5 tuổi). Đổi bằng biến môi trường `VOICE_RATE` (ví dụ `-35%`)
  hoặc `VOICE_NAME` (ví dụ `vi-VN-NamMinhNeural`, giọng nam).
- Tên file là `voiceKey(câu)` (`voice-hash.ts`): đổi hàm băm sẽ làm mất mọi file.

## Khi nào phải tạo lại

Khi đổi chữ của một bài (`packages/games/chess/src/i18n/vi.json`) hoặc thêm bài/thế cờ. Test `voice-pack.test.ts` báo lỗi
nếu danh sách file lệch với danh sách câu (`speechTexts`), và `setup-speech.ts` báo lỗi nếu một bài đọc một câu mà
danh sách không có.

## Cách tạo

```bash
# 1. Thư viện (một lần)
cd tools/voice && npm install && cd ../..

# 2. Tạo file mới (câu nào đã có file thì bỏ qua; thêm --force để làm lại hết, mất hơn 30 phút cho ~400 câu)
pnpm --filter @bg/server exec tsx ../../tools/voice/build.mts
```

Script gọi dịch vụ từng câu một, nghỉ 0,7 giây giữa các câu và thử lại khi bị trả 429 (gọi nhanh quá). Nó xoá file của
những câu không còn được đọc và ghi lại `index.json`. Muốn đổi giọng hoặc tốc độ thì chạy với `--force`.

Tiếng Anh chưa có file thu sẵn: dùng giọng của trình duyệt.

## Danh sách file (`index.json`) luôn được kiểm tra lại

Trang hỏi server mỗi lần xem `index.json` có đổi không (`no-cache` ở cả header lẫn lệnh `fetch`). Nếu dùng bản đã lưu,
các câu mới của phiên bản mới sẽ không được tìm thấy và trên máy không có giọng Việt thì bị bỏ qua, không đọc gì.
Câu được yêu cầu đọc trong lúc danh sách đang tải sẽ đợi danh sách về rồi mới đọc.

## Tại sao thư mục tên `vi-edge`

Trình duyệt giữ file mp3 một ngày (và CDN có thể giữ lâu hơn). Tên file chỉ phụ thuộc vào câu chữ, nên nếu tạo lại file
của **cùng những câu** (đổi giọng, đổi tốc độ) vào cùng một thư mục thì người dùng vẫn nghe giọng cũ cho đến khi cache hết hạn. Vì vậy
mỗi lần đổi giọng, hãy đặt thư mục mới (ví dụ `vi-edge2`), sửa `VOICE_SET` trong `speech.ts`, `OUT_DIR` trong `build.mts`,
test `voice-pack.test.ts`, e2e `chess-learn.spec.ts` và `.prettierignore`. Giọng Piper cũ ở thư mục `vi/` đã bị bỏ.
