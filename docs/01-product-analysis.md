# 01 — Phân tích sản phẩm

> Trạng thái: Draft v1 · Cập nhật: 2026-11-04 · Tên tạm: **BoardHub**

## 1. Tầm nhìn

Một nền tảng web chơi **nhiều loại board game** trên cùng một hệ thống, với **nhiều cách chơi**:
chơi cùng máy, chơi với máy (bot), chơi online với bạn bè hoặc người lạ, xem trận và xem lại.
Thêm game mới chỉ cần viết **một plugin luật chơi + một component bàn cờ**, không phải sửa lõi hệ thống.

## 2. Vấn đề & cơ hội

| Vấn đề hiện tại                                                          | Cơ hội                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Mỗi game nằm ở một web riêng, mỗi web một tài khoản                      | Một tài khoản, một lịch sử, một hệ thống xếp hạng cho mọi game       |
| Nhiều web nặng quảng cáo, chơi trên mobile kém                           | Giao diện nhẹ, responsive, ưu tiên mobile                            |
| Khó rủ bạn bè vào chơi nhanh                                             | Phòng riêng qua link mời, không cần đăng ký (chơi với tư cách khách) |
| Game dân gian Việt Nam (cờ tướng, ô ăn quan, cờ gánh…) ít bản online tốt | Ưu tiên game Việt, giao diện tiếng Việt                              |

## 3. Personas

| Persona                        | Mô tả                                            | Nhu cầu chính                                  |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| **P1 – Người chơi casual**     | Chơi 5–15 phút lúc rảnh, chủ yếu trên điện thoại | Vào chơi ngay, không cần đăng ký, chơi với bot |
| **P2 – Nhóm bạn**              | 2–6 người muốn chơi cùng nhau từ xa              | Tạo phòng, gửi link, chat, chơi lại nhanh      |
| **P3 – Người chơi cạnh tranh** | Muốn leo hạng, xem lại ván                       | Ghép trận theo trình độ, Elo, lịch sử, replay  |
| **P4 – Người mới học luật**    | Chưa biết luật game                              | Hướng dẫn luật, gợi ý nước đi hợp lệ, bot dễ   |
| **P5 – Admin / vận hành**      | Quản lý hệ thống                                 | Bật/tắt game, xử lý báo cáo, theo dõi số liệu  |

## 4. Danh mục game

Game được phân loại theo **đặc tính kỹ thuật**, vì các đặc tính này quyết định kiến trúc engine:

| Đặc tính       | Ý nghĩa với engine                             | Game ví dụ                       |
| -------------- | ---------------------------------------------- | -------------------------------- |
| `perfect-info` | Mọi người thấy toàn bộ trạng thái              | Caro, Cờ tướng, Reversi          |
| `chance`       | Có xúc xắc, xáo bài → cần RNG có seed          | Cá ngựa, Backgammon              |
| `hidden-info`  | Mỗi người chỉ thấy một phần → cần `playerView` | Bắn tàu, game bài                |
| `multi-player` | Hơn 2 người                                    | Cá ngựa (2–4), Tiến lên (4)      |
| `simultaneous` | Nhiều người đi cùng lúc                        | Oẳn tù tì, game bí mật đồng thời |

### Lộ trình game

| Đợt     | Game (id)                                                                           | Đặc tính                     | Lý do chọn                                          |
| ------- | ----------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------- |
| **MVP** | Caro / Gomoku (`caro`)                                                              | perfect-info, 2 người        | Luật đơn giản, dùng để kiểm chứng engine            |
| **MVP** | Bốn trong hàng (`four-in-a-row`)                                                    | perfect-info, 2 người        | Dễ viết bot minimax                                 |
| **MVP** | Reversi (`reversi`)                                                                 | perfect-info, có lượt bỏ qua | Kiểm chứng trường hợp "không có nước đi → mất lượt" |
| **MVP** | Cờ tướng (`xiangqi`)                                                                | perfect-info, luật phức tạp  | Game cốt lõi cho người Việt                         |
| Đợt 2   | Cờ vua (`chess`), Cờ đam (`checkers`), Ô ăn quan (`o-an-quan`), Cờ gánh (`co-ganh`) | perfect-info                 | Mở rộng danh mục                                    |
| Đợt 2   | Cá ngựa (`ca-ngua`)                                                                 | chance, 2–4 người            | Kiểm chứng RNG và nhiều người chơi                  |
| Đợt 3   | Bắn tàu (`sea-battle`), Tiến lên (`tien-len`)                                       | hidden-info                  | Kiểm chứng ẩn thông tin                             |

