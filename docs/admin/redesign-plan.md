# Kế hoạch nâng cấp trang Admin

> Lập ngày 2026-11-26. Trạng thái: **đã duyệt; GĐ0 đã làm** (xem [ADR-0013](../adr/0013-admin-roles-and-activity-data.md)). Nguồn yêu cầu: bản mô tả "Complete Admin Dashboard Redesign".

## 1. Hiện trạng (đã đọc từ code)

| Mảng               | Đang có                                                                                                                           | Ghi chú                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Web                | Next.js; một trang `/admin` (`features/admin/AdminScreen.tsx`), 5 tab: thống kê, báo cáo mở, đã xử lý, bật/tắt game, đang bị phạt | Dùng chung header/footer của trang cho bé                                     |
| Server             | Fastify; `admin/admin-routes.ts`, `admin-service.ts`, `stats/`                                                                    | Mọi route admin đã kiểm tra quyền ở server                                    |
| DB                 | Kysely + Postgres; không có `DATABASE_URL` thì lưu trong bộ nhớ                                                                   | Mỗi repo có bản Memory và bản Pg                                              |
| Đăng nhập          | JWT 30 ngày; khách hoặc tài khoản email + mật khẩu                                                                                | Không xác minh email, không đặt lại mật khẩu                                  |
| Quyền admin        | Tài khoản đã đăng ký có email nằm trong `ADMIN_EMAILS`                                                                            | Chỉ một vai trò                                                               |
| Thống kê           | `daily_visits`: mỗi trình duyệt một dòng mỗi ngày (ẩn danh / khách / tài khoản), giữ 90 ngày                                      | Mã trình duyệt là ngẫu nhiên, không gắn với tài khoản                         |
| Tiến độ học        | `users.learn_progress`: id bài đã xong, id câu đố đã giải, ngày giải câu đố                                                       | **Không có thời điểm** hoàn thành từng bài                                    |
| Bài học            | Dữ liệu và màn hình nằm trong code (`packages/games/chess/src/learn`), chữ ở i18n, giọng đọc thu sẵn                              | Không có trong DB                                                             |
| Câu đố             | File sinh tự động: chiếu hết 1 nước, Trắng đi, 3 mức                                                                              | Không có trong DB                                                             |
| Sao, cấp, huy hiệu | Tính từ tiến độ bằng hàm trong `learn/journey.ts`                                                                                 | Không lưu riêng                                                               |
| Ván cờ             | `matches`, `match_players`, `match_moves`                                                                                         | Chỉ ván qua server. Ván với máy và 2 người cùng máy chỉ nằm trong trình duyệt |

## 2. Việc phải xử lý trước

### 2.1 Lỗ hổng quyền admin

`register` chỉ kiểm tra email đã có người dùng chưa, còn `isAdmin` chỉ so email với `ADMIN_EMAILS`. Vì không xác minh email,
**ai đăng ký trước một địa chỉ có trong `ADMIN_EMAILS` mà chưa có tài khoản sẽ thành admin**. Nếu production lưu trong
bộ nhớ thì sau mỗi lần server khởi động lại, địa chỉ đó lại trống. Khi admin xem được email và hoạt động của trẻ, rủi ro này
không chấp nhận được. (Kết luận từ đọc code, chưa thử trên production.)

Cách sửa (đã làm ở GĐ0): quyền admin gắn với **tài khoản** qua bảng `roles` và `user_roles`. Khi chưa có Super Admin nào,
server cấp lúc khởi động cho tài khoản đã đăng ký có email trong `ADMIN_EMAILS` (Render gói free không có shell để cấp
bằng lệnh). Đăng ký mới bằng email trong danh sách bị từ chối.

### 2.2 Database production

Đã xác nhận (2026-11-26): production đã đặt `DATABASE_URL`, tài khoản admin đã đăng ký.

### 2.3 Dữ liệu chưa được thu thập

Biểu đồ không thể dựng ngược lại quá khứ cho những thứ chưa ghi. Vì vậy phần thu thập làm **sớm nhất**.

