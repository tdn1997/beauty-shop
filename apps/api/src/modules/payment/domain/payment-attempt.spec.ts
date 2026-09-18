import { describe, expect, it } from 'vitest';

import { Money } from '../../shared/domain/money';
import { PaymentAttempt } from './payment-attempt';
import { PaymentStatus } from './payment-status';

const attemptProps = {
  orderId: 'ord_1',
  provider: 'mock',
  amount: Money.parse('459000', 'VND'),
};

describe('PaymentAttempt - khởi tạo', () => {
  it('should start pending without a provider reference', () => {
    // arrange
    const props = attemptProps;

    // confirm
    expect(props.amount.isNegative()).toBe(false);

    // act
    const attempt = PaymentAttempt.initiated(props);

    // assert
    expect(attempt.status).toBe(PaymentStatus.Pending);
    expect(attempt.providerRef).toBeNull();
    expect(attempt.redirectUrl).toBeNull();
    expect(attempt.isPending()).toBe(true);
    expect(attempt.isSettled()).toBe(false);
  });

  it('should reject a blank order id', () => {
    // arrange
    const props = { ...attemptProps, orderId: '  ' };

    // confirm
    expect(() => PaymentAttempt.initiated(attemptProps)).not.toThrow();

    // act
    const act = () => PaymentAttempt.initiated(props);

    // assert
    expect(act).toThrow(/INVALID_PAYMENT_ATTEMPT/);
  });

  it('should reject a blank provider', () => {
    // arrange
    const props = { ...attemptProps, provider: '' };

    // confirm
    expect(() => PaymentAttempt.initiated(attemptProps)).not.toThrow();

    // act
    const act = () => PaymentAttempt.initiated(props);

    // assert
    expect(act).toThrow(/INVALID_PAYMENT_ATTEMPT/);
  });

  it('should reject a negative amount', () => {
    // arrange
    const props = { ...attemptProps, amount: Money.parse('-1', 'VND') };

    // confirm
    expect(props.amount.isNegative()).toBe(true);

    // act
    const act = () => PaymentAttempt.initiated(props);

    // assert
    expect(act).toThrow(/PAYMENT_AMOUNT_INVALID/);
  });

  it('should keep the amount as Money rather than a number', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Pending);

    // act
    const amount = attempt.amount;

    // assert
    expect(amount).toBeInstanceOf(Money);
    expect(amount.equals(attemptProps.amount)).toBe(true);
  });
});

describe('PaymentAttempt - chuyển trạng thái', () => {
  it('should record the provider reference when the payment succeeds', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.providerRef).toBeNull();

    // act
    attempt.succeed('mock_ref_1');

    // assert
    expect(attempt.status).toBe(PaymentStatus.Paid);
    expect(attempt.providerRef).toBe('mock_ref_1');
    expect(attempt.isSettled()).toBe(true);
  });

  it('should record the reason when the payment fails', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.failureReason).toBeNull();

    // act
    attempt.fail('Thẻ bị từ chối');

    // assert
    expect(attempt.status).toBe(PaymentStatus.Failed);
    expect(attempt.failureReason).toBe('Thẻ bị từ chối');
    expect(attempt.isSettled()).toBe(true);
  });

  it('should keep an undetermined outcome unsettled instead of calling it failed', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.isPending()).toBe(true);

    // act
    attempt.markUnknown('Nhà cung cấp không trả lời');

    // assert
    expect(attempt.status).toBe(PaymentStatus.Unknown);
    expect(attempt.isSettled()).toBe(false);
    expect(attempt.isPending()).toBe(false);
  });

  it('should let an undetermined attempt settle once the provider answers', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);
    attempt.markUnknown('Nhà cung cấp không trả lời');

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Unknown);

    // act
    attempt.succeed('mock_ref_9');

    // assert
    expect(attempt.status).toBe(PaymentStatus.Paid);
    expect(attempt.providerRef).toBe('mock_ref_9');
  });

  it('should remember where to send the customer while staying pending', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.redirectUrl).toBeNull();

    // act
    attempt.awaitRedirect('mock_ref_2', 'https://mock.local/pay/mock_ref_2');

    // assert
    expect(attempt.redirectUrl).toBe('https://mock.local/pay/mock_ref_2');
    expect(attempt.providerRef).toBe('mock_ref_2');
    expect(attempt.status).toBe(PaymentStatus.Pending);
  });
});

describe('PaymentAttempt - trạng thái không đổi khi bị từ chối', () => {
  it('should refuse to fail an attempt that already succeeded', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);
    attempt.succeed('mock_ref_1');

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Paid);

    // act
    const act = () => attempt.fail('Đổi ý');

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(attempt.status).toBe(PaymentStatus.Paid);
    expect(attempt.providerRef).toBe('mock_ref_1');
    expect(attempt.failureReason).toBeNull();
  });

  it('should refuse to mark a settled attempt as unknown', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);
    attempt.fail('Thẻ bị từ chối');

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Failed);

    // act
    const act = () => attempt.markUnknown('Thử lại xem sao');

    // assert
    expect(act).toThrow(/INVALID_TRANSITION/);
    expect(attempt.status).toBe(PaymentStatus.Failed);
    expect(attempt.failureReason).toBe('Thẻ bị từ chối');
  });

  it('should refuse a blank provider reference and leave the attempt pending', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Pending);

    // act
    const act = () => attempt.succeed('   ');

    // assert
    expect(act).toThrow(/INVALID_PAYMENT_ATTEMPT/);
    expect(attempt.status).toBe(PaymentStatus.Pending);
    expect(attempt.providerRef).toBeNull();
  });

  it('should refuse a blank failure reason and leave the attempt pending', () => {
    // arrange
    const attempt = PaymentAttempt.initiated(attemptProps);

    // confirm
    expect(attempt.status).toBe(PaymentStatus.Pending);

    // act
    const act = () => attempt.fail('');

    // assert
    expect(act).toThrow(/INVALID_PAYMENT_ATTEMPT/);
    expect(attempt.status).toBe(PaymentStatus.Pending);
    expect(attempt.failureReason).toBeNull();
  });
});
