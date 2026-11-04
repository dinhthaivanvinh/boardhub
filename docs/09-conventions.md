# 09 — Coding Conventions

## 1. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Không dùng `any`; khi bất đắc dĩ thì dùng `unknown` rồi parse bằng zod.
- Ưu tiên `type`/`interface` + hàm thuần; tránh class, trừ khi là service ở server.
- Export có tên (named export); chỉ dùng default export khi Next.js bắt buộc (page, layout).

## 2. Đặt tên

| Thứ             | Quy ước                                       | Ví dụ                          |
| --------------- | --------------------------------------------- | ------------------------------ |
| Game id         | kebab-case, tiếng Anh hoặc phiên âm không dấu | `caro`, `xiangqi`, `o-an-quan` |
| Package         | `@bg/<name>`, game: `@bg/game-<id>`           | `@bg/game-caro`                |
| File            | kebab-case                                    | `win-detection.ts`             |
| React component | PascalCase                                    | `CaroBoard.tsx`                |
| Socket event    | `domain:action`                               | `move:submit`                  |
| Mã lỗi          | `<namespace>.<snake_case>`                    | `caro.cell_occupied`           |
| Biến boolean    | `is/has/can/should`                           | `isMyTurn`                     |

## 3. Cấu trúc package game (bắt buộc)

```
packages/games/<id>/
├─ package.json          # name: @bg/game-<id>
├─ README.md             # tóm tắt + link tới docs/games/<id>.md
├─ src/
│  ├─ index.ts           # export { definition, Board, bot, meta, i18n }
│  ├─ rules/
│  │  ├─ types.ts        # State, Move, Config
│  │  ├─ config.ts       # configSchema (zod)
│  │  ├─ setup.ts
│  │  ├─ moves.ts        # moveSchema, validateMove, applyMove, legalMoves
│  │  ├─ result.ts
│  │  ├─ view.ts         # playerView
│  │  └─ definition.ts   # gộp lại thành GameDefinition
│  ├─ ui/
│  │  ├─ Board.tsx
│  │  └─ theme.css
│  ├─ bot/
│  │  └─ index.ts
│  └─ i18n/
│     ├─ vi.json
│     └─ en.json
└─ test/
   ├─ rules.test.ts
   ├─ properties.test.ts
   ├─ fixtures/          # chuỗi nước đi của các ván mẫu (.json)
   └─ Board.test.tsx
```

## 4. Git

- Nhánh: `feat/<scope>-<desc>`, `fix/<scope>-<desc>`, `docs/…`, `chore/…`. Ví dụ: `feat/game-xiangqi-rules`.
- Commit theo Conventional Commits: `feat(game-caro): detect overline in freestyle variant`.
  Scope là tên package bỏ `@bg/` (`engine`, `protocol`, `web`, `server`, `game-caro`…).
- PR phải: pass CI (lint, typecheck, test), ghi ID yêu cầu liên quan (ví dụ `FR-PLAY-03`) và cập nhật docs nếu thay đổi hợp đồng.

## 5. Lỗi & log

- Ở server: lỗi nghiệp vụ trả về qua `Ack {ok:false, code}`, không throw. Chỉ throw với lỗi lập trình (bug).
- Log dạng JSON (pino), luôn kèm `roomId`, `matchId`, `seat` nếu có. Không log nội dung chat hay thông tin ẩn của game.

## 6. Khi nào cần ADR

Viết ADR mới trong `docs/adr/` khi thay đổi: interface engine, protocol (breaking), lựa chọn công nghệ chính,
mô hình dữ liệu (breaking), hoặc một trong các nguyên tắc kiến trúc ở [03](03-architecture.md#1-nguyên-tắc-kiến-trúc).
