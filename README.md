# BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng — Next.js (web) · NestJS (API) · PostgreSQL.

## Hướng dẫn cài đặt (step by step)

Yêu cầu: Node.js ≥ 20.9 (xem mục 0), Docker (cho Postgres cục bộ và test tích hợp — xem
mục 0), npm.

### 0. Cài Node.js và Docker

**Node.js** — phiên bản yêu cầu lấy đúng theo `engines.node` trong `package.json` gốc của
repo: `>=20.9.0`.

- **macOS**:
  - Homebrew: `brew install node@20`
  - hoặc nvm (khuyến nghị nếu máy cần nhiều phiên bản Node):
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    nvm install 20.9.0
    nvm use 20.9.0
    ```
- **Windows**:
  - winget: `winget install OpenJS.NodeJS.LTS`
  - hoặc tải installer bản LTS ≥ 20.9 tại https://nodejs.org
- **Linux**: dùng nvm (khuyến nghị):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install 20.9.0
  nvm use 20.9.0
  ```

Kiểm tra đã cài đúng:

```bash
node -v
npm -v
```

**Docker** — dùng để chạy Postgres cục bộ (bước 3, `npm run db:up`) và cho
`npm run test:integration` (Testcontainers dựng Postgres tạm thời).

- **macOS**: `brew install --cask docker`, sau đó **mở app Docker Desktop** ít nhất một lần
  và đợi trạng thái chuyển sang **running** trước khi dùng lệnh `docker`.
- **Windows**: cài Docker Desktop (yêu cầu WSL2), bật WSL2 nếu chưa có:
  `wsl --install`, sau đó cài Docker Desktop từ https://www.docker.com/products/docker-desktop
  và bật tích hợp WSL2 trong phần cài đặt.
- **Linux**: cài Docker Engine và plugin Docker Compose theo hướng dẫn chính thức của
  distro, ví dụ Ubuntu:
  ```bash
  sudo apt-get install docker.io docker-compose-plugin
  sudo usermod -aG docker $USER
  ```
  Đăng xuất/đăng nhập lại (hoặc `newgrp docker`) để nhóm quyền `docker` có hiệu lực.

Kiểm tra đã cài đúng:

```bash
docker --version
docker compose version
docker ps
```

Ghi chú: `npm run test:unit` và `npm run test:web` **không cần Docker**. Chỉ `npm run db:up`
và `npm run test:integration` cần Docker đang chạy.

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

File mẫu đã có sẵn `DATABASE_URL` trỏ tới Postgres cục bộ ở bước 3, cùng `WEB_ORIGIN` và
bộ biến mật khẩu seed dùng ở bước 5 (`BEAUTYSHOP_DEMO_SEED`, `SEED_ADMIN_PASSWORD`,
`SEED_CUSTOMER_PASSWORD`, `SEED_CUSTOMER2_PASSWORD`). Đổi giá trị mật khẩu nếu muốn, nhưng
nhớ giữ đúng tên biến.

### 3. Khởi động Postgres

```bash
npm run db:up
```

Chạy `postgres:16-alpine` qua `docker-compose.yml`, cổng host **5433** (không đụng Postgres
cổng 5432 mặc định nếu máy đã có sẵn). Có healthcheck `pg_isready`; đợi vài giây trước khi
chạy migration nếu container mới khởi động lần đầu.

```bash
npm run db:down
```

Tắt container, **giữ lại volume dữ liệu**.

### 4. Áp migration

```bash
npm run db:migrate
```

Chạy `prisma migrate deploy`, áp tuần tự ba migration:

| Migration                                | Nội dung                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `20260917000000_init`                    | `sales_order`, `order_line`, `inventory_lot`, `outbox_event`, `checkout_replay`, `idempotency_record` + toàn bộ `CHECK`/`UNIQUE` |
| `20260922000000_add_catalog_and_address` | `product`, `product_variant`, `customer_address` + `CHECK` giá không âm, định dạng số điện thoại                                 |
| `20260922070000_storefront_catalog_auth` | Bảng `user` (mật khẩu hash, role) và session đăng nhập, mở rộng catalog cho 16 sản phẩm                                          |

### 5. Seed dữ liệu mẫu

```bash
npm run db:seed --workspace=@beautyshop/api
```

Script `apps/api/prisma/seed.ts` (chạy bằng `tsx`, gọi `seedDemo()` trong
`apps/api/prisma/seed/seed-demo.ts`) là **seed demo có chủ đích, không chạy ngầm**:

