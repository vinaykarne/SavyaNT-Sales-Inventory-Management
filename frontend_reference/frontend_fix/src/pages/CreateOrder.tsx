import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Eye,
  ArrowLeft,
  AlertCircle,
  Info,
  Calendar,
  User,
} from 'lucide-react';
import { SalesOrder } from '../types';
import { orderService } from '../services/orderService';
import { customerService } from '../services/customerService';
import { productService } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  calculateItemAmount,
  calculateOrderFinancials,
  validateDiscountPercentage,
} from '../utils/calculations';
import { formatCurrency, getTodayDateString } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OrderInvoiceModal } from '../components/OrderInvoiceModal';

interface FormItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  rate: number;
  availableStock: number;
  quantity: number;
  amount: number;
}

export const CreateOrder: React.FC = () => {
  const { currentUser, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const activeCustomers = useMemo(() => customerService.getActive(), []);
  const activeProducts = useMemo(() => productService.getActive(), []);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    activeCustomers[0]?.id || ''
  );
  const [orderDate, setOrderDate] = useState<string>(getTodayDateString());
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Items State (start with 1 empty item)
  const [items, setItems] = useState<FormItem[]>([
    {
      id: `item-${Date.now()}`,
      productId: '',
      productCode: '',
      productName: '',
      rate: 0,
      availableStock: 0,
      quantity: 1,
      amount: 0,
    },
  ]);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    return activeCustomers.find((c) => c.id === selectedCustomerId);
  }, [activeCustomers, selectedCustomerId]);

  // Handle Product Selection on a Row
  const handleProductChange = (rowIndex: number, productId: string) => {
    const product = activeProducts.find((p) => p.id === productId);
    const updated = [...items];

    if (!product) {
      updated[rowIndex] = {
        ...updated[rowIndex],
        productId: '',
        productCode: '',
        productName: '',
        rate: 0,
        availableStock: 0,
        amount: 0,
      };
      setItems(updated);
      return;
    }

    if (product.status !== 'Active') {
      toast.warning(`Product "${product.name}" is currently Inactive and cannot be selected.`);
      return;
    }

    // Check duplicate
    const isDuplicate = updated.some(
      (item, idx) => idx !== rowIndex && item.productId === productId
    );
    if (isDuplicate) {
      toast.warning(`"${product.name}" is already in this order. Duplicate products are not permitted.`);
      return;
    }

    const rate = product.price; // Locked-in demo price
    const qty = updated[rowIndex].quantity || 1;
    const amount = calculateItemAmount(qty, rate);

    updated[rowIndex] = {
      ...updated[rowIndex],
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      rate,
      availableStock: product.stockQuantity,
      quantity: qty,
      amount,
    };

    setItems(updated);
    setFormErrors([]);
  };

  // Handle Quantity Change on a Row
  const handleQuantityChange = (rowIndex: number, qtyString: string) => {
    const qty = parseInt(qtyString, 10);
    const updated = [...items];
    const safeQty = isNaN(qty) ? 0 : qty;
    const rate = updated[rowIndex].rate || 0;

    updated[rowIndex] = {
      ...updated[rowIndex],
      quantity: safeQty,
      amount: calculateItemAmount(safeQty, rate),
    };

    setItems(updated);
    setFormErrors([]);
  };

  // Add Item Row
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: '',
        productCode: '',
        productName: '',
        rate: 0,
        availableStock: 0,
        quantity: 1,
        amount: 0,
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (rowIndex: number) => {
    if (items.length <= 1) {
      toast.warning('An order must contain at least one item.');
      return;
    }
    const updated = items.filter((_, idx) => idx !== rowIndex);
    setItems(updated);
  };

  // Calculations
  const financials = useMemo(() => {
    const rawItems = items.map((i) => ({ quantity: i.quantity, rate: i.rate }));
    return calculateOrderFinancials(rawItems, discountPercentage);
  }, [items, discountPercentage]);

  // Validation
  const validateOrder = (): boolean => {
    const errors: string[] = [];

    if (!selectedCustomerId) {
      errors.push('Please select a customer for the order.');
    }

    if (!orderDate) {
      errors.push('Please select a valid order date.');
    }

    if (items.length === 0) {
      errors.push('Order must contain at least one product.');
    }

    const unselectedItem = items.some((i) => !i.productId);
    if (unselectedItem) {
      errors.push('Please select a product for all item rows.');
    }

    // Validate quantities strictly
    for (const item of items) {
      const q = Number(item.quantity);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        errors.push(`Invalid quantity for item "${item.productName || 'unnamed'}". Must be positive whole integer.`);
      }
    }

    // Duplicate check
    const productIds = items.map((i) => i.productId).filter(Boolean);
    if (new Set(productIds).size !== productIds.length) {
      errors.push('Duplicate products detected. Each product can only be added once.');
    }

    // Discount check
    const discValidation = validateDiscountPercentage(discountPercentage);
    if (!discValidation.isValid) {
      errors.push(discValidation.error || 'Invalid discount percentage');
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  // Save as Draft
  const handleSaveAsDraft = () => {
    if (!validateOrder()) return;

    const res = orderService.createOrder(
      {
        customerId: selectedCustomerId,
        orderDate,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discountPercentage,
        notes,
        status: 'Draft',
      },
      currentUser?.name || 'User',
      role || 'SALES'
    );

    if (res.success && res.order) {
      toast.success(`Draft order ${res.order.orderNumber} saved successfully.`);
      navigate(`/orders/${res.order.id}`);
    } else {
      toast.error(res.error || 'Failed to save draft order');
    }
  };

  // Prompt Confirmation Modal
  const handlePromptConfirm = () => {
    if (!validateOrder()) return;

    // Check stock shortages to warn user immediately before submitting
    const shortages: string[] = [];
    const freshProducts = productService.getAll();

    items.forEach((item) => {
      const freshProd = freshProducts.find((p) => p.id === item.productId);
      const stock = freshProd ? freshProd.stockQuantity : 0;
      if (item.quantity > stock) {
        shortages.push(
          `• ${item.productName}: Requested ${item.quantity}, but only ${stock} in warehouse stock.`
        );
      }
    });

    if (shortages.length > 0) {
      setFormErrors([
        'Insufficient stock to confirm this order. The entire order will be rejected unless stock is increased or order saved as Draft:',
        ...shortages,
      ]);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Confirm and Deduct Stock
  const handleConfirmOrder = () => {
    const res = orderService.createOrder(
      {
        customerId: selectedCustomerId,
        orderDate,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discountPercentage,
        notes,
        status: 'Confirmed',
      },
      currentUser?.name || 'User',
      role || 'SALES'
    );

    setIsConfirmModalOpen(false);

    if (res.success && res.order) {
      toast.success(
        `Order ${res.order.orderNumber} confirmed! Stock has been deducted atomically from warehouse inventory.`
      );
      navigate(`/orders/${res.order.id}`);
    } else {
      toast.error(res.error || 'Failed to confirm order');
    }
  };

  // Generate Mock Preview Order for Invoice Modal
  const handlePreview = () => {
    if (!validateOrder()) return;

    const mockOrder: SalesOrder = {
      id: 'SO-PREVIEW',
      orderNumber: 'SO-2026-DRAFT',
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Selected Customer',
      orderDate,
      items: items.map((i, idx) => ({
        id: `mock-${idx}`,
        productId: i.productId,
        productCode: i.productCode,
        productName: i.productName,
        rate: i.rate,
        quantity: i.quantity,
        amount: i.amount,
      })),
      subtotal: financials.subtotal,
      discountPercentage: financials.discountPercentage,
      discountAmount: financials.discountAmount,
      grandTotal: financials.grandTotal,
      createdBy: currentUser?.name || 'Sales Representative',
      createdByRole: role || 'SALES',
      status: 'Draft',
      notes,
      createdAt: new Date().toISOString(),
    };

    setPreviewOrder(mockOrder);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Create New Sales Order
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select customer, add products with live stock verification, and set discount (0-20%).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePreview}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
        >
          <Eye className="w-4 h-4 text-slate-500" />
          Preview Invoice
        </button>
      </div>

      {/* Validation Banner */}
      {formErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please correct the following errors before submitting:</span>
          </div>
          {formErrors.map((err, i) => (
            <p key={i} className="pl-6 font-medium">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
        {/* Customer & Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-6 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Customer <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition"
              >
                {activeCustomers.length === 0 ? (
                  <option value="">No Active Customers Available</option>
                ) : (
                  activeCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city}) - {c.email}
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedCustomer && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                ID: <span className="font-mono text-blue-600">{selectedCustomer.id}</span> • +91{' '}
                {selectedCustomer.mobile}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Order Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Auto-populated with current date</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Sales Representative
            </label>
            <input
              type="text"
              disabled
              value={`${currentUser?.name} (${role === 'ADMIN' ? 'Admin' : 'Sales'})`}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Logged-in session creator</p>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Order Items ({items.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 min-w-[260px]">Product Selection</th>
                  <th className="py-3 px-3 w-28 text-right">Unit Rate (₹)</th>
                  <th className="py-3 px-3 w-32 text-center">Available Stock</th>
                  <th className="py-3 px-3 w-28 text-center">Quantity</th>
                  <th className="py-3 px-3 w-32 text-right">Item Amount (₹)</th>
                  <th className="py-3 px-3 w-12 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const isStockInsufficient =
                    item.productId && item.quantity > item.availableStock;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 transition ${
                        isStockInsufficient ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* Product Dropdown */}
                      <td className="py-3 px-3">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 transition"
                        >
                          <option value="">-- Select Product --</option>
                          {activeProducts.map((p) => {
                            const disabled = items.some(
                              (other, i) => i !== index && other.productId === p.id
                            );
                            return (
                              <option key={p.id} value={p.id} disabled={disabled}>
                                {p.name} ({p.productCode}) - ₹{p.price} [Stock: {p.stockQuantity}]
                                {disabled ? ' (Already added)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        {item.productCode && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            SKU: {item.productCode}
                          </span>
                        )}
                      </td>

                      {/* Locked Rate */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                        {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                      </td>

                      {/* Stock Snapshot */}
                      <td className="py-3 px-3 text-center">
                        {item.productId ? (
                          <div className="flex flex-col items-center">
                            <span
                              className={`font-mono font-bold text-xs ${
                                item.availableStock <= 0
                                  ? 'text-rose-600'
                                  : item.availableStock <= 10
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {item.availableStock} units
                            </span>
                            {isStockInsufficient && (
                              <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                                Insufficient!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Quantity Input */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity || ''}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          disabled={!item.productId}
                          className={`w-20 p-2 text-center font-mono font-bold text-xs rounded-lg border focus:outline-hidden transition ${
                            isStockInsufficient
                              ? 'border-rose-400 bg-rose-50 text-rose-900'
                              : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                      </td>

                      {/* Item Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {item.amount > 0 ? formatCurrency(item.amount) : '₹0.00'}
                      </td>

                      {/* Remove Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary & Notes Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Order Notes &amp; Special Instructions
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivery terms, packaging instructions, invoice reference..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
            />
            <div className="mt-3 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                <strong>Stock Logic:</strong> Saving as <em>Draft</em> does not deduct stock.
                Confirming immediately will atomically check warehouse levels and deduct inventory.
              </p>
            </div>
          </div>

          {/* Calculations Box */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
              Calculation Breakdown
            </h4>

            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal (Sum of Items):</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(financials.subtotal)}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span>Discount Percentage:</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(0% to 20% max)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={discountPercentage}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setDiscountPercentage(isNaN(val) ? 0 : Math.max(0, Math.min(20, val)));
                    }}
                    className="w-16 p-1 text-center font-mono font-bold text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                  />
                  <span className="text-slate-500 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount Amount:</span>
                <span className="font-mono text-rose-600 font-medium">
                  -{formatCurrency(financials.discountAmount)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-slate-900">
              <span className="text-sm font-extrabold">Grand Total:</span>
              <span className="text-xl font-black font-mono text-blue-600">
                {formatCurrency(financials.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAsDraft}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-500" />
            Save as Draft
          </button>

          <button
            type="button"
            onClick={handlePromptConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm &amp; Deduct Stock
          </button>
        </div>
      </div>

      {/* Confirmation Dialog before Finalizing */}
      <ConfirmDialog
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmOrder}
        title="Confirm Sales Order"
        message={`Are you sure you want to finalize and CONFIRM this sales order for ${formatCurrency(
          financials.grandTotal
        )}?`}
        confirmLabel="Yes, Confirm and Deduct Stock"
        variant="primary"
        details={
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">Inventory Impact:</p>
            <p>
              Confirming will automatically decrement available quantities for all ordered products
              and generate "Sales Deduction" audit movements. Once confirmed, this order becomes
              read-only.
            </p>
          </div>
        }
      />

      {/* Invoice Preview Modal */}
      <OrderInvoiceModal
        isOpen={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        order={previewOrder}
      />
    </div>
  );
};
