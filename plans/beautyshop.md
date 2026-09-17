# Plan xây dựng BeautyShop

Stack: Next.js (web) · NestJS (API) · PostgreSQL
Trọng tâm: thuộc tính, phương thức, Encapsulation, GRASP.

> **Tiến độ**: ô `[x]` là đã làm xong và có test giữ.
> Chi tiết trạng thái: `README.md` · Quy ước code: `CLAUDE.md`.
> Giai đoạn 1 và 2 xong; Giai đoạn 3 xong phần domain, còn phần DB (Prisma).

---

## 0. Nguyên tắc xuyên suốt

- Mỗi module NestJS có 4 tầng: `domain/` → `application/` → `infrastructure/` → `api/`.
- `domain/` không import Nest, Prisma, Express, axios. Vi phạm = reject PR.
- Mọi phép ghi đều đi qua API NestJS. Next.js không chứa logic nghiệp vụ.
- Tiền dùng `bigint`/decimal, không dùng `number`.

Cấu trúc:

```
apps/api/src/modules/
  catalog | inventory | cart | pricing | ordering
  payment | shipping | notification | iam | shared
```

---

## Giai đoạn 1 — Thuộc tính (tuần 1)

Mục tiêu: dựng các lớp giá trị và entity đúng kiểu, chưa cần DB.

- [x] `shared/Money` — private readonly amount + currency, factory từ string, `add/times`, chặn khác currency.
- [x] `catalog/Product`, `ProductVariant` — tách định danh (`id`, `sku` readonly) khỏi mô tả (`name`, `status`).
- [x] `ordering/OrderLine` — `unitPriceSnapshot` + `quantity`, `subtotal()` là giá trị suy dẫn.
- [x] `ordering/Address` — value object bất biến, validate đủ trường trong constructor.
- [x] `inventory/InventoryLot` — `onHand`, `reserved`, `expiresOn`, `blocked`.
- [x] `shared/Clock` — inject được, không gọi `new Date()` trong domain.

Quy ước áp dụng:
- Thuộc tính ổn định → `readonly`; thuộc tính đổi được → `#private` + method đổi.
- Không có `static` nào giữ dữ liệu theo request (user hiện tại, giỏ hiện tại).
- Giá trị tính được (`subtotal`, `itemsTotal`) là method, không phải cột.
- Giá và địa chỉ trong đơn là **snapshot**, không tham chiếu catalog/profile.

---

## Giai đoạn 2 — Phương thức & hợp đồng (tuần 1–2)

- [x] Đặt tên theo ý định: `changeQuantity`, `reserve`, `confirm`, `cancel`, `dispatch` — **không** có `setStatus`, `setReserved`, `setQuantity`.
- [x] Mỗi method ghi rõ tiền điều kiện ở đầu thân hàm (`requireState`, `requireNonBlank`).
- [x] Tách lệnh / truy vấn: `OrderQueryService` trả DTO, `OrderCommandService` mới được đổi trạng thái.
- [x] Phân loại lỗi: `DomainError` (mã ổn định: `OUT_OF_STOCK`, `INVALID_TRANSITION`) vs lỗi hạ tầng.
- [x] `Result<T>` cho kết quả nghiệp vụ dự kiến; `throw` chỉ cho vi phạm bất biến.
- [x] Interceptor `@Idempotent()` — đọc `Idempotency-Key`, hash body, so `request_hash`.

---

## Giai đoạn 3 — Encapsulation (tuần 2)

- [x] `Order.lines` là `#private`; getter trả `Object.freeze([...])` hoặc DTO.
- [x] `InventoryLot.reserve(qty)` là cách duy nhất tăng `reserved`; không expose setter.
- [x] Constructor private + static factory (`Order.draft()`, `Order.fromQuote()`).
- [ ] Không trả entity Prisma ra API — mapper `toDto()` ở tầng `api/`.
- [x] Repository interface khai báo trong `application/`, implement trong `infrastructure/`.
- [ ] Bất biến tầng DB (đóng gói ở mức lưu trữ):
  - `CHECK (reserved >= 0 AND reserved <= on_hand)`
  - `CHECK (quantity > 0)`, `CHECK (unit_price >= 0)`
  - `UNIQUE (customer_id, key)` cho idempotency