- **Từ chối chạy nếu `NODE_ENV=production`**, và bắt buộc phải đặt
  `BEAUTYSHOP_DEMO_SEED=true` trong `apps/api/.env` — thiếu là báo lỗi dừng ngay.
- Bắt buộc có `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, `SEED_CUSTOMER2_PASSWORD`
  (đã có sẵn giá trị mẫu trong `.env.example`) để tạo mật khẩu cho 3 tài khoản demo.
- Tạo **16 sản phẩm / 27 biến thể / 27 lô kho / 3 người dùng + 3 địa chỉ**:
  - 2 lô cố ý ở trạng thái đặc biệt để demo cảnh báo tồn kho và lỗi checkout: hết hàng
    (`SKU-VITC-10ML`, `onHand: 0`) và sắp hết (`SKU-SPF50-100G`, `onHand: 5`).
  - 3 tài khoản: **admin@beautyshop.test** (role `ADMIN`), **customer@beautyshop.test** và
    **customer2@beautyshop.test** (role `CUSTOMER`), mỗi tài khoản kèm một địa chỉ giao hàng
    mặc định — dùng để kiểm thử luồng đăng nhập/checkout ở mục "Kiểm thử bằng tài khoản
    seed" bên dưới.
- **Idempotent nhưng không ghi đè dữ liệu đã sửa**: chạy lại (`upsert` theo khoá nghiệp vụ —
  SKU, mã lô, id địa chỉ, id user) sẽ giữ nguyên tồn kho, mật khẩu, role, trạng thái
  `enabled` và địa chỉ nếu bạn đã chỉnh sửa chúng sau lần seed đầu. Nói riêng: **seed lại
  không reset mật khẩu** của user đã tồn tại — muốn đổi mật khẩu một tài khoản demo thì xoá
  user đó khỏi DB rồi seed lại, hoặc dùng một database dùng-một-lần (seed lại từ đầu, xem
  lệnh ở cuối mục này).

### 6. Chạy ứng dụng

Terminal 1 — API:

```bash
npm run start:dev --workspace=@beautyshop/api
```

Terminal 2 — Web:

```bash
npm run dev --workspace=@beautyshop/web
```

API chạy ở `http://localhost:3001`, web ở `http://localhost:3000`. Hai lệnh chạy **song
song trong hai terminal riêng** — không tắt lệnh nào trong lúc dùng lệnh kia.

Mở `http://localhost:3000` để vào trang chủ (đọc danh mục 16 sản phẩm qua `GET /products`,
có ô tìm kiếm và bộ lọc theo danh mục), thêm sản phẩm vào giỏ, vào `/checkout` để thấy quote
diff và đặt hàng thật (ghi xuống Postgres).

## Kiểm thử bằng tài khoản seed (admin và customer)

Sau bước 5, dùng đúng 3 tài khoản demo để kiểm thử thủ công phân quyền và luồng mua hàng.

