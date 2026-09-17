import { DomainError } from '../../shared/domain/domain-error';
import { requireNonBlank } from '../../shared/domain/guards';

export interface AddressProps {
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2?: string | null;
  readonly ward: string;
  readonly district: string;
  readonly province: string;
}

export interface AddressDto {
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly ward: string;
  readonly district: string;
  readonly province: string;
}

const VN_MOBILE_PATTERN = /^0\d{9}$/;
const CODE = 'INVALID_ADDRESS';

/**
 * Value object địa chỉ giao hàng: bất biến, validate đủ trường ngay khi tạo.
 * Đơn hàng giữ **bản sao** địa chỉ, không tham chiếu profile khách —
 * khách đổi địa chỉ sau này không được phép làm đổi đơn đã đặt.
 */
export class Address {
  readonly #recipientName: string;
  readonly #phone: string;
  readonly #line1: string;
  readonly #line2: string | null;
  readonly #ward: string;
  readonly #district: string;
  readonly #province: string;

  private constructor(props: AddressDto) {
    this.#recipientName = props.recipientName;
    this.#phone = props.phone;
    this.#line1 = props.line1;
    this.#line2 = props.line2;
    this.#ward = props.ward;
    this.#district = props.district;
    this.#province = props.province;
  }

  static create(props: AddressProps): Address {
    const recipientName = requireNonBlank(props.recipientName, 'recipientName', CODE);
    const phone = requireNonBlank(props.phone, 'phone', CODE);
    const line1 = requireNonBlank(props.line1, 'line1', CODE);
    const ward = requireNonBlank(props.ward, 'ward', CODE);
    const district = requireNonBlank(props.district, 'district', CODE);
    const province = requireNonBlank(props.province, 'province', CODE);

    if (!VN_MOBILE_PATTERN.test(phone)) {
      throw new DomainError(CODE, 'Số điện thoại không hợp lệ', { field: 'phone' });
    }

    const line2 = props.line2?.trim();

    return new Address({
      recipientName,
      phone,
      line1,
      line2: line2 ? line2 : null,
      ward,
      district,
      province,
    });
  }

  equals(other: Address): boolean {
    const mine = this.toJSON();
    const theirs = other.toJSON();
    return (Object.keys(mine) as Array<keyof AddressDto>).every(
      (key) => mine[key] === theirs[key],
    );
  }

  toJSON(): AddressDto {
    return {
      recipientName: this.#recipientName,
      phone: this.#phone,
      line1: this.#line1,
      line2: this.#line2,
      ward: this.#ward,
      district: this.#district,
      province: this.#province,
    };
  }
}
