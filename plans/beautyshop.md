# Plan xây dựng BeautyShop

Stack: Next.js (web) · NestJS (API) · PostgreSQL
Trọng tâm: thuộc tính, phương thức, Encapsulation, GRASP.

> **Tiến độ**: ô `[x]` là đã làm xong và có test giữ.
> Chi tiết trạng thái: `README.md` · Quy ước code: `CLAUDE.md`.
> Giai đoạn 1–8: xong.

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
- [x] Không trả entity Prisma ra API. Repository trả aggregate, `toOrderDto()` trả dữ liệu thuần,
      và `architecture.spec.ts` chặn `api/` + `application/` import `infrastructure/`.
      *(Mapper hiện nằm ở `application/order.dto.ts`; nó sẽ chuyển xuống `api/` cùng lúc
      với controller đầu tiên ở Giai đoạn 4 — chưa có `api/` nào trong `ordering` để đặt.)*
- [x] Repository interface khai báo trong `application/`, implement trong `infrastructure/`.
- [x] Bất biến tầng DB (đóng gói ở mức lưu trữ) — `prisma/migrations/20260917000000_init/migration.sql`:
  - `CHECK (reserved >= 0 AND reserved <= on_hand)`, `CHECK (on_hand >= 0)`
  - `CHECK (quantity > 0)`, `CHECK (unit_price >= 0)`
  - `CHECK` soi lại tiền điều kiện của `confirm()` (rời nháp thì phải có địa chỉ)
    và `cancel()` (đã huỷ thì phải có lý do)
  - `UNIQUE (customer_id, key)` cho idempotency (chính là khoá chính ghép)
  - `Testcontainers` (Phase 7): SQL được thực thi thật trên PostgreSQL container trong IT01–IT12.
    Docker máy này không kéo được image cho `db:up`, nhưng test tự start container riêng.
- [x] Giữ tồn bằng SQL có điều kiện, không read-then-write —
  `PrismaInventoryRepository.reserve()`:
  `UPDATE inventory_lot SET reserved = reserved + $1, version = version + 1
   WHERE id = $2 AND blocked = false AND on_hand - reserved >= $1
     AND (expires_on IS NULL OR expires_on > $3)`.
  Trượt rồi mới đọc một lần để chẩn đoán lý do (`LOT_NOT_FOUND` / `LOT_BLOCKED` /
  `LOT_EXPIRED` / `OUT_OF_STOCK`) — lần đọc đó không mở lại khe đọc-rồi-ghi.
- [x] Cột `version` cho `sales_order` + `inventory_lot` (optimistic lock).
  Aggregate giữ thêm `persistedVersion` — phiên bản *đang nằm trong DB* — nên
  `UPDATE ... WHERE version = <phiên bản đã đọc>` có đúng thứ để so.
  Thua cuộc đua → `Result.err('CONCURRENT_MODIFICATION')`, hàng cũ không bị đụng.

---

## Giai đoạn 4 — GRASP nền tảng (tuần 3)

| Nguyên lý | Việc phải làm | Chống lỗi |
|---|---|---|
| Information Expert | `OrderLine.subtotal()`, `Order.itemsTotal()` | Controller không nhân giá × lượng |
| Creator | `Order.addQuotedLine()` tạo dòng | Không `new OrderLine()` ngoài aggregate |
| Controller | `CheckoutService` là controller ca sử dụng; `CheckoutController` chỉ map DTO | Controller HTTP không chứa nghiệp vụ |
| Low Coupling | `PaymentGateway` chỉ có `initiate` + `query` | Domain không import SDK |
| High Cohesion | Tách `catalog` / `ordering` / `inventory` / `payment` | Không tạo `BeautyShopService` |

- [x] Viết `CheckoutService.placeOrder()` đúng thứ tự: principal → quyền địa chỉ → idempotency → quote → transaction(reserve, save order, outbox, replay UNKNOWN) → commit → gọi payment **ngoài** transaction.
  Test dùng fake kiểm thứ tự, rollback Result và replay sau ngoại lệ postcommit; chưa chứng minh transaction Postgres thật. Catalog/address adapter rỗng, không có auth middleware ngoài trusted `request.user`/fail closed: chưa sẵn sàng runtime. Quy ước 4 phase và snapshot bất biến đã được sửa đầy đủ.

---

## Giai đoạn 5 — GRASP phần hai (tuần 4)

- [x] **Polymorphism**: interface `PaymentGateway`; `MockGateway` (scripted PAID/FAILED/UNKNOWN) + adapter sandbox. Chọn adapter bằng registry ở composition root.
- [x] **Pure Fabrication**: `PrismaOrderRepository`, `PrismaInventoryRepository`
  (làm sớm ở Giai đoạn 3 vì các bất biến tầng DB cần chúng). Ranh giới transaction
  nằm ở cổng `TransactionManager`; repository lấy client *đang hiệu lực* từ
  `PrismaClientSource` nên không tự mở, không tự commit.
