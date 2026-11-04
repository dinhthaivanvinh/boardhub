# 04 — Đặc tả Game Engine (`@bg/engine`)

Đây là **hợp đồng quan trọng nhất** của dự án. Mọi game đều phải tuân theo. Muốn thay đổi file này thì phải có ADR mới.

## 1. Kiểu dữ liệu cơ bản

```ts
// packages/engine/src/types.ts
export type Seat = number; // 0..maxPlayers-1, thứ tự ngồi trong ván
export type Viewer = Seat | 'spectator';

export type GameTag = 'perfect-info' | 'chance' | 'hidden-info' | 'simultaneous' | 'multi-player';

export interface GameMeta {
  id: string; // kebab-case, duy nhất, KHÔNG đổi sau khi phát hành
  rulesVersion: number; // tăng khi luật đổi, làm ván cũ không replay đúng được nữa
  minPlayers: number;
  maxPlayers: number;
  tags: GameTag[];
  estimatedMinutes: number;
  i18nKey: string; // ví dụ 'games.caro' → tên + mô tả trong i18n của game
}

export type MoveCheck = { ok: true } | { ok: false; code: string; params?: Record<string, unknown> }; // code dạng 'caro.cell_occupied'

export type GameResult =
  | { kind: 'win'; winners: Seat[]; reason: string } // reason: 'five_in_row', 'checkmate', 'resign', 'timeout'
  | { kind: 'draw'; reason: string }; // 'board_full', 'agreement', 'repetition'

export interface EngineContext {
  rng: Rng; // RNG có seed, do runner cung cấp
}

export interface Rng {
  next(): number; // [0, 1)
  int(minInclusive: number, maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[]; // trả về mảng mới
}
```

## 2. Interface `GameDefinition`

```ts
import type { z } from 'zod';

export interface GameDefinition<S, M, C> {
  meta: GameMeta;

  /** Schema cấu hình ván (biến thể). Phải có default cho mọi field. */
  configSchema: z.ZodType<C>;

  /** Schema của một nước đi. Runner dùng để parse input từ network. */
  moveSchema: z.ZodType<M>;

  /** Tạo state ban đầu. */
  setup(config: C, playerCount: number, ctx: EngineContext): S;

  /** Những ghế được phép đi lúc này. Rỗng khi ván đã kết thúc. Nhiều phần tử khi các ghế đi đồng thời. */
  activePlayers(state: S): Seat[];

  /** Kiểm tra nước đi có hợp lệ không. KHÔNG được thay đổi state. */
  validateMove(state: S, seat: Seat, move: M): MoveCheck;

  /** Áp dụng nước đi đã hợp lệ. Trả về state MỚI và không mutate state cũ. */
  applyMove(state: S, seat: Seat, move: M, ctx: EngineContext): S;

  /** Kết quả ván, hoặc null nếu ván chưa kết thúc. */
  result(state: S): GameResult | null;

  /** Phần state mà viewer được phép thấy. Game perfect-info có thể trả về chính state. */
  playerView(state: S, viewer: Viewer): unknown;

  /** (Tuỳ chọn, nhưng nên có) Liệt kê nước đi hợp lệ. Bắt buộc nếu game có bot hoặc highlight nước hợp lệ. */
  legalMoves?(state: S, seat: Seat): M[];

  /** (Tuỳ chọn) Xử lý khi một ghế bị loại (đầu hàng, hết giờ, bỏ ván). Mặc định: các ghế còn lại thắng. */
  onPlayerEliminated?(state: S, seat: Seat, reason: 'resign' | 'timeout' | 'abandon'): S;
}
```

## 3. Runner (code của lõi, game không tự viết)

```ts
// packages/engine/src/runner.ts
export function runMove<S, M, C>(
  def: GameDefinition<S, M, C>,
  state: S,
  seat: Seat,
  rawMove: unknown,
  ctx: EngineContext,
): { ok: true; state: S; result: GameResult | null } | { ok: false; code: string; params?: object } {
  if (def.result(state)) return { ok: false, code: 'engine.game_over' };
  if (!def.activePlayers(state).includes(seat)) return { ok: false, code: 'engine.not_your_turn' };
  const parsed = def.moveSchema.safeParse(rawMove);
  if (!parsed.success) return { ok: false, code: 'engine.invalid_move_shape' };
  const check = def.validateMove(state, seat, parsed.data);
  if (!check.ok) return check;
  const next = def.applyMove(state, seat, parsed.data, ctx);
  return { ok: true, state: next, result: def.result(next) };
}
```

`ctx.rng` được tạo bằng `createRng(matchSeed, moveIndex)`, nên mỗi nước có một RNG độc lập và tái tạo được.

## 4. Quy tắc bắt buộc (Engine Rules)

