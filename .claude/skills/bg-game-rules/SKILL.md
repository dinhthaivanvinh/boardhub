---
name: bg-game-rules
description: Implement or modify game rules in packages/games/<id>/src/rules or the core @bg/engine (GameDefinition, runMove, rng). Use whenever writing setup/validateMove/applyMove/legalMoves/result/playerView, fixing a rules bug ("sai luật", "nước đi không hợp lệ"), or adding a rules variant.
---

# Viết luật game (Rules)

Hợp đồng đầy đủ nằm ở `docs/04-game-engine-spec.md`. **Đọc file đó trước** nếu chưa đọc trong phiên này.

## Quy trình

1. Mở `docs/games/<id>.md`. Code phải khớp với spec; nếu thấy spec sai hoặc thiếu thì sửa spec **trước**, rồi mới sửa code.
2. Viết theo thứ tự: `types.ts` → `config.ts` → `setup.ts` → `moves.ts` → `result.ts` → `view.ts` → `definition.ts`.
3. Mỗi hàm viết xong thì viết test ngay (skill `bg-testing`).

## Checklist cho mỗi hàm

**setup(config, playerCount, ctx)**

- [ ] Đặt `config` vào state
- [ ] Mọi yếu tố ngẫu nhiên (ai đi trước, xáo bài) đều dùng `ctx.rng`

**validateMove(state, seat, move)**

- [ ] Không thay đổi state
- [ ] Không cần kiểm tra "đúng lượt" và "ván đã kết thúc", runner đã làm
- [ ] Mỗi lý do từ chối có một mã lỗi riêng `<id>.<snake_case>`, có trong i18n
- [ ] Rẻ: cố gắng O(1)–O(n); tránh sinh toàn bộ `legalMoves` chỉ để kiểm tra, trừ khi luật bắt buộc (ví dụ cờ tướng phải kiểm tra tự chiếu tướng)

**applyMove(state, seat, move, ctx)**

- [ ] Giả định move đã hợp lệ, nhưng không được throw nếu nó hợp lệ (E6)
- [ ] Trả về object mới: copy nông những phần thay đổi (`board.slice()`, `{...s}`) hoặc dùng `immer`
- [ ] Cập nhật `turn`, `moveCount`, `lastMove` và các trường dẫn xuất mà UI cần (`winLine`, `captured`…)
- [ ] Xử lý luật "mất lượt" ngay tại đây (ví dụ Reversi: nếu người kế tiếp không có nước thì chuyển lượt luôn)

**legalMoves(state, seat)**

- [ ] Khớp chính xác với `validateMove` (E7). Cách dễ nhất: sinh ứng viên rồi lọc bằng `validateMove`, sau đó tối ưu nếu cần
- [ ] Thứ tự trả về ổn định (deterministic)

**result(state)**

- [ ] Trả về `null` khi ván chưa kết thúc
- [ ] `reason` là chuỗi snake_case có trong i18n
- [ ] Xét thắng trước, rồi mới xét hòa (nước cuối vừa làm đầy bàn vừa tạo chuỗi thắng thì là thắng)

**playerView(state, viewer)**

- [ ] perfect-info: trả về `state`
- [ ] hidden-info: chỉ trả về public + private[viewer]; với `'spectator'` thì chỉ trả về public. Thay phần ẩn bằng số lượng (ví dụ `handCount`), không để lại id quân hay bài

## Cấm (sẽ bị reject ở review)

- `Math.random`, `Date`, `performance.now`, `crypto.*` trong `rules/`
- `Map`, `Set`, `class`, `undefined` trong state
- Import từ `react`, `@bg/ui`, `apps/*`, `node:*`
- Lưu tham chiếu chung giữa state cũ và state mới rồi mutate phần đó
- Đổi ý nghĩa của move hoặc state đã phát hành mà không tăng `rulesVersion`

## Mẹo hiệu năng (cho bot search)

- Bàn cờ dạng mảng 1 chiều; tính trước bảng hàng xóm/hướng (`DIRS`) ở module scope (hằng số thì được phép).
- Kiểm tra thắng chỉ quanh `lastMove`, không quét toàn bàn.
- Nếu cần mutate để tăng tốc trong bot, làm trong bot với bản copy riêng, không làm trong `applyMove`.

## Sửa `@bg/engine`

Đây là lõi. Mọi thay đổi interface `GameDefinition` hoặc `runMove` đều ảnh hưởng mọi game →
dừng lại, giải thích cho người dùng, viết ADR (`docs/adr/_template.md`), cập nhật `docs/04`, rồi sửa **tất cả** game trong cùng một PR.
