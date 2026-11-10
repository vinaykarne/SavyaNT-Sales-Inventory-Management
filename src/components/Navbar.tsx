import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  User,
  Shield,
  LogOut,
  AlertTriangle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { orderService } from '../services/orderService';

interface NavbarProps {
  onOpenMobile: () => void;
  isSidebarCollapsed: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobile, isSidebarCollapsed }) => {
  const { currentUser, isAdmin, logout, switchDemoUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute page title from path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard Overview';
    if (path.startsWith('/customers')) return 'Customer Management';
    if (path.startsWith('/products')) return 'Product Catalog';
    if (path.startsWith('/orders/new')) return 'Create New Sales Order';
    if (path.startsWith('/orders/edit')) return 'Edit Draft Order';
    if (path.startsWith('/orders/')) return 'Sales Order Details';
    if (path.startsWith('/orders')) return 'Sales Order Management';
    if (path.startsWith('/inventory')) return 'Inventory & Stock Movements';
    if (path.startsWith('/reports')) return 'Business Intelligence Reports';
    if (path.startsWith('/csv-import')) return 'Product CSV Bulk Import';
    if (path.startsWith('/settings')) return 'System Settings & Profile';
    return 'SavyaNT ERP';
  };

  // Real-time notification data (scoped to current user's role permissions)
  const allProducts = storage.getProducts();
  const products = isAdmin ? allProducts : allProducts.filter((p) => p.status === 'Active');
  const lowStockItems = products.filter((p) => p.stockQuantity <= 10);
  const orders = orderService.getAll(undefined, currentUser);
  const draftOrders = orders.filter((o) => o.status === 'Draft');

  const totalAlerts = lowStockItems.length + draftOrders.length;

  // Global search lookup across products, customers, orders
  const searchResults = React.useMemo(() => {
    if (!globalSearch.trim() || globalSearch.length < 2) return null;
    const q = globalSearch.toLowerCase().trim();

    const matchedProducts = products
      .filter((p) => p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q))
      .slice(0, 3);

    const allCustomers = storage.getCustomers();
    const customers = isAdmin ? allCustomers : allCustomers.filter((c) => c.status === 'Active');
    const matchedCustomers = customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 3);

    const matchedOrders = orders
      .filter((o) => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
      .slice(0, 3);

    return {
      products: matchedProducts,
      customers: matchedCustomers,
      orders: matchedOrders,
      total: matchedProducts.length + matchedCustomers.length + matchedOrders.length,
    };
  }, [globalSearch, products, orders, isAdmin]);

  return (
    <header
      className={`sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all duration-300 ease-in-out px-4 sm:px-6 flex items-center justify-between gap-4 ${
        isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
      }`}
    >
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 md:hidden transition"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">
          {getPageTitle()}
        </h1>
      </div>

      {/* Middle: Global Quick Search */}
      <div className="hidden sm:block flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products, orders, customers..."
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setSearchResultsOpen(true);
            }}
            onFocus={() => setSearchResultsOpen(true)}
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchResultsOpen && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Search Results ({searchResults.total})</span>
              <button
                onClick={() => setSearchResultsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">
              {searchResults.total === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No matching records found for "{globalSearch}"
                </div>
              ) : (
                <>
                  {searchResults.orders.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => {
                        navigate(`/orders/${o.id}`);
                        setSearchResultsOpen(false);
                      }}
                      className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-blue-600">{o.orderNumber}</p>
                        <p className="text-slate-500">{o.customerName}</p>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">{o.status}</span>
                    </div>
                  ))}

                  {searchResults.products.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        navigate('/products');
                        setSearchResultsOpen(false);
                      }}
                      className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-slate-400">{p.productCode} • {p.category}</p>
                      </div>
                      <span className="text-slate-600 font-semibold">₹{p.price}</span>
                    </div>
                  ))}

                  {searchResults.customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        navigate('/customers');
                        setSearchResultsOpen(false);
                      }}
                      className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        <p className="text-slate-400">{c.city} • {c.email}</p>
                      </div>
                      <span className="text-slate-400 text-[10px]">{c.status}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Notification Alerts & Profile Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
            aria-label="View system alerts"
          >
            <Bell className="w-5 h-5" />
            {totalAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  System Alerts &amp; Notifications
                </span>
                <span className="text-xs text-blue-600 font-medium">
                  {totalAlerts} Active
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {totalAlerts === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active warnings. All inventory &amp; orders are up to date!
                  </div>
                ) : (
                  <>
                    {lowStockItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate('/inventory');
                        }}
                        className="p-3 hover:bg-amber-50/50 cursor-pointer transition flex items-start gap-2.5"
                      >
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            Low Stock: {item.name}
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Only {item.stockQuantity} units left in warehouse.
                          </p>
                        </div>
                      </div>
                    ))}

                    {draftOrders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate(`/orders/${order.id}`);
                        }}
                        className="p-3 hover:bg-blue-50/50 cursor-pointer transition flex items-start gap-2.5"
                      >
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            Draft Order Pending: {order.orderNumber}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {order.customerName} • ₹{order.grandTotal.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                <button
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/inventory');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View Inventory Status <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs overflow-hidden">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser?.name.charAt(0) || 'U'
              )}
            </div>
            <div className="hidden lg:block text-left pr-1">
              <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser?.name}</p>
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                {currentUser?.role === 'ADMIN' ? 'Admin Role' : 'Sales Role'}
              </p>
            </div>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <p className="text-xs font-bold text-slate-900">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Shield className="w-3 h-3" />
                  {currentUser?.role === 'ADMIN' ? 'Full Administrator Access' : 'Sales Representative Access'}
                </div>
              </div>

              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Demo Account
                </div>
                <button
                  onClick={() => {
                    switchDemoUser('admin@savya.com');
                    setProfileOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                    isAdmin ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Admin (admin@savya.com)</span>
                  {isAdmin && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Active</span>}
                </button>
                <button
                  onClick={() => {
                    switchDemoUser('sales@savya.com');
                    setProfileOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                    !isAdmin ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Sales User (sales@savya.com)</span>
                  {!isAdmin && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">Active</span>}
                </button>
              </div>

              <div className="p-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5" />
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
