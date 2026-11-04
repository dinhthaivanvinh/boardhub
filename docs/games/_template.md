# Game Spec: <Tên game> (`<game-id>`)

> Điền đủ file này TRƯỚC khi viết code. Đây là nguồn sự thật về luật chơi.

## 1. Tổng quan

- Số người chơi: X–Y
- Tags: `perfect-info` | `chance` | `hidden-info` | `simultaneous` | `multi-player`
- Thời lượng ước tính: N phút
- Nguồn luật tham khảo: <link hoặc mô tả luật dân gian>

## 2. Thành phần

Bàn cờ (kích thước, hệ tọa độ), quân/bài, xúc xắc…

## 3. Chuẩn bị (setup)

Trạng thái ban đầu; ai đi trước.

## 4. Lượt chơi

Thứ tự lượt; các loại nước đi; nước đi bắt buộc; trường hợp mất lượt.

## 5. Điều kiện kết thúc

| Điều kiện | Kết quả | `reason` |
| --------- | ------- | -------- |

## 6. Biến thể (configSchema)

| Field | Kiểu | Mặc định | Mô tả |
| ----- | ---- | -------- | ----- |

## 7. Mô hình dữ liệu

```ts
type State = { … };
type Move = { … };
```

## 8. Mã lỗi

| Code | Khi nào |
| ---- | ------- |

## 9. playerView

Ai thấy gì. (Game perfect-info: "trả về toàn bộ state")

## 10. Bot

Chiến lược cho từng cấp độ; hàm đánh giá; cách giới hạn không gian tìm kiếm.

## 11. UI

Cách tương tác (click, kéo-thả), highlight, animation, điểm khó trên mobile.

## 12. Trường hợp biên cần test

- …
