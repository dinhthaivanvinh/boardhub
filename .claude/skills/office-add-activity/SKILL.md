---
name: office-add-activity
description: Add a new office activity to the "Văn phòng" area end to end — spec, packages/office/<id> package (ActivityDefinition), host/stage/participant UI, i18n, tests, and registration on server and web. Use when the user asks to "thêm hoạt động", "làm trò chia đội / bốc quà / thứ tự ngẫu nhiên / bí mật Santa", or create anything under packages/office/.
---

# Thêm một hoạt động văn phòng

Mục tiêu: hoạt động mới chạy được ở cả ba màn (chủ trì, sân khấu, điện thoại) **mà không sửa `OfficeHub`**, chỉ thêm
gói mới và một dòng ở mỗi registry (CLAUDE.md quy tắc 11, ADR-0005).

Đọc trước: `docs/office/04-activity-spec.md` (hợp đồng + quy tắc A1–A8), `docs/office/07-ux-guidelines.md`,
`docs/office/activities/lucky-animal.md` (hoạt động tham chiếu).

## Bước 0 — Kiểm tra

- `activityId` kebab-case, chưa có trong `packages/office/`, **không đổi** sau khi phát hành.
- Hoạt động có ngẫu nhiên không? Có → mọi lựa chọn ngẫu nhiên đi qua `draw` của hub (skill `office-fair-draw`).
- Có thông tin ẩn không (vd. Bí mật Santa)? Có → `view` phải lọc theo người xem + test `assertNoHiddenLeak`.
- Có cần cài đặt mà luật chơi khác nhau theo nơi? Hỏi người dùng hoặc đưa thành field trong `settingsSchema`.

## Bước 1 — Spec (bắt buộc, trước khi code)

Copy `docs/office/activities/_template.md` → `docs/office/activities/<id>.md`, điền đủ 8 mục.

## Bước 2 — Gói

```
packages/office/<id>/
├─ package.json          name @bg/office-<id>; exports ".", "./activity", "./i18n/*", "./theme.css", "./cover.svg"
├─ src/activity.ts       ActivityDefinition (settingsSchema, actionSchema, setup, validate, apply, onDrawResult, view)
├─ src/types.ts
├─ src/ui/{Host,Stage,Participant}.tsx   nhận ActivityScreenProps<View, Action>
├─ src/ui/theme.css      lớp CSS có tiền tố riêng (vd. `la-` cho lucky-animal)
├─ src/ui/cover.svg      640×400, tự vẽ (như ảnh bìa game)
├─ src/i18n/{vi,en}.json name, shortDescription, howTo (markdown ngắn), errors.*, settings.*
└─ test/{activity,view,ui}.test.ts(x)
```

Thứ tự viết: `types` → `settingsSchema`/`actionSchema` → `setup` → `validate` → `apply` → `onDrawResult` → `view` → UI.

## Bước 3 — Quy tắc khi viết `activity.ts`

- Thuần (A1): không `Math.random`, `Date`, `crypto`, I/O. Thời gian = `ctx.now`. Ngẫu nhiên = trả `{ draw }` từ `apply`.
- Không giữ danh sách người tham gia riêng (A7): đọc `ctx.participants`.
- Mỗi hành động có `kind`; hành động của chủ trì phải `validate` `actor.isHost`.
- Lỗi: mã `<activity-id>.<code>` + thêm vào `errors.*` trong i18n của gói.

## Bước 4 — UI

Dùng skill **`office-stage-ui`**. Ba màn đều nhận `view` (không bao giờ state đầy đủ). Hiệu ứng bốc dùng trình phát
dùng chung (`features/office/draw-player`), chỉ viết thêm mode nếu cần.

## Bước 5 — Đăng ký

- Server: một dòng trong `apps/server/src/office/registry.ts` (`OFFICE_ACTIVITIES`).
- Web: một dòng trong `apps/web/src/office/registry.ts` (Host/Stage/Participant + settings fields + cover) và i18n
  trong catalog văn phòng.
- `pnpm --filter @bg/web add "@bg/office-<id>@workspace:*"` (tương tự server); thêm vào `transpilePackages`
  (`apps/web/next.config.ts`) và `@import` theme.css trong `globals.css`.
- E2E `e2e/office-<id>.spec.ts`: ít nhất chủ trì tạo phiên, 2 người vào, một hành động chính, sân khấu hiển thị.

## Bước 6 — Hoàn thành khi

- [ ] `docs/office/activities/<id>.md` khớp code
- [ ] Test theo O-04 §7 xanh; `pnpm lint && pnpm typecheck && pnpm test`
- [ ] Ba màn chạy trên desktop + điện thoại 360 px + màn 1080p (sân khấu)
- [ ] Không file nào trong `apps/server/src/office/office-hub.ts` hay `@bg/office-core` bị sửa (nếu cần → đề xuất ADR)
- [ ] Cập nhật `docs/office/08-roadmap.md`; chạy skill `bg-docs-sync`
