CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'ADMIN');
ALTER TABLE "product" ADD COLUMN "description" TEXT NOT NULL DEFAULT '', ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other', ADD COLUMN "image_path" TEXT, ADD COLUMN "image_alt" TEXT, ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_variant" ADD COLUMN "display_name" TEXT NOT NULL DEFAULT '';
CREATE TABLE "app_user" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "display_name" TEXT NOT NULL, "password_hash" TEXT NOT NULL, "role" "user_role" NOT NULL DEFAULT 'CUSTOMER', "enabled" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL);
-- Explicit non-login placeholder preserves legacy ownership without inventing credentials.
INSERT INTO "app_user" ("id","email","display_name","password_hash","role","enabled","updated_at") SELECT DISTINCT "customer_id", 'disabled+' || md5("customer_id") || '@legacy.invalid', 'Legacy customer', 'disabled', 'CUSTOMER'::"user_role", false, CURRENT_TIMESTAMP FROM "customer_address" ON CONFLICT ("id") DO NOTHING;
CREATE TABLE "session" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE, "token_hash" TEXT NOT NULL UNIQUE, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expires_at" TIMESTAMP(3) NOT NULL, "revoked_at" TIMESTAMP(3));
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app_user"("id") ON DELETE RESTRICT;
