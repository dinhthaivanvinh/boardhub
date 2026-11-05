# Glossary — Thuật ngữ

Dùng **đúng** các từ này trong code, docs và giao diện để tránh nhầm lẫn.

| Thuật ngữ        | Định nghĩa                                                                                                 | Không dùng                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Game**         | Một loại board game (Caro, Cờ tướng). Định danh bằng `gameId`                                              | "trò"                                   |
| **Variant**      | Một bộ cấu hình luật của game (Caro 19×19) = output của `configSchema`                                     | "mode"                                  |
| **Mode**         | Cách chơi: `local`, `bot`, `private-room`, `quick-match`, `ranked`, `spectate`, `replay`, `correspondence` | "type"                                  |
| **Room**         | Phòng chờ chứa người chơi và người xem; có thể chơi nhiều Match nối tiếp                                   | "lobby" (lobby là trạng thái của room)  |
| **Match**        | Một ván chơi cụ thể, có `matchId`, seed và danh sách nước đi                                               | "game" (khi đang nói về một ván cụ thể) |
| **Seat**         | Vị trí trong ván (0, 1, …). Engine chỉ biết seat, không biết user                                          | "player index"                          |
| **Player**       | User hoặc bot đang ngồi ở một seat                                                                         |                                         |
| **Spectator**    | Người xem, không có seat                                                                                   |                                         |
| **Move**         | Một hành động theo luật game, đi qua `applyMove`                                                           |                                         |
| **Meta-action**  | Hành động ngoài luật: resign, offer-draw, takeback                                                         |                                         |
| **State**        | Trạng thái đầy đủ của ván (chỉ server biết khi chơi online)                                                |                                         |
| **View**         | `playerView(state, viewer)`: phần state mà một người được phép thấy                                        |                                         |
| **Ply**          | Một nước đi của một người. Một "turn" có thể gồm nhiều ply ở một số game                                   |                                         |
| **seq**          | Số thứ tự phiên bản state của Match, dùng để đồng bộ client–server                                         |                                         |
| **Time control** | Cấu hình đồng hồ: `{ type: 'none' \| 'per-move' \| 'fischer', baseMs, incrementMs }`                       |                                         |

## Khu "Văn phòng" (docs/office)

| Thuật ngữ              | Định nghĩa                                                                                                  | Không dùng                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Activity**           | Một loại hoạt động văn phòng (Thú may mắn, Chia đội). Định danh `activityId`, hợp đồng `ActivityDefinition` | "game" (game là board game) |
| **Session** (phiên)    | Một lần tổ chức activity, có mã 6 ký tự, một chủ trì, tới 200 người tham gia                                | "room" (room là board game) |
| **Host** (chủ trì)     | Người điều khiển phiên; quyền kiểm tra ở server                                                             | "admin"                     |
| **Participant**        | Người tham gia phiên (một `userId`), có tên + avatar; có thể là người vắng mặt do chủ trì thêm              | "player"                    |
| **Screen** (màn)       | `host` · `stage` (sân khấu, máy chiếu) · `participant` (điện thoại)                                         |                             |
| **Avatar**             | Con vật đại diện: dữ liệu `Avatar` v1 trong `@bg/avatars`, chỉ chứa id thuộc catalog                        | "ảnh đại diện"              |
| **Draw** (lần bốc)     | Một lần chọn ngẫu nhiên có `commitment`, `seed`, `candidates`, `winners`                                    | "spin" (spin là hiệu ứng)   |
| **Commitment**         | `sha256(seed)` công bố trước khi quay                                                                       |                             |
| **Reveal**             | Thời điểm server công bố `seed` và `winners`                                                                |                             |
| **Draw mode**          | Kiểu hiệu ứng bốc: `wheel`, `race`, `spotlight`, `claw`                                                     | "variant"                   |
| **Build-up / Landing** | Hai pha hiệu ứng: chưa biết kết quả / về đích ở người thắng                                                 |                             |
