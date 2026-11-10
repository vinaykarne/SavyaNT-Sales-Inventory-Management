import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Edit2,
  Printer,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { OrderStatus, SalesOrder } from '../types';
import { orderService } from '../services/orderService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { DataTable, Column } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { OrderInvoiceModal } from '../components/OrderInvoiceModal';

export const Orders: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<SalesOrder[]>(() =>
    orderService.getAll(undefined, currentUser)
  );
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [adminStaffFilter, setAdminStaffFilter] = useState<string>('All');

  // Dialog states
  const [orderToConfirm, setOrderToConfirm] = useState<SalesOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState<SalesOrder | null>(null);

  const refreshOrders = () => {
    setOrders(orderService.getAll(undefined, currentUser));
  };

  const handleConfirmOrder = () => {
    if (!orderToConfirm) return;
    const res = orderService.confirmOrder(
      orderToConfirm.id,
      currentUser?.name || 'User',
      currentUser
    );
    if (res.success) {
      toast.success(
        `Order ${orderToConfirm.orderNumber} confirmed! Stock successfully deducted from warehouse.`
      );
      setOrderToConfirm(null);
      refreshOrders();
    } else {
      toast.error(res.error || 'Failed to confirm order');
      setOrderToConfirm(null);
    }
  };

  const handleCancelOrder = () => {
    if (!orderToCancel) return;
    const res = orderService.cancelOrder(
      orderToCancel.id,
      currentUser?.name || 'User',
      cancelReason.trim(),
      currentUser
    );
    if (res.success) {
      if (orderToCancel.status === 'Confirmed') {
        toast.warning(
          `Order ${orderToCancel.orderNumber} cancelled. All reserved items have been restored to warehouse stock!`
        );
      } else {
        toast.info(`Draft order ${orderToCancel.orderNumber} cancelled.`);
      }
      setOrderToCancel(null);
      setCancelReason('');
      refreshOrders();
    } else {
      toast.error(res.error || 'Failed to cancel order');
      setOrderToCancel(null);
    }
  };

  // Unique creators for Admin filter
  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => set.add(o.createdBy));
    return Array.from(set);
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (dateFrom && o.orderDate < dateFrom) return false;
      if (dateTo && o.orderDate > dateTo) return false;
      if (isAdmin && adminStaffFilter !== 'All' && o.createdBy !== adminStaffFilter) {
        return false;
      }
      return true;
    });
  }, [orders, statusFilter, dateFrom, dateTo, isAdmin, adminStaffFilter]);

  const columns: Column<SalesOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order Number',
      sortable: true,
      className: 'font-mono text-xs font-bold text-blue-600',
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
      render: (o) => (
        <div>
          <span className="font-semibold text-slate-900 block">{o.customerName}</span>
          <span className="text-[11px] text-slate-400 font-mono">{o.items.length} items</span>
        </div>
      ),
    },
    {
      key: 'orderDate',
      header: 'Order Date',
      sortable: true,
      render: (o) => (
        <span className="text-slate-600 text-xs font-medium">{formatDate(o.orderDate)}</span>
      ),
    },
    {
      key: 'subtotal',
      header: 'Subtotal (₹)',
      sortable: true,
      sortValue: (o) => o.subtotal,
      className: 'font-mono text-xs text-slate-600 text-right',
      render: (o) => formatCurrency(o.subtotal),
    },
    {
      key: 'discountPercentage',
      header: 'Discount',
      sortable: true,
      sortValue: (o) => o.discountAmount,
      className: 'font-mono text-xs text-right',
      render: (o) => (
        <div>
          <span className="text-rose-600 font-medium">-{formatCurrency(o.discountAmount)}</span>
          <span className="text-[10px] text-slate-400 block font-sans">({o.discountPercentage}%)</span>
        </div>
      ),
    },
    {
      key: 'grandTotal',
      header: 'Grand Total (₹)',
      sortable: true,
      sortValue: (o) => o.grandTotal,
      className: 'font-mono text-xs font-bold text-slate-900 text-right',
      render: (o) => formatCurrency(o.grandTotal),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      sortable: true,
      render: (o) => (
        <div>
          <span className="font-medium text-slate-700 block text-xs">{o.createdBy}</span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            {o.createdByRole}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (o) => <StatusBadge status={o.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right min-w-[140px]',
      render: (o) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => navigate(`/orders/${o.id}`)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => setInvoiceOrder(o)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Print / Preview Tax Invoice"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Draft Actions: check permission */}
          {o.status === 'Draft' && orderService.canUserModifyOrder(o, currentUser) && (
            <>
              <button
                onClick={() => navigate(`/orders/edit/${o.id}`)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                title="Edit Draft Order"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOrderToConfirm(o)}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                title="Confirm Order (Deduct Stock)"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOrderToCancel(o)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Cancel Draft Order"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Confirmed Actions: check permission */}
          {o.status === 'Confirmed' && orderService.canUserModifyOrder(o, currentUser) && (
            <button
              onClick={() => setOrderToCancel(o)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Cancel Confirmed Order (Restores Stock)"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Sales Orders Management
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {filteredOrders.length} {isAdmin ? 'Total' : 'Assigned to You'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Administrator View: Showing company-wide orders. Full oversight across all sales staff.'
              : `Sales User View: Showing only orders created by ${currentUser?.name}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create New Order
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredOrders}
        keyExtractor={(o) => o.id}
        searchPlaceholder="Search by order number (e.g. SO-2026), customer name..."
        searchFilter={(o, q) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.createdBy.toLowerCase().includes(q) ||
          o.items.some((item) => item.productName.toLowerCase().includes(q))
        }
        defaultSortKey="orderNumber"
        defaultSortDirection="desc"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | OrderStatus)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft Only</option>
                <option value="Confirmed">Confirmed Only</option>
                <option value="Cancelled">Cancelled Only</option>
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-semibold ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Admin-only Staff Filter */}
            {isAdmin && uniqueCreators.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Sales Rep:</span>
                <select
                  value={adminStaffFilter}
                  onChange={(e) => setAdminStaffFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="All">All Representatives</option>
                  {uniqueCreators.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        }
      />

      {/* Confirmation Dialog before Confirming */}
      <ConfirmDialog
        isOpen={!!orderToConfirm}
        onClose={() => setOrderToConfirm(null)}
        onConfirm={handleConfirmOrder}
        title={`Confirm Order ${orderToConfirm?.orderNumber}`}
        message={`Are you sure you want to confirm order ${orderToConfirm?.orderNumber} for ${
          orderToConfirm ? formatCurrency(orderToConfirm.grandTotal) : ''
        }?`}
        variant="primary"
        confirmLabel="Confirm & Deduct Stock"
        details={
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">Inventory Verification:</p>
            <p>
              The system will verify that all {orderToConfirm?.items.length} items have sufficient
              warehouse stock. If even one product has insufficient quantity, confirmation will be
              rejected atomically.
            </p>
          </div>
        }
      />

      {/* Confirmation Dialog before Cancelling */}
      <ConfirmDialog
        isOpen={!!orderToCancel}
        onClose={() => {
          setOrderToCancel(null);
          setCancelReason('');
        }}
        onConfirm={handleCancelOrder}
        title={`Cancel Order ${orderToCancel?.orderNumber}`}
        message={`Are you sure you want to cancel order ${orderToCancel?.orderNumber}?`}
        variant="danger"
        confirmLabel="Cancel Order"
        details={
          <div className="space-y-3">
            <div
              className={`p-3 rounded-lg border text-xs ${
                orderToCancel?.status === 'Confirmed'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {orderToCancel?.status === 'Confirmed' ? (
                <>
                  <p className="font-bold text-amber-950">Stock Restoration Rule:</p>
                  <p>
                    Because this order was <strong>Confirmed</strong>, cancelling it will automatically
                    restore all deducted product quantities back to available inventory and log
                    "Sales Return" stock movements.
                  </p>
                </>
              ) : (
                <p>
                  This is a <strong>Draft</strong> order. Cancelling will mark it as cancelled without
                  affecting warehouse stock (stock was never deducted).
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Cancellation (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Customer request, postponed project..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-rose-500"
              />
            </div>
          </div>
        }
      />

      {/* Tax Invoice Modal */}
      <OrderInvoiceModal
        isOpen={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        order={invoiceOrder}
      />
    </div>
  );
};
