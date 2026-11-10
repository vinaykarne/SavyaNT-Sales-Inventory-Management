import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
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
import { formatCurrency } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

export const EditOrder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const activeCustomers = useMemo(() => customerService.getActive(), []);
  const allProducts = useMemo(() => productService.getAll(), []);

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<FormItem[]>([]);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    const existing = orderService.getById(id);
    if (!existing) {
      toast.error('Order not found.');
      navigate('/orders');
      return;
    }

    // Ownership check: Prevent editing orders belonging to other users
    if (!orderService.canUserModifyOrder(existing, currentUser)) {
      setAccessDenied(true);
      toast.error(
        `Access Denied: Order ${existing.orderNumber} was created by ${existing.createdBy}. Sales users can only edit their own orders.`
      );
      return;
    }

    if (existing.status !== 'Draft') {
      toast.warning(`Order ${existing.orderNumber} is "${existing.status}" and cannot be edited.`);
      navigate(`/orders/${existing.id}`);
      return;
    }

    setAccessDenied(false);
    setOrder(existing);
    setSelectedCustomerId(existing.customerId);
    setOrderDate(existing.orderDate);
    setDiscountPercentage(existing.discountPercentage);
    setNotes(existing.notes || '');

    const mappedItems: FormItem[] = existing.items.map((item) => {
      const prod = allProducts.find((p) => p.id === item.productId);
      return {
        id: item.id,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        rate: item.rate, // Preserved rate
        availableStock: prod ? prod.stockQuantity : 0,
        quantity: item.quantity,
        amount: item.amount,
      };
    });

    setItems(mappedItems);
  }, [id, navigate, allProducts, currentUser, toast]);

  const handleProductChange = (rowIndex: number, productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    const updated = [...items];

    if (!product) return;

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

    const rate = product.price;
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
  };

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
  };

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

  const handleRemoveItem = (rowIndex: number) => {
    if (items.length <= 1) {
      toast.warning('An order must contain at least one item.');
      return;
    }
    setItems(items.filter((_, idx) => idx !== rowIndex));
  };

  const financials = useMemo(() => {
    const rawItems = items.map((i) => ({ quantity: i.quantity, rate: i.rate }));
    return calculateOrderFinancials(rawItems, discountPercentage);
  }, [items, discountPercentage]);

  const validateOrder = (): boolean => {
    const errors: string[] = [];

    if (!selectedCustomerId) errors.push('Please select an active customer.');
    if (!orderDate) errors.push('Please select a valid order date.');
    if (items.length === 0) errors.push('Order must have at least one product.');
    if (items.some((i) => !i.productId)) errors.push('Please select a product for all rows.');

    // Validate quantities strictly
    for (const i of items) {
      const q = Number(i.quantity);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        errors.push(`Invalid quantity for item "${i.productName || 'unnamed'}". Must be positive whole integer.`);
      }
    }

    // Check inactive products
    for (const i of items) {
      if (i.productId) {
        const prod = allProducts.find((p) => p.id === i.productId);
        if (prod && prod.status !== 'Active') {
          errors.push(`Product "${prod.name}" (${prod.productCode}) is currently Inactive and cannot be ordered.`);
        }
      }
    }

    const productIds = items.map((i) => i.productId).filter(Boolean);
    if (new Set(productIds).size !== productIds.length) {
      errors.push('Duplicate products detected.');
    }

    const discCheck = validateDiscountPercentage(discountPercentage);
    if (!discCheck.isValid) errors.push(discCheck.error || 'Invalid discount.');

    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleSaveDraftChanges = () => {
    if (!order || !validateOrder()) return;

    const res = orderService.updateDraftOrder(
      order.id,
      {
        customerId: selectedCustomerId,
        orderDate,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discountPercentage,
        notes,
      },
      currentUser
    );

    if (res.success && res.order) {
      toast.success(`Draft order ${res.order.orderNumber} updated successfully.`);
      navigate(`/orders/${res.order.id}`);
    } else {
      toast.error(res.error || 'Failed to update order');
    }
  };

  const handlePromptConfirm = () => {
    if (!validateOrder()) return;

    // Check fresh stock shortages
    const shortages: string[] = [];
    const freshProducts = productService.getAll();

    items.forEach((item) => {
      const freshProd = freshProducts.find((p) => p.id === item.productId);
      const stock = freshProd ? freshProd.stockQuantity : 0;
      if (item.quantity > stock) {
        shortages.push(
          `• ${item.productName}: Requested ${item.quantity}, Available: ${stock}`
        );
      }
    });

    if (shortages.length > 0) {
      setFormErrors([
        'Cannot confirm order due to insufficient stock in warehouse:',
        ...shortages,
      ]);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmOrder = () => {
    if (!order) return;

    // First save changes with user context
    const updateRes = orderService.updateDraftOrder(
      order.id,
      {
        customerId: selectedCustomerId,
        orderDate,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discountPercentage,
        notes,
      },
      currentUser
    );

    if (!updateRes.success) {
      toast.error(updateRes.error || 'Failed to update order before confirmation');
      return;
    }

    // Then confirm with user context
    const confirmRes = orderService.confirmOrder(
      order.id,
      currentUser?.name || 'User',
      currentUser
    );
    setIsConfirmModalOpen(false);

    if (confirmRes.success && confirmRes.order) {
      toast.success(
        `Order ${confirmRes.order.orderNumber} confirmed! Stock has been deducted atomically.`
      );
      navigate(`/orders/${confirmRes.order.id}`);
    } else {
      toast.error(confirmRes.error || 'Failed to confirm order');
    }
  };

  if (accessDenied) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-xs max-w-lg mx-auto text-center space-y-4 my-8">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Edit Permission Denied</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          You cannot edit this order because it was created by another sales representative.
        </p>
        <button
          onClick={() => navigate('/orders')}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
        >
          Return to Orders
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        Loading draft order details...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/orders/${order.id}`)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Edit Draft Order
              </h2>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {order.orderNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Modify customer, quantities, or discount before final confirmation.
            </p>
          </div>
        </div>
      </div>

      {formErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please resolve the following issues:</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium transition"
            >
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city}) - {c.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Order Date
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium transition"
            />
          </div>
        </div>

        {/* Items Table */}
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
              Add Product
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
                  <th className="py-3 px-3 w-32 text-right">Amount (₹)</th>
                  <th className="py-3 px-3 w-12 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const isShortage = item.productId && item.quantity > item.availableStock;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 transition ${
                        isShortage ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        >
                          <option value="">-- Select Product --</option>
                          {allProducts.map((p) => {
                            const disabled = items.some(
                              (other, i) => i !== index && other.productId === p.id
                            );
                            return (
                              <option
                                key={p.id}
                                value={p.id}
                                disabled={disabled || p.status !== 'Active'}
                              >
                                {p.name} ({p.productCode}) - ₹{p.price} [Stock: {p.stockQuantity}]
                                {p.status !== 'Active' ? ' (Inactive)' : disabled ? ' (Already added)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                        {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-xs">
                        <span
                          className={
                            item.availableStock <= 0
                              ? 'text-rose-600'
                              : item.availableStock <= 10
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {item.availableStock}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity || ''}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          disabled={!item.productId}
                          className="w-20 p-2 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:border-blue-500"
                        />
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {item.amount > 0 ? formatCurrency(item.amount) : '₹0.00'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
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

        {/* Calculations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Order Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
            />
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
              Updated Financials
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(financials.subtotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Discount (%):</span>
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
                className="w-16 p-1 text-center font-mono font-bold bg-white border border-slate-200 rounded"
              />
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount Amount:</span>
              <span className="font-mono text-rose-600 font-medium">
                -{formatCurrency(financials.discountAmount)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-slate-900 font-extrabold text-sm">
              <span>Grand Total:</span>
              <span className="font-mono text-lg text-blue-600">
                {formatCurrency(financials.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(`/orders/${order.id}`)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveDraftChanges}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            <Save className="w-4 h-4" />
            Update Draft
          </button>
          <button
            type="button"
            onClick={handlePromptConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm Order Now
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmOrder}
        title="Confirm Order Confirmation"
        message="Confirming this order will permanently lock it and deduct the specified quantities from warehouse stock."
        confirmLabel="Confirm Order"
        variant="primary"
      />
    </div>
  );
};
