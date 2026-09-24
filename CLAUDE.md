# CLAUDE.md — BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng. Trọng tâm chấm điểm:
**thuộc tính, phương thức, Encapsulation, GRASP** — không phải tính năng.
Khi phải chọn giữa "nhanh" và "thể hiện đúng nguyên lý", chọn nguyên lý.

Kế hoạch đầy đủ 7 giai đoạn: `plans/beautyshop.md`. Trạng thái hiện tại: `README.md`.

## Lệnh

```bash
npm run test:unit                     # API unit tests (không Docker)
    npm run test:web                      # Web Vitest/jsdom
    npm run test:integration              # Testcontainers/PostgreSQL
npm run typecheck                     # tsc cho cả 2 workspace
npm run build --workspace=@beautyshop/api
npm run db:up                         # Postgres qua Docker, cổng 5433
npm run db:migrate                    # áp migration (CHECK, UNIQUE, cột version)
npm run db:seed --workspace=@beautyshop/api  # dữ liệu mẫu idempotent (catalog, kho, địa chỉ)
```

Hướng dẫn cài đặt đầy đủ từ đầu: `README.md`.

Chạy test trước khi coi bất cứ việc gì là xong. Không có ngoại lệ.

## Luật kiến trúc

Mỗi module NestJS có 4 tầng, phụ thuộc chỉ đi vào trong:

```
api/            → controller, filter, interceptor, mapper DTO
application/    → ca sử dụng, KHAI BÁO interface repository, quyết định ranh giới transaction
infrastructure/ → Prisma, gateway ngoài — CÀI ĐẶT interface của application
domain/         → TypeScript thuần
```

`domain/` **không được** import `@nestjs/*`, `@prisma/*`, `express`, `axios`,
và không được với sang module khác (trừ `shared`).
Luật này có test: `apps/api/src/architecture.spec.ts`. Đã xác minh nó bắt được
vi phạm thật (cắm file vi phạm → đỏ, gỡ → xanh).

## Quy ước code

- Tiền: `Money` (bigint đơn vị nhỏ nhất). **Không bao giờ** dùng `number` cho tiền.
- Thuộc tính ổn định → `readonly`. Đổi được → `#private` + method có tên theo ý định.
- **Không có `setX` nào.** Dùng `rename`, `publish`, `reserve`, `confirm`, `dispatch`.
- Giá trị tính được (`subtotal()`, `itemsTotal()`, `availableAt()`) là method, không phải cột.
- Getter trả tập hợp phải trả bản chụp đông cứng: `Object.freeze([...this.#lines])`.
- Constructor `private` + static factory (`Order.draft()`, `Money.parse()`, `Address.create()`).
- Tiền điều kiện đặt ở đầu thân hàm: `requireNonBlank`, `requirePositiveInteger`, `requireState`.
- Thời gian lấy từ `Clock` được inject. **Không `new Date()` trong domain.**
- Không `static` nào giữ dữ liệu theo request.
- Giá và địa chỉ trong đơn là **snapshot**, không tham chiếu catalog/profile.

## Lỗi

| Loại                                                         | Cách xử lý                                         |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Nghiệp vụ dự kiến (hết hàng, sai trạng thái, không tìm thấy) | trả `Result<T>` với `DomainError` mã ổn định       |
| Vi phạm bất biến (lỗi lập trình)                             | `throw DomainError`                                |
| Hạ tầng (mất kết nối, timeout)                               | **để nổi lên**, không gói vào `Result`, không nuốt |

`OrderCommandService` chỉ bắt `DomainError`, còn lại rethrow. Có test giữ luật này.
Mã lỗi là hợp đồng với client — client nhánh theo `code`, không theo message.

## Tách lệnh / truy vấn

- `OrderQueryService`: chỉ đọc, trả DTO thuần, method phải khớp `^(find|get|list|count)`.
  Có test quét prototype để giữ luật.
- `OrderCommandService`: chỗ duy nhất đổi trạng thái, trả `Result<void>`.

## TDD — bắt buộc

Đỏ → xanh → refactor. Viết test, **chạy và thấy nó đỏ**, rồi mới viết code.

Tên test bắt đầu bằng `should`. Thân test 4 phase, comment chữ thường:
`// arrange`, `// confirm`, `// act`, `// assert`.

Mọi ca lỗi phải assert trạng thái **không đổi** sau khi throw (so snapshot trước/sau).

Viết code mà không có test yêu cầu nó → xoá. Đã áp dụng trong repo này:
`Money.subtract/compareTo`, `ProductVariant.rename`, `OrderCommandService.markPaid/cancel`
đều bị gỡ, sẽ thêm lại kèm test khi có consumer thật.

## Lưu trữ

Aggregate tự quyết định hình dạng lưu trữ của mình: `toSnapshot()` + `static rehydrate()`.
Repository dịch snapshot ↔ hàng trong bảng, **không** đọc `#private`.
`rehydrate` là đường duy nhất đặt thẳng trạng thái mà không qua máy trạng thái —
chỉ repository được gọi.

Aggregate giữ `persistedVersion` (phiên bản đang trong DB) tách khỏi `version`
(phiên bản hiện tại). Đó là vế `WHERE version = ?` của optimistic lock.
Thua cuộc đua → `Result.err('CONCURRENT_MODIFICATION')`, **không** `markPersisted()`.

Repository không tự mở transaction: nó lấy client đang hiệu lực từ
`PrismaClientSource`. Ranh giới do application service vạch qua `TransactionManager`.

Bất biến được giữ ở **hai** tầng: domain (trong bộ nhớ) và `CHECK`/`UNIQUE`
(trong migration). Lặp lại là cố ý — domain chỉ chặn đường đi qua code.

## Còn nợ, cố ý

Cạnh tranh thật chỉ chứng minh được bằng Testcontainers + Postgres (Giai đoạn 7) —
**không** viết "test cạnh tranh" trên Map trong bộ nhớ, đó là test xanh giả.
Client Prisma giả trong test là tất định: nó kiểm _câu lệnh gửi đi_ và _cách dịch
0 hàng bị sửa_, không giả vờ kiểm cô lập giao dịch.

Checkout ghi replay UNKNOWN cùng transaction giữ tồn/đơn/outbox trước khi gọi payment.
Ownership phải kiểm trước replay; Result lỗi phải làm rollback, không commit một phần.
Ngoại lệ payment sau commit để nổi lên; lần retry trả UNKNOWN đã lưu, không initiate lại.
Outbox dùng `@nestjs/schedule`, giao at-least-once, không bảo đảm exactly-once.
Mock + adapter sandbox HTTP tổng quát đã có contract test; chưa có provider sandbox cụ thể.

Catalog/address giờ đã có persistence thật (`PrismaPriceCatalog`, `PrismaAddressBook`,
Giai đoạn 8) — không còn adapter rỗng ở composition root. Seed là 16 sản phẩm thật, ảnh
Open Beauty Facts (CC BY-SA) trong `apps/web/public/products/` — giữ `CREDITS.md` khi đổi ảnh.
Đổi tên sản phẩm seed → thêm tên cũ vào `previousNames`, nếu không seed báo va chạm id. Auth dùng opaque session 8 giờ và Bearer guard; web tải catalog động qua `GET /products`.
Chưa tự reconciliation UNKNOWN hoặc lưu payment attempt lifecycle ngoài replay.
`InventoryRepository` chưa có `save`/`create` qua port — seed ghi thẳng qua Prisma Client.
