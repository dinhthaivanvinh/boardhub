---
name: office-avatar
description: Work on the animal avatar system (@bg/avatars) — add a species, accessory, eye/mouth style, pattern or palette colour, change the layered SVG renderer, randomAvatar, the avatar studio UI, or the /api/me/avatar storage. Use for "thêm con vật", "thêm phụ kiện / màu", "sửa studio avatar", avatar rendering bugs.
---

# Con vật đại diện (`@bg/avatars`)

Đọc trước: `docs/office/05-avatar-system.md`. Quy tắc: CLAUDE.md 9 (tự vẽ) và 13 (chỉ id/màu thuộc catalog).

## Bản đồ code (theo O-03)

| Việc                        | File                                                   |
| --------------------------- | ------------------------------------------------------ |
| Schema, phiên bản, nâng cấp | `packages/avatars/src/schema.ts`                       |
| Catalog id + bảng màu       | `packages/avatars/src/catalog.ts`                      |
| Vẽ loài                     | `packages/avatars/src/render/species/<id>.tsx`         |
| Vẽ phụ kiện, mắt, miệng     | `packages/avatars/src/render/{accessories,face}.tsx`   |
| Ghép lớp                    | `packages/avatars/src/render/Avatar.tsx`               |
| Ngẫu nhiên                  | `packages/avatars/src/random.ts`                       |
| Studio                      | `apps/web/src/features/office/avatar-studio/*`         |
| Lưu trữ                     | `users.avatar`, `GET/PUT /api/me/avatar` (apps/server) |

## Thêm một loài

1. Thêm id vào `SPECIES` (cuối danh sách; **không đổi thứ tự / đổi tên id cũ**: dữ liệu người dùng đang lưu id).
2. Tạo `render/species/<id>.tsx` vẽ trong `viewBox 0 0 100 100`, xuất:
   - `Body({ body, accent, patternId })`: thân + đầu, dùng `clipPath` để hoa văn không tràn ra ngoài.
   - `anchors`: `head {x, y, w}`, `eyes {y, gap}`, `mouth {y}`, `neck {y}` — phụ kiện đặt theo anchor, **không** vẽ
     phụ kiện riêng cho loài.
3. Thêm tên vào i18n web `avatar.species.<id>` (vi + en).
4. Test: tổ hợp loài mới × mọi phụ kiện × mọi mắt vẽ không lỗi; thêm snapshot.

## Thêm phụ kiện / mắt / miệng / màu

- Phụ kiện vẽ theo `anchors`, dùng `accessoryColor`; thử với **mọi** loài (đầu to/nhỏ, có tai dài).
- Màu mới phải đạt tương phản với nền tối và nền sáng; thêm vào `PALETTE` và, nếu cần, vào danh sách **cặp đẹp**
  dùng cho `randomAvatar`.

## Bất biến

- Avatar = dữ liệu nhỏ, chỉ id thuộc catalog + màu thuộc `PALETTE`; zod `strictObject` từ chối mọi thứ khác.
- Đổi cấu trúc ⇒ tăng `v` + `upgradeAvatar`; không bao giờ làm hỏng avatar đã lưu.
- Renderer thuần: cùng avatar ⇒ cùng SVG. Id SVG nội bộ duy nhất mỗi lần vẽ (`useId()`).
- Không `<foreignObject>`, không font/ảnh ngoài (để xuất PNG).
- `detail="low"` dưới 40 px: bỏ hoa văn, chi tiết mảnh.
- `randomAvatar(rng)` nhận `rng`; không gọi `Math.random` trong `@bg/avatars`.

## Studio

- Nút lựa chọn có hình thu nhỏ, `aria-pressed`, ≥ 44 px; tab Loài · Màu · Mặt · Phụ kiện · Nền.
- Lưu tự động (debounce 600 ms) qua `PUT /api/me/avatar`; trong phiên, gửi `office:update-me` (tối đa 1 lần/giây).

## Kiểm tra cuối

`pnpm --filter @bg/avatars test` (tổ hợp, schema, snapshot, random 1.000 seed, hiệu năng 200 avatar) và xem bằng
mắt: chụp màn hình studio + lưới 10 loài ở cỡ 24/56/160/320 px.
