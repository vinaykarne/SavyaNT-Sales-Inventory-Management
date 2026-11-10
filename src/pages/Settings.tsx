import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  RotateCcw,
  Database,
  Server,
  Layers,
  Check,
  AlertTriangle,
  Info,
  Building2,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resetToDemoData } from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { apiClient } from '../services/apiClient';

export const Settings: React.FC = () => {
  const { currentUser, isAdmin, switchDemoUser, refreshUser } = useAuth();
  const toast = useToast();

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ isChecking: boolean; tested: boolean; isOnline: boolean; environment?: string }>({
    isChecking: false,
    tested: false,
    isOnline: false,
  });

  const handleTestBackendConnection = async () => {
    setBackendStatus({ isChecking: true, tested: false, isOnline: false });
    const res = await apiClient.checkBackendHealth();
    setBackendStatus({
      isChecking: false,
      tested: true,
      isOnline: res.isOnline,
      environment: res.environment,
    });
    if (res.isOnline) {
      toast.success(`Python Flask backend is ONLINE in ${res.environment || 'development'} mode!`);
    } else {
      toast.warning('Flask server on http://localhost:5000 is not currently reachable. Start via: python backend/run.py');
    }
  };

  const handleResetData = () => {
    resetToDemoData();
    refreshUser();
    setIsResetConfirmOpen(false);
    toast.success('All demo data has been reset to factory defaults (8 customers, 12 products, 10 orders).');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            System Settings &amp; Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            User credentials, role permissions, demonstration reset controls, and future backend roadmap.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestBackendConnection}
            disabled={backendStatus.isChecking}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 text-blue-600 ${backendStatus.isChecking ? 'animate-spin' : ''}`} />
            {backendStatus.isChecking ? 'Testing...' : 'Check Backend Health'}
          </button>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Reset Demo Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-base flex items-center justify-center overflow-hidden shadow-xs">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser?.name.charAt(0) || 'U'
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{currentUser?.name}</h3>
              <p className="text-xs text-slate-500">{currentUser?.email}</p>
              <div className="mt-1">
                <StatusBadge status={currentUser?.role || 'SALES'} size="sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
              <span className="text-slate-400">Department:</span>
              <span className="font-semibold text-slate-800">{currentUser?.department || 'Trading'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
              <span className="text-slate-400">User ID:</span>
              <span className="font-mono text-slate-800">{currentUser?.id}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span className="text-slate-400">Session Type:</span>
              <span className="font-medium text-emerald-600">Active Demo Session</span>
            </div>
          </div>

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Toggle Demo Account:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => switchDemoUser('admin@savya.com')}
                className={`p-2 rounded-xl text-xs font-semibold text-left border transition ${
                  isAdmin
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Admin User
              </button>
              <button
                onClick={() => switchDemoUser('sales@savya.com')}
                className={`p-2 rounded-xl text-xs font-semibold text-left border transition ${
                  !isAdmin
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Sales User
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Role Permissions Matrix */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Role-Based UI Permissions Matrix
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            SavyaNT Systems technical assignment demonstrates role-based interface restrictions:
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">System Module / Capability</th>
                  <th className="py-2.5 px-3 text-center">ADMIN Role</th>
                  <th className="py-2.5 px-3 text-center">SALES USER Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">View Active Customers &amp; Catalog</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Full Access</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Full Access</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Create &amp; Manage Sales Orders</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ All Orders</td>
                  <td className="py-2 px-3 text-center text-blue-600 font-bold">✓ Own Orders</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Add / Edit / Delete Customers</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-2 px-3 text-center text-slate-400">✗ Read-Only</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Add / Edit / Delete Products</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-2 px-3 text-center text-slate-400">✗ Read-Only</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Manual Stock Adjustment (Increase/Decrease)</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-2 px-3 text-center text-slate-400">✗ Restricted</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Product CSV Bulk Import</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-2 px-3 text-center text-slate-400">✗ Restricted</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Business Intelligence Reports</td>
                  <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ All Reports</td>
                  <td className="py-2 px-3 text-center text-blue-600 font-bold">✓ View Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Backend Architecture Roadmap (Required per brief) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Future Python REST API &amp; MySQL Integration Roadmap
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The application service layer has been decoupled into modular JavaScript/TypeScript services (
          <code className="bg-slate-100 text-slate-800 px-1 rounded">orderService</code>,{' '}
          <code className="bg-slate-100 text-slate-800 px-1 rounded">inventoryService</code>,{' '}
          <code className="bg-slate-100 text-slate-800 px-1 rounded">customerService</code>). Below is how each
          module maps directly to future Python (FastAPI / Flask / Django) endpoints and MySQL tables:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              1. Sales Orders &amp; Atomic Stock Lock
            </h4>
            <p className="text-slate-600 leading-relaxed">
              <strong>Future Endpoint:</strong> <code className="text-blue-600 font-mono">POST /api/orders/confirm</code><br />
              <strong>MySQL Implementation:</strong> Transaction with row-level locks (
              <code className="bg-slate-200 px-1 rounded text-[11px]">SELECT stock FROM products WHERE id IN (...) FOR UPDATE</code>
              ). Guarantees that concurrent orders for low-stock items never over-commit.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              2. Product &amp; Customer Master Data
            </h4>
            <p className="text-slate-600 leading-relaxed">
              <strong>Future Endpoints:</strong> <code className="text-blue-600 font-mono">/api/products</code>, <code className="text-blue-600 font-mono">/api/customers</code><br />
              <strong>MySQL Implementation:</strong> Foreign key constraints (
              <code className="bg-slate-200 px-1 rounded text-[11px]">ON DELETE RESTRICT</code>
              ) enforcing that products or customers referenced in active or historical orders cannot be dropped.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              3. Inventory Movements Audit Trail
            </h4>
            <p className="text-slate-600 leading-relaxed">
              <strong>Future Endpoint:</strong> <code className="text-blue-600 font-mono">GET /api/inventory/movements</code><br />
              <strong>MySQL Implementation:</strong> Append-only immutable table <code className="font-mono text-purple-700">stock_movements</code> with foreign keys to <code className="font-mono">product_id</code>, <code className="font-mono">order_id</code>, and <code className="font-mono">user_id</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              4. All-or-Nothing CSV Bulk Import
            </h4>
            <p className="text-slate-600 leading-relaxed">
              <strong>Future Endpoint:</strong> <code className="text-blue-600 font-mono">POST /api/products/import-csv</code><br />
              <strong>MySQL Implementation:</strong> Executed within a single database transaction block. If any validation fails, the entire transaction is rolled back with 0 partial insertions.
            </p>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetData}
        title="Reset All Demo Data"
        message="Are you sure you want to restore the demonstration database to its original initial state? Any custom products, customers, orders, or stock adjustments will be replaced with the factory demo dataset."
        confirmLabel="Reset Everything"
        variant="danger"
        details={
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              This will re-initialize LocalStorage with 8 sample customers, 12 products, 10 sales
              orders, and corresponding stock movement logs.
            </p>
          </div>
        }
      />
    </div>
  );
};
