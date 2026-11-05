# O-04 — Đặc tả hợp đồng hoạt động (`@bg/office-core`)

> Tương đương `docs/04-game-engine-spec.md` cho khu Văn phòng. Mọi hoạt động phải tuân thủ.

## 1. Khái niệm

| Thuật ngữ                        | Nghĩa                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| **Phiên** (session)              | Một lần tổ chức, có mã 6 ký tự, một hoạt động, một chủ trì                            |
| **Chủ trì** (host)               | Người tạo phiên (có thể chuyển quyền). Chỉ chủ trì gửi được hành động điều khiển      |
| **Người tham gia** (participant) | Một `userId` trong phiên, có tên + avatar; có thể là "người vắng mặt" do chủ trì thêm |
| **Màn** (screen)                 | `host` · `stage` (sân khấu, chỉ xem) · `participant`                                  |
| **Hành động** (action)           | Thông điệp làm đổi trạng thái hoạt động, do chủ trì hoặc người tham gia gửi           |
| **Lần bốc** (draw)               | Một lần chọn ngẫu nhiên có commitment, seed, candidates, winners                      |

## 2. Hợp đồng

```ts
export interface Participant {
  id: string;             // userId, hoặc "absent:<uuid>" cho người vắng mặt
  name: string;
  avatar: Avatar;         // @bg/avatars
  online: boolean;
  joinedAt: number;       // giờ server, chỉ để sắp xếp hiển thị
}

export interface ActivityContext {
  participants: readonly Participant[]; // thứ tự ổn định: theo id
  now: number;                          // giờ server (ms) do hub truyền vào
}

export interface DrawRequest {          // hoạt động xin hub một lần bốc
  n: number;
  candidates: string[];                 // id, hub sẽ sắp xếp lại
  mode: string;                         // kiểu hiệu ứng, chỉ để hiển thị
}

export interface ActivityDefinition<Settings, State, Action, View> {
  meta: { id: string; i18nKey: string; maxParticipants: number; modes: string[] };
  settingsSchema: z.ZodType<Settings>;
  actionSchema: z.ZodType<Action>;
  setup(settings: Settings): State;
  /** Kiểm tra quyền và tính hợp lệ. Không đổi state. */
  validate(state: State, actor: { id: string; isHost: boolean }, action: Action, ctx: ActivityContext): Check;
  /** Áp dụng hành động. Trả state mới, và (tùy chọn) yêu cầu một lần bốc. */
  apply(state: State, actor: {...}, action: Action, ctx: ActivityContext): { state: State; draw?: DrawRequest };
  /** Hub gọi khi lần bốc đã có kết quả (sau reveal). */
  onDrawResult(state: State, result: DrawResult, ctx: ActivityContext): State;
  /** Hub gọi khi danh sách người tham gia đổi (vào, rời, bị kick). Không bắt buộc. */
  onParticipantsChanged?(state: State, ctx: ActivityContext): State;
  /** Phần mỗi màn được thấy (quy tắc A4). */
  view(state: State, screen: 'host' | 'stage' | 'participant', viewerId: string | null): View;
}
```

## 3. Quy tắc bắt buộc

| ID  | Quy tắc                                                                                                             | Lý do                         |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A1  | Không I/O, `Math.random`, `Date`, `crypto` trong hoạt động. Thời gian qua `ctx.now`, ngẫu nhiên qua lần bốc của hub | Kiểm thử, phát lại, công bằng |
| A2  | State JSON-serializable, không mutate input                                                                         | Lưu Redis, so sánh            |
| A3  | Mọi hành động parse bằng `actionSchema` (zod) ở server                                                              | An toàn                       |
| A4  | `view` không lộ thông tin ẩn (vd. Bí mật Santa: mỗi người chỉ thấy cặp của mình). Có test `assertNoHiddenLeak`      | Riêng tư                      |
| A5  | Hoạt động **không tự chọn ngẫu nhiên**: phải xin hub bằng `draw` để có commit–reveal                                | Công bằng (ADR-0006)          |
| A6  | Kết quả lần bốc đã reveal là bất biến; hoạt động chỉ được thêm lần bốc mới                                          | Không huỷ kết quả             |
| A7  | Hoạt động không giữ danh sách người tham gia riêng; dùng `ctx.participants` (hub là nguồn sự thật)                  | Tránh lệch dữ liệu            |
| A8  | Thêm hoạt động = gói `packages/office/<id>` + một dòng ở registry server và web                                     | Không sửa lõi                 |

