'use client';
import { Button } from './ui/button';
export default function QuantityStepper({
  variantId,
  name,
  quantity,
  updateQuantity,
}: {
  variantId: string;
  name: string;
  quantity: number;
  updateQuantity: (variantId: string, n: number) => void;
}) {
  return (
    <div className="quantity-stepper">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={`Giảm số lượng ${name}`}
        disabled={quantity === 1}
        onClick={() => updateQuantity(variantId, quantity - 1)}
      >
        −
      </Button>
      <input
        className="input input--qty tabular"
        type="number"
        inputMode="numeric"
        min={1}
        value={quantity}
        aria-label={`Số lượng cho ${name}`}
        onChange={(e) => updateQuantity(variantId, parseInt(e.target.value, 10) || 1)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={`Tăng số lượng ${name}`}
        onClick={() => updateQuantity(variantId, quantity + 1)}
      >
        +
      </Button>
    </div>
  );
}
