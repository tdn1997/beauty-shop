# BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng — Next.js (web) · NestJS (API) · PostgreSQL.

## Chạy

```bash
npm install       # cũng chạy `prisma generate`
npm test          # 434+ test (Vitest), 45 file
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

apps/web/src/
  app/             # Next.js App Router pages
  app/api/         # Route handlers (proxy tới API)
  components/      # Shared UI components
  lib/             # Cart context, formatters, types
```

Ranh giới `domain/` được **kiểm thử tự động**:
`apps/api/src/architecture.spec.ts` đỏ nếu `domain/` import
`@nestjs/*`, `@prisma/*`, `express`, `axios` hoặc thò sang module khác.

## Trạng thái theo kế hoạch

**Giai đoạn 1–7: xong.**

### Backend (NestJS API) — 434+ test

| Thành phần | Test |
|---|---|
| `Money` + arithmetic + percentage | 39 |
| `Clock` | 4 |
| `DomainError` + guards | 3 |
| `Result<T>` | 9 |
| `Product`, `ProductVariant` | 13 |
| `OrderLine` | 8 |
| `Address` | 9 |
| `Order` (aggregate, snapshot, phiên bản) | 34 |
| `InventoryLot` | 23 |
| CQS: Command / Query service | 12+ |
| CheckoutService + durable replay | 25+ |
| Idempotency (service + interceptor) | 13 |
| DomainError → HTTP filter | 5 |
| TransactionManager + repositories | 40+ |
| OutboxEvent + NotificationPort + OutboxDispatcher + worker | 54 |
| PaymentGateway (MockGateway + SandboxGateway) contract test | 45 |
| DiscountPolicy / ShippingPolicy / Quote / MemberDiscountPolicy | 105+ |
| Module wiring + architecture | 10+ |
| **Tổng backend** | **434+ test** |

### Integration (Testcontainers Postgres) — 12 test

IT01–IT12: optimistic lock, CHECK constraints, UNIQUE, concurrent stock reservation, outbox atomicity.

### Web (Next.js) — 5 trang

| Trang | URL | Tính năng |
|---|---|---|
| Trang chủ / Catalog | `/` | 4 sản phẩm, variant selector SKU, thêm vào giỏ |
| Giỏ hàng | `/cart` | Xem/sửa/xoá, tổng phụ |
| Checkout | `/checkout` | Quote diff, idempotency key, xử lý UNKNOWN |
| Admin Đơn hàng | `/admin/orders` | Bảng phân trang, tách cột thanh toán/giao hàng |
| Admin Kho | `/admin/inventory` | Bảng phân trang, 3 cột Vật lý/Đã giữ/Khả dụng |

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/quote` | Báo giá |
| `GET` | `/quote/preview` | Báo giá nhanh |
| `POST` | `/checkout` | Đặt hàng (idempotent) |
| `GET` | `/orders` | Danh sách đơn (admin) |
| `GET` | `/orders/:id` | Chi tiết đơn (admin) |
| `GET` | `/inventory/lots` | Danh sách lô kho (admin) |

## Quy ước đã áp dụng

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number` — phần trăm dùng basis points.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định.
- `subtotal()`, `itemsTotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot.
- `Order.lines` trả mảng đông cứng (`Object.freeze`).
- **Tách lệnh/truy vấn**: `*QueryService` chỉ đọc; `*CommandService` mới được đổi trạng thái.
- **Phân loại lỗi**: nghiệp vụ dự kiến → `Result<T>`; vi phạm bất biến → `throw`; lỗi hạ tầng → nổi lên.

## Còn nợ

- Migration chưa chạy trên Postgres thật (Docker không kéo được image).
- Catalog thật (`InMemoryPriceCatalog` rỗng), address adapter rỗng → checkout chưa runtime-ready.
- Auth middleware chưa có; chỉ tin `request.user` từ header.
- Sandbox payment thật chưa tích hợp; UNKNOWN reconciliation chưa có.
- `InventoryRepository` chưa có `save` (nhập hàng, khoá lô).
