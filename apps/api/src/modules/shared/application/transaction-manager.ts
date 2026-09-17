/**
 * Cổng ranh giới transaction.
 *
 * Ca sử dụng là nơi **duy nhất** biết "những việc nào phải cùng thành hoặc cùng
 * hỏng" — nên nó gọi `run`, còn repository chỉ ghi. Repository tự mở và tự commit
 * thì hai lệnh ghi thuộc cùng một ca sử dụng sẽ commit rời nhau, và một sự cố
 * ở giữa để lại dữ liệu nửa vời không ai dọn.
 */
export interface TransactionManager {
  /** Chạy `work` trong một transaction. Gọi lồng thì dùng lại transaction đang mở. */
  run<T>(work: () => Promise<T>): Promise<T>;
}
