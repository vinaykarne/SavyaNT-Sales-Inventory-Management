import React, { useState, useMemo } from 'react';
import {
  Boxes,
  ArrowUpDown,
  Plus,
  Minus,
  AlertTriangle,
  History,
  Download,
  Search,
  Filter,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { Product, StockMovement, StockMovementType } from '../types';
import { inventoryService } from '../services/inventoryService';
import { productService } from '../services/productService';
import { csvService } from '../services/csvService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateStockAdjustment } from '../utils/validators';
import { formatCurrency, formatDate, formatDateTime, getStockStatus } from '../utils/formatters';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

export const Inventory: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels');
  const [products, setProducts] = useState<Product[]>(() => productService.getAll());
  const [movements, setMovements] = useState<StockMovement[]>(() =>
    inventoryService.getMovements()
  );

  // Filters
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('All');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('All');

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'Increase' | 'Decrease'>('Increase');
  const [adjustQuantity, setAdjustQuantity] = useState<number | string>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustErrors, setAdjustErrors] = useState<Record<string, string>>({});

  const refreshAll = () => {
    setProducts(productService.getAll());
    setMovements(inventoryService.getMovements());
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === adjustProductId);
  }, [products, adjustProductId]);

  const handleOpenAdjust = (product?: Product) => {
    const targetProduct = product || products[0];
    setAdjustProductId(targetProduct?.id || '');
    setAdjustType('Increase');
    setAdjustQuantity(1);
    setAdjustReason('');
    setAdjustErrors({});
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const validation = validateStockAdjustment(
      selectedProduct.stockQuantity,
      adjustType,
      adjustQuantity,
      adjustReason
    );

    if (!validation.isValid) {
      setAdjustErrors(validation.errors);
      return;
    }

    const res = inventoryService.adjustStock({
      productId: selectedProduct.id,
      type: adjustType,
      quantity: Number(adjustQuantity),
      reason: adjustReason,
      performedBy: currentUser?.name || 'Administrator',
    });

    if (res.success && res.movement) {
      toast.success(
        `Stock for ${selectedProduct.name} successfully ${
          adjustType === 'Increase' ? 'increased' : 'decreased'
        } by ${adjustQuantity} units.`
      );
      setIsAdjustModalOpen(false);
      refreshAll();
    } else {
      toast.error(res.error || 'Failed to adjust stock');
    }
  };

  // Export movements to CSV
  const handleExportMovementsCSV = () => {
    const headers = [
      'Movement ID',
      'Product Code',
      'Product Name',
      'Movement Type',
      'Quantity Change',
      'Previous Stock',
      'New Stock',
      'Related Order',
      'Reason',
      'Date & Time',
      'Created By',
    ];
    const rows = movements.map((m) => [
      m.movementCode,
      m.productCode,
      m.productName,
      m.movementType,
      m.quantityChange,
      m.previousStock,
      m.newStock,
      m.relatedOrderNumber || 'N/A',
      m.reason,
      m.timestamp,
      m.createdBy,
    ]);
    csvService.exportToCSV('Stock_Movement_History', headers, rows);
    toast.success('Stock Movement History exported to CSV.');
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    if (stockStatusFilter === 'All') return true;
    const status = getStockStatus(p.stockQuantity).label;
    return status === stockStatusFilter;
  });

  // Filtered movements
  const filteredMovements = movements.filter((m) => {
    if (movementTypeFilter === 'All') return true;
    return m.movementType === movementTypeFilter;
  });

  // Stock Level Columns
  const levelColumns: Column<Product>[] = [
    {
      key: 'productCode',
      header: 'Product Code',
      sortable: true,
      className: 'font-mono text-xs font-bold text-blue-600',
    },
    {
      key: 'name',
      header: 'Product Name',
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-semibold text-slate-900 block">{p.name}</span>
          <span className="text-[11px] text-slate-400">{p.category}</span>
        </div>
      ),
    },
    {
      key: 'stockQuantity',
      header: 'Current Stock',
      sortable: true,
      sortValue: (p) => p.stockQuantity,
      render: (p) => (
        <span className="font-mono text-sm font-bold text-slate-900">
          {p.stockQuantity} units
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Stock Status',
      sortable: true,
      render: (p) => {
        const info = getStockStatus(p.stockQuantity);
        return <StatusBadge status={info.label} size="sm" />;
      },
    },
    {
      key: 'price',
      header: 'Unit Price (₹)',
      sortable: true,
      sortValue: (p) => p.price,
      className: 'font-mono text-xs text-slate-700 text-right',
      render: (p) => formatCurrency(p.price),
    },
    {
      key: 'lastStockUpdate',
      header: 'Last Updated',
      sortable: true,
      render: (p) => (
        <span className="text-slate-500 text-xs">
          {p.lastStockUpdate ? formatDateTime(p.lastStockUpdate) : formatDate(p.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (p) =>
        isAdmin ? (
          <button
            onClick={() => handleOpenAdjust(p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Adjust Stock
          </button>
        ) : (
          <span className="text-xs text-slate-400 italic">View Only</span>
        ),
    },
  ];

  // Stock Movement Columns
  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'movementCode',
      header: 'Movement ID',
      sortable: true,
      className: 'font-mono text-xs font-bold text-blue-600',
    },
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (m) => (
        <div>
          <span className="font-semibold text-slate-900 block">{m.productName}</span>
          <span className="text-[11px] text-slate-400 font-mono">{m.productCode}</span>
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Movement Type',
      sortable: true,
      render: (m) => {
        const isDeduction = m.quantityChange < 0;
        return (
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isDeduction
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {m.movementType}
          </span>
        );
      },
    },
    {
      key: 'quantityChange',
      header: 'Quantity Change',
      sortable: true,
      sortValue: (m) => m.quantityChange,
      className: 'text-center font-mono font-bold text-xs',
      render: (m) => (
        <span className={m.quantityChange < 0 ? 'text-rose-600' : 'text-emerald-600'}>
          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
        </span>
      ),
    },
    {
      key: 'previousStock',
      header: 'Before → After',
      className: 'font-mono text-xs text-slate-600',
      render: (m) => (
        <span>
          {m.previousStock} → <strong className="text-slate-900">{m.newStock}</strong>
        </span>
      ),
    },
    {
      key: 'relatedOrderNumber',
      header: 'Related Order',
      render: (m) =>
        m.relatedOrderNumber ? (
          <span className="font-mono text-xs text-blue-600 font-bold">
            {m.relatedOrderNumber}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
    },
    {
      key: 'reason',
      header: 'Reason / Memo',
      render: (m) => <span className="text-xs text-slate-600">{m.reason}</span>,
    },
    {
      key: 'timestamp',
      header: 'Date & Time',
      sortable: true,
      render: (m) => (
        <span className="text-slate-500 text-xs font-mono">{formatDateTime(m.timestamp)}</span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Performed By',
      className: 'text-xs text-slate-700 font-medium',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Warehouse Inventory &amp; Stock Movements
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time stock quantities, stock status classifiers, and complete immutable audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={() => handleOpenAdjust()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
              Adjust Stock
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Stock Adjustments (Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('levels')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'levels'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Current Stock Levels ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Audit Log ({movements.length})</span>
        </button>
      </div>

      {/* Tab 1: Current Stock Levels */}
      {activeTab === 'levels' && (
        <DataTable
          columns={levelColumns}
          data={filteredProducts}
          keyExtractor={(p) => p.id}
          searchPlaceholder="Search products by code or name..."
          searchFilter={(p, q) =>
            p.productCode.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
          }
          defaultSortKey="stockQuantity"
          defaultSortDirection="asc"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status Filter:</span>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All Items</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock (≤10)</option>
                <option value="Out of Stock">Out of Stock (0)</option>
              </select>
            </div>
          }
        />
      )}

      {/* Tab 2: Stock Movements Audit Trail */}
      {activeTab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={filteredMovements}
          keyExtractor={(m) => m.id}
          searchPlaceholder="Search movements by ID, product, reason, order #..."
          searchFilter={(m, q) =>
            Boolean(
              m.movementCode.toLowerCase().includes(q) ||
              m.productName.toLowerCase().includes(q) ||
              m.productCode.toLowerCase().includes(q) ||
              m.reason.toLowerCase().includes(q) ||
              (m.relatedOrderNumber && m.relatedOrderNumber.toLowerCase().includes(q))
            )
          }
          defaultSortKey="timestamp"
          defaultSortDirection="desc"
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Movement Type:</span>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="All">All Types</option>
                  <option value="Opening Stock">Opening Stock</option>
                  <option value="Stock Increase">Stock Increase</option>
                  <option value="Stock Decrease">Stock Decrease</option>
                  <option value="Sales Deduction">Sales Deduction</option>
                  <option value="Sales Return">Sales Return</option>
                </select>
              </div>

              <button
                onClick={handleExportMovementsCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          }
        />
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Stock Adjustment"
        subtitle="Record warehouse physical counts, damages, or stock receipts."
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdjustSubmit}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
            >
              Apply Adjustment
            </button>
          </>
        }
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Product <span className="text-rose-500">*</span>
            </label>
            <select
              value={adjustProductId}
              onChange={(e) => setAdjustProductId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.productCode}) — Current: {p.stockQuantity} units
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Current Stock</span>
                <p className="font-mono text-base font-bold text-slate-900 mt-0.5">
                  {selectedProduct.stockQuantity} units
                </p>
              </div>
              <StatusBadge status={getStockStatus(selectedProduct.stockQuantity).label} size="sm" />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Adjustment Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjustType('Increase')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  adjustType === 'Increase'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                Increase Stock
              </button>

              <button
                type="button"
                onClick={() => setAdjustType('Decrease')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  adjustType === 'Decrease'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Minus className="w-4 h-4 text-rose-600" />
                Decrease Stock
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity to {adjustType} <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              className={`w-full p-2.5 rounded-lg border text-xs font-mono font-bold focus:outline-hidden transition ${
                adjustErrors.quantity
                  ? 'border-rose-400 bg-rose-50/50'
                  : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {adjustErrors.quantity && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{adjustErrors.quantity}</p>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason / Memo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Physical inventory reconciliation, transit breakage..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className={`w-full p-2.5 rounded-lg border text-xs focus:outline-hidden transition ${
                adjustErrors.reason
                  ? 'border-rose-400 bg-rose-50/50'
                  : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {adjustErrors.reason && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{adjustErrors.reason}</p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
