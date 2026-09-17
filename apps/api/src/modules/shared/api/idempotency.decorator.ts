import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'beautyshop:idempotent';

/**
 * Đánh dấu một route phải chạy đúng một lần cho mỗi (khách, Idempotency-Key).
 * Dùng cho mọi endpoint ghi có hệ quả thật: đặt hàng, thanh toán, hoàn tiền.
 */
export const Idempotent = (): MethodDecorator => SetMetadata(IDEMPOTENT_METADATA_KEY, true);
