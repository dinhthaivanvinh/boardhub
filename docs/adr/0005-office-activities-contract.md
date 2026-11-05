# ADR-0005: Hoạt động văn phòng dùng hợp đồng riêng (`ActivityDefinition`), không dùng `GameDefinition`

- Trạng thái: Accepted · Ngày: 2026-11-05

## Bối cảnh

Khu "Văn phòng" cần các hoạt động như bốc thăm bằng con vật, chia đội, bốc quà. Chúng khác board game ở nhiều
điểm: có **chủ trì** điều khiển; tới **200 người** vào/ra bất kỳ lúc nào; **không có lượt**; một số hành động chỉ chủ
trì được làm; cần ba kiểu màn (chủ trì, sân khấu, người tham gia); ngẫu nhiên phải **kiểm chứng được**.
`GameDefinition` giả định số ghế cố định (`minPlayers..maxPlayers`), `activePlayers` theo lượt, phòng có ghế, đồng hồ.

## Quyết định

- Tạo gói `@bg/office-core` với hợp đồng `ActivityDefinition` (O-04): thuần như engine (không I/O, không
  `Math.random`, không `Date`), có `validate/apply/view`, xin hub bốc thăm qua `draw` (không tự random).
- Server có `OfficeHub` riêng và namespace Socket.IO `/office`, **dùng chung** hạ tầng: auth, gateway pattern, khoá,
  `JobScheduler`, LiveStore, Postgres, Redis adapter.
- Mỗi hoạt động là một gói `packages/office/<id>`, đăng ký bằng một dòng (giống game).

## Phương án đã cân nhắc

- **Dùng `GameDefinition` với 200 ghế:** phòng/ghế/sẵn sàng/đồng hồ không có nghĩa; `activePlayers` phải trả cả 200
  người; xếp hạng, ghép trận, replay không áp dụng. Làm lõi board game phức tạp thêm → loại.
- **Viết khu Văn phòng như ứng dụng riêng:** lặp lại auth, socket, lưu trữ, i18n → loại.
- **Không có hợp đồng, viết thẳng logic trong hub:** mỗi hoạt động mới phải sửa hub, khó test → loại.

## Hệ quả

- ✅ Lõi board game không đổi; khu Văn phòng có mô hình đúng với bản chất (chủ trì + đám đông).
- ✅ Hoạt động test được như luật game (thuần, xác định).
- ⚠️ Hai hub song song: một số logic (khoá, rate limit, resync theo `seq`) cần giữ nhất quán; skill `office-realtime`
  ghi rõ các bất biến dùng chung.
