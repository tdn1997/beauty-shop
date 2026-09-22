export function multiplyMinorUnits(amount: string, quantity: number): string {
  if (!/^\d+$/.test(amount) || !Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error('Invalid money multiplication');
  return (BigInt(amount) * BigInt(quantity)).toString();
}
export function sumMinorUnits(lines: readonly { price: string; quantity: number }[]): string {
  return lines
    .reduce((sum, line) => sum + BigInt(multiplyMinorUnits(line.price, line.quantity)), 0n)
    .toString();
}