| #   | Quy tắc                                                                                                                                 | Vì sao                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| E1  | Không import `react`, `node:*`, `fetch`, hay bất kỳ I/O nào trong `rules/`                                                              | Engine phải chạy được ở cả browser, server và worker |
| E2  | Không dùng `Math.random`, `Date.now`, `new Date()`, `crypto.randomUUID`                                                                 | Determinism: replay phải ra cùng kết quả             |
| E3  | Mọi nguồn ngẫu nhiên phải lấy từ `ctx.rng`                                                                                              | Như E2                                               |
| E4  | State phải **JSON-serializable**: không dùng `Map`, `Set`, class instance, function, `undefined` trong mảng                             | State được lưu ở Redis và gửi qua mạng               |
| E5  | `applyMove` không mutate state đầu vào (được phép dùng `immer` `produce`)                                                               | Undo, bot search, so sánh state                      |
| E6  | `validateMove` và `applyMove` phải nhất quán: nếu `validateMove` trả về ok thì `applyMove` không được throw                             | Runner tin vào hợp đồng này                          |
| E7  | `legalMoves(s, seat)` phải trả về đúng tập nước mà `validateMove` chấp nhận (property test kiểm tra)                                    | Bot và UI dựa vào đây                                |
| E8  | Mã lỗi có namespace `<gameId>.<snake_case>` và có bản dịch ở i18n của game                                                              | Hiển thị lỗi thân thiện                              |
| E9  | Trạng thái thời gian (đồng hồ) KHÔNG nằm trong engine; server quản lý rồi gọi `onPlayerEliminated`                                      | Engine không biết đến thời gian                      |
| E10 | `playerView` của game `hidden-info` không được chứa bất kỳ dữ liệu ẩn nào, kể cả dạng mã hóa                                            | Chống gian lận                                       |
| E11 | Đổi luật làm ván cũ không replay đúng được nữa → tăng `rulesVersion` và giữ nhánh xử lý luật cũ hoặc đánh dấu replay cũ là không hỗ trợ | Lịch sử ván                                          |

## 5. Hình dạng state khuyến nghị

```ts
interface CaroState {
  board: (Seat | null)[]; // mảng 1 chiều, index = row * size + col
  size: number;
  turn: Seat;
  moveCount: number;
  lastMove: number | null;
  winLine: number[] | null; // để UI vẽ đường thắng
  config: CaroConfig; // giữ config trong state để các hàm luật tự đủ thông tin
}
```

- Ưu tiên **mảng 1 chiều** cho bàn cờ dạng lưới (dễ serialize, nhanh).
- Lưu thêm các trường dẫn xuất mà UI cần (`lastMove`, `winLine`) để UI không phải tính lại luật.
- Với `hidden-info`: tách `public` và `private[seat]` ngay trong state để viết `playerView` dễ dàng.

## 6. Hành động ngoài nước đi

Đầu hàng, xin hòa, xin đi lại là **meta-action** do `MatchService` xử lý, không đi qua `applyMove`:

| Action                       | Xử lý                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| `resign`                     | `onPlayerEliminated(state, seat, 'resign')` hoặc dùng xử lý mặc định |
| `offer-draw` / `accept-draw` | Server ghi kết quả `{kind:'draw', reason:'agreement'}`               |
| `takeback`                   | Server dựng lại state từ `moves[0..n-2]` (nhờ tính deterministic)    |
| `timeout`                    | Đồng hồ server hết giờ → `onPlayerEliminated(..., 'timeout')`        |

## 7. Test harness có sẵn

`@bg/engine/testing` cung cấp:

- `playMoves(def, config, moves[], seed?)`: áp dụng chuỗi nước đi, throw nếu có nước không hợp lệ.
- `assertLegalMovesConsistent(def, state)`: kiểm tra quy tắc E7.
- `randomPlayout(def, config, seed, maxPlies, { eachStep? })`: chơi ngẫu nhiên đến hết ván (throw nếu vượt `maxPlies`), gọi `eachStep(state)` sau mỗi nước; dùng cho property test.
- `assertSerializable(state)`: kiểm tra quy tắc E4.
- `assertNoMutation(def, config, games)`: deep-freeze state trước mỗi `applyMove` để kiểm tra quy tắc E5.
- `assertDeterministic(def, config, games)`: chơi cùng seed hai lần, so sánh state sau mỗi nước (E2, E3).
- `assertNoHiddenLeak(def, state, resampleHidden, { players })`: kiểm tra quy tắc E10. `resampleHidden(state, viewer, rng)` do game viết, trả về bản sao của state với mọi thông tin mà `viewer` không được thấy đã bị bốc lại ngẫu nhiên; view của `viewer` phải giữ nguyên.

Xem thêm [10-testing-strategy](10-testing-strategy.md).
