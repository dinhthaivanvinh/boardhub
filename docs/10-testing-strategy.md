# 10 — Testing Strategy

## 1. Kim tự tháp test

| Tầng               | Công cụ                   | Phạm vi                                                                | Bắt buộc           |
| ------------------ | ------------------------- | ---------------------------------------------------------------------- | ------------------ |
| Rules unit         | Vitest                    | Từng luật của từng game                                                | ✅ mọi game        |
| Rules property     | Vitest + fast-check       | Bất biến engine (E4–E7, E10)                                           | ✅ mọi game        |
| Fixture replay     | Vitest                    | Ván mẫu có thật → kết quả mong đợi                                     | ✅ mọi game        |
| Bot                | Vitest                    | Bot luôn trả về nước hợp lệ, tôn trọng deadline, thắng được bot random | ✅ nếu game có bot |
| Board component    | Vitest + Testing Library  | Render, click → `onMove`, a11y labels                                  | ✅                 |
| Server integration | Vitest + socket.io-client | Luồng phòng/ván với Redis thật (testcontainers)                        | ✅ lõi             |
| E2E                | Playwright                | 2 trình duyệt chơi hết một ván                                         | Smoke cho mỗi game |

## 2. Test bắt buộc cho mỗi game (Definition of Done)

```ts
// test/properties.test.ts — dùng helper từ @bg/engine/testing
describe('<game> invariants', () => {
  it('random playouts always terminate with a valid result', ...);        // randomPlayout 200 ván
  it('legalMoves matches validateMove', ...);                              // E7
  it('state is JSON-serializable after every move', ...);                  // E4
  it('applyMove does not mutate input', ...);                              // E5 (deep-freeze state)
  it('same seed + moves => same state', ...);                              // E2/E3
  it('playerView hides private info', ...);                                // E10, chỉ với hidden-info
});
```

Rules unit test phải có ít nhất:

- Trạng thái khởi tạo đúng với **mọi biến thể** cấu hình.
- Mỗi loại nước đi hợp lệ, và mỗi mã lỗi trong `validateMove` có ít nhất một test kích hoạt.
- Mọi điều kiện kết thúc (thắng/hòa/bế tắc) và các trường hợp biên (góc bàn, cạnh bàn, nước cuối cùng).

## 3. Fixtures

- Lưu ở `test/fixtures/*.json`: `{ config, seed, moves: [...], expected: { result, finalStateHash? } }`.
- Khi sửa bug luật: **thêm fixture tái hiện bug trước**, sau đó mới sửa.

## 4. CI

`pnpm lint && pnpm typecheck && pnpm test` chạy trên mỗi PR (Turborepo chỉ chạy lại package bị ảnh hưởng).
E2E chạy trên nhánh `main` và trước khi release.

Coverage tối thiểu: `rules/` **90%** lines; các phần còn lại 70%.