Mật khẩu của mỗi tài khoản là giá trị bạn đặt cho biến môi trường tương ứng trước khi seed
(`SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, `SEED_CUSTOMER2_PASSWORD` trong
`apps/api/.env` — mặc định đã có giá trị mẫu trong `.env.example`).

| Email                       | Role       | Biến môi trường mật khẩu  |
| --------------------------- | ---------- | ------------------------- |
| `admin@beautyshop.test`     | `ADMIN`    | `SEED_ADMIN_PASSWORD`     |
| `customer@beautyshop.test`  | `CUSTOMER` | `SEED_CUSTOMER_PASSWORD`  |
| `customer2@beautyshop.test` | `CUSTOMER` | `SEED_CUSTOMER2_PASSWORD` |

Kịch bản kiểm thử thủ công đề nghị, sau khi API và web đã chạy (bước 6):

1. **Đăng nhập bằng `customer@beautyshop.test`** tại `/login`.
   - Thanh điều hướng **không** hiện nút "Admin".
   - Vào thẳng URL `/admin/orders` bị chặn: chuyển hướng về `/` (không phải trang admin).
2. **Đăng xuất**, rồi **đăng nhập bằng `admin@beautyshop.test`**.
   - Thanh điều hướng hiện nút "Admin".
   - Vào `/admin/orders` xem được bảng đơn hàng; vào `/admin/inventory` xem được bảng tồn
     kho.
3. **Đăng xuất** (nút "Đăng xuất" trên thanh điều hướng) — thử lại `/admin/orders`: bị
   chuyển hướng về `/login` vì phiên đã mất hiệu lực.
4. **Đăng nhập lại bằng một trong hai tài khoản customer**, thêm sản phẩm vào giỏ hàng, vào
   `/checkout`: danh sách địa chỉ hiển thị đúng là địa chỉ giao hàng của **chính tài khoản
   đang đăng nhập** (mỗi customer chỉ thấy địa chỉ của mình, lấy qua `GET /addresses` có
   xác thực).

Muốn seed lại từ đầu trên một database dùng-một-lần (ví dụ sau khi đổi migration, hoặc muốn
đổi mật khẩu tài khoản demo):

```bash
npm run db:down && npm run db:up && npm run db:migrate && npm run db:seed --workspace=@beautyshop/api
```

`npm run db:down` chỉ tắt container và **giữ volume**; chỉ xoá volume Docker thủ công khi
chắc chắn đó là database demo dùng-một-lần, không chứa dữ liệu cần giữ.

## Xác minh cài đặt đúng

Các lệnh kiểm thử tách theo môi trường:

```bash
npm run test:unit        # test API không cần Docker (loại các *.integration.spec.ts)
npm run test:web         # Vitest + Testing Library (jsdom) cho web
npm run test:integration # test API cần Docker (Testcontainers dựng Postgres tạm thời)
npm run typecheck        # tsc cho cả 2 workspace
npm run build --workspace=@beautyshop/api
npm run build --workspace=@beautyshop/web
```

Muốn chạy end-to-end (Playwright, cần build web trước):

```bash
npm exec --workspace=@beautyshop/web -- playwright install chromium
npm run test:e2e
```

Lưu ý: chỉ `test:unit` và `test:web` chạy được mà **không cần Docker**. `test:integration`
**cần Docker đang chạy** vì dùng Testcontainers để dựng một Postgres tạm thời riêng biệt
với Postgres ở bước 3 (không đụng dữ liệu seed).

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
  seed.ts           # entrypoint seed demo
  seed/             # fixtures (catalog, user) + logic seedDemo()
```

Ranh giới `domain/` được **kiểm thử tự động**:
`apps/api/src/architecture.spec.ts` đỏ nếu `domain/` import
`@nestjs/*`, `@prisma/*`, `express`, `axios` hoặc thò sang module khác.

## Xác thực và dữ liệu demo

Web đọc danh mục thật từ `GET /products` (không còn hard-code sản phẩm trong code web).
Đăng nhập dùng session opaque tồn tại 8 giờ; chỉ hash SHA-256 của token được lưu ở server.
Trình duyệt nhận cookie HttpOnly, `SameSite=Lax`, `Path=/`
(`__Host-beautyshop_session` khi chạy HTTPS production, `beautyshop_session` khi chạy cục
bộ). Token không bao giờ lưu ở `localStorage`. Các route API không còn tin header
`x-user-id`/`x-user-role` do client tự gắn — danh tính người dùng lấy từ session đã xác
thực ở server.

Giới hạn số lần đăng nhập sai (login throttle) được lưu trong bộ nhớ, tính theo địa chỉ
socket tin cậy và tài khoản đã chuẩn hoá, **cho một instance API duy nhất**. Nếu triển khai
nhiều bản sao API cùng lúc, cần thay bằng kho lưu giới hạn tốc độ dùng chung.

Trạng thái `UNKNOWN` của thanh toán vẫn được lưu bền và cần đối soát; gọi lại checkout với
cùng attempt key không tạo đơn hàng mới.

Ảnh minh hoạ sản phẩm ở `apps/web/public/products/` là SVG hình học tự vẽ cho dự án, không
phụ thuộc tài sản hay giấy phép bên ngoài. Giá và mô tả mang tính minh hoạ, không phải
tuyên bố y tế. Font Be Vietnam Pro hiện tải qua `next/font/google`, nên lần build production
đầu tiên chưa cache có thể cần truy cập mạng để tải font.

## Trạng thái theo kế hoạch

**Giai đoạn 1–7: xong.** Catalog, địa chỉ và xác thực đều có persistence thật
(`PrismaPriceCatalog`, `PrismaAddressBook`, bảng `user`/session) — checkout và phân quyền
admin/customer chạy end-to-end với dữ liệu seed.

### Backend (NestJS API) — 439 test đơn vị + 12 test tích hợp

Chạy `npm run test:unit` cho số liệu test đơn vị hiện tại (thay đổi theo mã nguồn, không
liệt kê chi tiết theo thành phần ở đây để tránh lệch số). `npm run test:integration` chạy
IT01–IT12 (Testcontainers Postgres): optimistic lock, ràng buộc `CHECK`, `UNIQUE`, tranh
chấp giữ chỗ tồn kho đồng thời, tính nguyên tử của outbox.

### Web (Next.js)

| Trang               | URL                | Tính năng                                                                     |
| ------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Trang chủ / Catalog | `/`                | 16 sản phẩm đọc từ `GET /products`, tìm kiếm, lọc theo danh mục, thêm vào giỏ |
| Đăng nhập           | `/login`           | Đăng nhập session, chuyển hướng `returnTo` an toàn                            |
| Giỏ hàng            | `/cart`            | Xem/sửa/xoá, tổng phụ                                                         |
| Checkout            | `/checkout`        | Quote diff, idempotency key, xử lý UNKNOWN, yêu cầu đăng nhập                 |
| Admin Đơn hàng      | `/admin/orders`    | Bảng phân trang, tách cột thanh toán/giao hàng — chỉ role ADMIN               |
| Admin Kho           | `/admin/inventory` | Bảng phân trang, 3 cột Vật lý/Đã giữ/Khả dụng — chỉ role ADMIN                |

### API endpoints

| Method | Path              | Quyền truy cập | Mô tả                         |
| ------ | ----------------- | -------------- | ----------------------------- |
| `POST` | `/auth/login`     | công khai      | Đăng nhập, trả session        |
| `GET`  | `/auth/me`        | cần đăng nhập  | Thông tin người dùng hiện tại |
| `POST` | `/auth/logout`    | công khai      | Đăng xuất, thu hồi session    |
| `GET`  | `/products`       | công khai      | Danh mục sản phẩm còn bán     |
| `GET`  | `/addresses`      | cần đăng nhập  | Địa chỉ của chính người dùng  |
| `POST` | `/quote`          | cần đăng nhập  | Báo giá                       |
| `GET`  | `/quote/preview`  | cần đăng nhập  | Báo giá nhanh                 |
| `POST` | `/checkout`       | cần đăng nhập  | Đặt hàng (idempotent)         |
| `GET`  | `/orders`         | admin          | Danh sách đơn                 |
| `GET`  | `/orders/:id`     | admin          | Chi tiết đơn                  |
| `GET`  | `/inventory/lots` | admin          | Danh sách lô kho              |

## Quy ước đã áp dụng

- Tiền là `bigint` đơn vị nhỏ nhất, không bao giờ là `number` — phần trăm dùng basis points.
- Thuộc tính đổi được là `#private`, chỉ đổi qua method có tên theo ý định.
- `subtotal()`, `itemsTotal()`, `availableAt()` là giá trị suy dẫn, tính bằng method.
- Giá và địa chỉ trong đơn là snapshot.
- `Order.lines` trả mảng đông cứng (`Object.freeze`).
- **Tách lệnh/truy vấn**: `*QueryService` chỉ đọc; `*CommandService` mới được đổi trạng thái.
- **Phân loại lỗi**: nghiệp vụ dự kiến → `Result<T>`; vi phạm bất biến → `throw`; lỗi hạ tầng → nổi lên.
- Seed idempotent: mọi bản ghi dùng `upsert` theo khoá nghiệp vụ (SKU, lot code, address id, user id).
- Định dạng code bằng Prettier: `npm run format` sửa tại chỗ, `npm run format:check` chỉ kiểm tra (dùng trước khi commit hoặc trong CI).

## Còn nợ

- Sandbox payment thật chưa tích hợp; `SandboxGateway` là adapter wire chung, chưa nối
  provider cụ thể; UNKNOWN reconciliation tự động chưa có.
- `InventoryRepository` chưa có `save`/`create` qua port — seed ghi thẳng qua Prisma Client,
  chưa qua use case "nhập hàng" thật (chưa có ca sử dụng đó).
- Login throttle chỉ lưu trong bộ nhớ của một instance API; chưa sẵn sàng cho nhiều bản sao
  chạy song song (xem mục "Xác thực và dữ liệu demo").
