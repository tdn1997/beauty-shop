# BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng — Next.js (web) · NestJS (API) · PostgreSQL.

## Chạy

```bash
npm install       # cũng chạy `prisma generate`
npm test          # 205 test (Vitest)
npm run typecheck # tsc cho cả 2 workspace
npm run db:up     # Postgres qua Docker (cổng 5433)
npm run db:migrate # áp migration lên DB đó

npm run start:dev --workspace=@beautyshop/api   # API   http://localhost:3001
npm run dev       --workspace=@beautyshop/web   # Web   http://localhost:3000
```

## Cấu trúc

```
apps/api/src/modules/<module>/
  domain/          # TypeScript thuần — không Nest, không Prisma, không HTTP
  application/     # ca sử dụng, khai báo interface repository
  infrastructure/  # Prisma, gateway ngoài — implement interface của application
  api/             # controller + mapper DTO
```

Ranh giới `domain/` được **kiểm thử tự động**, không dựa vào review thủ công:
`apps/api/src/architecture.spec.ts` sẽ đỏ nếu một file trong `domain/` import
`@nestjs/*`, `@prisma/*`, `express`, `axios`… hoặc thò sang module khác.

## Trạng thái theo kế hoạch

**Giai đoạn 1 — Thuộc tính: xong. Giai đoạn 2 — Phương thức & hợp đồng: xong.
Giai đoạn 3 — Encapsulation: xong.**

| Thành phần | File | Test |
|---|---|---|
| `Money` (có cả đơn vị nhỏ nhất) | `shared/domain/money.ts` | 22 |
| `Clock` | `shared/domain/clock.ts` | 4 |
| `DomainError` + guards | `shared/domain/{domain-error,guards}.ts` | 3 |
| `Result<T>` | `shared/domain/result.ts` | 9 |
| `Product`, `ProductVariant` | `catalog/domain/` | 13 |
| `OrderLine` | `ordering/domain/order-line.ts` | 8 |
| `Address` | `ordering/domain/address.ts` | 9 |
| `Order` (aggregate, snapshot, phiên bản) | `ordering/domain/order.ts` | 34 |
| `InventoryLot` (snapshot, phiên bản) | `inventory/domain/inventory-lot.ts` | 23 |
| CQS: Query / Command service | `ordering/application/` | 12 |
| Idempotency | `shared/application/idempotency.service.ts` | 8 |
| `@Idempotent()` interceptor | `shared/api/idempotency.interceptor.ts` | 5 |
| `DomainError` → HTTP | `shared/api/domain-error.filter.ts` | 5 |
| Ranh giới transaction | `shared/infrastructure/prisma-transaction-manager.ts` | 5 |
| `PrismaOrderRepository` (optimistic lock) | `ordering/infrastructure/` | 13 |
| `PrismaInventoryRepository` (giữ tồn) | `inventory/infrastructure/` | 16 |
| `PrismaIdempotencyStore` (UNIQUE) | `shared/infrastructure/` | 11 |
| Ranh giới tầng | `src/architecture.spec.ts` | 5 |

Quy ước đã áp dụng:

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number` — kể cả trong DB
  (`unit_price BIGINT`), nên không có chỗ nào phải làm tròn.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định
  (`rename`, `publish`, `reserve`, `confirm`, `dispatch`) — không có `setX` nào.
- `subtotal()`, `itemsTotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot, không tham chiếu catalog/profile.
- `Order.lines` trả mảng đông cứng (`Object.freeze`) — không sửa đơn qua getter được.
- **Tách lệnh/truy vấn**: `OrderQueryService` chỉ đọc và trả DTO;
  `OrderCommandService` mới được đổi trạng thái.
- **Phân loại lỗi**: tình huống nghiệp vụ dự kiến → `Result<T>` (mã ổn định:
  `OUT_OF_STOCK`, `LOT_BLOCKED`, `LOT_EXPIRED`, `INVALID_TRANSITION`,
  `ORDER_NOT_FOUND`, `CONCURRENT_MODIFICATION`); vi phạm bất biến → `throw`;
  lỗi hạ tầng **không bị nuốt**, để nổi lên thành 500.
