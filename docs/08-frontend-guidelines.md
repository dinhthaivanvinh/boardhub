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

### 6.1 Màn bài học (cờ vua) trên màn rộng

Từ 1024 px rộng (`html.board-stage`, trang không cuộn) màn bài học (`LessonScreen`, lớp `lesson-scene`) theo thiết kế: nền
trời xanh và đồng cỏ (`public/scene/bg.svg`), thẻ menu bài học bên trái (mỗi bài có biểu tượng, dấu tick xanh khi đã học, mũi
tên khi chưa), các bước dạng viên thuốc ở giữa phía trên, **bàn cờ khung gỗ ở chính giữa**, và bên phải một bóng nói chứa chữ,
ba nút đọc to và nút `Tiếp tục` màu cam, có bạn nhỏ mascot đứng ở góc bóng (chỉ tay khi đọc bài, mừng khi xong bài). Ở màn cao từ
46 rem và rộng từ 80 rem có thêm biển gỗ và mascot đang đọc sách ở góc dưới. Mascot là các tư thế của một bộ hình do chủ dự án
tạo, đã tách nền và lưu thành `public/scene/mascot-*.webp` (`pointing`, `cheer`, `thinking`, `thumbs`, `reading`, `welldone`,
và `face` cho ô tài khoản và bài đầu tiên); muốn đổi hình thì thay file cùng tên. Nền trời và đồng cỏ là `bg.svg` tự vẽ.

- `.ch-learn` là một lưới hai cột (`.ch-learn-layout` là `display: contents`): các bước và bàn cờ ở cột giữa, bóng nói chiếm cột
  phải. Cỡ bàn cờ tính theo chiều cao màn hình và bề rộng của bài (`cqw`) nên cột chữ không bao giờ bị cắt.
- Bàn cờ không dịch chuyển khi cuộn: nếu bài nói nhiều thì chính bóng nói cuộn bên trong (`overflow-y`).
- Bài có từ 6 bước trở lên (toạ độ, chiến thuật) thu nhỏ các viên thuốc về một hàng để bàn cờ không bị đẩy xuống.
- Màn hẹp hơn (điện thoại, máy tính bảng) giữ giao diện gọn như trước; chỉ nút `Tiếp tục` là màu cam.
- Header toàn site có logo to, câu chào `app.slogan` (từ 80 rem), mỗi mục có biểu tượng và ô tài khoản có mặt cười.

### 6.2 Trang chủ kiểu "bản đồ phiêu lưu"

Trang chủ (`apps/web/src/app/page.tsx`) và header dùng bộ kiểu trong `apps/web/src/app/adventure.css` (token `--adv-*`, nút `.adv-btn`, bo góc 24–32px). Các phần theo thứ tự: hero (ảnh nền `public/home/hero-bg.webp`; trên điện thoại là ảnh cắt `hero-cheer.webp` đặt dưới chữ) → trợ lý "chú Mã" (`HomeProgress`) → 3 lợi ích → 6 quân cờ → **bản đồ 8 điểm** (`AdventureMap`, các bài của từng điểm lấy từ `adventure-steps.ts` theo `JOURNEY`) → thử thách hôm nay (`DailyChallenge`) → chơi với máy / bạn bè → thành tích (`Achievements`) → lời kêu gọi cuối trang. Mọi con số (sao, cấp, bài đã học, chuỗi ngày, huy hiệu, tiến độ từng điểm) tính từ tiến độ thật lưu trên máy (`useLearnStats`, `useDoneLessons`), không có số giả. Chữ nằm trong `portal.*` (vi và en); test `home-messages.test.ts` kiểm tra đủ khoá. Hoạt hình nhẹ và tắt khi `prefers-reduced-motion`. Bàn cờ vua (`ui/Board.tsx`) dùng khung toạ độ ngoài giống bài học (`ch-learn-frame`); màn chơi, xem lại ván, câu đố và luyện tập (chỉ cờ vua) dùng cùng cảnh trời và đồng cỏ, khung gỗ quanh bàn cờ và bảng trắng bên phải (`play-scene`, `lesson-scene`) trên màn rộng.

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

## 9. SEO

- **Lớp render:** trang công khai (`/`, `/board-games`, `/games/[id]`, `/office`, `/leaderboard`, `/live`) render nội dung chính
  ở server: tiêu đề, mô tả, luật chơi, bảng xếp hạng (fetch ở server, `GAME_SERVER_INTERNAL_URL` nếu cần, cache 60 s).
  Phần cần `localStorage` hoặc socket là "đảo" client bên trong; chỉ màn chơi/phòng/tài khoản dùng `ssr: false`.
