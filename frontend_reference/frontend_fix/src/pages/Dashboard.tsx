import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  ShoppingCart,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { orderService } from '../services/orderService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { round2 } from '../utils/calculations';
import { Product } from '../types';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#94A3B8', // slate-400
  Confirmed: '#10B981', // emerald-500
  Cancelled: '#F43F5E', // rose-500
};

export const Dashboard: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Load fresh data
  const allCustomers = storage.getCustomers();
  const allProducts = storage.getProducts();
  const customers = isAdmin ? allCustomers : allCustomers.filter((c) => c.status === 'Active');
  const products = isAdmin ? allProducts : allProducts.filter((p) => p.status === 'Active');

  // Role-scoped orders (Admin: all orders, Sales: own orders)
  const orders = useMemo(() => {
    return orderService.getAll(undefined, currentUser);
  }, [currentUser]);

  // 1. Customer Visibility Metrics
  // Admin: counts all customers and active customers separately
  // Sales User: only counts active customers
  const totalCustomers = customers.length;
  const activeCustomers = useMemo(() => {
    return customers.filter((c) => c.status === 'Active').length;
  }, [customers]);

  // 2. Product Visibility Metrics
  // Admin: counts all products and active products separately
  // Sales User: only counts active products
  const totalProducts = products.length;
  const activeProductsList = useMemo(() => {
    return products.filter((p) => p.status === 'Active');
  }, [products]);
  const activeProductsCount = activeProductsList.length;

  // Products visible to the current role (Sales User only sees active products)
  const visibleProducts = useMemo(() => {
    return isAdmin ? products : activeProductsList;
  }, [isAdmin, products, activeProductsList]);

  // Order Metrics
  const totalOrders = orders.length;
  const confirmedOrdersList = useMemo(() => {
    return orders.filter((o) => o.status === 'Confirmed');
  }, [orders]);
  const confirmedOrdersCount = confirmedOrdersList.length;

  const totalConfirmedSales = useMemo(() => {
    return round2(confirmedOrdersList.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0));
  }, [confirmedOrdersList]);

  const lowStockThreshold = 10;
  const lowStockProducts = useMemo(() => {
    return visibleProducts.filter((p) => p.stockQuantity <= lowStockThreshold);
  }, [visibleProducts]);

  // Order status distribution data for Pie Chart
  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Confirmed: 0, Cancelled: 0 };
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // 3. Dynamic Rolling Six-Month Monthly Sales Chart (aggregates ONLY Confirmed orders)
  const monthlySalesData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Dynamically generate previous 5 months up to current month (rolling 6 months)
    const rollingSlots: Array<{
      key: string;
      month: string;
      sales: number;
      count: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      rollingSlots.push({
        key,
        month: `${monthNames[m]} ${y}`,
        sales: 0,
        count: 0,
      });
    }

    // Aggregate confirmed orders into rolling slots
    confirmedOrdersList.forEach((o) => {
      if (!o.orderDate) return;
      let y: number;
      let m: number;

      if (typeof o.orderDate === 'string' && o.orderDate.includes('-')) {
        const parts = o.orderDate.split('-');
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
      } else {
        const d = new Date(o.orderDate);
        if (isNaN(d.getTime())) return;
        y = d.getFullYear();
        m = d.getMonth();
      }

      const orderKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const targetSlot = rollingSlots.find((s) => s.key === orderKey);
      if (targetSlot) {
        targetSlot.sales = round2(targetSlot.sales + (Number(o.grandTotal) || 0));
        targetSlot.count += 1;
      }
    });

    return rollingSlots.map(({ month, sales, count }) => ({
      month,
      sales,
      count,
    }));
  }, [confirmedOrdersList]);

  // 4. Dynamic Reporting Period Label
  const reportingPeriodLabel = useMemo(() => {
    if (monthlySalesData.length === 0) return 'Rolling 6 Months';
    const first = monthlySalesData[0].month;
    const last = monthlySalesData[monthlySalesData.length - 1].month;
    return `${first} – ${last}`;
  }, [monthlySalesData]);

  // Top selling products by quantity sold
  const topSellingProducts = useMemo(() => {
    const countMap: Record<string, { product: Product; soldQty: number; revenue: number }> = {};

    confirmedOrdersList.forEach((order) => {
      order.items.forEach((item) => {
        if (!countMap[item.productId]) {
          const matchedProd = visibleProducts.find((p) => p.id === item.productId);
          if (matchedProd) {
            countMap[item.productId] = {
              product: matchedProd,
              soldQty: 0,
              revenue: 0,
            };
          }
        }
        if (countMap[item.productId]) {
          countMap[item.productId].soldQty += item.quantity;
          countMap[item.productId].revenue = round2(
            countMap[item.productId].revenue + (Number(item.amount) || 0)
          );
        }
      });
    });

    return Object.values(countMap)
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5);
  }, [confirmedOrdersList, visibleProducts]);

  // Recent 5 orders
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt || b.orderDate).getTime() - new Date(a.createdAt || a.orderDate).getTime())
      .slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Welcome back, {currentUser?.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Overview of company operations, sales performance, and warehouse inventory.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate('/orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            New Sales Order
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/csv-import')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Import CSV
            </button>
          )}
        </div>
      </div>

      {/* 6 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Customer Visibility Card */}
        <StatCard
          title={isAdmin ? 'Total Customers' : 'Active Customers'}
          value={isAdmin ? totalCustomers : activeCustomers}
          subtitle={isAdmin ? `${activeCustomers} Active` : 'Active Accounts'}
          icon={Users}
          variant="blue"
          onClick={() => navigate('/customers')}
        />

        {/* Product Visibility Card */}
        <StatCard
          title={isAdmin ? 'Total Products' : 'Active Products'}
          value={isAdmin ? totalProducts : activeProductsCount}
          subtitle={isAdmin ? `${activeProductsCount} Active` : 'In Catalog'}
          icon={Package}
          variant="slate"
          onClick={() => navigate('/products')}
        />

        {/* Total Orders */}
        <StatCard
          title="Total Orders"
          value={totalOrders}
          subtitle="All lifecycle stages"
          icon={ShoppingCart}
          variant="purple"
          onClick={() => navigate('/orders')}
        />

        {/* Confirmed Orders */}
        <StatCard
          title="Confirmed Orders"
          value={confirmedOrdersCount}
          subtitle={`${Math.round((confirmedOrdersCount / (totalOrders || 1)) * 100)}% Conversion`}
          icon={CheckCircle2}
          variant="emerald"
          onClick={() => navigate('/orders')}
        />

        {/* Total Confirmed Sales */}
        <StatCard
          title="Total Confirmed Sales"
          value={formatCurrency(totalConfirmedSales)}
          subtitle="Net after discounts"
          icon={TrendingUp}
          variant="blue"
          onClick={() => navigate('/reports')}
        />

        {/* Low Stock Alerts */}
        <StatCard
          title="Low Stock Alerts"
          value={lowStockProducts.length}
          subtitle={`≤ ${lowStockThreshold} units threshold`}
          icon={AlertTriangle}
          variant="amber"
          badge={
            lowStockProducts.length > 0
              ? { text: 'Needs Reorder', variant: 'warning' }
              : { text: 'Optimal', variant: 'positive' }
          }
          onClick={() => navigate('/inventory')}
        />
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Sales Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Monthly Confirmed Sales Performance
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total net sales revenue generated per month (in INR)
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              {reportingPeriodLabel}
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySalesData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                />
                <Tooltip
                  formatter={(val: unknown) => [
                    formatCurrency(Number(val) || 0),
                    'Confirmed Sales',
                  ]}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  itemStyle={{ color: '#93C5FD' }}
                />
                <Bar dataKey="sales" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Order Status Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribution across Draft, Confirmed &amp; Cancelled</p>
          </div>

          <div className="h-64 sm:h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {orderStatusData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={STATUS_COLORS[entry.name] || '#94A3B8'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid of Tables: Recent Orders & Stock / Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recent Sales Orders
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest transactions submitted by sales team</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              View All Orders <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{order.customerName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(order.orderDate)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(order.grandTotal)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Top Selling & Low Stock Tabs */}
        <div className="space-y-6">
          {/* Top Selling Products */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Top-Selling Products
              </h3>
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                By Volume
              </span>
            </div>

            <div className="space-y-3">
              {topSellingProducts.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No sales recorded yet.</p>
              ) : (
                topSellingProducts.map(({ product, soldQty, revenue }, idx) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{product.name}</p>
                        <p className="text-[10px] text-slate-400">{product.productCode} • {product.category}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900">{soldQty} sold</span>
                      <p className="text-[10px] text-slate-500 font-mono">{formatCurrency(revenue)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock Quick Warning Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Critical Stock Watch
                </h3>
              </div>
              <button
                onClick={() => navigate('/inventory')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2.5">
              {lowStockProducts.length === 0 ? (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs text-center font-medium">
                  All inventory items are sufficiently stocked!
                </div>
              ) : (
                lowStockProducts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate('/inventory')}
                    className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 truncate">
                      <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{p.productCode}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        p.stockQuantity === 0
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {p.stockQuantity === 0 ? 'Out of Stock' : `${p.stockQuantity} left`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