- Ranh giới transaction do application service quyết định qua `TransactionManager`;
  repository lấy client *đang hiệu lực* nên không tự mở, không tự commit.

### Đóng gói ở hai tầng

Domain giữ bất biến trong bộ nhớ; DB giữ lại đúng những bất biến ấy một lần nữa
(`prisma/migrations/20260917000000_init/migration.sql`). Không thừa: domain chỉ chặn
được đường đi qua code, còn `CHECK` chặn cả script sửa tay và job nhập liệu.

| Bất biến | Trong domain | Trong DB |
|---|---|---|
| `0 <= reserved <= on_hand` | `InventoryLot.reserve()` | `CHECK (reserved >= 0 AND reserved <= on_hand)` |
| Lượng dương, đơn giá không âm | `OrderLine.create()` | `CHECK (quantity > 0)`, `CHECK (unit_price >= 0)` |
| Rời nháp thì phải có địa chỉ giao | `Order.confirm()` | `CHECK` trên `sales_order` |
| Đã huỷ thì phải có lý do | `Order.cancel()` | `CHECK` trên `sales_order` |
| Một biến thể một dòng | `Order.addQuotedLine()` gộp lượng | `UNIQUE (order_id, variant_id)` |
| Một khoá idempotency một lần | `IdempotencyService.run()` | `PRIMARY KEY (customer_id, key)` |

### Hai chỗ chống cạnh tranh

- **Đơn hàng — optimistic lock.** Aggregate giữ `persistedVersion` (phiên bản đang
  nằm trong DB) tách khỏi `version` (phiên bản hiện tại). Ghi là
  `UPDATE ... WHERE id = ? AND version = <persistedVersion>`; không hàng nào khớp
  nghĩa là ai đó đã ghi trước → `Result.err('CONCURRENT_MODIFICATION')`, hàng cũ
  không bị đụng, và đơn trong bộ nhớ **không** được đánh dấu đã lưu.
- **Kho — điều kiện nằm trong câu ghi.** `reserve()` là một câu
  `UPDATE ... WHERE on_hand - reserved >= $1 AND blocked = false`. Không đọc tồn
  trước rồi mới trừ: khe giữa hai lệnh đó là chỗ hai khách cùng chen vào và cùng
  được duyệt trên cùng một lượng hàng.

### Chưa làm, cố ý

- **Migration chưa chạy trên Postgres thật.** Docker trong máy này không kéo được
  image (`TLS handshake timeout`). SQL đã sinh và đã rà, nhưng việc Postgres thực
  sự thực thi các `CHECK` đó thuộc Giai đoạn 7.
- **Chưa có test cạnh tranh thật.** Các test repository dùng client giả tất định:
  chúng kiểm repository có gắn đúng điều kiện (`WHERE version = ?`,
  `on_hand - reserved >= ?`, `UNIQUE`) và dịch "0 hàng bị sửa" thành mã lỗi nào.
  Việc hai transaction thật giành nhau một hàng thì phải để Postgres trả lời —
  `Promise.all` trên `Map` trong bộ nhớ chỉ là test xanh giả. Giai đoạn 7.
- `InventoryRepository` mới có `findById` + `reserve`. `save` sẽ thêm kèm test khi
  có ca sử dụng thật cần ghi lại cả lô (nhập hàng, khoá lô).
- Mapper `toOrderDto()` còn nằm ở `application/order.dto.ts`; nó xuống `api/`
  cùng controller đầu tiên ở Giai đoạn 4. Điều quan trọng đã có test giữ:
  `architecture.spec.ts` chặn `api/` và `application/` import `infrastructure/`,
  nên kiểu của Prisma không bò lên được tới DTO.
- Chưa có controller HTTP nào; `CheckoutService` và thứ tự đặt hàng
  (principal → quyền địa chỉ → idempotency → quote → transaction → payment ngoài transaction)
  là Giai đoạn 4. Vì vậy API hiện chỉ khởi động được khi có Postgres —
  composition root đã cắm thẳng bản Prisma.

**Tiếp theo — Giai đoạn 4:** `CheckoutService.placeOrder()` và controller HTTP đầu tiên.
