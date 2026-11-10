/**
 * Input and business rule validation functions
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validateIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  // Allows 10-digit standard Indian mobile numbers, with optional +91 or 0 prefix
  const cleaned = mobile.replace(/[\s-]/g, '');
  const re = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  return re.test(cleaned);
}

export function isPositiveInteger(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

export function isNonNegativeInteger(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return Number.isInteger(num) && num >= 0;
}

export function isNonNegativeNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

export function validateCustomerForm(data: {
  name?: string;
  email?: string;
  mobile?: string;
  city?: string;
  status?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Customer name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Customer name must be at least 2 characters';
  }

  if (!data.email || data.email.trim().length === 0) {
    errors.email = 'Email address is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address (e.g. user@domain.com)';
  }

  if (!data.mobile || data.mobile.trim().length === 0) {
    errors.mobile = 'Mobile number is required';
  } else if (!validateIndianMobile(data.mobile)) {
    errors.mobile = 'Enter a valid 10-digit mobile number (e.g. 9876543210)';
  }

  if (!data.city || data.city.trim().length === 0) {
    errors.city = 'City is required';
  }

  if (!data.status || !['Active', 'Inactive'].includes(data.status)) {
    errors.status = 'Status must be either Active or Inactive';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateProductForm(
  data: {
    productCode?: string;
    name?: string;
    category?: string;
    price?: number | string;
    stockQuantity?: number | string;
    status?: string;
  },
  existingCodes: string[] = []
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.productCode || data.productCode.trim().length === 0) {
    errors.productCode = 'Product code is required';
  } else {
    const code = data.productCode.trim().toUpperCase();
    if (existingCodes.includes(code)) {
      errors.productCode = `Product code '${code}' already exists`;
    }
  }

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Product name is required';
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.category = 'Category is required';
  }

  if (data.price === undefined || data.price === null || data.price === '') {
    errors.price = 'Price is required';
  } else if (!isNonNegativeNumber(data.price)) {
    errors.price = 'Price cannot be negative';
  }

  if (data.stockQuantity === undefined || data.stockQuantity === null || data.stockQuantity === '') {
    errors.stockQuantity = 'Stock quantity is required';
  } else if (!isNonNegativeInteger(data.stockQuantity)) {
    errors.stockQuantity = 'Stock quantity must be a non-negative whole number';
  }

  if (!data.status || !['Active', 'Inactive'].includes(data.status)) {
    errors.status = 'Status must be either Active or Inactive';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStockAdjustment(
  currentStock: number,
  type: 'Increase' | 'Decrease',
  quantity: number | string,
  reason: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isPositiveInteger(quantity)) {
    errors.quantity = 'Quantity must be a positive whole number';
  }

  if (!reason || reason.trim().length < 3) {
    errors.reason = 'Reason is mandatory (at least 3 characters)';
  }

  const qty = Number(quantity) || 0;
  if (type === 'Decrease' && currentStock - qty < 0) {
    errors.quantity = `Cannot decrease by ${qty}. Stock would become negative (Current: ${currentStock})`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
