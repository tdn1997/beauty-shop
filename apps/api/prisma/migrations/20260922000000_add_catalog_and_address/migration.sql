-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "variant_status" AS ENUM ('ACTIVE', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "list_price" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "variant_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_address" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "ward" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_sku_key" ON "product_variant"("sku");

-- CreateIndex
CREATE INDEX "product_variant_product_id_idx" ON "product_variant"("product_id");

-- CreateIndex
CREATE INDEX "customer_address_customer_id_idx" ON "customer_address"("customer_id");

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Bất biến ở tầng lưu trữ.
--
-- Domain đã giữ đúng những luật này trong bộ nhớ (ProductVariant.create/
-- changeListPrice, Address.create). Lặp lại chúng ở đây không thừa: domain
-- chỉ chặn được đường đi qua code, còn CHECK chặn cả script sửa tay, job
-- nhập liệu và bản vá vội vàng. Đóng gói ở mức lưu trữ.
--
-- Prisma schema không khai báo được CHECK nên chúng nằm trong migration này.
-- ---------------------------------------------------------------------------

-- Giá niêm yết không được âm, giống bất biến của `order_line.unit_price`.
ALTER TABLE "product_variant"
  ADD CONSTRAINT "product_variant_list_price_non_negative" CHECK ("list_price" >= 0);

-- Số điện thoại phải khớp đúng mẫu di động Việt Nam mà `Address.create()`
-- đã validate trong bộ nhớ (`^0\d{9}$`) — lặp lại ở DB để chặn cả đường ghi
-- thẳng không qua domain.
ALTER TABLE "customer_address"
  ADD CONSTRAINT "customer_address_phone_format" CHECK ("phone" ~ '^0[0-9]{9}$');