> ⚖️ **Lưu ý bản quyền:** chỉ làm game có luật chơi dân gian/phổ thông hoặc game tự thiết kế.
> Không dùng tên thương hiệu, hình ảnh hay tài sản của game thương mại
> (ví dụ dùng "Reversi" thay cho "Othello", "Bốn trong hàng" thay cho "Connect Four").

## 5. Các cách chơi (Play modes)

| Mode             | Mô tả                                                    | Đợt   |
| ---------------- | -------------------------------------------------------- | ----- |
| `local`          | Chơi chung một máy (hot-seat), chạy hoàn toàn ở client   | MVP   |
| `bot`            | Chơi với bot, có nhiều cấp độ                            | MVP   |
| `private-room`   | Tạo phòng, mời bằng link hoặc mã 6 ký tự                 | MVP   |
| `quick-match`    | Ghép trận tự động theo game và trình độ                  | Đợt 2 |
| `ranked`         | Ghép trận có tính Elo                                    | Đợt 2 |
| `spectate`       | Xem trận đang diễn ra                                    | Đợt 2 |
| `replay`         | Xem lại từng nước của ván đã kết thúc                    | Đợt 2 |
| `correspondence` | Chơi không đồng bộ, mỗi nước có hạn vài giờ đến vài ngày | Đợt 3 |
| `tournament`     | Giải đấu loại trực tiếp hoặc vòng tròn                   | Đợt 3 |

Mỗi game có thể cấu hình thêm **biến thể luật** (ví dụ Caro 15×15 hoặc 19×19, có hoặc không chặn hai đầu)
và **thời gian** (không giới hạn, theo nước, hoặc tổng thời gian + cộng thêm mỗi nước).

## 6. Phạm vi

**Trong MVP:** 4 game MVP · local / bot / private-room · tài khoản khách và tài khoản đăng ký · chat trong phòng ·
đồng hồ cơ bản · tiếng Việt và tiếng Anh · responsive.

**Ngoài phạm vi (hiện tại):** app mobile native · tiền thật, cá cược · voice/video · trình tạo game cho người dùng.

## 7. Rủi ro & cách giảm thiểu

| Rủi ro                                                 | Mức độ     | Giảm thiểu                                                                                    |
| ------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| Luật mỗi game rất khác nhau, lõi bị "vỡ" khi thêm game | Cao        | Định nghĩa interface `GameDefinition` chặt chẽ ngay từ đầu, MVP chọn game có đặc tính đa dạng |
| Gian lận (sửa client, gửi nước sai)                    | Cao        | Server là nguồn sự thật duy nhất (server-authoritative), luôn kiểm tra nước đi ở server       |
| Lộ thông tin ẩn qua network                            | Trung bình | Server chỉ gửi `playerView`, không bao giờ gửi full state cho client                          |
| Mất kết nối giữa ván                                   | Trung bình | Cơ chế reconnect bằng `seq`, giữ ghế trong thời gian chờ                                      |
| Dùng AI bot để gian lận ở ranked                       | Trung bình | Đợt sau: phát hiện bất thường, báo cáo                                                        |
| Tranh chấp bản quyền                                   | Thấp       | Xem lưu ý bản quyền ở mục 4                                                                   |

## 8. Chỉ số thành công (KPI)

- Thời gian từ lúc vào trang đến nước đi đầu tiên: **< 15 giây** (chế độ bot/local).
- Tỷ lệ ván online kết thúc bình thường (không bỏ ngang do lỗi): **> 95%**.
- p95 độ trễ từ lúc gửi nước đến khi đối thủ nhận được: **< 200 ms** (cùng khu vực).
- Thêm một game perfect-info mới: **≤ 3 ngày công** cho một dev đã quen codebase.