| Số liệu được yêu cầu                                 | Hiện có?                     | Cách làm                                                  |
| ---------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| Tổng tài khoản, đã đăng ký, khách                    | Có (`users`)                 | Dùng ngay, so kỳ trước bằng `created_at`                  |
| Người truy cập duy nhất theo khoảng ngày             | Có (`daily_visits`)          | `COUNT(DISTINCT visitor_id)`; không cộng dồn số từng ngày |
| Phiên truy cập                                       | Chưa                         | Thêm đếm phiên (nghỉ quá 30 phút là phiên mới)            |
| Hoạt động cuối                                       | Chưa                         | `users.last_seen_at`                                      |
| Tổng bài đã xong, câu đố đã giải                     | Có, chỉ với người đã đồng bộ | Tính từ `learn_progress`                                  |
| Học theo ngày, người học tích cực, lịch sử hoạt động | Chưa                         | Bảng `learn_events`                                       |
| Thời gian học                                        | Chưa                         | Cần đo ở client; để sau, không ước đoán                   |
| Chuỗi ngày học                                       | Chỉ chuỗi giải câu đố        | Có `learn_events` thì tính được cho cả bài học            |
| Ván cờ                                               | Chỉ ván qua server           | Ghi rõ "ván online" trên giao diện                        |

Đã quyết: client gửi `learn_events` **lúc hoàn thành**, kể cả khi không đăng nhập (theo mã ngẫu nhiên của trình duyệt,
không có tên hay email). Tiến độ cũ không bị tính vào biểu đồ.

### 2.4 Định nghĩa số liệu (hiển thị ngay trong giao diện)

| Tên                     | Định nghĩa                                                                        |
| ----------------------- | --------------------------------------------------------------------------------- |
| Người truy cập duy nhất | Số mã trình duyệt khác nhau trong khoảng ngày. Một người dùng hai máy tính là hai |
| Phiên                   | Một lượt dùng liên tục                                                            |
| Khách vãng lai          | Truy cập mà không đăng nhập; **không** phải tài khoản                             |
| Tài khoản khách         | Dòng `users` loại `guest` (tạo khi cần chơi online hoặc dùng khu Văn phòng)       |
| Tài khoản đăng ký       | Dòng `users` loại `registered`                                                    |
| Người dùng hoạt động    | Tài khoản có `last_seen_at` trong khoảng ngày                                     |
| Người học tích cực      | Có ít nhất một sự kiện học trong khoảng ngày                                      |

Gộp một người trên nhiều thiết bị chỉ làm được với tài khoản đã đăng nhập (đếm theo `user_id`). Không đoán danh tính của
khách vãng lai. Dữ liệu lượt vào chỉ giữ 90 ngày, nên bộ lọc 90 ngày **không có** số so với kỳ trước, trừ khi tăng lên 180 ngày.

## 3. Thiết kế khung

- **Tách giao diện:** `app/admin/layout.tsx` + `AdminShell` (sidebar, header). Header/footer của trang bé bọc trong một
  component ẩn khi đường dẫn bắt đầu bằng `/admin`, không phải di chuyển các trang khác.
- **CSS:** file riêng `app/admin/admin.css`, token gắn vào `.admin`, không ảnh hưởng trang bé. Giai đoạn đầu chỉ có nền sáng.
- **Màu:** giữ bảng màu yêu cầu cho nền, viền, biểu đồ. Ba màu không đủ tương phản cho chữ nhỏ (AA 4,5:1):
  `#1976F3` trên trắng khoảng 4,3 → nút có chữ trắng dùng `#1554B8`; `#71839B` khoảng 3,9 → chữ phụ dùng `#5A6C85`;
  `#E8A12B` chỉ dùng cho nền nhạt và biểu tượng.
- **Component dùng chung** (`features/admin/ui/`): `StatCard`, `DataTable` (sắp xếp, phân trang), `DateRangeFilter`,
  `ConfirmDialog`, `StatusChip`, `Toast`, và trạng thái đang tải / trống / lỗi.
- **Biểu đồ:** SVG tự viết (đường và cột là đủ), không thêm thư viện. Mỗi biểu đồ có bảng số kèm theo.
- **Chữ:** qua i18n, đủ `vi` và `en`.
- **Menu:** chỉ hiện mục đã làm xong. Không để mục trống.
- **Header:** breadcrumb, avatar, menu hồ sơ, đăng xuất. Chuông báo = số báo cáo chưa xử lý. Ô tìm kiếm bật khi có
  trang Người dùng.

Chuyển 5 tab hiện tại, không mất chức năng:

| Tab cũ                             | Chỗ mới                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| Thống kê                           | `/admin` (thẻ số) và `/admin/visitors` (chi tiết, bảng ngày, CSV) |
| Báo cáo mở, đã xử lý, đang bị phạt | `/admin/reports`                                                  |
| Bật/tắt game (cả 8 board game)     | `/admin/settings/games`                                           |