- [x] **Indirection**: `NotificationPort` + bảng `outbox_event` ghi cùng transaction với đơn; worker `@nestjs/schedule` đọc và gửi, có retry giới hạn.
- [x] **Protected Variations**: `DiscountPolicy`, `ShippingPolicy` trả giá trị giảm/phí, không sửa `Order`. Pipeline threshold → percent → rounding → cap → min(base) đã đúng thứ tự trong `PercentageDiscountPolicy` có `minimumSpend`.

---

Kết quả: 434+ test/45 file; 12 integration test PostgreSQL thật; typecheck và build đều xanh.

## Giai đoạn 6 — Web + admin (tuần 5)

- [x] Chọn biến thể đổi đúng SKU gửi lên (không chỉ đổi nhãn).
- [x] Checkout gọi lại quote trước khi submit, hiện diff nếu giá/tồn đổi.
- [x] Idempotency key sinh 1 lần cho 1 nội dung giỏ; sửa giỏ → key mới.
- [x] Thanh toán `UNKNOWN` → hiện "đang kiểm tra", ẩn nút trả lại.
- [x] Admin tách 3 cột: vật lý / đã giữ / khả dụng; đơn tách cột thanh toán và giao hàng.

---

## Giai đoạn 7 — Kiểm thử chứng minh thiết kế (tuần 6)

- [x] Unit (Vitest) — UT01–UT12, 434+ test với đầy đủ snapshot trước/sau.
- [x] Integration (Testcontainers Postgres) — IT01–IT12, 12 test PostgreSQL thật với `Promise.all` cạnh tranh.
- [x] Contract test — một bộ ca chạy chung cho MockGateway và adapter sandbox HTTP tổng quát; transport giả, không phải provider sandbox thật.
- [x] Đánh giá thay đổi — `MemberDiscountPolicy` thêm được mà không sửa `OrderLine.subtotal`, chứng minh Protected Variations.

---

## Giai đoạn 8 — Persistence catalog/địa chỉ + seed (tuần 7)

Mục tiêu: xoá bỏ hai adapter rỗng cuối cùng chặn checkout chạy thật, và có dữ liệu mẫu
để chấm bài / demo mà không cần tự tay tạo sản phẩm.

- [x] Schema: thêm `Product`, `ProductVariant`, `CustomerAddress` vào `schema.prisma`.
  Migration riêng `20260922000000_add_catalog_and_address` (không sửa `..._init` đã được
  Testcontainers xác minh ở Giai đoạn 7). `CHECK (list_price >= 0)`,
  `CHECK (phone ~ '^0[0-9]{9}$')` — lặp lại đúng bất biến domain đã có (`ProductVariant`,
  `Address.create()`) ở tầng lưu trữ.
- [x] `PrismaPriceCatalog implements PriceCatalog` — thay `InMemoryPriceCatalog([])` ở
  composition root (`pricing.module.ts`). `sellable` suy dẫn từ `status === 'ACTIVE'`,
  không phải cột boolean riêng — giống hệt quy tắc `ProductVariant.isSellable()`.
- [x] `PrismaAddressBook implements AddressBook` — thay `InMemoryAddressBook` ở
  `ordering.module.ts`. Điểm bảo mật cốt lõi: `findFirst({ where: { id, customerId } })`
  lọc theo **cả hai** trường trong một câu truy vấn — không đọc theo `id` rồi mới kiểm tra
  chủ sở hữu sau, tránh khe hở đọc-rồi-so.
- [x] `apps/api/prisma/seed.ts` — idempotent (`upsert` theo khoá nghiệp vụ: SKU, lot code,
  address id), chạy bằng `tsx` (`prisma.seed` config trong `package.json`). Dữ liệu khớp
  đúng mock catalog trên web (SKU giống hệt, giá giống hệt) nên "Xem giá mới" ở checkout
  báo "Giá không đổi" ngay từ lần chạy đầu — không phải sửa gì thêm ở web. Cố ý có 1 lô
  hết hàng và 1 lô sắp hết để demo `OUT_OF_STOCK` và màu cảnh báo admin.
- [x] Migration đã áp thật lên Postgres cục bộ (`npm run db:migrate`), seed đã chạy thật
  (`npm run db:seed`) — xác minh bằng query đếm bản ghi, không chỉ chạy trên Testcontainers
  ephemeral như Giai đoạn 7.
- [x] README viết lại thành hướng dẫn cài đặt 7 bước, từ `git clone` tới `npm test` xanh.

### Còn nợ sau Giai đoạn 8

- Web catalog (`apps/web/src/app/page.tsx`) vẫn hard-code, chưa có `GET /products` để
  đọc từ DB — dữ liệu seed hiện chỉ phục vụ tầng API (checkout/quote validate theo DB thật),
  trang chủ web chưa tự tải danh sách sản phẩm động.
- `InventoryRepository` vẫn chưa có `save`/`create` qua port; seed ghi thẳng qua
  `PrismaClient` (bỏ qua application layer) vì chưa có use case "nhập hàng" thật.
- Auth vẫn chỉ tin `request.user` do web route handler tự gắn header — seed tạo đúng
  1 customer/1 address để demo, chưa phải hệ thống đăng ký/đăng nhập thật.

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