- **Metadata:** `src/seo/site.ts` → `publicPage()` cho title, description, canonical, Open Graph, Twitter.
  `NEXT_PUBLIC_SITE_URL` là địa chỉ thật khi deploy (mặc định `http://localhost:3000`).
- **Ảnh chia sẻ:** `app/opengraph-image.tsx` (trang chủ) và `app/games/[gameId]/opengraph-image.tsx` (mỗi game), 1200×630.
- **Structured data:** `<JsonLd>`: `WebSite` (trang chủ), `ItemList` (danh mục), `Game` + `BreadcrumbList` (trang game).
- **Crawl:** `app/robots.ts` chặn phòng, ván, xem lại, hồ sơ, tài khoản, admin, phiên văn phòng; `app/sitemap.ts` liệt kê trang công khai
  và bảng xếp hạng từng game (mỗi game là một link thật `/leaderboard?game=…`). Trang riêng tư có thêm `robots: { index: false }`.
- **Khác:** `app/icon.svg`, `app/manifest.ts`; một `<h1>` mỗi trang; trang game có breadcrumb.
- **Tạm chỉ tiếng Việt:** `LANGUAGE_CHOICE = false` trong `apps/web/src/i18n/messages.ts` ẩn ô chọn ngôn ngữ và bỏ qua cookie, vì giọng đọc thu sẵn của các bài học mới có tiếng Việt. Bản tiếng Anh vẫn giữ nguyên; đặt `true` để bật lại.
- **Giới hạn:** ngôn ngữ chọn bằng cookie, URL không có `/vi` `/en` nên công cụ tìm kiếm chỉ thấy bản tiếng Việt (không có hreflang).

## 10. Âm thanh

Mọi âm thanh được **tổng hợp bằng Web Audio** (`apps/web/src/sound/`): không có file âm thanh, không lo bản quyền,
không tải thêm gì. Khu Văn phòng có âm thanh riêng (`features/office/draw-player/sounds.ts`, mặc định tắt).

**Hợp đồng với game** (`@bg/ui` `board/sound.ts`): game chỉ _gọi tên_ chuyện vừa xảy ra, app quyết định nghe thế nào.

- `moveSounds(before, after): SoundCue[]`: hàm thuần, nhận hai **view** của người xem (không lộ thông tin ẩn), chỉ được gọi khi
  `moveCount` tăng đúng 1 (đi lại, resync, tải lại trang thì im lặng). Export từ package game, đăng ký trong `client-registry.ts`.
- `music: 'calm' | 'folk' | 'sea'`: kiểu nhạc nền.
- `BoardProps.playSound`: cho bàn cờ tự diễn nước đi theo thời gian (Ô ăn quan kêu từng viên sỏi, khớp hiệu ứng).

| Cue            | Khi nào                 | Game                        | Âm                                       |
| -------------- | ----------------------- | --------------------------- | ---------------------------------------- |
| `place`        | đặt quân                | Caro, Cờ lật                | quân gỗ đặt xuống bàn                    |
| `drop`         | thả đĩa                 | Bốn trong hàng              | đĩa lăn xuống cột, nảy hai lần           |
| `move`         | đi quân                 | Cờ vua, Cờ tướng, Cờ gánh   | trượt nhẹ rồi đặt xuống                  |
| `capture`      | ăn quân                 | Cờ vua, Cờ tướng, Ô ăn quan | gõ mạnh hơn + quân bị ăn lách cách       |
| `flip` (count) | lật quân / gánh, vây    | Cờ lật, Cờ gánh             | chuỗi tiếng "tích" cao dần               |
| `check`        | chiếu tướng             | Cờ vua, Cờ tướng            | hai tiếng chuông                         |
| `pick`, `sow`  | bốc quân, rải từng viên | Ô ăn quan                   | sỏi rơi vào ô gỗ                         |
| `splash`       | bắn trượt               | Bắn tàu                     | nước bắn + bọt                           |
| `hit` / `sunk` | trúng / chìm tàu        | Bắn tàu                     | nổ + mảnh vỡ / nổ lớn, thân tàu rên, bọt |
| `ready`        | xếp xong hạm đội        | Bắn tàu                     | hai tiếng gõ + chuông                    |
| `invalid`      | nước bị từ chối         | mọi game                    | hai tiếng "bụp" trầm, nhỏ                |

Âm của app (không do game gọi): `win` (hợp âm rải đi lên), `lose` (giai điệu đi xuống, nhẹ nhàng, không phải còi báo lỗi),
`draw`, `clock` (tích tắc mỗi giây trong 10 giây cuối của **đồng hồ mình**), `chat` (tin nhắn của người khác).
Thắng/thua tính theo người xem; người xem ván người khác và chơi 2 người cùng máy nghe `win` (hoặc `draw`).

