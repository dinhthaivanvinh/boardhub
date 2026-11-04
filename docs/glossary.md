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
