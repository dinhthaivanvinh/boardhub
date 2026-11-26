# Cờ vua: chế độ Học (spec)

Trạng thái: Đã làm bản đầu (bài toạ độ, 6 bài quân cờ, bài ăn quân, bài chiếu hết, bài mẹo nhỏ, 3 nước đặc biệt, 6 khai cuộc). Mã: `packages/games/chess/src/learn`, các bài ở `/learn/chess/<id>`; không có trang danh sách, trang chủ có lộ trình. Quyết định kiến trúc: [ADR-0009](../adr/0009-chess-learn-area.md). Đối tượng: trẻ mới biết cờ.

## 1. Nguyên tắc

- Một bài = một ý. Câu ngắn, từ đơn giản, mỗi bước chỉ làm một việc.
- Học bằng cách làm: sau khi xem animation thì trẻ tự bấm hoặc tự đi.
- Sai không bị phạt: hiện gợi ý, cho thử lại không giới hạn.
- Dùng lại `Board`/`PieceIcon`; ô đi được lấy từ `legalPositionMoves`.
- Hỗ trợ bàn phím, đọc màn hình và `prefers-reduced-motion` (thay animation bằng ảnh tĩnh kèm mũi tên).

### Giọng đọc

- Bé 5 tuổi chưa biết chữ, nên **kết quả sau mỗi lần bé bấm được đọc to** (đúng, sai và lý do), mặc định bật. Công tắc "Đọc kết quả" nhớ lựa chọn trong trình duyệt (`learn.chess.voice.v1`). Câu hỏi chỉ đọc khi bé bấm "Đọc to" hoặc bật "Tự động đọc".
- Cùng một lời sai bấm hai lần thì đọc hai lần. Bộ đếm "tìm được 2/4" và dòng chờ không đọc.
- Các bài tự sang câu sau (toạ độ, ăn quân, chiếu hết) chờ giọng đọc xong mới chuyển.
- Giọng là **file mp3 thu sẵn** (ADR-0011, `tools/voice`), nghe giống nhau trên mọi trình duyệt. Câu nào không có file thì dùng giọng
  của trình duyệt đúng ngôn ngữ; không có giọng nào phù hợp thì không đọc và hiện lời nhắc cài giọng.
- **Đọc câu hỏi và đọc kết quả đều bật sẵn** (công tắc nhớ trong trình duyệt). Bài nào cũng có nút **Quay lại** (bước trước, hoặc nước trước ở bài khai cuộc).

## 1b. Thứ tự lộ trình

Làm quen bàn cờ → Quân cờ → Luật (ăn quân, chiếu hết, hoà) → Nước đặc biệt → Mẹo và tàn cuộc → Khai cuộc. Nước đặc biệt đứng
trước khai cuộc vì các khai cuộc có nhập thành. Thứ tự chỉ khai báo ở `JOURNEY` (`learn/journey.ts`); menu bài học, nút "bài tiếp
theo", trang Hành trình và bản đồ trang chủ đều lấy từ đó. Tiến độ lưu theo id bài nên đổi thứ tự không làm mất tiến độ.

Phần Khai cuộc bắt đầu bằng hai bài dưới đây, sau đó mới đến 6 khai cuộc có tên (gắn nhãn "Nâng cao"). Huy hiệu "Bậc thầy cờ
vua nhí" chỉ đòi 21 bài có từ lúc huy hiệu ra đời (`MASTER_LESSONS`), để thêm bài không làm bé mất huy hiệu.

## 1c. Hai bài mở đầu ván (`learn/opening-basics.ts`, `OpeningBasicsLessons.tsx`)

- **3 nguyên tắc mở đầu** (`opening-basics`): đưa tốt vào d4/e4 → đưa mã hoặc tượng mới ra ô an toàn (mã không ra mép) →
  nhập thành → chọn nước tốt nhất trong 3 nước. Mọi nước thoả điều kiện đều được nhận.
- **Coi chừng chiếu hết nhanh** (`early-mate`, bé cầm Đen): xem đòn 4 nước → tìm ô f7 → chặn khi hậu ra h5, f3, và khi hậu
  quay lại f3 sau ...g6 → đấu lại từ đầu. Nước chặn đúng là nước sau đó Trắng không còn chiếu hết 1 nước và không có chuỗi đổi
  quân nào trên một ô làm Đen lỗ (`defenceVerdict`). Cách kiểm này chỉ nhìn đổi quân ngay lập tức, không tính đòn xa hơn.

