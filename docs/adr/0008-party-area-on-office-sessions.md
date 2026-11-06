# ADR-0008: Khu thứ ba "Tiệc nhóm" chạy trên phiên Văn phòng; bốc thăm có phần thưởng

- Trạng thái: Accepted · Ngày: 2026-11-06

## Bối cảnh

Người dùng muốn một menu riêng cho các trò chơi nhiều người trong một căn phòng (gia đình, hội bạn), trò đầu tiên là
**Lì xì Tết**: chủ phòng mở phòng, mọi người vào bằng QR với tên và con vật, rồi lần lượt được gọi lên nhận phong bao
có mệnh giá do chủ phòng đặt. Cách chơi giống hệt khu Văn phòng (màn chiếu, điện thoại, chủ trì, bốc thăm công bằng)
nhưng đối tượng và không khí khác.

## Quyết định

- Thêm khu **Tiệc nhóm** dưới `/party/*`, menu thứ ba **Tiệc nhóm ▾** ở header và thẻ thứ ba ở cổng `/`.
- Trò chơi của khu là **hoạt động văn phòng** bình thường (ADR-0005): gói `packages/office/<id>`, một dòng registry,
  cùng `OfficeHub`, socket `/office`, bảng `office_*`. Không có hạ tầng thứ hai.
- Khu của một phiên suy ra từ `activityId` (`apps/web/src/office/areas.ts`). Phiên tiệc ở `/party/s/<code>`
  (`/host`, `/screen`, `/verify/<drawId>`), các trang này dùng lại trang của khu Văn phòng. Mở nhầm khu thì client tự
  chuyển sang đúng khu. `GET /api/office/:code` trả thêm `activityId` để ô "Vào bằng mã" đi thẳng đến đúng khu.
- Bốc thăm có thể kèm **phần thưởng** (`DrawRequest.prizes`): cùng một seed chọn người và phần thưởng của từng người
  (`drawPrizes`, docs/office/04 §5). Chồng phần thưởng công khai từ đầu, phần thưởng của mỗi người lộ cùng lúc reveal.
  Bản ghi cũ không có `prizes` vẫn kiểm chứng như trước.

## Phương án đã cân nhắc

- **Hạ tầng phiên riêng cho Tiệc nhóm:** lặp lại hub, socket, lưu trữ, quyền chủ trì → loại.
- **Để Lì xì trong khu Văn phòng:** không đúng yêu cầu "một menu game nữa", không khí Tết lạc lõng → loại.
- **Hoạt động tự chọn phong bao sau khi hub chọn người:** vi phạm quy tắc 10 (hoạt động không tự random) → loại.
- **Hai lần bốc (một cho người, một cho phong bao):** hai seed, hai trang kiểm chứng, hiệu ứng rời rạc → loại.

## Hệ quả

- ✅ Thêm trò chơi tiệc = thêm một hoạt động; mọi thứ của khu Văn phòng (QR, người vắng mặt, con vật, kiểm chứng) có sẵn.
- ✅ Phần thưởng dùng được cho hoạt động khác (bốc quà nhiều giải).
- ⚠️ Danh sách hoạt động thuộc khu Tiệc nằm ở `areas.ts`; thêm trò tiệc mới phải thêm id vào đó.
- ⚠️ Migration `2026_11_11_001_draw_prizes` thêm cột `prizes`, `awarded` vào `office_draws` (nullable).
