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
| `buildReplay` + `ReplayScreen`   | replay                                | Dựng lại mọi thế cờ từ seed + nước đi ✅ đã có |

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

- `GridBoard` (`@bg/ui`): lưới ô có `role="grid"`, phím mũi tên, `aria-label` từng ô. Tuỳ chọn `gridLines={false}` và `background` cho game chơi trên giao điểm (Cờ tướng vẽ sông/cung ở đó), `overlay` cho đường thắng.
- **Nội dung trong ô không nhận sự kiện chuột** (GridBoard bọc trong `pointer-events: none`). Lý do: quân mờ/chấm gợi ý thay nhau xuất hiện khi hover; nếu phần tử nhận `mousedown` bị gỡ khỏi DOM trước `mouseup` thì trình duyệt bỏ luôn `click` (lỗi thật đã gặp ở Reversi).
- Bàn cờ cần xoay theo phe (Cờ tướng): đổi chỉ số hiển thị ↔ chỉ số bàn trong component game (`display = 89 - index`), không xoay SVG (để chữ không bị lộn ngược).

- Mặc định dùng **SVG** với `viewBox` cố định, co giãn theo container (`width: 100%`, `aspect-ratio`).
- Dùng primitive từ `@bg/ui/board`: `<GridBoard>`, `<Cell>`, `<Piece>`, `<HighlightLayer>`, `<Arrow>`, `<CoordinateLabels>`.
- Bàn cờ có nhiều hiệu ứng hoặc > 500 phần tử động → cân nhắc Canvas/PixiJS (cần ADR).
- Animation bằng CSS transform hoặc `framer-motion`; tắt khi người dùng bật `prefers-reduced-motion` hoặc tắt trong cài đặt.

## 4. Luật chơi trong ván

Mọi màn chơi (local/bot, phòng online, xem lại) có nút **Luật chơi** (`apps/web/src/features/rules/RulesButton.tsx`, FR-PLAY-08).
Hộp thoại dùng `<dialog>` gốc của trình duyệt (giữ focus, Esc để đóng, ván phía sau vẫn chạy) và hiển thị:

1. **Tùy chọn của ván này**: từ `configFields` + giá trị config (qua `describeConfig`), cộng thời gian và luật mất kết nối với phòng online.
2. Toàn văn `games.<id>.rules` (markdown đơn giản: đoạn văn và **đậm**).

## 5. Tương tác

- Hỗ trợ cả **click-click** (chọn quân → chọn ô đích) và **kéo-thả** (drag) cho game có di chuyển quân.
- Bàn phím: phím mũi tên di chuyển con trỏ ô, `Enter`/`Space` để chọn, `Esc` để hủy chọn.
- Mỗi ô có `aria-label` (ví dụ "Hàng 3, cột 5, quân Đen"); có một vùng `aria-live` thông báo nước đi cuối.
- Phân biệt quân bằng **hình dạng hoặc ký hiệu**, không chỉ bằng màu.
- Vùng chạm tối thiểu 32×32 px trên mobile; nếu bàn cờ quá dày (Caro 19×19) thì có chế độ zoom/pan.

## 6. Layout màn chơi

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

## 7. i18n

- Dùng `next-intl`. Chuỗi chung nằm ở `apps/web/src/i18n/{vi,en}.json`.
- Chuỗi riêng của game (tên, luật, mã lỗi) nằm ở `packages/games/<id>/src/i18n/{vi,en}.json` và được gộp vào lúc build.
- Không nối chuỗi thủ công; dùng ICU message: `"{player} thắng bằng {reason}"`.

## 8. Theme

- Màu dùng CSS variables (`--board-bg`, `--board-line`, `--piece-p0`, `--piece-p1`, …) định nghĩa ở `apps/web/src/app/globals.css`.
- Mỗi game có `src/ui/theme.css` riêng (export `./theme.css`, được `@import` trong `globals.css`). Màn chơi có thuộc tính `data-game="<id>"`, nên game đổi màu quân bằng `[data-game='<id>'] { --piece-p0: …; }` mà không ảnh hưởng game khác.
- **Kết thúc ván:** `ResultOverlay` (apps/web/src/features/match) hiện kết quả giữa bàn cờ với hiệu ứng tỏa sáng: vàng
  khi bạn thắng, xám xanh khi thua, tím bạc khi hòa, trung tính khi chơi chung máy hoặc đang xem. Nó chờ nước cuối diễn
  xong: tối thiểu 0,8 giây và không còn phần tử `[data-animating="true"]` trong bàn (board nào có hoạt cảnh dài phải
  đặt thuộc tính này). "Xem bàn cờ" hoặc Esc để ẩn.
- **Quân di chuyển phải trượt tới chỗ mới**, không hiện ra ngay: dùng `SlidingPiece` của `@bg/ui` trong `overlay` của
  `GridBoard` (key = `moveCount`, `animate = settings.animations`) và không vẽ quân đó trong ô đích. CSS `.bg-slide` ở
  `globals.css` (0,6 giây, tắt khi giảm chuyển động). Hiệu ứng phụ (lật, đổi màu) chờ quân trượt xong mới chạy.
- Mỗi game có ảnh bìa `src/ui/cover.svg` (640×400, export `./cover.svg`, đăng ký trong `apps/web/src/games/covers.ts`), hiện ở trang chủ và trang game. Ảnh tự vẽ bằng SVG (bàn cờ + vài quân đang chơi), màu cố định vì được nạp bằng `<img>` nên không dùng được biến CSS; chữ trong ảnh chỉ là trang trí (`alt=""`).
- Mỗi game export thêm `PieceIcon({ seat, size })`: hình quân nhỏ dùng trong thẻ người chơi (đăng ký trong `client-registry.ts`). Không có thì app hiển thị tên quân.
- Hỗ trợ light và dark mode.
