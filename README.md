# BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng — Next.js (web) · NestJS (API) · PostgreSQL.

## Chạy

```bash
npm install
npm test          # unit test domain (Vitest)
npm run typecheck # tsc cho cả 2 workspace
npm run db:up     # Postgres qua Docker (cổng 5433)

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

**Giai đoạn 1 — Thuộc tính: xong. Giai đoạn 2 — Phương thức & hợp đồng: xong.**

| Thành phần | File | Test |
|---|---|---|
| `Money` | `shared/domain/money.ts` | 17 |
| `Clock` | `shared/domain/clock.ts` | 4 |
| `DomainError` + guards | `shared/domain/{domain-error,guards}.ts` | 3 |
| `Result<T>` | `shared/domain/result.ts` | 8 |
| `Product`, `ProductVariant` | `catalog/domain/` | 13 |
| `OrderLine` | `ordering/domain/order-line.ts` | 8 |
| `Address` | `ordering/domain/address.ts` | 9 |
| `Order` (aggregate) | `ordering/domain/order.ts` | 25 |
| `InventoryLot` | `inventory/domain/inventory-lot.ts` | 14 |
| CQS: Query / Command service | `ordering/application/` | 11 |
| Idempotency | `shared/application/idempotency.service.ts` | 8 |
| `@Idempotent()` interceptor | `shared/api/idempotency.interceptor.ts` | 5 |
| `DomainError` → HTTP | `shared/api/domain-error.filter.ts` | 5 |
| Ranh giới tầng | `src/architecture.spec.ts` | 3 |

Quy ước đã áp dụng:

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number`.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định
  (`rename`, `publish`, `reserve`, `confirm`, `dispatch`) — không có `setX` nào.
- `subtotal()`, `itemsTotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot, không tham chiếu catalog/profile.
- `Order.lines` trả mảng đông cứng (`Object.freeze`) — không sửa đơn qua getter được.
- **Tách lệnh/truy vấn**: `OrderQueryService` chỉ đọc và trả DTO;
  `OrderCommandService` mới được đổi trạng thái.
- **Phân loại lỗi**: tình huống nghiệp vụ dự kiến → `Result<T>` (mã ổn định:
  `OUT_OF_STOCK`, `INVALID_TRANSITION`, `ORDER_NOT_FOUND`); vi phạm bất biến → `throw`;
  lỗi hạ tầng **không bị nuốt**, để nổi lên thành 500.
- Ranh giới transaction do application service quyết định, repository không tự commit.

### Chưa làm, cố ý

- Repository mới có bản in-memory. Bản Prisma + optimistic lock thật
  (`version`, `CHECK (reserved <= on_hand)`, giữ tồn bằng SQL có điều kiện)
  thuộc Giai đoạn 3 & 5 — cạnh tranh thật chỉ chứng minh được bằng
  integration test với Postgres (Giai đoạn 7), không phải bằng Map trong bộ nhớ.
- Chưa có controller HTTP nào; `CheckoutService` và thứ tự đặt hàng
  (principal → quyền địa chỉ → idempotency → quote → transaction → payment ngoài transaction)
  là Giai đoạn 4.

**Tiếp theo — Giai đoạn 3:** Prisma schema + các bất biến ở tầng DB,
`PrismaOrderRepository`, giữ tồn bằng `UPDATE ... WHERE on_hand - reserved >= $1`.
