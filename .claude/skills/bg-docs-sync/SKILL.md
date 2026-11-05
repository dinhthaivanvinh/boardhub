---
name: bg-docs-sync
description: Keep docs/ in sync with code after changes to contracts — engine interface, protocol events, data model, architecture, game rules, office activities/avatars/draws, roadmap status — and write ADRs for breaking decisions. Use at the end of any task that touched packages/engine, packages/protocol, packages/office-core, packages/avatars, the database schema (apps/server/src/db), a game's or activity's rules, or project structure, or when asked to "cập nhật tài liệu".
---

# Đồng bộ tài liệu

Docs là hợp đồng giữa các agent. Docs sai còn tệ hơn không có docs.

## Ánh xạ thay đổi → file cần cập nhật

| Bạn đã thay đổi…                                       | Cập nhật                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `packages/engine` (types, runner, testing helpers)     | `docs/04-game-engine-spec.md` + ADR nếu là breaking change                            |
| `packages/protocol` (event, payload, mã lỗi)           | `docs/05-realtime-protocol.md`                                                        |
| `apps/server/src/db/database.ts`, Redis keys           | `docs/06-data-model.md`                                                               |
| `packages/bots` interface hoặc thuật toán              | `docs/07-bots.md`                                                                     |
| `BoardProps`, `useMatch`, primitive của `@bg/ui/board` | `docs/08-frontend-guidelines.md`                                                      |
| Cấu trúc thư mục, package mới, tech stack              | `docs/03-architecture.md`, `docs/09-conventions.md`, `CLAUDE.md`                      |
| Luật hoặc config của game                              | `docs/games/<id>.md`                                                                  |
| Thêm game                                              | `docs/01-product-analysis.md` (bảng lộ trình game), `docs/11-roadmap.md`              |
| Hoàn thành một mục roadmap                             | Đánh dấu `[x]` trong `docs/11-roadmap.md`                                             |
| Thuật ngữ mới                                          | `docs/glossary.md`                                                                    |
| Quy trình làm việc thay đổi                            | Skill tương ứng trong `.claude/skills/`                                               |
| `@bg/office-core` (hợp đồng hoạt động, bốc thăm)       | `docs/office/04-activity-spec.md` + ADR nếu breaking (đổi `drawWinners` luôn cần ADR) |
| `@bg/avatars` (schema, catalog)                        | `docs/office/05-avatar-system.md`                                                     |
| Sự kiện `office:*`, REST văn phòng, bảng `office_*`    | `docs/office/06-protocol-and-data.md`                                                 |
| Màn văn phòng, hiệu ứng bốc                            | `docs/office/07-ux-guidelines.md`                                                     |
| Thêm/sửa hoạt động văn phòng                           | `docs/office/activities/<id>.md`, `docs/office/08-roadmap.md`                         |

## Khi nào phải viết ADR

Thay đổi interface `GameDefinition` / `runMove`, protocol breaking, đổi công nghệ chính, đổi nguyên tắc kiến trúc, schema DB breaking.
Copy `docs/adr/_template.md` → `docs/adr/NNNN-<slug>.md` (số tiếp theo). ADR cũ bị thay thế thì đổi trạng thái thành `Superseded by ADR-NNNN`, không xóa.

## Quy tắc viết

- Tiếng Việt; tên code, event, field giữ nguyên tiếng Anh trong `backtick`.
- Dùng đúng thuật ngữ trong `docs/glossary.md`.
- Code mẫu trong docs phải khớp với type thật. Nếu đã copy type vào docs, hãy grep lại sau khi đổi type.
- Cập nhật dòng "Cập nhật: YYYY-MM-DD" ở đầu file nếu có.

## Kiểm tra cuối

```bash
git diff --name-only            # liệt kê file code đã đổi → đối chiếu với bảng ánh xạ ở trên
grep -rn "TODO(docs)" docs/     # không còn TODO bị bỏ sót
```

Liệt kê trong báo cáo cuối các file docs đã cập nhật, và những gì cố ý chưa cập nhật (kèm lý do).