## 4. Vòng đời phiên

```
created ──(người vào)──▶ open ──(chủ trì khoá)──▶ locked ──(mở)──▶ open
   │                       │                          │
   └─────────── 24 giờ không hoạt động / chủ trì đóng ──────▶ closed (chỉ đọc lịch sử)
Lần bốc: idle ──draw──▶ running(build-up) ──reveal──▶ revealed ──▶ idle
```

Trong lúc `running`: không bốc chồng, không kick người trong danh sách ứng viên đã chốt (kick sẽ có hiệu lực sau).

## 5. Bốc thăm công bằng (commit–reveal)

Hàm công khai (cùng một mã chạy ở server và trang kiểm chứng):

```ts
commitment(seed) = hex(sha256(seed))                           // seed: 32 byte ngẫu nhiên, hex
drawWinners(seed, drawId, candidates, n):
  pool = [...candidates].sort()                                // id tăng dần, trùng lặp bị loại
  winners = []
  for i in 0..n-1:
    h = hmacSha256(key = seed, message = `${drawId}:${i}`)
    x = 64 bit đầu của h, đọc big-endian thành số nguyên không dấu
    j = x mod pool.length                                      // lệch xác suất < 2^-50, bỏ qua được
    winners.push(pool.splice(j, 1)[0])
  return winners
verify(record) = commitment(record.seed) === record.commitment
                 && deepEqual(drawWinners(record.seed, record.drawId, record.candidates, record.n), record.winners)
```

**Phần quà trong cùng lần bốc** (thêm cho Lì xì, không đổi thuật toán cũ): `DrawRequest.prizes` là kho phần quà (id duy nhất).
Hub chọn thêm một phần quà cho mỗi người thắng, cùng seed, khác thông điệp HMAC:

```ts
drawPrizes(seed, drawId, prizes, n)   // như drawWinners nhưng message = `${drawId}:prize:${i}`; quà i → người thắng i
verify(record) = (như trên) && (record.prizes ? deepEqual(drawPrizes(seed, drawId, prizes, n), record.awarded) : true)
```

Kho `prizes` công khai ngay khi bắt đầu (như `candidates`); `awarded` chỉ công bố lúc reveal. `DrawResult.awarded` đưa vào
`onDrawResult`. Lần bốc cũ (không có `prizes`) vẫn kiểm chứng như trước.

- `seed` sinh bằng `crypto.randomBytes(32)` ở hub, **không** truyền vào hoạt động trước khi reveal.
- `drawId` là uuid do hub tạo, nằm trong commitment payload, nên không thể dùng lại seed cho lần bốc khác.
- Kịch bản hiệu ứng: `animationRng = createRng(seed, 'anim')` (dùng `@bg/engine` createRng) ⇒ mọi màn giống nhau.

## 6. Thời gian của lần bốc

| Mốc              | Giá trị                                                       |
| ---------------- | ------------------------------------------------------------- |
| `startsAt`       | `now + 1200 ms` (để mọi màn kịp nhận)                         |
| `revealAt`       | `startsAt + buildUp(mode)`; buildUp 2,5–4 giây                |
| Gửi reveal       | `revealAt − 400 ms` (job)                                     |
| Về đích          | `revealAt` → `revealAt + landing(mode)`; landing 2,5–3,5 giây |
| Giảm chuyển động | bỏ pha build-up/landing, hiện kết quả lúc `revealAt`          |

## 7. Kiểm thử bắt buộc cho một hoạt động

- `validate`/`apply` cho mọi hành động, kể cả người không phải chủ trì bị từ chối.
- Bất biến: không mutate, serializable, xác định (cùng đầu vào ⇒ cùng kết quả).
- `view`: không lộ thông tin ẩn với mọi màn (A4).
- Bốc thăm: `verify` đúng với kết quả thật; sửa 1 bit của seed/candidates/winners ⇒ `verify` sai.
- Phân phối: 100.000 lần `drawWinners` với 10 ứng viên, mỗi người được chọn 10% ± 0,5%.