## 1d. Bài Chiếu hết đến cùng (`basic-mates`, `learn/basic-mates.ts`, `BasicMatesLesson.tsx`)

Đứng sau bài Mẹo nhỏ. Bé cầm Trắng chơi nhiều nước liền để chiếu hết vua đen đơn độc: **hai xe** rồi **hậu + vua** (hai thế
này xong là xong bài), **xe + vua** là thử thách thêm sau khi xong.

- Máy giữ vua đen (`defenderMove`, kết quả cố định theo thế cờ): ăn quân không ai bảo vệ; nếu không thì tránh bị chiếu hết ngay
  ở nước sau, rồi chọn chỗ rộng, gần giữa. Chỉ nhìn một nước nên không phải phòng thủ hoàn hảo.
- Nước làm hoà do hết nước đi, hoặc để vua đen ăn mất quân: diễn ra, giải thích, rồi lùi **đúng nước đó**.
- Quá số nước giới hạn (`limit`) thì xếp lại bàn; luôn có nút xếp lại.
- Gợi ý: có chiếu hết 1 nước thì tô sáng quân rồi ô đến; không có thì nói bước tiếp theo của cách làm (`mateTip`). Không có bộ
  giải tìm nước tốt nhất. Mỗi thế có một đường thắng trong test, nên luôn thắng được trước máy này.

## 2. Tính năng 1: Giới thiệu quân cờ

Thứ tự bài: Tốt → Xe → Tượng → Mã → Hậu → Vua. Sau đó các bài đặc biệt: bắt tốt qua đường, nhập thành, phong cấp.

Mỗi bài gồm các bước:

1. **Gặp quân:** tên, hình, một câu mô tả ("Xe đi thẳng như đường ray").
2. **Xem:** animation quân đi trên bàn trống, lần lượt qua các hướng; ô đến sáng lên. Nút phát lại, tạm dừng.
3. **Thử:** đặt quân lên bàn, trẻ bấm ô quân có thể đi tới. Đúng thì ô sáng, sai thì rung nhẹ và nhắc lại quy tắc.
4. **Thử thách:** vài thế nhỏ (ví dụ "ăn quân đỏ bằng 1 nước", "đi tới ô sao"). Hoàn thành thì được 1 sao.

Dữ liệu một bài (ý tưởng):

```ts
type PieceLesson = {
  id: 'rook';
  piece: 'R';
  fen: string; // thế để thử
  demo: { from: string; path: string[] }[]; // animation
  challenges: { fen: string; goal: { type: 'reach' | 'capture'; square: string } }[];
};
```

## 3. Tính năng 2: Bài học khai cuộc

Hiện có 6 khai cuộc: **Ý (Italian)**, **Gambit Hậu**, **Phòng thủ Sicilia**, **Hệ thống London**, **Ruy Lopez**, **Phòng thủ Pháp**. Thêm khai cuộc = thêm một mục trong `learn/data.ts` và các khóa `s0…sN`, `sum0…2` trong i18n.

Mỗi khai cuộc là một chuỗi nước, mỗi nước kèm lời giải thích:

```ts
type OpeningLesson = {
  id: 'italian';
  side: 'w' | 'b'; // trẻ cầm bên nào
  steps: {
    move: string; // SAN hoặc 'e2e4'
    who: 'student' | 'opponent';
    why: string; // khóa i18n: lý do (kiểm soát trung tâm, phát triển quân...)
    hint?: string; // khóa i18n
    arrows?: [string, string][];
    highlights?: string[];
  }[];
};
```

Luồng: máy giải thích nước → trẻ tự đi nước đó (ô đúng nhấp nháy khi bấm "Gợi ý") → đối thủ đi → lặp đến hết.
Cuối bài có tóm tắt 3 ý chính ("Chiếm trung tâm", "Phát triển quân", "Nhập thành sớm") và tuỳ chọn "Chơi tiếp với bot từ thế này".

## 3b. Bài Toạ độ (chặng 0)

Bài đầu tiên (`/learn/chess/coordinates`), cho bé chưa biết đọc tên ô. Ẩn dụ: bàn cờ là rạp chiếu phim, mỗi ô là một ghế;
**hàng số màu cam**, **cột chữ màu xanh**, ô là chỗ hai đường gặp nhau. Hai màu này dùng nhất quán trong mọi bài.

