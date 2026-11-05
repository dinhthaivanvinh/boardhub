# Activity Spec: Thú may mắn (`lucky-animal`)

> Hoạt động đầu tiên của khu Văn phòng. Tuân thủ [O-04](../04-activity-spec.md).

## 1. Tổng quan

- Mục đích: chọn ngẫu nhiên N người trong phiên, mỗi người đại diện bằng con vật của mình.
- Người tham gia: 2–200. Chủ trì mặc định không tham gia bốc (`hostParticipates = false`).
- Mode MVP: `wheel`, `race`. Đợt 2: `spotlight`, `claw`.

## 2. Cài đặt (`settingsSchema`)

Tiêu đề ("Ai mua trà sữa?") thuộc **phiên** (`office:create { title }`), không nằm trong cài đặt của hoạt động.

| Field              | Kiểu            | Mặc định | Mô tả                                                |
| ------------------ | --------------- | -------- | ---------------------------------------------------- |
| `mode`             | `wheel \| race` | `race`   | Kiểu hiệu ứng mặc định (đổi được trước mỗi lần quay) |
| `n`                | 1–20            | 1        | Số người được chọn mỗi lần                           |
| `excludePrevious`  | boolean         | true     | Người đã được chọn ở lần trước không vào lần sau     |
| `hostParticipates` | boolean         | false    | Chủ trì có trong danh sách ứng viên                  |

## 3. State

```ts
type LuckyAnimalState = {
  settings: Settings;
  rounds: { drawId: string; winners: string[]; mode: string }[]; // các lần đã reveal
  excluded: string[]; // id đã trúng (khi excludePrevious) — suy ra từ rounds, giữ để tiện đọc
};
```

## 4. Hành động

| Action                                            | Ai      | Hiệu lực                                                                                                                     |
| ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `{ kind: 'configure', patch: Partial<Settings> }` | chủ trì | Đổi cài đặt (không khi đang bốc)                                                                                             |
| `{ kind: 'draw' }`                                | chủ trì | Xin hub bốc: `candidates` = người tham gia (online hoặc vắng mặt), trừ `excluded` và chủ trì (nếu không tham gia); cần ≥ `n` |
| `{ kind: 'reset-exclusions' }`                    | chủ trì | Xoá danh sách đã trúng (mọi người lại được bốc)                                                                              |

Người offline (mất kết nối) **vẫn** là ứng viên (họ có thể chỉ đang khoá màn hình); chủ trì kick nếu muốn bỏ.

## 5. Kết quả

`onDrawResult` thêm vòng vào `rounds`, cập nhật `excluded`. View cho mọi màn gồm `rounds` (công khai), số ứng viên còn
lại, cài đặt. Không có thông tin ẩn.

## 6. Mã lỗi riêng

| Code                  | Khi nào              |
| --------------------- | -------------------- |
| `office.not_enough`   | Ứng viên còn lại < N |
| `office.bad_settings` | Cài đặt sai (zod)    |

Hai mã dùng chung của khu Văn phòng (O-06 §3), vì hoạt động khác (chia đội, bốc quà) cũng cần.

## 7. Trường hợp biên cần test

- 2 người, N = 1, 1.000 lần (reset mỗi lần): mỗi người ~50%.
- `excludePrevious`: 5 người, 5 lần N = 1 ⇒ mọi người được chọn đúng 1 lần, lần thứ 6 báo `not_enough`.
- Người bị kick giữa lúc đang bốc vẫn có thể trúng lần đó (danh sách đã chốt), không có trong lần sau.
- Người vào giữa lúc đang bốc không nằm trong lần đó.
- Chủ trì không tham gia ⇒ không bao giờ trúng; bật `hostParticipates` ⇒ có thể trúng.
- `verify` đúng cho mọi lần bốc trong một phiên 20 vòng.
