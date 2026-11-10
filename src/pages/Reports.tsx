import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Users,
  Package,
  AlertTriangle,
  History,
  Download,
  Calendar,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { csvService } from '../services/csvService';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

export const Reports: React.FC = () => {
  const { currentUser } = useAuth();
  const toast = useToast();

  const [activeSection, setActiveSection] = useState<'customer' | 'product' | 'lowstock' | 'movements'>('customer');

  // Date filters for sales reports
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Threshold for low stock report
  const [stockThreshold, setStockThreshold] = useState<number>(10);

  // Search for movements
  const [movementSearch, setMovementSearch] = useState('');

  // A. Customer Sales Summary Data (role-scoped to currentUser)
  const customerSalesData = useMemo(() => {
    return reportService.getCustomerSalesSummary({ dateFrom, dateTo }, currentUser);
  }, [dateFrom, dateTo, currentUser]);

  // B. Product Sales Summary Data (role-scoped to currentUser)
  const productSalesData = useMemo(() => {
    return reportService.getProductSalesSummary({ dateFrom, dateTo }, currentUser);
  }, [dateFrom, dateTo, currentUser]);

  // C. Low Stock Report Data
  const lowStockData = useMemo(() => {
    return reportService.getLowStockReport(stockThreshold);
  }, [stockThreshold]);

  // D. Stock Movements Data
  const movementsData = useMemo(() => {
    return reportService.getStockMovementHistory({ search: movementSearch });
  }, [movementSearch]);

  // Export A to CSV
  const handleExportCustomerSales = () => {
    const headers = ['Customer ID', 'Customer Name', 'Confirmed Orders Count', 'Total Sales After Discount (₹)'];
    const rows = customerSalesData.map((c) => [
      c.customerId,
      c.customerName,
      c.confirmedOrderCount,
      c.totalSalesAfterDiscount,
    ]);
    csvService.exportToCSV('Customer_Sales_Summary_Report', headers, rows);
    toast.success('Customer Sales Summary exported.');
  };

  // Export B to CSV
  const handleExportProductSales = () => {
    const headers = ['Product Code', 'Product Name', 'Quantity Sold', 'Gross Item Value Before Discount (₹)'];
    const rows = productSalesData.map((p) => [
      p.productCode,
      p.productName,
      p.quantitySold,
      p.grossItemValue,
    ]);
    csvService.exportToCSV('Product_Sales_Summary_Report', headers, rows);
    toast.success('Product Sales Summary exported.');
  };

  // Export C to CSV
  const handleExportLowStock = () => {
    const headers = ['Product Code', 'Product Name', 'Category', 'Current Stock', 'Unit Price (₹)', 'Status'];
    const rows = lowStockData.map((p) => [
      p.productCode,
      p.productName,
      p.category,
      p.currentStock,
      p.unitPrice,
      p.status,
    ]);
    csvService.exportToCSV(`Low_Stock_Report_Threshold_${stockThreshold}`, headers, rows);
    toast.success('Low Stock Report exported.');
  };

  // Export D to CSV
  const handleExportMovements = () => {
    const headers = [
      'Movement ID',
      'Product Code',
      'Product Name',
      'Movement Type',
      'Quantity Change',
      'Related Order',
      'Reason',
      'Date & Time',
      'Created By',
    ];
    const rows = movementsData.map((m) => [
      m.movementCode,
      m.productCode,
      m.productName,
      m.movementType,
      m.quantityChange,
      m.relatedOrderNumber || 'N/A',
      m.reason,
      m.timestamp,
      m.createdBy,
    ]);
    csvService.exportToCSV('Stock_Movement_Audit_Report', headers, rows);
    toast.success('Stock Movement History exported.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Business Intelligence &amp; Sales Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit-grade performance metrics strictly computed from Confirmed sales orders and warehouse logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'customer' && (
            <button
              onClick={handleExportCustomerSales}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export Customer Sales CSV
            </button>
          )}
          {activeSection === 'product' && (
            <button
              onClick={handleExportProductSales}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export Product Sales CSV
            </button>
          )}
          {activeSection === 'lowstock' && (
            <button
              onClick={handleExportLowStock}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export Low Stock CSV
            </button>
          )}
          {activeSection === 'movements' && (
            <button
              onClick={handleExportMovements}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export Movement History CSV
            </button>
          )}
        </div>
      </div>

      {/* Report Section Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveSection('customer')}
          className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
            activeSection === 'customer'
              ? 'border-blue-500 bg-blue-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              activeSection === 'customer' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">A. Customer Sales</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Order counts &amp; net sales</p>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('product')}
          className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
            activeSection === 'product'
              ? 'border-blue-500 bg-blue-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              activeSection === 'product' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">B. Product Sales</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Quantity sold &amp; gross item value</p>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('lowstock')}
          className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
            activeSection === 'lowstock'
              ? 'border-blue-500 bg-blue-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              activeSection === 'lowstock' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">C. Low Stock Report</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Configurable stock threshold</p>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('movements')}
          className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
            activeSection === 'movements'
              ? 'border-blue-500 bg-blue-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              activeSection === 'movements' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">D. Stock Movements</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Complete movement history</p>
          </div>
        </button>
      </div>

      {/* Section A: Customer Sales Summary */}
      {activeSection === 'customer' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">Filter By Confirmed Date Range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-blue-600 font-semibold hover:underline ml-2"
                >
                  Reset Dates
                </button>
              )}
            </div>
            <p className="text-slate-400 text-[11px] italic">
              Includes all registered clients (even those with 0 confirmed orders)
            </p>
          </div>

          <DataTable
            columns={[
              {
                key: 'customerId',
                header: 'Customer ID',
                sortable: true,
                className: 'font-mono text-xs font-semibold text-blue-600',
              },
              {
                key: 'customerName',
                header: 'Customer Name',
                sortable: true,
                className: 'font-semibold text-slate-900 text-xs',
              },
              {
                key: 'confirmedOrderCount',
                header: 'Confirmed Orders',
                sortable: true,
                className: 'font-mono font-bold text-xs text-center',
                render: (c) => (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs ${
                      c.confirmedOrderCount > 0
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-400 font-normal'
                    }`}
                  >
                    {c.confirmedOrderCount}
                  </span>
                ),
              },
              {
                key: 'totalSalesAfterDiscount',
                header: 'Total Sales After Discount (₹)',
                sortable: true,
                sortValue: (c) => c.totalSalesAfterDiscount,
                className: 'font-mono font-bold text-xs text-right',
                render: (c) => (
                  <span className={c.totalSalesAfterDiscount > 0 ? 'text-slate-900' : 'text-slate-400'}>
                    {formatCurrency(c.totalSalesAfterDiscount)}
                  </span>
                ),
              },
            ]}
            data={customerSalesData}
            keyExtractor={(c) => c.customerId}
            searchPlaceholder="Search customer sales summary..."
            searchFilter={(c, q) =>
              c.customerName.toLowerCase().includes(q) || c.customerId.toLowerCase().includes(q)
            }
            defaultSortKey="totalSalesAfterDiscount"
            defaultSortDirection="desc"
          />
        </div>
      )}

      {/* Section B: Product Sales Summary */}
      {activeSection === 'product' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">Filter Order Date Range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
            <p className="text-slate-400 text-[11px] italic">
              Gross Value = Quantity × Locked Rate before overall order discount
            </p>
          </div>

          <DataTable
            columns={[
              {
                key: 'productCode',
                header: 'Product Code',
                sortable: true,
                className: 'font-mono text-xs font-bold text-blue-600',
              },
              {
                key: 'productName',
                header: 'Product Name',
                sortable: true,
                className: 'font-semibold text-slate-900 text-xs',
              },
              {
                key: 'quantitySold',
                header: 'Total Quantity Sold',
                sortable: true,
                className: 'font-mono font-bold text-xs text-center',
                render: (p) => (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      p.quantitySold > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 font-normal'
                    }`}
                  >
                    {p.quantitySold} units
                  </span>
                ),
              },
              {
                key: 'grossItemValue',
                header: 'Gross Item Value Before Order Discount (₹)',
                sortable: true,
                sortValue: (p) => p.grossItemValue,
                className: 'font-mono font-bold text-xs text-right text-slate-900',
                render: (p) => formatCurrency(p.grossItemValue),
              },
            ]}
            data={productSalesData}
            keyExtractor={(p) => p.productId}
            searchPlaceholder="Search product sales..."
            searchFilter={(p, q) =>
              p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
            }
            defaultSortKey="quantitySold"
            defaultSortDirection="desc"
          />
        </div>
      )}

      {/* Section C: Low Stock Report */}
      {activeSection === 'lowstock' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4 text-amber-500" />
              <label className="font-bold text-slate-700">
                User-Configurable Stock Threshold:
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={stockThreshold}
                onChange={(e) => setStockThreshold(parseInt(e.target.value, 10) || 0)}
                className="w-20 p-1.5 font-mono font-bold text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <span className="text-slate-500">units or less</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                {lowStockData.length} items currently at or below threshold
              </span>
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: 'productCode',
                header: 'Product Code',
                sortable: true,
                className: 'font-mono text-xs font-bold text-blue-600',
              },
              {
                key: 'productName',
                header: 'Product Name',
                sortable: true,
                className: 'font-semibold text-slate-900 text-xs',
              },
              {
                key: 'category',
                header: 'Category',
                sortable: true,
                className: 'text-xs text-slate-500',
              },
              {
                key: 'currentStock',
                header: 'Current Stock',
                sortable: true,
                className: 'font-mono font-bold text-xs text-center',
                render: (p) => (
                  <span
                    className={`font-mono font-bold ${
                      p.currentStock === 0 ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  >
                    {p.currentStock} units
                  </span>
                ),
              },
              {
                key: 'unitPrice',
                header: 'Unit Price (₹)',
                sortable: true,
                className: 'font-mono text-xs text-slate-700 text-right',
                render: (p) => formatCurrency(p.unitPrice),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                render: (p) => <StatusBadge status={p.status} size="sm" />,
              },
            ]}
            data={lowStockData}
            keyExtractor={(p) => p.productId}
            searchPlaceholder="Search low stock items..."
            searchFilter={(p, q) =>
              p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
            }
            defaultSortKey="currentStock"
            defaultSortDirection="asc"
          />
        </div>
      )}

      {/* Section D: Stock Movement History */}
      {activeSection === 'movements' && (
        <div className="space-y-4">
          <DataTable
            columns={[
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
                render: (m) => (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.quantityChange < 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {m.movementType}
                  </span>
                ),
              },
              {
                key: 'quantityChange',
                header: 'Quantity Change',
                sortable: true,
                className: 'text-center font-mono font-bold text-xs',
                render: (m) => (
                  <span className={m.quantityChange < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
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
                    <span className="text-slate-400">-</span>
                  ),
              },
              {
                key: 'reason',
                header: 'Reason',
                className: 'text-xs text-slate-600',
              },
              {
                key: 'timestamp',
                header: 'Timestamp',
                sortable: true,
                render: (m) => (
                  <span className="text-slate-400 font-mono text-xs">
                    {formatDateTime(m.timestamp)}
                  </span>
                ),
              },
              {
                key: 'createdBy',
                header: 'Created By',
                className: 'text-xs text-slate-700 font-medium',
              },
            ]}
            data={movementsData}
            keyExtractor={(m) => m.id}
            searchPlaceholder="Search movement history..."
            searchFilter={(m, q) =>
              m.movementCode.toLowerCase().includes(q) ||
              m.productName.toLowerCase().includes(q) ||
              m.reason.toLowerCase().includes(q)
            }
            defaultSortKey="timestamp"
            defaultSortDirection="desc"
          />
        </div>
      )}
    </div>
  );
};