Các bước: gặp bàn cờ → **Hàng số** (bấm cả hàng) → **Cột chữ** (bấm cả cột) → **Hai đường gặp nhau** (luôn có đường kẻ) →
**Tự tìm ô** (không có đường kẻ; nút Gợi ý, hoặc sai 3 lần thì tự hiện) → **Kho báu** (chọn tên ô trong 3 lựa chọn: hai
đáp án sai là ô cùng cột và ô cùng hàng, đúng thứ bé hay nhầm). Mỗi bước 5 câu; đúng thì tự sang câu sau, sai thì thử lại
không giới hạn kèm nhắc luật. Câu hỏi sinh bằng hàm thuần có seed cố định (`coordRounds`), nên lặp lại được và test được.
Chưa có bài "Đặt quân" (đặt vua vào ô e1).

## 3e. Bài Mẹo nhỏ và tàn cuộc (chặng 6)

Bài `/learn/chess/tactics`, bài cuối của lộ trình trước khi chơi thật. Các bước: gặp mẹo nhỏ → **Chĩa hai mũi** (4 thế: mã, mã chiếu vua, tốt, tượng; nước đi thường không được tính, mọi nước chĩa hai mũi an toàn đều đúng; có Gợi ý) → **Quân bị ghim** (3 thế: bấm quân trắng đang bị ghim; đáp án đúng thì quân đen đang ghim được tô sáng) → **Hai xe** (3 thế chiếu hết 1 nước, dùng lại khung "Bắt vua" của bài chiếu hết) → **Hoà hay thắng?** (5 thế, lượt đen: chiếu hết, hoà do hết nước đi, hay chưa xong).

Đáp án do engine tính (`forkMoves`, `pinnedSquares`, `pinners`, `drawKind`), test kiểm tra từng FEN. Một "chĩa hai mũi" là nước sau đó quân vừa đi tấn công hai quân lớn (từ mã trở lên, hoặc vua) và đen không ăn được nó.

Chưa có: ghim tương đối (quân sau là hậu), xiên (skewer), tàn cuộc xe + vua, chơi trọn ván Hậu + Vua với máy.

## 3d. Bài Ăn quân và bảo vệ (chặng 2)

Bài `/learn/chess/capture`, sau bài quân cờ và trước bài chiếu hết. Bé cầm quân trắng, trừ bước "Bị đe doạ" (đen đi).

Các bước: gặp ăn quân → **Thử ăn** (5 thế: xe, tượng, mã, tốt, hậu; nước đi thường không được tính, mọi nước ăn đều đúng; có Gợi ý) → **Bị đe doạ** (5 thế: bấm quân trắng mà một quân đen ăn được; mỗi thế có một quân trắng an toàn làm mồi nhử) → **Nên ăn không?** (6 thế: 3 quân đen không ai bảo vệ, 3 quân có người bảo vệ; đáp án đúng thì quân sẽ ăn lại được tô sáng) → **Quân nào quý?** (5 cặp, không có cặp bằng nhau: tốt 1, mã và tượng 3, xe 5, hậu 9; bấm nút hoặc bấm quân trên bàn).

Đáp án của mọi thế do engine tính (`capturable`, `attackers`, `recapturers`), không viết tay; test kiểm tra từng FEN. Khung các vòng câu hỏi dùng chung với bài chiếu hết (`learn/rounds.tsx`).

Chưa có: đổi quân (đổi xe lấy tốt, lời hay lỗ), nhiều quân cùng bảo vệ, quân bị ghim.

## 3c. Bài Bắt vua: chiếu và chiếu hết (chặng 3)

Bài `/learn/chess/checkmate`, cho bé đã biết quân cờ. Lời dẫn: vua rất nhát; có quân dọa thì nói "Chiếu!", hết cách cứu thì "Chiếu hết!". Bé luôn cầm quân trắng.

Các bước: gặp vua → **Chiếu** (5 thế: bấm quân đang dọa vua; xe, tượng, mã, hậu, tốt) → **Cứu vua** (3 thế: chạy, ăn, che; nước cứu đúng cách nhưng sai loại được gọi tên chứ không tính) → **Chiếu hết?** (6 thế: "Cứu được" hay "Hết cách") → **Bắt vua** (6 thế chiếu hết 1 nước, hậu và xe xen kẽ).

