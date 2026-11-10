/**
 * Precise business calculations for orders and sales.
 * All amounts are rounded to 2 decimal places.
 */

export function round2(num: unknown): number {
  const n = typeof num === 'number' ? num : Number(num);
  if (isNaN(n) || !isFinite(n)) {
    return 0;
  }
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateItemAmount(quantity: unknown, rate: unknown): number {
  const q = Number(quantity);
  const r = Number(rate);
  if (isNaN(q) || q <= 0 || isNaN(r) || r < 0) {
    return 0;
  }
  return round2(q * r);
}

export function calculateSubtotal(items: { amount?: number; quantity?: number; rate?: number }[]): number {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  const sum = items.reduce((acc, item) => {
    if (typeof item.amount === 'number' && !isNaN(item.amount)) {
      return acc + item.amount;
    }
    const calculated = calculateItemAmount(item.quantity, item.rate);
    return acc + calculated;
  }, 0);
  return round2(sum);
}

export function validateDiscountPercentage(discount: unknown): { isValid: boolean; error?: string } {
  if (discount === null || discount === undefined || discount === '') {
    return { isValid: false, error: 'Discount percentage is required' };
  }
  const num = Number(discount);
  if (isNaN(num)) {
    return { isValid: false, error: 'Discount must be a valid number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Discount cannot be negative' };
  }
  if (num > 20) {
    return { isValid: false, error: 'Discount cannot exceed 20%' };
  }
  return { isValid: true };
}

export function calculateDiscountAmount(subtotal: unknown, discountPercentage: unknown): number {
  const sub = Number(subtotal);
  const disc = Number(discountPercentage);
  if (isNaN(sub) || sub <= 0 || isNaN(disc) || disc <= 0) {
    return 0;
  }
  const safeDiscount = Math.max(0, Math.min(20, disc));
  return round2((sub * safeDiscount) / 100);
}

export function calculateGrandTotal(subtotal: unknown, discountAmount: unknown): number {
  const sub = Number(subtotal);
  const disc = Number(discountAmount);
  const safeSub = isNaN(sub) || sub < 0 ? 0 : sub;
  const safeDisc = isNaN(disc) || disc < 0 ? 0 : disc;
  const total = Math.max(0, safeSub - safeDisc);
  return round2(total);
}

export interface OrderFinancials {
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  grandTotal: number;
}

export function calculateOrderFinancials(
  items: { quantity: number | string; rate: number | string }[],
  discountPercentage: number | string
): OrderFinancials {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      discountPercentage: 0,
      discountAmount: 0,
      grandTotal: 0,
    };
  }

  const itemAmounts = items.map((i) => calculateItemAmount(i.quantity, i.rate));
  const subtotal = round2(itemAmounts.reduce((a, b) => a + b, 0));
  const rawDiscount = Number(discountPercentage);
  const safeDiscount = isNaN(rawDiscount) ? 0 : Math.max(0, Math.min(20, rawDiscount));
  const discountAmount = calculateDiscountAmount(subtotal, safeDiscount);
  const grandTotal = calculateGrandTotal(subtotal, discountAmount);

  return {
    subtotal,
    discountPercentage: safeDiscount,
    discountAmount,
    grandTotal,
  };
}
