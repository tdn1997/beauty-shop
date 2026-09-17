/**
 * Nguồn client Prisma **đang hiệu lực**.
 *
 * Repository không giữ kết nối riêng: nó hỏi nguồn này mỗi lần ghi, nên khi ca
 * sử dụng đang mở transaction thì lệnh ghi tự động rơi vào transaction đó.
 * `PrismaTransactionManager` chính là một nguồn như vậy.
 */
export interface PrismaClientSource<TClient> {
  current(): TClient;
}