## 4. Các giai đoạn

Mỗi mục là một PR. Cỡ: S nhỏ, M vừa, L lớn.

### GĐ0 — Nền an toàn (S)

1. Xác nhận database production.
2. Sửa lỗ hổng 2.1 bằng bảng `roles`, `user_roles`.
3. `users.last_seen_at`, `learn_events`, đếm phiên. Bắt đầu thu thập.

**Xong khi:** test chứng minh người lạ không chiếm được quyền admin; sự kiện học được ghi trên Postgres thật.

### GĐ1 — Khung + Tổng quan + Thống kê truy cập (L)

- 1a. Khung admin, component dùng chung, chuyển 5 tab. Không đổi API.
- 1b. `GET /api/admin/overview` và `GET /api/admin/analytics?from&to` (ngày theo giờ Việt Nam, tối đa 90 ngày).
  8 thẻ số; 4 biểu đồ (tăng người dùng, hoạt động học, bài hoàn thành, ván cờ); lọc Hôm nay / 7 / 14 / 30 / 90 / tùy chọn;
  hoạt động gần đây.
- 1c. Trang truy cập: giữ nguyên nguồn `daily_visits`, thêm biểu đồ, lọc ngày, bảng chi tiết, định nghĩa, xuất CSV
  (chặn công thức trong ô CSV).

Biểu đồ dùng dữ liệu mới ghi "có dữ liệu từ ngày …", không vẽ số 0 giả cho quá khứ.

### GĐ2 — Người dùng, câu đố, học tập

**2a. Nhật ký admin + Người dùng (L).** Nhật ký làm ở đây, sớm hơn đề bài, vì từ đây admin xem dữ liệu cá nhân và có
thao tác xóa.

- Bảng `admin_audit`: ai, hành động, đối tượng, thời điểm, thay đổi. Chỉ thêm, không sửa/xóa. Ghi cả các thao tác
  hiện có (bật/tắt game, phạt), xem hồ sơ chi tiết và xuất CSV.
- Danh sách: tìm, lọc (loại, ngày đăng ký, trạng thái), sắp xếp, phân trang **ở server**. Số sao lưu thêm thành cột,
  cập nhật khi đồng bộ tiến độ, tính bằng chính `totalStars` (cần export không kèm React cho server).
- Chi tiết: thông tin, sao, cấp, huy hiệu, tiến độ, chuỗi ngày, ván online, lịch sử từ `learn_events`.
- Sửa: chỉ tên hiển thị. Khóa/mở: dùng lại `user_sanctions`.
- **Xóa = ẩn danh hóa** (đúng docs/06 §3): xóa email, mật khẩu, avatar, tiến độ, sự kiện; giữ lịch sử ván.
  Xóa hẳn dòng không được vì `match_players` tham chiếu `users`. Token cũ phải bị từ chối.
- CSV mặc định không kèm email. Không bao giờ trả `password_hash`.

**2b. Câu đố (L).**

- Câu đố sẵn có **giữ trong code** (chỉ đọc, có thể ẩn). Câu mới lưu ở bảng `puzzles`; web đọc qua API công khai và
  vẫn chạy bằng câu sẵn có khi server đang ngủ.
- Trình soạn dùng lại bàn cờ và luật của `@bg/game-chess`: FEN, bên đi, nhiều nước, gợi ý, giải thích, 4 độ khó,
  gắn chặng học, xem trước.
- Kiểm tra trước khi xuất bản: FEN hợp lệ, mọi nước hợp lệ; câu dạng "chiếu hết trong N" được duyệt để xác nhận có chiếu hết.
- Phải sửa phía bé: hiện `writeLocalProgress` và `totalStars` **bỏ qua id câu đố không có trong code**, nên câu mới sẽ
  không được lưu và không được tính sao. Màn giải cũng phải hỗ trợ nhiều nước.
- Câu đố hằng ngày chỉ lấy từ bộ sẵn có, để thêm câu mới không làm đổi lịch.
- Chữ mới không có giọng thu sẵn, trình duyệt sẽ đọc thay.

**2c. Học tập, mức 1 (M).** Cây Chặng → Bài (đọc từ code), xem trước, số người đã hoàn thành, ẩn/hiện và đổi thứ tự trong
chặng (lưu phần ghi đè ở DB). Bài đã ẩn vẫn giữ sao đã nhận; cần test cho huy hiệu `master` và "bài tiếp theo".

