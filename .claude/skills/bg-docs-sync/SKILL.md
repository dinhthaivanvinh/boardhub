---
name: bg-docs-sync
description: Keep docs/ in sync with code after changes to contracts — engine interface, protocol events, data model, architecture, game rules, roadmap status — and write ADRs for breaking decisions. Use at the end of any task that touched packages/engine, packages/protocol, prisma schema, a game's rules, or project structure, or when asked to "cập nhật tài liệu".
---

# Đồng bộ tài liệu

Docs là hợp đồng giữa các agent. Docs sai còn tệ hơn không có docs.

## Ánh xạ thay đổi → file cần cập nhật

| Bạn đã thay đổi…                                       | Cập nhật                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `packages/engine` (types, runner, testing helpers)     | `docs/04-game-engine-spec.md` + ADR nếu là breaking change               |
| `packages/protocol` (event, payload, mã lỗi)           | `docs/05-realtime-protocol.md`                                           |
| `prisma/schema.prisma`, Redis keys                     | `docs/06-data-model.md`                                                  |
| `packages/bots` interface hoặc thuật toán              | `docs/07-bots.md`                                                        |
| `BoardProps`, `useMatch`, primitive của `@bg/ui/board` | `docs/08-frontend-guidelines.md`                                         |
| Cấu trúc thư mục, package mới, tech stack              | `docs/03-architecture.md`, `docs/09-conventions.md`, `CLAUDE.md`         |
| Luật hoặc config của game                              | `docs/games/<id>.md`                                                     |
| Thêm game                                              | `docs/01-product-analysis.md` (bảng lộ trình game), `docs/11-roadmap.md` |
| Hoàn thành một mục roadmap                             | Đánh dấu `[x]` trong `docs/11-roadmap.md`                                |
| Thuật ngữ mới                                          | `docs/glossary.md`                                                       |
| Quy trình làm việc thay đổi                            | Skill tương ứng trong `.claude/skills/`                                  |

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
