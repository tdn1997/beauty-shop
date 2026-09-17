import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Kết nối Prisma gắn vào vòng đời của Nest.
 *
 * Đây là **lớp duy nhất** trong toàn bộ API import `@prisma/client`. Repository
 * chỉ nhận những giao diện hẹp do chính nó khai báo, nên đổi ORM sau này là việc
 * của thư mục `infrastructure/`, không đụng tới domain hay ca sử dụng.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Client mà Prisma trao cho thân `$transaction` — cùng các bảng, nhưng không có
 * `$transaction`/`$connect`, vì bên trong một transaction thì không mở transaction nữa.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