**Nhạc nền** là một dàn nhạc nhỏ tổng hợp bằng Web Audio (`sound/orchestra/`) chơi các bản nhạc **viết riêng cho dự án**
(`scores.ts`, không trích giai điệu có sẵn) trong tiếng vang phòng hoà nhạc:

| Kiểu   | Bản                                                  | Game                                           | Dàn nhạc                                                                                               |
| ------ | ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `calm` | Pastorale (Rê trưởng, 4/4, 70 bpm, 24 ô nhịp A–A'–B) | Cờ vua, Cờ tướng, Caro, Cờ lật, Bốn trong hàng | sáo / violin / clarinet hát giai điệu, harp rải móc đơn, viola giữ hợp âm, contrabass, kèn horn bè phụ |
| `folk` | "Làng quê" (điệu Bắc C–D–F–G–A, 62 bpm, 16 ô nhịp)   | Ô ăn quan, Cờ gánh                             | sáo như sáo trúc có láy, harp như đàn tranh có luyến, nền dây trầm, cello bè phụ                       |
| `sea`  | "Ra khơi" (Rê thứ, 3/4, 84 bpm, 16 ô nhịp)           | Bắn tàu                                        | kèn horn gọi, cello "đưa võng" theo nhịp sóng, trống timpani vê, tiếng sóng                            |

- Nhạc cụ (`instruments.ts`): đàn dây = vài dao động răng cưa lệch nhau một chút (một bè, không phải một cây đàn), vibrato
  vào trễ; horn có độ "nở" sáng; sáo có hơi thổi; harp gảy ngân; timpani vê là một tiếng trống kéo dài với tremolo.
- Mỗi vòng lặp đổi nhạc cụ hát giai điệu (`melodyBy`), từ vòng hai mới có bè phụ; mỗi nốt lệch rất nhẹ về thời điểm và độ
  mạnh để nghe như người chơi. Đoạn giữa (`lift`) to hơn một chút.
- Thêm/sửa bản nhạc: theo ký hiệu ở đầu `scores.ts`; `apps/web/test/music-scores.test.ts` kiểm tra mỗi ô nhịp đủ phách,
  nốt hợp lệ, nằm trong âm vực của nhạc cụ, và giai điệu dân gian chỉ dùng thang ngũ cung.
- Chi phí: render offline 60 s nhạc mất khoảng 15–20 s (khoảng 25–33 % một nhân CPU khi phát). Đo lại khi thêm nhạc cụ.

Chỉ phát khi ván đang diễn ra, mờ dần khi ván kết thúc. Không có nhạc ở màn xem lại (chỉ có tiếng nước đi khi bước tới).

**Mức âm**: effects ×0,9 và music ×0,4 nhân với âm lượng người dùng, qua một compressor chung. Nhạc nền đỉnh ≈ 0,07–0,09 so với tiếng đi
quân ≈ 0,33 (thấp hơn khoảng 12 dB); tiếng nổ lớn nhất ≈ 0,88. Đo lại bằng render offline khi đổi công thức âm.

**Quy tắc**: trình duyệt chỉ cho phát âm sau lần chạm/phím đầu tiên, nên âm trước đó bị bỏ qua (không xếp hàng); tab ẩn thì tạm dừng.
Cài đặt (`bg-sound` trong `localStorage`): hiệu ứng bật 70 %, nhạc nền bật 50 %; bảng "Âm thanh" có ở mọi màn chơi.
Âm thanh chỉ là phần thêm: mọi thông tin vẫn có trên màn hình. E2E bật `localStorage["bg-sound-debug"]="1"` để đọc
`window.__bgSounds`.

## Khu quản trị (`/admin`)

- Giao diện tách riêng: `app/admin/layout.tsx` + `features/admin/AdminShell.tsx`; header/footer của trang cho bé được ẩn
  bằng CSS (`body:has(.admin)`). CSS gắn vào `.admin` (`app/admin/admin.css`), chỉ có nền sáng.
- Thành phần dùng chung ở `features/admin/ui/`: `StatCard`, `Delta`, `RangeFilter`, `TimeChart`, `RankBars`, `PageHeader`,
  `Panel`, `useLoad`, `ErrorLine`, `Loading`.
- Biểu đồ là SVG tự viết. Mỗi biểu đồ có bảng số đi kèm, dùng bàn phím đọc được, màu theo thứ tự cố định
  `--chart-1..3`. Không dùng hai trục; số đo khác loại chỉ đưa vào bảng.
- Số chưa thu thập hiện "—", không hiện 0.
- Menu chỉ liệt kê trang đã có.
