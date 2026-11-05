# Khu "Văn phòng" — mục lục tài liệu

Trò chơi nhỏ cho nhân viên văn phòng: mỗi người có một con vật đại diện tự trang trí, chủ trì chiếu sân khấu, trò chơi
bốc ngẫu nhiên công bằng (commit–reveal) người được chọn.

| Tài liệu                                             | Nội dung                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| [O-01 Phân tích sản phẩm](01-product-analysis.md)    | Tầm nhìn, personas, tình huống, bổ sung đề xuất, rủi ro, KPI  |
| [O-02 Yêu cầu](02-requirements.md)                   | FR-NAV / AVA / SES / DRAW / FAIR, NFR-OFF                     |
| [O-03 Kiến trúc](03-architecture.md)                 | Gói mới, OfficeHub, luồng vào phiên, luồng bốc thăm, quy mô   |
| [O-04 Hợp đồng hoạt động](04-activity-spec.md)       | `ActivityDefinition`, quy tắc A1–A8, thuật toán bốc công khai |
| [O-05 Hệ thống con vật](05-avatar-system.md)         | Schema avatar, catalog, cách vẽ, studio                       |
| [O-06 Giao thức & dữ liệu](06-protocol-and-data.md)  | Sự kiện `office:*`, REST, mã lỗi, Postgres, Redis             |
| [O-07 UX](07-ux-guidelines.md)                       | Ba màn, hiệu ứng bốc, đồng bộ thời gian, điện thoại, a11y     |
| [O-08 Lộ trình](08-roadmap.md)                       | Mốc O0–O5                                                     |
| [Hoạt động: Thú may mắn](activities/lucky-animal.md) | Đặc tả hoạt động đầu tiên                                     |
| [Mẫu đặc tả hoạt động](activities/_template.md)      | Copy khi thêm hoạt động mới                                   |

ADR liên quan: [0005](../adr/0005-office-activities-contract.md) hợp đồng hoạt động ·
[0006](../adr/0006-fair-draw-commit-reveal.md) bốc thăm commit–reveal ·
[0007](../adr/0007-two-areas-information-architecture.md) hai khu & URL.
