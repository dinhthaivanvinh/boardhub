---
name: office-fair-draw
description: Anything that picks people at random in the office area — the commit–reveal draw in OfficeHub, drawWinners/commitment/verify in @bg/office-core, the reveal timer, draw history and the verification page, and seed-driven animation scripts. Use for "bốc thăm", "quay", "chọn ngẫu nhiên", "kiểm chứng", fairness or "kết quả sai/lệch" reports.
---

# Bốc thăm công bằng (commit–reveal)

Đọc trước: ADR-0006, `docs/office/04-activity-spec.md` §5–§6, `docs/office/03-architecture.md` §5.
Quy tắc vàng 10: ngẫu nhiên **chỉ ở server**, có commit–reveal, kết quả đã reveal bất biến.

## Bản đồ code

| Việc                                        | File                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `commitment`, `drawWinners`, `verify`, hash | `packages/office-core/src/fair-draw.ts`, `hash.ts` (`@noble/hashes`)      |
| Sinh seed, chốt ứng viên, hẹn reveal        | `apps/server/src/office/office-hub.ts` (`startDraw`, job `office-reveal`) |
| Lưu lịch sử                                 | `office_draws` (Postgres)                                                 |
| Trang kiểm chứng                            | `apps/web/src/app/office/s/[code]/verify/[drawId]`                        |
| Kịch bản hiệu ứng theo seed                 | `apps/web/src/features/office/draw-player/*`                              |

## Quy trình một lần bốc (không đổi thứ tự)

1. Trong khoá: kiểm tra không có lần bốc đang chạy, ứng viên ≥ N.
2. Chốt `candidates` = id đã **sắp xếp, bỏ trùng**; lưu kèm tên + avatar lúc chốt (để lịch sử không đổi theo).
3. `seed = randomBytes(32).toString('hex')` (**chỉ** `node:crypto`), `drawId = randomUUID()`,
   `commitment = sha256Hex(seed)`.
4. `winners = drawWinners(seed, drawId, candidates, n)` ngay lúc này (để kết quả đã cố định trước khi ai thấy gì).
5. Lưu live state (gồm seed bí mật) → phát `office:draw-started` **không có** seed/winners.
6. Job `office-reveal` lúc `revealAt − 400 ms`: idempotent (đã reveal thì bỏ qua) → ghi `office_draws`
   (`revealed_at`) → gọi `activity.onDrawResult` → phát `office:draw-revealed { seed, winners, landAt }`.

## Bất biến

- `drawWinners` là **thuật toán công khai** (O-04 §5). Đổi nó = đổi kết quả của mọi lần bốc cũ khi kiểm chứng ⇒
  không được đổi; nếu bắt buộc, thêm `algorithm: 'v2'` vào bản ghi và giữ v1 để kiểm chứng bản cũ (cần ADR).
- Không bao giờ gửi `seed`/`winners` trước `revealAt − 400 ms`; không log seed ở mức info.
- Không có thao tác huỷ/sửa một lần bốc đã bắt đầu; đóng phiên giữa chừng vẫn phải reveal (job vẫn chạy).
- Người kick/rời sau khi chốt vẫn có thể trúng lần đó (danh sách đã chốt); hiển thị "(đã rời)".
- Hiệu ứng: build-up dùng `createRng(drawId, 'build')`, landing dùng `createRng(seed, 'anim')` ⇒ mọi màn giống nhau.
- Client chỉ **hiển thị**; client không bao giờ tự quyết người thắng (trừ trang kiểm chứng tính lại để so).

## Test bắt buộc

- `verify` đúng với bản ghi thật; đổi 1 ký tự của seed/drawId/candidates/winners ⇒ sai.
- Phân phối: 100.000 lần, 10 ứng viên, mỗi người 10% ± 0,5%; N = 3 không trùng người.
- Thứ tự ứng viên đầu vào không ảnh hưởng kết quả (hàm tự sắp xếp).
- Hub: job reveal chạy 2 lần ⇒ chỉ một bản ghi, một sự kiện; seed không có trong bất kỳ sự kiện nào trước reveal
  (test chặn ở mức socket: thu mọi payload rồi tìm chuỗi seed).
- Trang kiểm chứng (unit hoặc e2e): hiện ✓ với bản ghi thật, ✗ khi sửa winners.
