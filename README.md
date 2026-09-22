# BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng — Next.js (web) · NestJS (API) · PostgreSQL.

## Hướng dẫn cài đặt (step by step)

Yêu cầu: Node.js ≥ 20.9, Docker (cho Postgres cục bộ), npm.

### 1. Cài dependency

```bash
git clone <repo-url> beautyshop
cd beautyshop
npm install
```

`npm install` tự chạy `prisma generate` (hook `postinstall` trong `apps/api/package.json`)
để sinh Prisma Client — không cần chạy tay.

### 2. Cấu hình biến môi trường

```bash
cp apps/api/.env.example apps/api/.env
```

Mặc định đã trỏ tới Postgres cục bộ ở bước 3:

```
DATABASE_URL="postgresql://beautyshop:beautyshop@localhost:5433/beautyshop?schema=public"
```

### 3. Khởi động Postgres

```bash
npm run db:up
```

Chạy `postgres:16-alpine` qua `docker-compose.yml`, cổng host **5433** (không đụng Postgres
cổng 5432 mặc định nếu máy đã có sẵn). Có healthcheck `pg_isready`; đợi vài giây trước khi
chạy migration nếu container mới khởi động lần đầu.

```bash
npm run db:down   # tắt và giữ lại volume dữ liệu
```

### 4. Áp migration

```bash
npm run db:migrate
```

Chạy `prisma migrate deploy`, áp tuần tự hai migration:

| Migration                                | Nội dung                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `20260917000000_init`                    | `sales_order`, `order_line`, `inventory_lot`, `outbox_event`, `checkout_replay`, `idempotency_record` + toàn bộ `CHECK`/`UNIQUE` |
| `20260922000000_add_catalog_and_address` | `product`, `product_variant`, `customer_address` + `CHECK` giá không âm, định dạng số điện thoại                                 |

### 5. Seed dữ liệu mẫu

```bash
npm run db:seed --workspace=@beautyshop/api
```

Script `apps/api/prisma/seed.ts` (chạy bằng `tsx`, idempotent — chạy lại bao nhiêu lần cũng
không nhân đôi dữ liệu vì dùng `upsert` theo khoá nghiệp vụ) tạo:

- **4 sản phẩm / 7 biến thể** — trùng khớp SKU và giá đang hiển thị ở trang chủ web
  (`SKU-SERUM-15`, `SKU-SERUM-30`, `SKU-SPF50-50G`, `SKU-SPF50-100G`, `SKU-FACEWASH-100`,
  `SKU-VITC-10ML`, `SKU-VITC-20ML`) — `id` của variant **bằng chính SKU** để frontend khớp
  ngay không cần đổi code web.
- **7 lô kho** — một lô mỗi biến thể, cố ý có **1 lô hết hàng** (`SKU-VITC-10ML`, `onHand: 0`)
  và **1 lô sắp hết** (`SKU-SPF50-100G`, `onHand: 5`) để demo màu cảnh báo ở `/admin/inventory`
  và lỗi `OUT_OF_STOCK` khi checkout.
- **1 địa chỉ mẫu** — `id: 'default'`, `customerId: 'test-customer-1'`, khớp đúng giá trị
  hard-code hiện tại của web (`apps/web/src/app/checkout/page.tsx` gửi `addressId: 'default'`,
  các route API gửi header `x-user-id: test-customer-1`) nên checkout chạy được ngay không
  cần sửa gì thêm.

### 6. Chạy ứng dụng

```bash
npm run start:dev --workspace=@beautyshop/api   # API   http://localhost:3001
npm run dev       --workspace=@beautyshop/web   # Web   http://localhost:3000
```

Mở `http://localhost:3000`, thêm sản phẩm vào giỏ, vào `/checkout` để thấy quote diff và đặt
hàng thật (ghi xuống Postgres). Vào `/admin/orders` và `/admin/inventory` để xem dữ liệu vừa
seed.

### 7. Xác minh cài đặt đúng

```bash
npm test                              # 445 test (Vitest), chạy được không cần Postgres
npm run typecheck                     # tsc cho cả 2 workspace
npm run build --workspace=@beautyshop/api
```

Muốn seed lại từ đầu (ví dụ sau khi đổi migration):

```bash
npm run db:down && npm run db:up && npm run db:migrate && npm run db:seed --workspace=@beautyshop/api
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

apps/api/prisma/
  schema.prisma    # lược đồ + enum
  migrations/       # SQL tuần tự, CHECK ràng buộc đóng gói ở tầng lưu trữ
  seed.ts           # dữ liệu mẫu idempotent
```

Ranh giới `domain/` được **kiểm thử tự động**:
`apps/api/src/architecture.spec.ts` đỏ nếu `domain/` import
`@nestjs/*`, `@prisma/*`, `express`, `axios` hoặc thò sang module khác.

## Trạng thái theo kế hoạch

**Giai đoạn 1–7: xong.** Catalog và địa chỉ giờ có persistence thật (`PrismaPriceCatalog`,
`PrismaAddressBook`) — checkout chạy được end-to-end với dữ liệu seed, không còn phụ thuộc
adapter rỗng trong bộ nhớ.

### Backend (NestJS API) — 445 test