**Mức 2 (CMS đầy đủ) chưa đưa vào kế hoạch.** Mỗi loại bài hiện là một component riêng. Tạo/sửa bài, quiz, hoạt động bàn cờ,
tải ảnh/video đòi hỏi: thiết kế lại cách dựng bài, chuyển nội dung song ngữ vào DB, nơi lưu file (đĩa Render gói free
không giữ được file), và bài sửa sẽ mất giọng thu sẵn. Nếu cần, viết spec và ADR riêng.

### GĐ3 — Ván cờ, báo cáo, thành tích

**3a. Ván cờ (M).** Chỉ đọc, không có API sửa kết quả. Thống kê và bảng (mã, hai người chơi, bắt đầu, kết thúc, thời lượng,
kết quả, trạng thái), chi tiết dùng lại `ReplayScreen`. Hiện chỉ có `playing` và `finished`; **không có "đã hủy"**.
Đề xuất hiển thị "bỏ dở" cho ván `playing` không có nước mới quá 24 giờ và ghi rõ định nghĩa.

**3b. Báo cáo và phản hồi (M).** Mở rộng `player_reports`: `new` / `in_progress` / `resolved` (`open` cũ thành `new`),
người phụ trách, ghi chú nội bộ. Giữ nguyên cấm chat, khóa, bằng chứng chat. Phản hồi phụ huynh/bé hiện **chưa có nơi gửi**:
cần bảng `feedback` và một form công khai, có giới hạn tần suất, không bắt buộc thông tin liên hệ.

**3c. Thành tích, mức xem (S).** Danh sách huy hiệu, điều kiện, số người đạt; mốc cấp; bảng xếp hạng (dùng `ratings`).
Chưa cho sửa giá trị thưởng: sao được **tính lại** từ tiến độ, đổi giá trị là đổi luôn sao đã có của mọi bé, trái yêu cầu
"giữ nguyên logic thưởng". Tạo huy hiệu mới và nhiệm vụ hằng ngày (hiện chưa tồn tại) là tính năng sản phẩm, cần spec riêng.

### GĐ4 — Vai trò và hoàn thiện (M)

Quyền kiểm tra theo **hành động** ở server (`requirePermission('users.delete')`). Trang gán vai trò, trang xem nhật ký.
Không cho hạ quyền Super Admin cuối cùng.

| Quyền                                    | Super Admin | Content Manager | Moderator | Analyst |
| ---------------------------------------- | :---------: | :-------------: | :-------: | :-----: |
| Tổng quan, thống kê tổng hợp             |      ✓      |        ✓        |     ✓     |    ✓    |
| Câu đố, học tập                          |      ✓      |        ✓        |           |         |
| Hồ sơ người dùng (có email)              |      ✓      |                 |     ✓     |         |
| Báo cáo, cấm chat, khóa                  |      ✓      |                 |     ✓     |         |
| Xóa tài khoản, xuất danh sách người dùng |      ✓      |                 |           |         |
| Bật/tắt game, vai trò, nhật ký           |      ✓      |                 |           |         |

Trước GĐ4, chỉ Super Admin vào được trang admin.

## 5. Kiểm tra sau mỗi PR

- `pnpm lint`, `pnpm typecheck`, `pnpm test` cho package bị ảnh hưởng.
- Mỗi API admin mới có test: chưa đăng nhập, không phải admin, (từ GĐ4) sai vai trò.
- Repo mới có test tích hợp trên Postgres thật; chỉ thêm migration, không sửa migration đã chạy.
- e2e: trên máy chỉ chạy các test liên quan; cả bộ chạy trên CI.
- Xem giao diện ở 3 cỡ: 1280, 768, 375 px.
- Cập nhật docs/05, docs/06; ADR cho vai trò và cho việc thu thập sự kiện học.
- Không dùng dữ liệu giả trên production.

## 6. Đã quyết định (2026-11-26)

| #   | Câu hỏi                              | Quyết định   |
| --- | ------------------------------------ | ------------ |
| 1   | Database production, tài khoản admin | Đã có cả hai |
| 2   | Đếm việc học của bé không đăng nhập  | Có, ẩn danh  |
| 3   | Quản lý học tập                      | Mức 1        |
| 4   | Thành tích                           | Chỉ xem      |
| 5   | Vai trò                              | Có bảng role |

Dữ liệu ở đây là của trẻ em, nên chỉ thu thập đúng thứ cần cho số liệu, đặt thời hạn lưu, và xem lại quy định bảo vệ
dữ liệu cá nhân áp dụng trước khi mở rộng việc thu thập.
