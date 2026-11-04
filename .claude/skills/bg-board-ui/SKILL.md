---
name: bg-board-ui
description: Build or modify a game's board React component (packages/games/<id>/src/ui) or shared board primitives in @bg/ui/board. Use for "giao diện bàn cờ", board rendering, piece interaction (click/drag/keyboard), highlights, animations, responsive/mobile board layout, or board accessibility.
---

# Bàn cờ (Board UI)

Tham chiếu: `docs/08-frontend-guidelines.md`.

## Hợp đồng

```ts
export function Board(props: BoardProps<View, Move>): JSX.Element;
```

- Chỉ nhận props, gọi `props.onMove(move)` khi người dùng hoàn tất một nước.
- **Không** import socket, store, router, `fetch`. **Không** import `setup`, `applyMove` để tự tính state mới; chỉ được dùng các helper thuần, chỉ đọc từ `rules/` (ví dụ `legalMoves` để biết quân nào chọn được).
- Nhận `view` (không phải full state). Với game hidden-info, view chỉ có những gì người này được thấy.

## Các bước

1. Dùng primitive từ `@bg/ui/board` trước khi tự vẽ: `GridBoard`, `Cell`, `Piece`, `HighlightLayer`, `Arrow`, `CoordinateLabels`. Nếu thiếu primitive dùng được cho ≥ 2 game, thêm vào `@bg/ui` thay vì viết riêng trong game.
2. SVG với `viewBox` cố định; container dùng `width:100%` + `aspect-ratio`. Không đặt kích thước pixel cứng.
3. `orientation` xoay bàn để người chơi luôn thấy phe mình ở phía dưới (Cờ tướng, Cờ vua).
4. Lớp vẽ theo thứ tự: nền bàn → highlight (lastMove, legal, selected) → quân → overlay (winLine, mũi tên) → lớp nhận input.
5. Tương tác:
   - Game đặt quân (Caro, Reversi): click hoặc tap vào ô; hover hiện quân mờ; khi `settings.confirmMove` bật thì cần tap 2 lần.
   - Game di chuyển quân (Cờ tướng, Cờ đam): hỗ trợ cả click-click lẫn kéo-thả; khi đã chọn quân thì highlight các đích hợp lệ.
   - Khi `disabled || !isMyTurn` thì không gọi `onMove`, nhưng vẫn cho phép xem (hover, chọn quân để xem nước).
6. Bàn phím: roving tabindex trên lưới; phím mũi tên / Enter / Space / Esc.
7. a11y: mỗi ô có `aria-label` (i18n); quân phân biệt bằng hình hoặc ký hiệu, không chỉ bằng màu; có `aria-live="polite"` thông báo nước đi cuối.
8. Animation: chỉ dùng transform/opacity; tắt khi `!settings.animations` hoặc khi `prefers-reduced-motion`.
9. Màu: dùng CSS variables (`--board-*`, `--piece-p0`…) trong `theme.css`; kiểm tra cả light và dark.

## PieceIcon và màu theo game

- Export `PieceIcon({ seat, size })` cạnh `Board` (SVG nhỏ, `aria-hidden`), dùng cho thẻ người chơi.
- Màu quân riêng của game: đặt trong `theme.css` dưới selector `[data-game='<id>']` (xem `packages/games/four-in-a-row/src/ui/theme.css`).

## Bẫy đã gặp

- Nội dung `renderCell` không nhận sự kiện chuột (GridBoard lo việc này). Đừng gắn `onClick` lên quân hay chấm gợi ý; mọi tương tác đi qua `onActivate` của ô.
- Game chơi trên giao điểm: `gridLines={false}` + `background` (xem `packages/games/xiangqi/src/ui/Board.tsx`).
- Cần xoay bàn theo phe: đổi chỉ số trong component, không xoay cả SVG (chữ sẽ bị ngược).
- Unit test với jsdom không phát hiện lỗi hit-testing; luôn có E2E Playwright bấm thật trên bàn cờ.

## Mobile

- Vùng chạm ≥ 32 px. Nếu ô quá nhỏ (Caro 19×19 ở 360 px) thì bật pinch-zoom/pan và `confirmMove`.
- Không phụ thuộc vào hover để hiển thị thông tin quan trọng.

## Kiểm tra trước khi xong

- [ ] Test component: render với view mẫu; click ô → `onMove` được gọi với đúng move; `disabled` thì không gọi
- [ ] Có `aria-label` trên các ô
- [ ] Mở thử ở viewport 360 px và 1440 px, cả light và dark (dùng skill `run` hoặc Playwright screenshot nếu có)
- [ ] Không có chuỗi hard-code; tất cả qua i18n
