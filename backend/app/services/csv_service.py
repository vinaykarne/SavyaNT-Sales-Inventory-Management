"""
SavyaNT Sales Order & Inventory Management System
CSV Product Import Service

Handles bulk CSV product imports with strict all-or-nothing transaction semantics,
row-level validation, internal duplicate detection, and automated Opening Stock movement creation.
"""

import csv
from decimal import Decimal, InvalidOperation
import io
from app.extensions import db
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.utils.concurrency import generate_movement_code
from app.utils.exceptions import BusinessConflictError, ValidationError

REQUIRED_HEADERS = {"product_code", "name", "category", "price", "stock_quantity", "status"}


class CSVService:
    """Processes product CSV files with strict all-or-nothing transactional integrity."""

    @staticmethod
    def import_products_csv(file_storage, current_user_id: int | None = None) -> dict:
        """Parses, validates, and atomically inserts products and initial stock movements from CSV."""
        if not file_storage or not file_storage.filename:
            raise ValidationError("No file uploaded. Please upload a valid .csv file.")

        filename = file_storage.filename.lower()
        if not filename.endswith(".csv"):
            raise ValidationError("Invalid file extension. Only CSV files are supported.")

        # Read contents
        try:
            content_bytes = file_storage.read()
            # Decode using utf-8 with fallback to utf-8-sig (handles Excel BOM) or latin-1
            try:
                content_text = content_bytes.decode("utf-8-sig")
            except UnicodeDecodeError:
                content_text = content_bytes.decode("latin-1")
        except Exception as e:
            raise ValidationError(f"Could not read uploaded file: {str(e)}")

        if not content_text.strip():
            raise ValidationError("Uploaded CSV file is empty.")

        csv_file = io.StringIO(content_text.strip())
        reader = csv.reader(csv_file)

        # 1. Read and validate headers
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValidationError("CSV file contains no rows.")

        normalized_headers = [h.strip().lower().replace(" ", "_") for h in raw_headers]
        header_map = {name: idx for idx, name in enumerate(normalized_headers)}

        missing_headers = [req for req in REQUIRED_HEADERS if req not in header_map]
        if missing_headers:
            raise ValidationError(
                f"Missing required CSV column(s): {', '.join(missing_headers)}. "
                f"Required headers are: {', '.join(sorted(REQUIRED_HEADERS))}."
            )

        # 2. Parse and validate every row
        rows_to_insert = []
        errors = []
        seen_codes_in_csv = set()

        for line_num, row in enumerate(reader, start=2):
            if not row or all(not cell.strip() for cell in row):
                continue  # skip blank lines

            # Pad row if fewer columns than headers
            while len(row) < len(normalized_headers):
                row.append("")

            def get_val(col_name: str) -> str:
                return row[header_map[col_name]].strip()

            raw_code = get_val("product_code").upper()
            raw_name = get_val("name")
            raw_category = get_val("category") or "General"
            raw_price = get_val("price")
            raw_stock = get_val("stock_quantity")
            raw_status = get_val("status") or "Active"

            row_errors = []

            # Validate Product Code
            if not raw_code:
                row_errors.append("Product code is missing.")
            elif raw_code in seen_codes_in_csv:
                row_errors.append(f"Duplicate product code '{raw_code}' found within the CSV file.")
            else:
                seen_codes_in_csv.add(raw_code)

            # Validate Name
            if not raw_name:
                row_errors.append("Product name is missing.")

            # Validate Price
            price_dec = Decimal("0.00")
            try:
                price_dec = Decimal(raw_price)
                if price_dec < Decimal("0.00"):
                    row_errors.append("Price cannot be negative.")
                else:
                    price_dec = price_dec.quantize(Decimal("0.01"))
            except (InvalidOperation, TypeError, ValueError):
                row_errors.append(f"Invalid price '{raw_price}': Must be a valid numeric amount.")

            # Validate Stock Quantity
            stock_int = 0
            try:
                stock_int = int(raw_stock)
                if stock_int < 0:
                    row_errors.append("Stock quantity cannot be negative.")
            except (TypeError, ValueError):
                row_errors.append(f"Invalid stock quantity '{raw_stock}': Must be an integer.")

            # Validate Status
            norm_status = raw_status.capitalize()
            if norm_status not in ("Active", "Inactive"):
                row_errors.append(f"Invalid status '{raw_status}': Must be 'Active' or 'Inactive'.")

            if row_errors:
                errors.append(f"Row {line_num}: {'; '.join(row_errors)}")
            else:
                rows_to_insert.append({
                    "line_num": line_num,
                    "product_code": raw_code,
                    "name": raw_name,
                    "category": raw_category,
                    "price": price_dec,
                    "stock_quantity": stock_int,
                    "status": norm_status,
                })

        # Check existing product codes in DB
        if rows_to_insert:
            codes_to_check = [r["product_code"] for r in rows_to_insert]
            existing_products = Product.query.filter(Product.product_code.in_(codes_to_check)).all()
            for ep in existing_products:
                errors.append(f"Product code '{ep.product_code}' already exists in the database.")

        # ALL-OR-NOTHING ENFORCEMENT: If any row fails, reject entire batch
        if errors:
            raise ValidationError(
                f"CSV Import aborted: {len(errors)} error(s) encountered. "
                "Zero products were imported due to all-or-nothing transactional requirements.",
                details=errors[:20]  # Return up to 20 detailed error messages
            )

        if not rows_to_insert:
            raise ValidationError("CSV file contains no valid data rows to import.")

        # 3. Insert all records in single atomic database transaction
        inserted_products = []
        for r in rows_to_insert:
            product = Product(
                product_code=r["product_code"],
                name=r["name"],
                category=r["category"],
                price=r["price"],
                stock_quantity=r["stock_quantity"],
                status=r["status"],
            )
            db.session.add(product)
            db.session.flush()

            # If opening stock > 0, create Opening Stock movement
            if r["stock_quantity"] > 0:
                mov_code = generate_movement_code()
                mov = StockMovement(
                    movement_code=mov_code,
                    product_id=product.id,
                    movement_type="Opening Stock",
                    quantity_change=r["stock_quantity"],
                    previous_stock=0,
                    new_stock=r["stock_quantity"],
                    reason="Bulk CSV Import opening stock",
                    created_by=current_user_id,
                )
                db.session.add(mov)

            inserted_products.append(product.to_dict())

        db.session.commit()

        return {
            "importedCount": len(inserted_products),
            "products": inserted_products,
        }
