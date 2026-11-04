# ADR-0003: Socket.IO tự quản lý phòng, thay vì framework game server

- Trạng thái: Accepted · Ngày: 2026-11-04

## Bối cảnh

Cần realtime cho phòng chơi. Các phương án: Socket.IO, Colyseus, boardgame.io, WebSocket thuần.

## Quyết định

Dùng **Socket.IO** + Redis adapter, và tự viết RoomService/MatchService mỏng dựa trên `@bg/engine`.

## Lý do

- Colyseus/boardgame.io có mô hình state và game riêng, chồng chéo với `GameDefinition` của dự án → bị khóa vào framework.
- WebSocket thuần thì phải tự viết reconnect, room, ack, fallback.
- Socket.IO đã có sẵn ack, room, reconnect và scale ngang qua Redis.

## Hệ quả

- ✅ Kiểm soát hoàn toàn protocol ([05](../05-realtime-protocol.md)) và vòng đời phòng.
- ⚠️ Phải tự viết lock, đồng hồ và reconnect logic ở tầng ứng dụng.
