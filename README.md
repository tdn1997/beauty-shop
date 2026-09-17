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

**Giai đoạn 1 — Thuộc tính: xong.**

| Mục | File | Test |
|---|---|---|
| `shared/Money` | `modules/shared/domain/money.ts` | 17 |
| `shared/Clock` | `modules/shared/domain/clock.ts` | 4 |
| `catalog/Product`, `ProductVariant` | `modules/catalog/domain/` | 13 |
| `ordering/OrderLine` | `modules/ordering/domain/order-line.ts` | 8 |
| `ordering/Address` | `modules/ordering/domain/address.ts` | 9 |
| `inventory/InventoryLot` | `modules/inventory/domain/inventory-lot.ts` | 14 |
| Ranh giới tầng | `src/architecture.spec.ts` | 3 |

Quy ước đã áp dụng:

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number`.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định
  (`rename`, `publish`, `reserve`, `changeQuantity`) — không có `setX`.
- `subtotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot, không tham chiếu catalog/profile.
- Không `static` nào giữ dữ liệu theo request; thời gian lấy từ `Clock` được inject.

**Tiếp theo — Giai đoạn 2:** `Result<T>`, tách `OrderQueryService` / `OrderCommandService`,
interceptor `@Idempotent()`.
# beauty-shop
