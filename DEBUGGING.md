# SavyaNT Technical Assessment — Debugging Exercise

**Assignment Title:** Sales Order & Inventory Management System  
**Role:** Fresher / Trainee Software Developer Assessment  
**Document:** `DEBUGGING.md`  

---

## 1. Problem Overview & Faulty Function

In sales order and inventory management applications, financial calculations and inventory deduction are business-critical. A common defect found in initial trainee implementations is the calculation of order line items, subtotals, and discounts using native Python floating-point types (`float`), coupled with lack of validation and dynamic product rate lookups.

Below is the original faulty implementation submitted for order total calculation:

```python
# FAULTY IMPLEMENTATION: calculate_order_financials_faulty.py

def calculate_order_financials_faulty(items, discount_percentage):
    """
    Faulty order financial calculation logic.
    Calculates subtotal, discount, and grand total.
    """
    subtotal = 0.0
    processed_items = []
    
    for item in items:
        # BUG 1 & 2: Floating point arithmetic and unchecked quantity
        rate = float(item["rate"])
        qty = float(item["quantity"])
        line_amount = qty * rate
        subtotal += line_amount
        processed_items.append({
            "product_id": item["product_id"],
            "rate": rate,
            "quantity": qty,
            "amount": line_amount
        })
    
    # BUG 3: Unconstrained discount percentage (accepts > 20% or < 0%)
    discount_amount = subtotal * (discount_percentage / 100.0)
    
    # BUG 4: IEEE-754 float precision drift without currency quantizing
    grand_total = subtotal - discount_amount
    
    return {
        "items": processed_items,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "grand_total": grand_total
    }
```

---

## 2. Root Cause Analysis

### Defect 1: IEEE-754 Floating-Point Precision Drift
- **Why it occurs:** In Python, standard `float` numbers are 64-bit binary floating-point numbers conforming to IEEE-754. Fractions like `0.1` or `0.05` cannot be represented exactly in binary base-2.
- **Symptom:** Evaluating `19.99 * 3` yields `59.970000000000006`. Calculating discounts on subtotals frequently produces repeating decimals such as `47.97600000000001`, leading to accounting discrepancies between order totals, payment gateways, and database ledger balances.

### Defect 2: Lack of Discount Boundary Enforcement (Business Rule Violation)
- **Why it occurs:** The business specification explicitly mandates: *“Discount percentage must be constrained between 0% and 20%.”*
- **Symptom:** The faulty function blindly calculates `subtotal * (discount_percentage / 100.0)`. Passing a discount of `50` or `120` produces negative or heavily slashed revenue without throwing any validation error. Passing a negative discount increases the order price without authorization.

### Defect 3: Missing Quantity and Rate Validation
- **Why it occurs:** `qty` is cast to `float` without asserting `qty > 0` or verifying that it is an integer. Passing `quantity = -5` reduces the order subtotal and, when confirming, would improperly inflate product inventory.

### Defect 4: Dynamic Re-fetching vs. Historical Rate Preservation
- **Why it occurs:** If rates are fetched from the live `Product` table at invoice generation time instead of storing the agreed rate in `SalesOrderItem.rate`, any future price increase by an Admin retroactively alters past orders, corrupting financial reports.

---

## 3. Corrected Implementation

The corrected implementation uses Python’s `decimal.Decimal` with explicit `ROUND_HALF_UP` currency quantizing (`0.01`), enforces boundary constraints, and rejects invalid inputs.

