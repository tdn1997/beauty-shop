# CLAUDE.md — BeautyShop

Đồ án Thiết kế phần mềm hướng đối tượng. Trọng tâm chấm điểm:
**thuộc tính, phương thức, Encapsulation, GRASP** — không phải tính năng.
Khi phải chọn giữa "nhanh" và "thể hiện đúng nguyên lý", chọn nguyên lý.

Kế hoạch đầy đủ 7 giai đoạn: `plans/beautyshop.md`. Trạng thái hiện tại: `README.md`.

## Lệnh

```bash
npm test                              # 134 test, Vitest
npm run typecheck                     # tsc cho cả 2 workspace
npm run build --workspace=@beautyshop/api
npm run db:up                         # Postgres qua Docker, cổng 5433
```

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

| Loại | Cách xử lý |
|---|---|
| Nghiệp vụ dự kiến (hết hàng, sai trạng thái, không tìm thấy) | trả `Result<T>` với `DomainError` mã ổn định |
| Vi phạm bất biến (lỗi lập trình) | `throw DomainError` |
| Hạ tầng (mất kết nối, timeout) | **để nổi lên**, không gói vào `Result`, không nuốt |

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

## Còn nợ, cố ý

Repository mới có bản in-memory. Optimistic lock thật, `CHECK (reserved <= on_hand)`,
`UPDATE ... WHERE on_hand - reserved >= $1` thuộc Giai đoạn 3 & 5.
Cạnh tranh thật chỉ chứng minh được bằng Testcontainers + Postgres (Giai đoạn 7) —
**không** viết "test cạnh tranh" trên Map trong bộ nhớ, đó là test xanh giả.
