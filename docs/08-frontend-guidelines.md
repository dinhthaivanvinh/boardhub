# 08 — Frontend Guidelines

## 1. Game runtime ở client

Màn chơi không quan tâm đang ở mode nào; nó chỉ dùng một hook chung:

```ts
const match = useLocalMatch(gameId, definition, config, controllers); // apps/web/src/game-runtime (M1)
// Từ M2 sẽ có useMatch() chung cho cả local và online.
// match.view, match.mySeat, match.activeSeats, match.result, match.clocks, match.lastMove
// match.submitMove(move), match.action('resign'), match.legalMoves (nếu có)
```

| Runner                           | Mode                                  | Nguồn sự thật                                  |
| -------------------------------- | ------------------------------------- | ---------------------------------------------- |
| `LocalMatch` (+ `useLocalMatch`) | local, bot (offline)                  | Engine chạy ngay trong browser ✅ đã có        |
| `OnlineMatchClient`              | private-room, quick, ranked, spectate | Server; client có optimistic update + rollback |
| `ReplayRunner`                   | replay                                | Dựng lại state từ danh sách nước đi            |

## 2. Hợp đồng component bàn cờ

Mỗi game export một component có props thống nhất:

```ts
export interface BoardProps<V, M> {
  view: V; // playerView, KHÔNG phải full state
  mySeat: Seat | null; // null = đang xem
  isMyTurn: boolean;
  legalMoves?: M[]; // để highlight
  lastMove?: M;
  orientation?: Seat; // xoay bàn theo góc nhìn của người chơi
  onMove(move: M): void;
  disabled?: boolean; // khi đang chờ server hoặc đang replay
  settings: { showLegalMoves: boolean; animations: boolean; coordinates: boolean; confirmMove: boolean };
}
```

**Board component không biết gì về socket, store hay route.** Nó chỉ nhận props và gọi `onMove`.

## 3. Rendering

- Mặc định dùng **SVG** với `viewBox` cố định, co giãn theo container (`width: 100%`, `aspect-ratio`).
- Dùng primitive từ `@bg/ui/board`: `<GridBoard>`, `<Cell>`, `<Piece>`, `<HighlightLayer>`, `<Arrow>`, `<CoordinateLabels>`.
- Bàn cờ có nhiều hiệu ứng hoặc > 500 phần tử động → cân nhắc Canvas/PixiJS (cần ADR).
- Animation bằng CSS transform hoặc `framer-motion`; tắt khi người dùng bật `prefers-reduced-motion` hoặc tắt trong cài đặt.

## 4. Tương tác

- Hỗ trợ cả **click-click** (chọn quân → chọn ô đích) và **kéo-thả** (drag) cho game có di chuyển quân.
- Bàn phím: phím mũi tên di chuyển con trỏ ô, `Enter`/`Space` để chọn, `Esc` để hủy chọn.
- Mỗi ô có `aria-label` (ví dụ "Hàng 3, cột 5, quân Đen"); có một vùng `aria-live` thông báo nước đi cuối.
- Phân biệt quân bằng **hình dạng hoặc ký hiệu**, không chỉ bằng màu.
- Vùng chạm tối thiểu 32×32 px trên mobile; nếu bàn cờ quá dày (Caro 19×19) thì có chế độ zoom/pan.

## 5. Layout màn chơi

```
Desktop                                   Mobile
┌──────────────────────┬──────────┐       ┌──────────────┐
│                      │ Player B │       │ Player B ⏱   │
│                      │ ⏱ 04:32  │       ├──────────────┤
│       BOARD          ├──────────┤       │    BOARD     │
│                      │ Moves /  │       ├──────────────┤
│                      │ Chat tab │       │ Player A ⏱   │
│                      ├──────────┤       ├──────────────┤
│                      │ Player A │       │ [≡] [💬] [⚑] │
└──────────────────────┴──────────┘       └──────────────┘
```

## 6. i18n

- Dùng `next-intl`. Chuỗi chung nằm ở `apps/web/src/i18n/{vi,en}.json`.
- Chuỗi riêng của game (tên, luật, mã lỗi) nằm ở `packages/games/<id>/src/i18n/{vi,en}.json` và được gộp vào lúc build.
- Không nối chuỗi thủ công; dùng ICU message: `"{player} thắng bằng {reason}"`.

## 7. Theme

- Màu dùng CSS variables (`--board-bg`, `--board-line`, `--piece-p0`, `--piece-p1`, …) định nghĩa ở `apps/web/src/app/globals.css`.
- Mỗi game có `src/ui/theme.css` riêng (export `./theme.css`, được `@import` trong `globals.css`). Màn chơi có thuộc tính `data-game="<id>"`, nên game đổi màu quân bằng `[data-game='<id>'] { --piece-p0: …; }` mà không ảnh hưởng game khác.
- Mỗi game export thêm `PieceIcon({ seat, size })`: hình quân nhỏ dùng trong thẻ người chơi (đăng ký trong `client-registry.ts`). Không có thì app hiển thị tên quân.
- Hỗ trợ light và dark mode.