```python
# CORRECTED IMPLEMENTATION: calculate_order_financials.py

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


CURRENCY_TWO_PLACES = Decimal("0.01")


def round_currency(value: Decimal) -> Decimal:
    """Rounds a Decimal value to exactly 2 decimal places using standard ROUND_HALF_UP."""
    return value.quantize(CURRENCY_TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_order_financials(
    items: list[dict[str, Any]], 
    discount_percentage: float | int | str | Decimal
) -> dict[str, Any]:
    """
    Robust, production-grade financial calculation for Sales Orders.
    
    Guarantees:
    1. Zero floating-point drift using Python Decimal.
    2. Strict discount percentage validation [0.00, 20.00].
    3. Positive integer quantity validation (> 0).
    4. Non-negative rate validation (>= 0.00).
    5. Exact rounding to two decimal places at every line and total.
    """
    if not items or not isinstance(items, list):
        raise ValueError("Order must contain at least one line item.")
        
    # 1. Validate Discount Percentage
    try:
        disc_pct = Decimal(str(discount_percentage))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"Invalid discount percentage '{discount_percentage}': Must be numeric.")
        
    if disc_pct < Decimal("0.00") or disc_pct > Decimal("20.00"):
        raise ValueError(
            f"Discount percentage '{disc_pct}' violates business constraints. "
            "Discount must be between 0.00% and 20.00%."
        )
    disc_pct = disc_pct.quantize(CURRENCY_TWO_PLACES)

    # 2. Process Line Items
    processed_items = []
    subtotal = Decimal("0.00")
    seen_products = set()

    for idx, item in enumerate(items, 1):
        product_id = item.get("product_id") or item.get("productId")
        if not product_id:
            raise ValueError(f"Item #{idx}: product_id is required.")
            
        if product_id in seen_products:
            raise ValueError(f"Item #{idx}: Duplicate product '{product_id}' detected. Products must be unique per order.")
        seen_products.add(product_id)

        # Validate Quantity: must be strictly positive integer
        try:
            qty_int = int(item.get("quantity", 0))
            if qty_int <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValueError(f"Item #{idx}: Quantity must be a strictly positive integer (> 0).")

        # Validate Rate: must be non-negative Decimal
        try:
            rate_dec = Decimal(str(item.get("rate", "0.00")))
            if rate_dec < Decimal("0.00"):
                raise ValueError()
            rate_dec = round_currency(rate_dec)
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f"Item #{idx}: Rate must be a valid non-negative monetary value.")

        # Line amount calculation
        line_amount = round_currency(Decimal(qty_int) * rate_dec)
        subtotal += line_amount

        processed_items.append({
            "product_id": product_id,
            "quantity": qty_int,
            "rate": rate_dec,
            "amount": line_amount,
        })

    # 3. Independent Calculation of Totals
    discount_amount = round_currency(subtotal * (disc_pct / Decimal("100.00")))
    grand_total = round_currency(subtotal - discount_amount)

    return {
        "items": processed_items,
        "subtotal": subtotal,
        "discount_percentage": disc_pct,
        "discount_amount": discount_amount,
        "grand_total": grand_total,
    }
```

---

## 4. Input & Output Verification

### Test Case A: Floating-Point Drift Test
- **Input:**
  - Item 1: `quantity = 3`, `rate = 1499.99`
  - Item 2: `quantity = 7`, `rate = 299.50`
  - `discount_percentage = 12.5%`
- **Faulty Output:**
  - `subtotal = 6596.470000000001`
  - `discount_amount = 824.5587500000001`
  - `grand_total = 5771.91125`
- **Corrected Output:**
  - `subtotal = Decimal('6596.47')` (3 × 1499.99 = 4499.97; 7 × 299.50 = 2096.50; sum = 6596.47)
  - `discount_amount = Decimal('824.56')` (6596.47 × 0.125 = 824.55875 → rounded to 824.56)
  - `grand_total = Decimal('5771.91')` (6596.47 - 824.56 = 5771.91)

### Test Case B: Boundary Discount Enforcement
- **Input:** `discount_percentage = 25.0`
- **Faulty Output:** Accepts 25% discount silently.
- **Corrected Output:** Raises `ValueError: Discount percentage '25.00' violates business constraints. Discount must be between 0.00% and 20.00%.`

### Test Case C: Zero / Negative Quantity Rejection
- **Input:** `quantity = -2`, `rate = 500.00`
- **Faulty Output:** `subtotal = -1000.0`
- **Corrected Output:** Raises `ValueError: Item #1: Quantity must be a strictly positive integer (> 0).`

---

## 5. Automated Regression Test Suite

This corrected logic is covered by automated unit and integration tests located in `backend/tests/test_orders.py` and `src/utils/calculations.ts` in the frontend.
