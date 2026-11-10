import { EntityStatus, Product, StockMovement } from '../types';
import { storage } from '../utils/storage';
import { apiClient } from './apiClient';

export interface CSVRowError {
  rowNumber: number;
  field?: string;
  message: string;
  rawRow?: string;
}

export interface ParsedProductRow {
  rowNumber: number;
  productCode: string;
  productName: string;
  category: string;
  price: number;
  stockQuantity: number;
  status: EntityStatus;
}

export interface CSVParseResult {
  isValid: boolean;
  headerErrors: string[];
  rowErrors: CSVRowError[];
  parsedRows: ParsedProductRow[];
  totalRows: number;
}


function parseCSVRecords(input: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field.trim()); field = '';
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) records.push(row);
  return records;
}

export const EXPECTED_HEADERS = [
  'product_code',
  'product_name',
  'category',
  'price',
  'stock_quantity',
  'status',
];

export const csvService = {
  /**
   * Parses CSV string and performs strict validation.
   * If any error exists (header, duplicate, validation, or existing code in DB),
   * isValid is set to false and all row-level errors are collected.
   */
  parseAndValidateProductCSV(csvContent: string): CSVParseResult {
    let records: string[][];
    try { records = parseCSVRecords(csvContent.replace(/^\uFEFF/, '')); }
    catch (error) {
      return { isValid: false, headerErrors: [error instanceof Error ? error.message : 'Invalid CSV format.'], rowErrors: [], parsedRows: [], totalRows: 0 };
    }

    const result: CSVParseResult = {
      isValid: true,
      headerErrors: [],
      rowErrors: [],
      parsedRows: [],
      totalRows: 0,
    };

    if (records.length === 0) {
      result.isValid = false;
      result.headerErrors.push('The CSV file is empty.');
      return result;
    }

    // 1. Validate headers
    const actualHeaders = records[0].map((h) => h.trim().toLowerCase());
    if (new Set(actualHeaders).size !== actualHeaders.length) {
      result.isValid = false;
      result.headerErrors.push('CSV contains duplicate column headers.');
      return result;
    }

    const missingHeaders = EXPECTED_HEADERS.filter((exp) => !actualHeaders.includes(exp));
    const unexpectedHeaders = actualHeaders.filter((header) => !EXPECTED_HEADERS.includes(header));
    if (missingHeaders.length > 0 || unexpectedHeaders.length > 0 || actualHeaders.length !== EXPECTED_HEADERS.length) {
      result.isValid = false;
      result.headerErrors.push(
        `Invalid CSV headers. Missing: ${missingHeaders.join(', ') || 'none'}; unexpected: ${unexpectedHeaders.join(', ') || 'none'}. Expected: ${EXPECTED_HEADERS.join(', ')}`
      );
      return result;
    }

    // Find indices
    const codeIdx = actualHeaders.indexOf('product_code');
    const nameIdx = actualHeaders.indexOf('product_name');
    const catIdx = actualHeaders.indexOf('category');
    const priceIdx = actualHeaders.indexOf('price');
    const stockIdx = actualHeaders.indexOf('stock_quantity');
    const statusIdx = actualHeaders.indexOf('status');

    const dataLines = records.slice(1);
    result.totalRows = dataLines.length;

    if (dataLines.length === 0) {
      result.isValid = false;
      result.headerErrors.push('The CSV file contains column headers but no product data rows.');
      return result;
    }

    const seenCodesInCsv = new Set<string>();
    const existingProducts = storage.getProducts();
    const existingCodes = new Set(existingProducts.map((p) => p.productCode.toUpperCase()));

    dataLines.forEach((cols, idx) => {
      const rowNumber = idx + 2;
      const line = cols.join(',');

      if (cols.length !== actualHeaders.length) {
        result.rowErrors.push({
          rowNumber,
          message: `Incomplete row: expected ${actualHeaders.length} columns, but found ${cols.length}.`,
          rawRow: line,
        });
        result.isValid = false;
        return;
      }

      const rawCode = cols[codeIdx]?.trim();
      const rawName = cols[nameIdx]?.trim();
      const rawCat = cols[catIdx]?.trim() || 'General';
      const rawPrice = cols[priceIdx]?.trim();
      const rawStock = cols[stockIdx]?.trim();
      const rawStatus = cols[statusIdx]?.trim();

      // Product Code validation
      if (!rawCode) {
        result.rowErrors.push({
          rowNumber,
          field: 'product_code',
          message: 'Product code cannot be empty.',
          rawRow: line,
        });
        result.isValid = false;
      } else {
        const upperCode = rawCode.toUpperCase();
        if (seenCodesInCsv.has(upperCode)) {
          result.rowErrors.push({
            rowNumber,
            field: 'product_code',
            message: `Duplicate product code '${rawCode}' found within this CSV file.`,
            rawRow: line,
          });
          result.isValid = false;
        } else {
          seenCodesInCsv.add(upperCode);
        }

        if (existingCodes.has(upperCode)) {
          result.rowErrors.push({
            rowNumber,
            field: 'product_code',
            message: `Product code '${rawCode}' already exists in the system database.`,
            rawRow: line,
          });
          result.isValid = false;
        }
      }

      // Product Name validation
      if (!rawName) {
        result.rowErrors.push({
          rowNumber,
          field: 'product_name',
          message: 'Product name cannot be empty.',
          rawRow: line,
        });
        result.isValid = false;
      }

      // Price validation
      const priceNum = Number(rawPrice);
      if (rawPrice === '' || !Number.isFinite(priceNum)) {
        result.rowErrors.push({
          rowNumber,
          field: 'price',
          message: `Invalid price '${rawPrice}'. Must be a valid numeric amount.`,
          rawRow: line,
        });
        result.isValid = false;
      } else if (priceNum < 0) {
        result.rowErrors.push({
          rowNumber,
          field: 'price',
          message: `Price cannot be negative (found: ${priceNum}).`,
          rawRow: line,
        });
        result.isValid = false;
      }

      // Stock validation
      const stockNum = Number(rawStock);
      if (rawStock === '' || !Number.isFinite(stockNum)) {
        result.rowErrors.push({
          rowNumber,
          field: 'stock_quantity',
          message: `Invalid stock quantity '${rawStock}'. Must be a valid integer.`,
          rawRow: line,
        });
        result.isValid = false;
      } else if (!Number.isInteger(stockNum)) {
        result.rowErrors.push({
          rowNumber,
          field: 'stock_quantity',
          message: `Stock quantity cannot be a decimal/fraction (found: ${stockNum}). Must be a whole number.`,
          rawRow: line,
        });
        result.isValid = false;
      } else if (stockNum < 0) {
        result.rowErrors.push({
          rowNumber,
          field: 'stock_quantity',
          message: `Stock quantity cannot be negative (found: ${stockNum}).`,
          rawRow: line,
        });
        result.isValid = false;
      }

      // Status validation
      const normalizedStatus =
        rawStatus?.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
      if (
        rawStatus &&
        rawStatus.toLowerCase() !== 'active' &&
        rawStatus.toLowerCase() !== 'inactive'
      ) {
        result.rowErrors.push({
          rowNumber,
          field: 'status',
          message: `Invalid status '${rawStatus}'. Allowed values are 'Active' or 'Inactive'.`,
          rawRow: line,
        });
        result.isValid = false;
      }

      // Add to parsed rows if all basic types are present
      result.parsedRows.push({
        rowNumber,
        productCode: rawCode ? rawCode.toUpperCase() : `ROW-${rowNumber}`,
        productName: rawName || '',
        category: rawCat,
        price: isNaN(priceNum) ? 0 : priceNum,
        stockQuantity: isNaN(stockNum) ? 0 : stockNum,
        status: normalizedStatus as EntityStatus,
      });
    });

    return result;
  },

  /**
   * Commits validated parsed rows into storage atomically.
   * If any error was flagged during parsing, calling this will reject.
   */
  commitImport(
    parsedRows: ParsedProductRow[],
    importedBy: string
  ): { success: boolean; importedCount: number; error?: string } {
    if (storage.getCurrentUser()?.role !== 'ADMIN') return { success: false, importedCount: 0, error: 'Admin permission required to import products.' };
    if (!parsedRows || parsedRows.length === 0) {
      return { success: false, importedCount: 0, error: 'No rows to import.' };
    }

    const existingProducts = storage.getProducts();
    const movements = storage.getStockMovements();
    const existingCodes = new Set(existingProducts.map((product) => product.productCode.trim().toUpperCase()));
    const incomingCodes = new Set<string>();
    for (const row of parsedRows) {
      const code = row.productCode.trim().toUpperCase();
      if (!code || existingCodes.has(code) || incomingCodes.has(code)) return { success: false, importedCount: 0, error: `Duplicate or empty product code: ${code || '(empty)'}. Nothing was imported.` };
      if (!row.productName.trim() || !Number.isFinite(row.price) || row.price < 0 || !Number.isInteger(row.stockQuantity) || row.stockQuantity < 0) return { success: false, importedCount: 0, error: `Invalid data for product ${code}. Nothing was imported.` };
      if (row.status !== 'Active' && row.status !== 'Inactive') return { success: false, importedCount: 0, error: `Invalid status for product ${code}. Nothing was imported.` };
      incomingCodes.add(code);
    }

    let maxMovSeq = movements.reduce((max, m) => {
      const match = m.movementCode.match(/MOV-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const newProducts: Product[] = [];
    const newMovements: StockMovement[] = [];
    const timestamp = new Date().toISOString();

    for (const row of parsedRows) {
      const newProd: Product = {
        id: row.productCode,
        productCode: row.productCode,
        name: row.productName,
        category: row.category,
        price: row.price,
        stockQuantity: row.stockQuantity,
        status: row.status,
        createdAt: timestamp,
        lastStockUpdate: timestamp,
      };
      newProducts.push(newProd);

      if (row.stockQuantity > 0) {
        maxMovSeq += 1;
        const movCode = `MOV-${String(maxMovSeq).padStart(4, '0')}`;
        newMovements.push({
          id: movCode,
          movementCode: movCode,
          productId: newProd.id,
          productCode: newProd.productCode,
          productName: newProd.name,
          movementType: 'Opening Stock',
          quantityChange: row.stockQuantity,
          previousStock: 0,
          newStock: row.stockQuantity,
          reason: 'CSV Bulk Import Opening Stock',
          timestamp,
          createdBy: importedBy,
        });
      }
    }

    // Best-effort all-or-nothing browser-storage commit.
    const commit = storage.commit({ products: [...newProducts, ...existingProducts], stockMovements: [...newMovements, ...movements] });
    if (!commit.success) return { success: false, importedCount: 0, error: commit.error };

    // Format into standard CSV text to sync with Flask backend endpoint
    try {
      const csvLines = [
        'product_code,name,category,price,stock_quantity,status',
        ...newProducts.map(p => `${p.productCode},"${p.name}","${p.category}",${p.price},${p.stockQuantity},${p.status}`)
      ].join('\n');
      const blob = new Blob([csvLines], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'import.csv');
      apiClient.upload('/products/import', formData).catch(e =>
        console.warn('[csvService] Backend import sync error:', e)
      );
    } catch (e) {
      console.warn('[csvService] Error constructing CSV for backend sync:', e);
    }

    return { success: true, importedCount: newProducts.length };
  },

  splitCSVLine(line: string): string[] {
    try { return parseCSVRecords(line)[0] || []; }
    catch { return []; }
  },

  exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
    const escapeCol = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCol).join(','),
      ...rows.map((row) => row.map(escapeCol).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  getSampleValidCSV(): string {
    return `product_code,product_name,category,price,stock_quantity,status
PRD-101,Logitech MX Master 3S,Peripherals,8995,15,Active
PRD-102,Keychron K2 Mechanical Keyboard,Accessories,7499,25,Active
PRD-103,Sony WH-1000XM5 Headphones,Audio,26990,8,Active
PRD-104,Samsung T7 1TB Portable SSD,Storage,9499,30,Active
PRD-105,Dell UltraSharp 32-inch 4K,Displays,48500,5,Active`;
  },

  getSampleInvalidCSV(): string {
    return `product_code,product_name,category,price,stock_quantity,status
PRD-001,Existing Keyboard Duplicate,Accessories,1500,20,Active
PRD-999,Invalid Negative Price Item,Components,-450,10,Active
PRD-888,Decimal Stock Quantity Item,Storage,3200,12.5,Active
PRD-777,Negative Stock Quantity Item,Power,1200,-5,Active
,Missing Product Code Item,Peripherals,900,15,Active
PRD-666,Invalid Status Item,Audio,2500,10,Pending`;
  },
};
