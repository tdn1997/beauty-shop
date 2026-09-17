import { Module } from '@nestjs/common';

/**
 * Composition root. Mỗi module nghiệp vụ (catalog, inventory, ordering, ...)
 * sẽ được đăng ký ở đây khi tầng application/api của nó ra đời.
 */
@Module({
  imports: [],
})
export class AppModule {}