| Thành phần                                                     | Test         |
| -------------------------------------------------------------- | ------------ |
| `Money` + arithmetic + percentage                              | 39           |
| `Clock`                                                        | 4            |
| `DomainError` + guards                                         | 3            |
| `Result<T>`                                                    | 9            |
| `Product`, `ProductVariant`                                    | 13           |
| `OrderLine`                                                    | 8            |
| `Address`                                                      | 9            |
| `Order` (aggregate, snapshot, phiên bản)                       | 34           |
| `InventoryLot`                                                 | 23           |
| CQS: Command / Query service                                   | 12+          |
| CheckoutService + durable replay                               | 25+          |
| Idempotency (service + interceptor)                            | 13           |
| DomainError → HTTP filter                                      | 5            |
| TransactionManager + repositories                              | 40+          |
| OutboxEvent + NotificationPort + OutboxDispatcher + worker     | 54           |
| PaymentGateway (MockGateway + SandboxGateway) contract test    | 45           |
| DiscountPolicy / ShippingPolicy / Quote / MemberDiscountPolicy | 105+         |
| `PrismaPriceCatalog`, `PrismaAddressBook`                      | 11           |
| Module wiring + architecture                                   | 10+          |
| **Tổng backend**                                               | **445 test** |

### Integration (Testcontainers Postgres) — 12 test

IT01–IT12: optimistic lock, CHECK constraints, UNIQUE, concurrent stock reservation, outbox atomicity.

### Web (Next.js) — 5 trang

| Trang               | URL                | Tính năng                                      |
| ------------------- | ------------------ | ---------------------------------------------- |
| Trang chủ / Catalog | `/`                | 4 sản phẩm, variant selector SKU, thêm vào giỏ |
| Giỏ hàng            | `/cart`            | Xem/sửa/xoá, tổng phụ                          |
| Checkout            | `/checkout`        | Quote diff, idempotency key, xử lý UNKNOWN     |
| Admin Đơn hàng      | `/admin/orders`    | Bảng phân trang, tách cột thanh toán/giao hàng |
| Admin Kho           | `/admin/inventory` | Bảng phân trang, 3 cột Vật lý/Đã giữ/Khả dụng  |

### API endpoints

| Method | Path              | Mô tả                    |
| ------ | ----------------- | ------------------------ |
| `POST` | `/quote`          | Báo giá                  |
| `GET`  | `/quote/preview`  | Báo giá nhanh            |
| `POST` | `/checkout`       | Đặt hàng (idempotent)    |
| `GET`  | `/orders`         | Danh sách đơn (admin)    |
| `GET`  | `/orders/:id`     | Chi tiết đơn (admin)     |
| `GET`  | `/inventory/lots` | Danh sách lô kho (admin) |

## Quy ước đã áp dụng

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number` — phần trăm dùng basis points.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định.
- `subtotal()`, `itemsTotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot.
- `Order.lines` trả mảng đông cứng (`Object.freeze`).
- **Tách lệnh/truy vấn**: `*QueryService` chỉ đọc; `*CommandService` mới được đổi trạng thái.
- **Phân loại lỗi**: nghiệp vụ dự kiến → `Result<T>`; vi phạm bất biến → `throw`; lỗi hạ tầng → nổi lên.
- Seed idempotent: mọi bản ghi dùng `upsert` theo khoá nghiệp vụ (SKU, lot code, address id).

## Còn nợ

- Auth middleware chưa có; chỉ tin `request.user` từ header (`x-user-id`, `x-user-role`)
  do web route handler tự gắn — chưa có xác thực thật.
- Sandbox payment thật chưa tích hợp; `SandboxGateway` là adapter wire chung, chưa nối
  provider cụ thể; UNKNOWN reconciliation tự động chưa có.
- `InventoryRepository` chưa có `save`/`create` qua port — seed ghi thẳng qua Prisma Client,
  chưa qua use case "nhập hàng" thật (chưa có ca sử dụng đó).
- Web catalog (`apps/web/src/app/page.tsx`) vẫn hard-code danh sách sản phẩm; chưa có
  `GET /products` để web tự tải catalog từ DB — dữ liệu seed hiện chỉ phục vụ tầng API
  (checkout/quote/admin), trang chủ web chưa đọc từ đó.

## Storefront authentication and demo data

The storefront now reads 16 products, 27 variants, and advisory availability from `GET /products`. Authentication uses opaque eight-hour sessions; only a SHA-256 token hash is persisted. The browser receives an HttpOnly, SameSite=Lax, Path=/ cookie (`__Host-beautyshop_session` under production HTTPS, `beautyshop_session` locally). Tokens are never stored in localStorage.

Demo seeding is intentionally opt-in and refuses `NODE_ENV=production`. Before running it against a disposable development database, set `BEAUTYSHOP_DEMO_SEED=true` and provide strong values for `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, and `SEED_CUSTOMER2_PASSWORD`. Ordinary reruns preserve password/role/enabled/address edits and inventory quantities/reservations/versions. `npm run db:down` retains the volume; destructive volume removal is appropriate only for a confirmed disposable demo database.

Catalog illustrations under `apps/web/public/products/` are original project-authored SVG geometric bottle illustrations, generated for this repository, with no external asset or license dependency. Prices and descriptions are illustrative and make no medical claims. Be Vietnam Pro is currently loaded through `next/font/google`, so a first uncached production build may require font-network access.

Login throttling is bounded in-memory by the trusted socket address and normalized account for a single API instance. Deployments with more than one API replica must replace it with shared rate-limit storage. Payment `UNKNOWN` remains durable and requires reconciliation; retrying checkout reuses the same attempt key and does not initiate a new purchase.

Verification commands are separated by environment:

```bash
npm run test:unit        # API tests without Docker specs
npm run test:web         # Vitest + RTL/jsdom
npm run test:integration # Testcontainers/PostgreSQL specs
npm run typecheck
npm run build --workspace=@beautyshop/api
npm run build --workspace=@beautyshop/web
npm exec --workspace=@beautyshop/web -- playwright install chromium
npm run test:e2e
```
