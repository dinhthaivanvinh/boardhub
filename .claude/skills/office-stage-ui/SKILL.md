---
name: office-stage-ui
description: Build or change office-area screens — the host console, the projector stage, the phone participant view, the /office hub and the two-area navigation — and draw animations (wheel, race, spotlight, claw) that must stay in sync across screens using server time. Use for "màn chiếu", "sân khấu", "màn chủ trì", "hiệu ứng quay", "đua thú", "vòng quay", animation sync/jank, or office layout on phones.
---

# Màn hình khu Văn phòng & hiệu ứng bốc

Đọc trước: `docs/office/07-ux-guidelines.md`, `docs/08-frontend-guidelines.md` (i18n, a11y, giảm chuyển động, ResultOverlay).

## Bản đồ code (theo O-03)

| Việc                                    | File                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| Trang `/office`, tạo phiên, vào bằng mã | `apps/web/src/app/office/*`, `features/office/hub/*`             |
| Ba màn của phiên                        | `apps/web/src/app/office/s/[code]/{page,host,screen}`            |
| Khung dùng chung (QR, đàn thú, header)  | `apps/web/src/features/office/stage/*`                           |
| Trình phát hiệu ứng bốc                 | `apps/web/src/features/office/draw-player/*` (một file mỗi mode) |
| UI riêng từng hoạt động                 | `packages/office/<id>/src/ui/*`                                  |
| Menu hai khu                            | `apps/web/src/app/layout.tsx`, `features/settings/MobileNav.tsx` |

## Quy tắc màn hình

- **Sân khấu** đọc được từ cuối phòng: chữ ≥ 24 px ở 1080p, tên người thắng ≥ 48 px; không có nút điều khiển.
- **Chủ trì**: mọi điều khiển cũng dùng được bằng bàn phím; Space = Quay ở chế độ trình chiếu.
- **Điện thoại** 360 px: không cuộn ngang, vùng chạm ≥ 44 px.
- Mọi chuỗi qua i18n (vi + en). Con vật có `aria-label`; kết quả bốc đọc qua `aria-live`.

## Hiệu ứng bốc: trình phát theo thời gian

- Mỗi mode là một module `{ buildUp(t, ctx), landing(t, ctx) }` trả **vị trí/transform** cho từng con vật tại thời
  điểm `t` (ms kể từ đầu pha). Không giữ trạng thái giữa các khung.
- Vòng lặp `requestAnimationFrame` tính `tServer = Date.now() + serverOffset`, chọn pha theo `startsAt`/`revealAt`/
  `landAt`, gọi hàm của mode, rồi **ghi thẳng `transform` vào DOM/SVG** (ref), không `setState` mỗi khung
  (NFR-OFF-07: 200 con vật ≥ 50 fps).
- Build-up chưa biết kết quả: chỉ dùng `createRng(drawId, 'build')`. Landing dùng `createRng(seed, 'anim')` và phải
  **kết thúc chính xác** ở người thắng (test: `landing(duration)` đặt người thắng đúng vị trí đích).
- Build-up phải nối mượt vào landing (khớp vị trí/vận tốc tại `revealAt`).
- Người vào giữa chừng / tab ẩn rồi hiện: vẽ lại đúng nhờ hàm thuần theo thời gian.
- Giảm chuyển động (`prefers-reduced-motion` hoặc tắt "Hiệu ứng"): bỏ hai pha, hiện kết quả lúc `revealAt`.
- Nhiều người: wheel > 60 người ⇒ quay theo nhóm 12; race chỉ chạy 12 con, người thắng luôn có mặt.

## Kết quả & đồng bộ

- Thẻ người thắng + pháo hoa giống `ResultOverlay` (tôn trọng giảm chuyển động); điện thoại người thắng rung nếu có.
- Không đổi pha bằng `setTimeout`; mọi mốc theo giờ server.

## Kiểm tra

- Unit: mỗi mode, `landing(end)` đặt đúng người thắng cho N = 1 và N = 3, với 2, 12, 200 ứng viên.
- E2E (3 trình duyệt): chủ trì quay, sân khấu và điện thoại hiện cùng người thắng; bản giảm chuyển động hiện ngay.
- Xem bằng mắt: chụp sân khấu ở 1920×1080 (chờ, giữa build-up, về đích) và điện thoại 390×844.
