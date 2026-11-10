import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  XCircle,
  Edit2,
  Boxes,
  ShieldAlert,
} from 'lucide-react';
import { SalesOrder, StockMovement } from '../types';
import { orderService } from '../services/orderService';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OrderInvoiceModal } from '../components/OrderInvoiceModal';

export const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // Dialogs
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const loadData = () => {
    if (!id) return;
    const rawOrder = orderService.getById(id);

    if (!rawOrder) {
      toast.error('Order not found.');
      navigate('/orders');
      return;
    }

    // Ownership check: Prevent URL tampering by sales users trying to inspect other users' orders
    if (!orderService.canUserAccessOrder(rawOrder, currentUser)) {
      setAccessDenied(true);
      toast.error(
        `Access Denied: Order ${rawOrder.orderNumber} was created by ${rawOrder.createdBy}. Sales users can only access their own orders.`
      );
      return;
    }

    setAccessDenied(false);
    setOrder(rawOrder);

    // Fetch related stock movements for this order
    const allMovements = inventoryService.getMovements();
    const related = allMovements.filter(
      (m) => m.relatedOrderId === rawOrder.id || m.relatedOrderNumber === rawOrder.orderNumber
    );
    setMovements(related);
  };

  useEffect(() => {
    loadData();
  }, [id, currentUser]);

  const handleConfirmOrder = () => {
    if (!order) return;
    const res = orderService.confirmOrder(order.id, currentUser?.name || 'User', currentUser);
    setIsConfirmOpen(false);
    if (res.success) {
      toast.success(
        `Order ${order.orderNumber} successfully confirmed! All product items have been deducted from stock.`
      );
      loadData();
    } else {
      toast.error(res.error || 'Failed to confirm order');
    }
  };

  const handleCancelOrder = () => {
    if (!order) return;
    const res = orderService.cancelOrder(
      order.id,
      currentUser?.name || 'User',
      cancelReason.trim(),
      currentUser
    );
    setIsCancelOpen(false);
    setCancelReason('');
    if (res.success) {
      if (order.status === 'Confirmed') {
        toast.warning(
          `Order ${order.orderNumber} cancelled. All reserved items have been restored to warehouse stock!`
        );
      } else {
        toast.info(`Draft order ${order.orderNumber} cancelled.`);
      }
      loadData();
    } else {
      toast.error(res.error || 'Failed to cancel order');
    }
  };

  if (accessDenied) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-xs max-w-lg mx-auto text-center space-y-4 my-8">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Access Restricted</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          You do not have permission to view or manage this sales order. Under trading role rules,
          Sales Users are only permitted to view orders they created themselves.
        </p>
        <button
          onClick={() => navigate('/orders')}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
        >
          Return to My Orders
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading order details...
      </div>
    );
  }

  const canModify = orderService.canUserModifyOrder(order, currentUser);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Back to Orders List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {order.orderNumber}
              </h2>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed on {formatDate(order.orderDate)} by {order.createdBy} ({order.createdByRole})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsInvoiceOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Invoice
          </button>

          {order.status === 'Draft' && canModify && (
            <>
              <button
                onClick={() => navigate(`/orders/edit/${order.id}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Draft
              </button>
              <button
                onClick={() => setIsConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Order
              </button>
              <button
                onClick={() => setIsCancelOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}

          {order.status === 'Confirmed' && canModify && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Order (Restore Stock)
            </button>
          )}
        </div>
      </div>

      {/* Main Order Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
        {/* Customer & Order Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Customer Information
            </span>
            <p className="text-sm font-bold text-slate-900 mt-1">{order.customerName}</p>
            <p className="text-slate-500 mt-0.5">ID: {order.customerId}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Order Timeline
            </span>
            <p className="text-slate-700 mt-1">
              <span className="font-semibold">Order Date:</span> {formatDate(order.orderDate)}
            </p>
            {order.confirmedAt && (
              <p className="text-emerald-700 font-medium mt-0.5">
                Confirmed: {formatDateTime(order.confirmedAt)}
              </p>
            )}
            {order.cancelledAt && (
              <p className="text-rose-700 font-medium mt-0.5">
                Cancelled: {formatDateTime(order.cancelledAt)}
              </p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Sales Staff
            </span>
            <p className="text-slate-800 font-semibold mt-1">{order.createdBy}</p>
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
              {order.createdByRole}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Ordered Line Items ({order.items.length})
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Product Description</th>
                  <th className="py-3 px-3 text-right">Rate Locked At Order (₹)</th>
                  <th className="py-3 px-3 text-center">Quantity</th>
                  <th className="py-3 px-3 text-right">Item Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">SKU: {item.productCode}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold font-mono text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Order Notes &amp; History
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 min-h-[90px]">
              {order.notes ? order.notes : 'No special notes recorded.'}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
              Financial Summary
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(order.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Order Discount ({order.discountPercentage}%):</span>
              <span className="font-mono text-rose-600 font-medium">
                -{formatCurrency(order.discountAmount)}
              </span>
            </div>

            <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-slate-900">
              <span className="text-sm font-extrabold">Grand Total:</span>
              <span className="text-xl font-black font-mono text-blue-600">
                {formatCurrency(order.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Related Stock Audit Log (Movements triggered by this order) */}
        {movements.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Related Inventory Movements Audit Trail ({movements.length})
              </h4>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Movement ID</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Action Type</th>
                    <th className="py-2.5 px-3 text-center">Qty Change</th>
                    <th className="py-2.5 px-3">Stock Before → After</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                        {m.movementCode}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {m.productName} ({m.productCode})
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.movementType === 'Sales Deduction'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-center font-mono font-bold ${
                          m.quantityChange < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">
                        {m.previousStock} → {m.newStock}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {formatDateTime(m.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmOrder}
        title={`Confirm Order ${order.orderNumber}`}
        message={`Are you sure you want to confirm this order? All ${order.items.length} items will be verified and deducted from warehouse stock.`}
        confirmLabel="Confirm Order"
        variant="primary"
      />

      {/* Cancel Dialog */}
      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
          setCancelReason('');
        }}
        onConfirm={handleCancelOrder}
        title={`Cancel Order ${order.orderNumber}`}
        message={`Are you sure you want to cancel this order? ${
          order.status === 'Confirmed'
            ? 'All previously deducted product quantities will be restored back into available warehouse inventory.'
            : 'This draft order will be marked cancelled without impacting inventory.'
        }`}
        variant="danger"
        confirmLabel="Cancel Order"
        details={
          <div className="mt-2">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Customer changed mind, incorrect rate..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-rose-500"
            />
          </div>
        }
      />

      {/* Invoice Modal */}
      <OrderInvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        order={order}
      />
    </div>
  );
};
