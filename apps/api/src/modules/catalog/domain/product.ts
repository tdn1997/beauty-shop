import { requireNonBlank } from '../../shared/domain/guards';

export enum ProductStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
}

export interface CreateProductProps {
  readonly id: string;
  readonly name: string;
}

/**
 * Sản phẩm: tách định danh (`id` — readonly, theo suốt vòng đời)
 * khỏi phần mô tả (`name`, `status` — đổi được, nhưng chỉ qua method).
 */
export class Product {
  readonly #id: string;
  #name: string;
  #status: ProductStatus;

  private constructor(id: string, name: string, status: ProductStatus) {
    this.#id = id;
    this.#name = name;
    this.#status = status;
  }

  static create(props: CreateProductProps): Product {
    const id = requireNonBlank(props.id, 'id', 'INVALID_PRODUCT');
    const name = requireNonBlank(props.name, 'name', 'INVALID_PRODUCT');
    return new Product(id, name, ProductStatus.Draft);
  }

  get id(): string {
    return this.#id;
  }

  get name(): string {
    return this.#name;
  }

  get status(): ProductStatus {
    return this.#status;
  }

  rename(name: string): void {
    this.#name = requireNonBlank(name, 'name', 'INVALID_PRODUCT');
  }

  publish(): void {
    this.#status = ProductStatus.Active;
  }

  archive(): void {
    this.#status = ProductStatus.Archived;
  }

  isSellable(): boolean {
    return this.#status === ProductStatus.Active;
  }
}
