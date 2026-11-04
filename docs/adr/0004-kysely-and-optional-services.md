# ADR-0004: Kysely thay cho Prisma; Redis và Postgres là tùy chọn khi dev

- Trạng thái: Accepted · Ngày: 2026-11-05 · Thay thế phần "Prisma" trong [03](../03-architecture.md) và [06](../06-data-model.md)

## Bối cảnh

Khi làm M2, Prisma mới nhất đang ở bản 8 RC với nhiều thay đổi lớn (driver adapter, generated client). Nhu cầu của
dự án nhỏ: vài bảng, truy vấn đơn giản, cần kiểu dữ liệu rõ ràng. Ngoài ra, bắt dev cài Docker chỉ để chơi thử là rào cản.

## Quyết định

- Dùng **Kysely + `pg`**: query builder có kiểu, migration viết bằng TypeScript trong `apps/server/src/db/database.ts`, server tự migrate khi khởi động.
- Lưu trữ đi qua interface (`LiveStore`, `UserRepo`, `HistoryRepo`) với 2 bản:
  - Bộ nhớ (mặc định khi thiếu `REDIS_URL` / `DATABASE_URL`) cho dev và unit test.
  - Redis / Postgres cho production và test tích hợp (`pnpm --filter @bg/server test:integration`).

## Phương án đã cân nhắc

- **Prisma 8 RC:** API chưa ổn định, cần bước generate → loại.
- **Drizzle:** tốt, nhưng Kysely đủ dùng và đơn giản hơn cho migration viết tay.
- **SQL thuần với `pg`:** mất kiểu dữ liệu → loại.

## Hệ quả

- ✅ `pnpm dev` chạy được không cần Docker; unit test không cần dịch vụ ngoài.
- ✅ Kiểu của bảng nằm cạnh migration, dễ đọc.
- ⚠️ Phải giữ 2 bản của mỗi repo đúng hành vi như nhau: có test tích hợp cho bản Redis/Postgres.
- ⚠️ Chế độ bộ nhớ mất dữ liệu khi khởi động lại; client tự tạo khách mới khi token không còn hợp lệ.