- [ ] Giữ tồn bằng SQL có điều kiện, không read-then-write:
  `UPDATE inventory_lot SET reserved = reserved + $1 WHERE id = $2 AND on_hand - reserved >= $1 AND blocked = false`
- [ ] Cột `version` cho `sales_order` + `inventory_lot` (optimistic lock).

---

## Giai đoạn 4 — GRASP nền tảng (tuần 3)

| Nguyên lý | Việc phải làm | Chống lỗi |
|---|---|---|
| Information Expert | `OrderLine.subtotal()`, `Order.itemsTotal()` | Controller không nhân giá × lượng |
| Creator | `Order.addQuotedLine()` tạo dòng | Không `new OrderLine()` ngoài aggregate |
| Controller | `CheckoutService` là controller ca sử dụng; `CheckoutController` chỉ map DTO | Controller HTTP không chứa nghiệp vụ |
| Low Coupling | `PaymentGateway` chỉ có `initiate` + `query` | Domain không import SDK |
| High Cohesion | Tách `catalog` / `ordering` / `inventory` / `payment` | Không tạo `BeautyShopService` |

- [ ] Viết `CheckoutService.placeOrder()` đúng thứ tự: principal → quyền địa chỉ → idempotency → quote → transaction(reserve, save order, outbox) → commit → gọi payment **ngoài** transaction.

---

## Giai đoạn 5 — GRASP phần hai (tuần 4)

- [ ] **Polymorphism**: interface `PaymentGateway`; `MockGateway` (scripted PAID/FAILED/UNKNOWN) + 1 adapter sandbox. Chọn adapter bằng registry ở composition root.
- [ ] **Pure Fabrication**: `PrismaOrderRepository`, `PrismaInventoryRepository`. Transaction boundary do application service quyết định, repository không tự commit.
- [ ] **Indirection**: `NotificationPort` + bảng `outbox_event` ghi cùng transaction với đơn; worker `@nestjs/schedule` đọc và gửi, có retry giới hạn.
- [ ] **Protected Variations**: `DiscountPolicy`, `ShippingPolicy` trả giá trị giảm/phí, không sửa `Order`. Thứ tự: ngưỡng → phần trăm → làm tròn → trần → `min(base)`.

---

## Giai đoạn 6 — Web + admin (tuần 5)

- [ ] Chọn biến thể đổi đúng SKU gửi lên (không chỉ đổi nhãn).
- [ ] Checkout gọi lại quote trước khi submit, hiện diff nếu giá/tồn đổi.
- [ ] Idempotency key sinh 1 lần cho 1 nội dung giỏ; sửa giỏ → key mới.
- [ ] Thanh toán `UNKNOWN` → hiện "đang kiểm tra", ẩn nút trả lại.
- [ ] Admin tách 3 cột: vật lý / đã giữ / khả dụng; đơn tách cột thanh toán và giao hàng.

---

## Giai đoạn 7 — Kiểm thử chứng minh thiết kế (tuần 6)

- [ ] Unit (Vitest) — Money, OrderLine, Order, InventoryLot: UT01–UT12. Mỗi ca lỗi phải so snapshot trước/sau.
- [ ] Integration (Testcontainers Postgres) — IT01–IT12. Ca cạnh tranh chạy `Promise.all` hai transaction thật.
- [ ] Contract test — một bộ ca chạy chung cho mọi implement `PaymentGateway`.
- [ ] Đánh giá thay đổi: thêm `MemberDiscountPolicy` mà không sửa `OrderLine.subtotal` → đạt.

---

## Checklist review PR

1. Có setter công khai nào phá được bất biến không?
2. Có method nào vừa truy vấn vừa ghi không?
3. Domain có import Prisma/Nest/HTTP không?
4. Phép tính tiền có lặp lại ở nhiều nơi không?
5. Getter có trả tham chiếu tập hợp nội bộ không?
6. Thêm nhà cung cấp mới có phải sửa `Order` không?

---

## Rủi ro cần canh

- JS `number` làm tròn sai tiền → dùng bigint/decimal xuyên suốt.
- Prisma interactive transaction timeout mặc định 5s → chỉnh, và không gọi mạng bên trong.
- Next.js Server Action dễ kéo nghiệp vụ lên frontend → cấm ghi trực tiếp DB từ web.
