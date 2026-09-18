-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_event_status_occurred_at_idx" ON "outbox_event"("status", "occurred_at");

-- Số lần thử không âm; đã bỏ cuộc thì phải giữ lý do để người vận hành xử lý.
ALTER TABLE "outbox_event"
  ADD CONSTRAINT "outbox_event_attempts_non_negative" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "outbox_event_failed_needs_reason"
    CHECK ("status" <> 'FAILED' OR "last_error" IS NOT NULL);

-- CreateTable
CREATE TABLE "sales_order" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "order_status" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "cancellation_reason" TEXT,
    "discount" BIGINT NOT NULL DEFAULT 0 CHECK ("discount" >= 0),
    "shipping_fee" BIGINT NOT NULL DEFAULT 0 CHECK ("shipping_fee" >= 0),
    "ship_recipient_name" TEXT,
    "ship_phone" TEXT,
    "ship_line1" TEXT,
    "ship_line2" TEXT,
    "ship_ward" TEXT,
    "ship_district" TEXT,
    "ship_province" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lot" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "lot_code" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "expires_on" DATE,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_replay" (
    "customer_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "idempotency_status" NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkout_replay_pkey" PRIMARY KEY ("customer_id", "key"),
    CONSTRAINT "checkout_replay_completed_response" CHECK ("status" <> 'COMPLETED' OR ("response" IS NOT NULL AND jsonb_typeof("response") = 'object'))
);

CREATE TABLE "idempotency_record" (
    "customer_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "idempotency_status" NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("customer_id","key")
);

-- CreateIndex
CREATE INDEX "sales_order_customer_id_idx" ON "sales_order"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_order_id_variant_id_key" ON "order_line"("order_id", "variant_id");

-- CreateIndex
CREATE INDEX "inventory_lot_variant_id_idx" ON "inventory_lot"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lot_variant_id_lot_code_key" ON "inventory_lot"("variant_id", "lot_code");

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Bất biến ở tầng lưu trữ.
--
-- Domain đã giữ đúng những luật này trong bộ nhớ (InventoryLot.reserve,
-- OrderLine.create, Order.confirm/cancel). Lặp lại chúng ở đây không thừa:
-- domain chỉ chặn được đường đi qua code, còn CHECK chặn cả script sửa tay,
-- job nhập liệu và bản vá vội vàng. Đóng gói ở mức lưu trữ.
--
-- Prisma schema không khai báo được CHECK nên chúng nằm trong migration này.
-- ---------------------------------------------------------------------------

-- Tồn không âm, và phần đã giữ không bao giờ vượt tồn vật lý.
-- Đây là bất biến cốt lõi của kho: nếu nó vỡ, cửa hàng bán thứ mình không có.
ALTER TABLE "inventory_lot"
  ADD CONSTRAINT "inventory_lot_on_hand_non_negative" CHECK ("on_hand" >= 0),
  ADD CONSTRAINT "inventory_lot_reserved_within_on_hand"
    CHECK ("reserved" >= 0 AND "reserved" <= "on_hand"),
  ADD CONSTRAINT "inventory_lot_blocked_needs_reason"
    CHECK ("blocked" = false OR "block_reason" IS NOT NULL),
  ADD CONSTRAINT "inventory_lot_version_non_negative" CHECK ("version" >= 0);

-- Dòng đơn: lượng phải dương (dòng lượng 0 thì phải xoá, không phải để lại),
-- đơn giá không âm.
ALTER TABLE "order_line"
  ADD CONSTRAINT "order_line_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_line_unit_price_non_negative" CHECK ("unit_price" >= 0);

-- Đơn hàng: soi lại đúng hai tiền điều kiện của `Order.confirm()` và
-- `Order.cancel()` — đơn đã rời trạng thái nháp thì phải có địa chỉ giao,
-- đơn đã huỷ thì phải có lý do.
ALTER TABLE "sales_order"
  ADD CONSTRAINT "sales_order_version_non_negative" CHECK ("version" >= 0),
  ADD CONSTRAINT "sales_order_cancelled_needs_reason"
    CHECK ("status" <> 'CANCELLED' OR "cancellation_reason" IS NOT NULL),
  ADD CONSTRAINT "sales_order_shipping_address_once_left_draft"
    CHECK (
      "status" IN ('DRAFT', 'CANCELLED')
      OR (
        "ship_recipient_name" IS NOT NULL
        AND "ship_phone" IS NOT NULL
        AND "ship_line1" IS NOT NULL
        AND "ship_ward" IS NOT NULL
        AND "ship_district" IS NOT NULL
        AND "ship_province" IS NOT NULL
      )
    );

-- `UNIQUE (customer_id, key)` của idempotency chính là khoá chính ghép ở trên
-- (`idempotency_record_pkey`). Nhờ nó `reserve()` là một lần INSERT nguyên tử:
-- hai request song song cùng khoá thì đúng một cái thắng, cái kia vấp 23505 —
-- không có khe đọc-rồi-ghi nào ở giữa.
