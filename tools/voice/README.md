# Giọng đọc thu sẵn cho các bài học

Các bài học đọc to bằng **file mp3 thu sẵn** (`apps/web/public/audio/vi/`) nên nghe giống nhau trên mọi trình duyệt
và thiết bị; câu nào không có file thì dùng giọng của trình duyệt (xem `packages/games/chess/src/learn/speech.ts`).

- Giọng: Piper `vi_VN-vais1000-medium` chạy bằng `sherpa-onnx`, tạo offline, không gửi chữ ra ngoài.
- Giấy phép: bộ dữ liệu **VAIS-1000** theo **CC BY 4.0** (được dùng thương mại, phải ghi nguồn). Nguồn đã ghi ở trang
  `/learn/chess` và trong `index.json`. Mô hình: https://huggingface.co/rhasspy/piper-voices (vi/vi_VN/vais1000).
- Tên file là `voiceKey(câu)` (`voice-hash.ts`): đổi hàm băm sẽ làm mất mọi file.

## Khi nào phải tạo lại

Khi đổi chữ của một bài (`packages/games/chess/src/i18n/vi.json`) hoặc thêm bài/thế cờ. Test `voice-pack.test.ts` báo lỗi
nếu danh sách file lệch với danh sách câu (`speechTexts`), và `setup-speech.ts` báo lỗi nếu một bài đọc một câu mà
danh sách không có.

## Cách tạo

```bash
# 1. Mô hình (67 MB, không đưa vào git). Giải nén vào tools/voice/model/
curl -L -o model.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2
mkdir -p tools/voice/model && tar -xjf model.tar.bz2 -C tools/voice/model

# 2. Thư viện (phải đúng bản 1.12.x: từ 2.x sherpa-onnx không còn tự chuyển chữ sang âm)
cd tools/voice && npm install && cd ../..

# 3. Tạo file mới (câu nào đã có file thì bỏ qua; thêm --force để làm lại hết)
pnpm --filter @bg/server exec tsx ../../tools/voice/build.mts
```

Script xoá file của những câu không còn được đọc và ghi lại `index.json`. Tốc độ đọc đặt chậm hơn bình thường
(`SPEED = 0.9` trong `build.mts`) vì người nghe là trẻ 5 tuổi. Muốn đổi giọng hoặc tốc độ thì chạy với `--force`.

Tiếng Anh chưa có file thu sẵn: dùng giọng của trình duyệt.