Ở bước cuối, mọi nước chiếu hết đều được chấp nhận. Nước chưa chiếu hết được chơi tiếp trên bàn: đen đáp lại (vua chạy, che hoặc ăn), thông báo nói rõ vì sao chưa phải chiếu hết (chưa chiếu, đen cứu được, hoặc hoà), rồi thế được đặt lại. Có Gợi ý hai mức. Các thế nằm trong `learn/checkmate.ts`; test dùng engine để kiểm tra từng thế (đúng là bị chiếu, đúng là chiếu hết hoặc không, có nước chiếu hết 1 nước).

Chưa có: chơi trọn ván Hậu + Vua bắt Vua với máy, hoàn tác, bài xe + vua.

## 3f. Bài Xếp quân và đi trước (chặng 0, sau Toạ độ)

Bài `/learn/chess/setup` (`learn/basics.ts`, `BasicsLessons.tsx`): cách một ván bắt đầu. Các bước: **Xếp quân** (hàng sau từ trái sang phải xe, mã, tượng, hậu, vua, tượng, mã, xe; hậu đứng đúng màu của mình; ô góc bên phải phía mình luôn sáng; Trắng đi trước, hai bên thay phiên; mục tiêu là chiếu hết vua) → **Tìm quân** (6 câu: bàn cờ thiếu một quân ở ô có vòng, bé chọn quân trong 6 nút) → **Trả lời** (5 câu chọn đáp án: ai đi trước, màu ô góc, màu ô của hậu đen, đến lượt ai, mục tiêu của ván). Test đối chiếu từng sự thật với engine (Trắng đi trước, h1 là ô sáng, hậu trắng d1 sáng, hậu đen d8 tối, quân ở từng ô của thế xuất phát).

## 3g. Bài Khi nào hoà? (chặng 2, sau Bắt vua)

Bài `/learn/chess/draws`: các cách ván cờ kết thúc không có người thắng. Các bước: **Ván hoà** (hết nước đi mà không bị chiếu; không đủ quân chiếu hết: vua với vua, vua với một mã hoặc một tượng; lặp thế 3 lần; 50 nước mỗi bên không đi tốt, không ăn quân; dặn để vua đối phương còn đường đi khi sắp thắng) → **Ai thắng?** (6 thế: chiếu hết, hoà do hết nước đi, vua với vua, vua với tượng, và hai thế còn chơi tiếp là xe và hậu; bé chọn "có người thắng", "hoà" hay "còn chơi tiếp") → **Hoà thế nào?** (3 câu chữ cho điều không thấy được trên một thế cờ: lặp thế, 50 nước, và một câu "còn chơi tiếp"). Test dùng engine kiểm tra đáp án từng thế (`outcomeOf`: bí nước, không đủ quân hay chiếu hết).

Cả hai bài đều có lời đọc: câu tiếng Việt thu sẵn thành mp3 (`speech-texts.ts` liệt kê câu cho cả `vi` và `en`; tiếng Anh dùng giọng của trình duyệt), có trong hành trình (`journey.ts`) và tính 3 sao mỗi bài như các bài khác. Hai bài chưa có phần Luyện tập riêng.

## 4. Tiến độ

- Mỗi bài chỉ có hai trạng thái: chưa xong / đã xong (✓), lưu `localStorage` khóa `learn.chess.v1` (danh sách id bài đã xong).
- Không khoá bài: trẻ học theo thứ tự tuỳ ý. Chưa có sao 0–3 hay chế độ phụ huynh.
- Mỗi bài quân cờ có đúng một thử thách; có thêm 3 bài nước đặc biệt (nhập thành, bắt tốt qua đường, phong cấp): xem demo rồi tự đi nước đó; phong cấp cho chọn quân.

## 5. Kiểm thử

- Test dữ liệu: mọi `fen` hợp lệ; mọi nước trong `OpeningLesson.steps` hợp lệ khi phát lại từ thế đầu.
- Test thử thách: mỗi `goal` đạt được bằng đúng nước hợp lệ theo `legalPositionMoves`.
- Test i18n: mọi khóa có đủ `vi` và `en`.
- Test UI: bấm ô đúng/sai, reduced-motion, bàn phím.
- E2E: hoàn thành một bài quân cờ và một bài khai cuộc.

## 6. Ngoài phạm vi lượt đầu

Đồng bộ tiến độ theo tài khoản, giọng đọc, bài tập tàn cuộc/chiến thuật, huy hiệu, chế độ phụ huynh.
