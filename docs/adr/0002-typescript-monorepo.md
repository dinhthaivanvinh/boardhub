# ADR-0002: TypeScript monorepo (pnpm + Turborepo)

- Trạng thái: Accepted · Ngày: 2026-11-04

## Bối cảnh

Engine, protocol và UI component của game phải dùng chung giữa web và server.

## Quyết định

Dùng một repo, một ngôn ngữ (TypeScript strict), pnpm workspaces để quản lý package, Turborepo để cache build/test.
Mỗi game là một package riêng `@bg/game-<id>`.

## Phương án đã cân nhắc

- **Nhiều repo:** phải đồng bộ phiên bản engine/protocol rất mệt → loại.
- **Server viết bằng Go/Rust:** hiệu năng tốt hơn, nhưng phải viết luật 2 lần hoặc dùng WASM → để sau, nếu thực sự cần.

## Hệ quả

- ✅ Đổi interface thì lỗi type xuất hiện ngay trong toàn bộ repo.
- ⚠️ Phải ép quy tắc phụ thuộc giữa các package bằng ESLint để giữ engine sạch.
