---
name: bg-testing
description: Write or fix tests for games and core packages — rules unit tests, property tests with fast-check, replay fixtures, board component tests, socket integration tests, Playwright E2E. Use when adding tests, fixing a rules bug ("lỗi luật"), reproducing a reported match, or checking a game meets its Definition of Done.
---

# Testing

Tham chiếu: `docs/10-testing-strategy.md`.

## Sửa bug luật (bắt buộc theo thứ tự)

1. Tái hiện bug bằng một fixture: `test/fixtures/bug-<short-desc>.json` gồm `{ config, seed, moves, expected }`.
   Nếu bug đến từ một ván thật: lấy `config`, `seed`, `moves` từ bảng `Match` / `MatchMove`.
2. Chạy test → **phải fail**. Nếu không fail thì chưa tái hiện được bug, quay lại bước 1.
3. Sửa code ở `rules/`.
4. Chạy lại toàn bộ test của game. Nếu cách sửa làm đổi kết quả của các ván cũ → tăng `rulesVersion` (E11).

## Rules unit test

Dùng helper `playMoves` để dựng state, sau đó assert. Đặt tên test mô tả **luật** chứ không mô tả code:

```ts
it('five in a row blocked on both ends does not win when blockedEndsRule is on', () => {
  const s = playMoves(definition, { blockedEndsRule: true }, [/* … */]);
  expect(definition.result(s)).toBeNull();
});
```

Checklist độ phủ cho mỗi game:

- [ ] setup đúng với mọi giá trị của từng field trong config
- [ ] mỗi mã lỗi của `validateMove` có ít nhất 1 test
- [ ] mọi `reason` trong `result` có ít nhất 1 test
- [ ] các trường hợp biên liệt kê ở mục 12 của `docs/games/<id>.md`

## Property test (mọi game)

Dùng `@bg/engine/testing`: `randomPlayout`, `assertLegalMovesConsistent`, `assertSerializable`, `assertNoMutation`,
`assertDeterministic`, và `assertNoHiddenLeak` (game hidden-info). Template ở `.claude/skills/bg-add-game/templates.md`.
Khi fast-check tìm ra counterexample: chuyển nó thành fixture rồi mới sửa code.

## Board component test

Testing Library: render với một view mẫu; tìm ô qua `getByRole('gridcell', { name: … })`, click → expect `onMove` được gọi với move đúng;
`disabled` thì không gọi; `lastMove` có class hoặc thuộc tính highlight.

## Server integration / E2E

Xem phần "Test bắt buộc" trong skill `bg-realtime`. E2E (Playwright): 2 browser context, tạo phòng → join bằng code → chơi
một chuỗi nước định sẵn đến khi kết thúc → cả hai thấy cùng một kết quả.

## Lệnh

```bash
pnpm --filter @bg/game-<id> test             # một game
pnpm --filter @bg/game-<id> test -- -t "blocked"   # lọc theo tên test
pnpm test                                    # toàn repo (Turborepo chỉ chạy package bị ảnh hưởng)
pnpm e2e                                     # Playwright
```

Báo cáo kết quả trung thực: nếu có test fail hoặc bị skip thì nói rõ test nào và vì sao.
