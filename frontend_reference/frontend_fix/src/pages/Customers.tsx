import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Customer, EntityStatus } from '../types';
import { customerService } from '../services/customerService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateCustomerForm } from '../utils/validators';
import { formatDate } from '../utils/formatters';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';

export const Customers: React.FC = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [customers, setCustomers] = useState<Customer[]>(() => isAdmin ? customerService.getAll() : customerService.getActive());
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    city: '',
    status: 'Active' as EntityStatus,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // View Customer Details
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  // Delete Confirm Dialog
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const refreshList = () => {
    setCustomers(isAdmin ? customerService.getAll() : customerService.getActive());
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      city: '',
      status: 'Active',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      city: customer.city,
      status: customer.status,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCustomerForm(formData);

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    if (editingCustomer) {
      const res = customerService.update(editingCustomer.id, formData);
      if (res.success) {
        toast.success(`Customer "${formData.name}" updated successfully.`);
        setIsFormOpen(false);
        refreshList();
      } else {
        toast.error(res.error || 'Failed to update customer');
      }
    } else {
      const res = customerService.create(formData);
      if (res.success) {
        toast.success(`Customer "${formData.name}" added successfully.`);
        setIsFormOpen(false);
        refreshList();
      } else {
        toast.error(res.error || 'Failed to create customer');
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (!customerToDelete) return;
    const res = customerService.delete(customerToDelete.id);
    if (res.success) {
      toast.success(`Customer "${customerToDelete.name}" deleted.`);
      setCustomerToDelete(null);
      refreshList();
    } else {
      toast.error(res.error || 'Cannot delete customer.');
      setCustomerToDelete(null);
    }
  };

  const handleToggleStatus = (customer: Customer) => {
    const res = customerService.toggleStatus(customer.id);
    if (res.success) {
      toast.info(`Status of "${customer.name}" set to ${res.newStatus}`);
      refreshList();
    } else {
      toast.error(res.error || 'Failed to update status');
    }
  };

  // Filter customers by status
  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === 'Active') return c.status === 'Active';
    if (statusFilter === 'Inactive') return c.status === 'Inactive';
    return true;
  });

  const columns: Column<Customer>[] = [
    {
      key: 'id',
      header: 'Customer ID',
      sortable: true,
      className: 'font-mono text-xs font-semibold text-blue-600',
    },
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      render: (c) => (
        <div>
          <span className="font-semibold text-slate-900 block">{c.name}</span>
          <span className="text-[11px] text-slate-400 font-mono">Member since {formatDate(c.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      sortable: true,
      render: (c) => (
        <span className="text-slate-600 text-xs flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          {c.email}
        </span>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      sortable: true,
      render: (c) => (
        <span className="text-slate-700 font-mono text-xs flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          +91 {c.mobile}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      render: (c) => (
        <span className="text-slate-700 text-xs flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          {c.city}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (c) => <StatusBadge status={c.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setViewCustomer(c)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin ? (
            <>
              <button
                onClick={() => handleOpenEdit(c)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Edit Customer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleStatus(c)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                title={c.status === 'Active' ? 'Deactivate Customer' : 'Activate Customer'}
              >
                {c.status === 'Active' ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setCustomerToDelete(c)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span
              className="p-1 text-slate-300"
              title="Admin role required to modify master customer records"
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
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
              Customer Directory
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {customers.length} Registered
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage trading clients, contact details, and account active/inactive statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Read-only (Sales User Mode)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        keyExtractor={(c) => c.id}
        searchPlaceholder="Search by customer name, email, or mobile..."
        searchFilter={(c, q) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.mobile.includes(q) ||
          c.city.toLowerCase().includes(q)
        }
        defaultSortKey="name"
        defaultSortDirection="asc"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        }
      />

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
        subtitle="Ensure customer name, email, and 10-digit Indian mobile number are correct."
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
            >
              {editingCustomer ? 'Update Customer' : 'Save Customer'}
            </button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Aarav Patel"
              className={`w-full p-2.5 rounded-lg border text-xs focus:outline-hidden transition ${
                formErrors.name
                  ? 'border-rose-400 bg-rose-50/50'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {formErrors.name && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@domain.in"
                className={`w-full p-2.5 rounded-lg border text-xs focus:outline-hidden transition ${
                  formErrors.email
                    ? 'border-rose-400 bg-rose-50/50'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.email && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="9820123456"
                  className={`w-full p-2.5 rounded-r-lg border text-xs focus:outline-hidden transition ${
                    formErrors.mobile
                      ? 'border-rose-400 bg-rose-50/50'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
              </div>
              {formErrors.mobile && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.mobile}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Mumbai, Chennai, Delhi"
                className={`w-full p-2.5 rounded-lg border text-xs focus:outline-hidden transition ${
                  formErrors.city
                    ? 'border-rose-400 bg-rose-50/50'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.city && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.city}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as EntityStatus })
                }
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* View Customer Details Drawer/Modal */}
      <Modal
        isOpen={!!viewCustomer}
        onClose={() => setViewCustomer(null)}
        title="Customer Profile &amp; History"
        maxWidth="md"
        footer={
          <button
            onClick={() => setViewCustomer(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            Close
          </button>
        }
      >
        {viewCustomer && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-mono text-xs text-blue-600 font-bold">
                  {viewCustomer.id}
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{viewCustomer.name}</h4>
              </div>
              <StatusBadge status={viewCustomer.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-slate-100 bg-white">
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Email</p>
                <p className="text-slate-800 font-medium mt-0.5">{viewCustomer.email}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Mobile</p>
                <p className="text-slate-800 font-mono mt-0.5">+91 {viewCustomer.mobile}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Location</p>
                <p className="text-slate-800 font-medium mt-0.5">{viewCustomer.city}, India</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Registration Date</p>
                <p className="text-slate-800 mt-0.5">{formatDate(viewCustomer.createdAt)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Customer Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer Confirmation"
        message={`Are you sure you want to delete customer "${customerToDelete?.name}" (${customerToDelete?.id})?`}
        variant="danger"
        confirmLabel="Delete Customer"
        details={
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Integrity Guard:</strong> If this customer has any past or existing sales orders
              (Draft, Confirmed, or Cancelled), the deletion will be safely rejected to protect transaction
              history. You may change their status to <em>Inactive</em> instead.
            </p>
          </div>
        }
      />
    </div>
  );
};
