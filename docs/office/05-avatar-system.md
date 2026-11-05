# O-05 — Hệ thống con vật đại diện (`@bg/avatars`)

## 1. Mục tiêu

- Mỗi người có **một con vật** nhận ra được từ cuối phòng họp, tự tay chỉnh, dùng lại ở mọi phiên.
- Dữ liệu nhỏ, an toàn (chỉ id có trong catalog), vẽ được ở mọi cỡ, không cần tải ảnh.
- Tự vẽ toàn bộ (CLAUDE.md quy tắc 9): không nhân vật hoạt hình thương mại, không emoji của nền tảng.

## 2. Mô hình dữ liệu (phiên bản 1)

```ts
export const AvatarSchema = z.strictObject({
  v: z.literal(1), // phiên bản; tăng khi đổi cấu trúc, có hàm nâng cấp
  species: z.enum(SPECIES), // 'cat' | 'dog' | 'fox' | 'panda' | 'rabbit' | 'bear' | 'penguin' | 'frog' | 'owl' | 'tiger'
  body: HexColor, // màu chính, phải thuộc PALETTE (hoặc gần nhất)
  accent: HexColor, // màu phụ (bụng, tai trong, mõm)
  pattern: z.enum(PATTERNS), // 'plain' | 'stripes' | 'spots' | 'patch'
  eyes: z.enum(EYES), // 'round' | 'happy' | 'sleepy' | 'wink' | 'star' | 'surprised'
  mouth: z.enum(MOUTHS), // 'smile' | 'grin' | 'tongue' | 'o' | 'cat'
  accessory: z.enum(ACCESSORIES), // 'none' | 'cap' | 'beanie' | 'crown' | 'glasses' | 'sunglasses' | 'bow' | 'scarf' | 'headphones' | 'flower'
  accessoryColor: HexColor,
  background: HexColor,
});
export type Avatar = z.infer<typeof AvatarSchema>;
```

- Màu là hex nhưng **phải thuộc bảng màu** `PALETTE` (24 màu) để luôn đủ tương phản và đẹp; zod kiểm tra.
- Tên hiển thị **không** nằm trong avatar (nằm ở người tham gia / hồ sơ).
- Kích thước JSON ~200 byte. Lưu ở `users.avatar` (jsonb) và trong mỗi bản ghi người tham gia.
- Đổi cấu trúc ⇒ tăng `v`, viết `upgradeAvatar(old)`; server luôn trả bản mới nhất.

## 3. Catalog (id ổn định, không đổi sau khi phát hành)

| Nhóm     | Giá trị (MVP)                                                                               |
| -------- | ------------------------------------------------------------------------------------------- |
| Loài     | cat, dog, fox, panda, rabbit, bear, penguin, frog, owl, tiger                               |
| Hoa văn  | plain, stripes, spots, patch (không phải loài nào cũng có mọi hoa văn hợp lý; vẫn cho phép) |
| Mắt      | round, happy, sleepy, wink, star, surprised                                                 |
| Miệng    | smile, grin, tongue, o, cat                                                                 |
| Phụ kiện | none, cap, beanie, crown, glasses, sunglasses, bow, scarf, headphones, flower               |
| Bảng màu | 24 màu: lông tự nhiên (8), pastel (8), tươi (8)                                             |

Tên hiển thị của mỗi id nằm trong i18n (`avatar.species.cat` …).

## 4. Vẽ (render)

- `<Avatar avatar size label? />` trả **một `<svg viewBox="0 0 100 100">`**, các lớp theo thứ tự:
  `background → body (đầu + thân) → pattern (cắt theo body bằng clipPath) → ears/inner (accent) → face (mắt, mõm, miệng) → accessory`.
- Mỗi loài định nghĩa **khung chung** để phụ kiện đặt đúng chỗ: `anchors: { head: {x,y,w}, eyes: {y}, neck: {y} }`.
  Phụ kiện vẽ theo anchor, không theo loài ⇒ thêm loài mới không phải vẽ lại phụ kiện.
- id trong SVG (`clipPath`, `gradient`) phải duy nhất mỗi lần vẽ (`useId()`), vì sân khấu vẽ 200 con cùng lúc.
- Không dùng `<foreignObject>`, font ngoài, ảnh ngoài ⇒ xuất PNG được bằng canvas.
- Ở cỡ < 40 px bỏ hoa văn và chi tiết nhỏ (`detail="low"`).
- Hàm thuần: cùng avatar ⇒ cùng SVG (có snapshot test).

## 5. Studio (UX)

- Trang `/office/avatar` và bản rút gọn khi vào phiên lần đầu.
- Bố cục: xem trước lớn ở trên (điện thoại) / bên trái (máy tính); các tab **Loài · Màu · Mặt · Phụ kiện · Nền**;
  mỗi lựa chọn là một nút có hình thu nhỏ (≥ 44 px), có `aria-pressed`.
- Nút **Ngẫu nhiên** (🎲) và **Hoàn tác**. Lưu tự động (debounce 600 ms) vào hồ sơ.
- Tên hiển thị dùng lại tên tài khoản; sửa được ngay trong studio.

## 6. Ngẫu nhiên

`randomAvatar(rng)` nhận `rng` (giao diện `Rng` của `@bg/engine`), chọn loài, rồi chọn cặp màu `body/accent` từ
danh sách **cặp đẹp** đã duyệt (không chọn hai màu bất kỳ), phụ kiện có xác suất `none` 30%.
Dùng ở: nút Ngẫu nhiên (rng UI), avatar mặc định cho khách mới (rng theo `userId` ⇒ ổn định), người vắng mặt.

## 7. Kiểm thử

- Mọi tổ hợp loài × phụ kiện × mắt vẽ được không lỗi (test sinh tổ hợp).
- `AvatarSchema` từ chối màu ngoài bảng, id lạ, trường thừa.
- Snapshot SVG cho một avatar mỗi loài.
- `randomAvatar` với 1.000 seed đều hợp lệ theo schema.
- Hiệu năng: vẽ 200 avatar < 50 ms trong jsdom.
