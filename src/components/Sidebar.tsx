import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Boxes,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { orderService } from '../services/orderService';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { currentUser, isAdmin, isSales, logout, switchDemoUser } = useAuth();
  const navigate = useNavigate();

  // Get live badge counters (role-scoped for sales representative draft visibility)
  const allProducts = storage.getProducts();
  const products = isAdmin ? allProducts : allProducts.filter((p) => p.status === 'Active');
  const lowStockCount = products.filter((p) => p.stockQuantity <= 10).length;

  const orders = orderService.getAll(undefined, currentUser);
  const draftOrdersCount = orders.filter((o) => o.status === 'Draft').length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: Users,
      adminOnly: false,
    },
    {
      to: '/products',
      label: 'Products',
      icon: Package,
      adminOnly: false,
    },
    {
      to: '/orders',
      label: 'Sales Orders',
      icon: ShoppingCart,
      adminOnly: false,
      badge: draftOrdersCount > 0 ? { count: draftOrdersCount, color: 'bg-slate-700 text-slate-200' } : undefined,
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: Boxes,
      adminOnly: false,
      badge: lowStockCount > 0 ? { count: lowStockCount, color: 'bg-amber-500/20 text-amber-300' } : undefined,
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: BarChart3,
      adminOnly: false,
    },
    {
      to: '/csv-import',
      label: 'CSV Import',
      icon: FileSpreadsheet,
      adminOnly: true, // Admin-only per requirement
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      adminOnly: false,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-[#0F172A] border-r border-slate-800 text-slate-300 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shadow-xl`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-[#0B1120]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 font-black tracking-wider">
              <Building2 className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-white text-base tracking-tight leading-tight">
                  Savya<span className="text-blue-400">NT</span> ERP
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase">
                  Sales &amp; Inventory
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle button */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Role Badge Banner */}
        {!isCollapsed && (
          <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser?.name.charAt(0) || 'U'
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{currentUser?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      isAdmin ? 'bg-blue-400' : 'bg-indigo-400'
                    }`}
                  />
                  <span className="text-[11px] font-medium text-slate-300">
                    {isAdmin ? 'Administrator' : 'Sales User'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick switcher tooltip */}
            <button
              onClick={() => {
                const targetEmail = isAdmin ? 'sales@savya.com' : 'admin@savya.com';
                switchDemoUser(targetEmail);
              }}
              title="Click to toggle between Admin and Sales User demo accounts"
              className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-700/80 hover:bg-blue-600 hover:text-white text-slate-300 transition"
            >
              Switch
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isRestricted = item.adminOnly && isSales;

            if (isRestricted) {
              return (
                <div
                  key={item.to}
                  title="Admin Only module"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 opacity-50 cursor-not-allowed text-xs font-medium ${
                    isCollapsed ? 'justify-center' : ''
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.label}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group relative ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                  } ${isCollapsed ? 'justify-center' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badge.color}`}
                  >
                    {item.badge.count}
                  </span>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0B1120]/70">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Sign out of system"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
