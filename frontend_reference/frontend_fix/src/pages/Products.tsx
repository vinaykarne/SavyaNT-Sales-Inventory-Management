import React, { useState } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Tag,
  Boxes,
  Lock,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import { EntityStatus, Product, ProductCategory } from '../types';
import { productService } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateProductForm } from '../utils/validators';
import { formatCurrency, formatDate, getStockStatus } from '../utils/formatters';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';

const CATEGORIES: ProductCategory[] = [
  'Accessories',
  'Peripherals',
  'Audio',
  'Storage',
  'Networking',
  'Displays',
  'Components',
  'Power',
];

export const Products: React.FC = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>(() => isAdmin ? productService.getAll() : productService.getActive());
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    productCode: '',
    name: '',
    category: 'Accessories' as ProductCategory | string,
    price: 0,
    stockQuantity: 0,
    status: 'Active' as EntityStatus,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // View Modal
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // Delete Confirm Dialog
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const refreshList = () => {
    setProducts(isAdmin ? productService.getAll() : productService.getActive());
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      productCode: '',
      name: '',
      category: 'Accessories',
      price: 0,
      stockQuantity: 0,
      status: 'Active',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      productCode: product.productCode,
      name: product.name,
      category: product.category,
      price: product.price,
      stockQuantity: product.stockQuantity,
      status: product.status,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existingCodes = editingProduct
      ? products.filter((p) => p.id !== editingProduct.id).map((p) => p.productCode.toUpperCase())
      : products.map((p) => p.productCode.toUpperCase());

    const validation = validateProductForm(formData, existingCodes);

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    if (editingProduct) {
      const res = productService.update(editingProduct.id, formData);
      if (res.success) {
        toast.success(`Product "${formData.name}" updated successfully.`);
        setIsFormOpen(false);
        refreshList();
      } else {
        toast.error(res.error || 'Failed to update product');
      }
    } else {
      const res = productService.create(formData);
      if (res.success) {
        toast.success(`Product "${formData.name}" added to catalog.`);
        setIsFormOpen(false);
        refreshList();
      } else {
        toast.error(res.error || 'Failed to create product');
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    const res = productService.delete(productToDelete.id);
    if (res.success) {
      toast.success(`Product "${productToDelete.name}" deleted.`);
      setProductToDelete(null);
      refreshList();
    } else {
      toast.error(res.error || 'Cannot delete product.');
      setProductToDelete(null);
    }
  };

  const handleToggleStatus = (product: Product) => {
    const res = productService.toggleStatus(product.id);
    if (res.success) {
      toast.info(`Status of "${product.name}" changed to ${res.newStatus}`);
      refreshList();
    } else {
      toast.error(res.error || 'Failed to update product status');
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
    if (statusFilter === 'Active' && p.status !== 'Active') return false;
    if (statusFilter === 'Inactive' && p.status !== 'Inactive') return false;
    return true;
  });

  const columns: Column<Product>[] = [
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
          <span className="text-[11px] text-slate-400">Added on {formatDate(p.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Tag className="w-3 h-3 text-slate-400" />
          {p.category}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Selling Price (₹)',
      sortable: true,
      sortValue: (p) => p.price,
      className: 'font-mono text-xs font-bold text-slate-900',
      render: (p) => formatCurrency(p.price),
    },
    {
      key: 'stockQuantity',
      header: 'Available Stock',
      sortable: true,
      sortValue: (p) => p.stockQuantity,
      render: (p) => {
        const stockStatus = getStockStatus(p.stockQuantity);
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 font-mono text-xs">
              {p.stockQuantity}
            </span>
            <StatusBadge status={stockStatus.label} size="sm" />
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setViewProduct(p)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin ? (
            <>
              <button
                onClick={() => handleOpenEdit(p)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Edit Product"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleStatus(p)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                title={p.status === 'Active' ? 'Deactivate Product' : 'Activate Product'}
              >
                {p.status === 'Active' ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setProductToDelete(p)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Delete Product"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span
              className="p-1 text-slate-300"
              title="Admin role required to modify product catalog"
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
              Product Master Catalog
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {products.length} Items
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage electronic hardware, component rates in INR, inventory thresholds, and SKU definitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Catalog View Only (Sales Mode)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search by product code (e.g. PRD-001) or name..."
        searchFilter={(p, q) =>
          p.productCode.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        }
        defaultSortKey="productCode"
        defaultSortDirection="asc"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.productCode}` : 'Add New Product'}
        subtitle="Specify product code, category, unit price, and initial warehouse stock."
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
              {editingProduct ? 'Update Product' : 'Save Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Product Code / SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.productCode}
                onChange={(e) =>
                  setFormData({ ...formData, productCode: e.target.value.toUpperCase() })
                }
                placeholder="e.g. PRD-013"
                className={`w-full p-2.5 rounded-lg border text-xs font-mono focus:outline-hidden transition ${
                  formErrors.productCode
                    ? 'border-rose-400 bg-rose-50/50'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.productCode && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.productCode}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 24-Port Gigabit Smart Switch"
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
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className={`w-full pl-7 pr-3 py-2.5 rounded-lg border text-xs font-mono focus:outline-hidden transition ${
                    formErrors.price
                      ? 'border-rose-400 bg-rose-50/50'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
              </div>
              {formErrors.price && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.price}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial Stock Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, stockQuantity: parseInt(e.target.value, 10) || 0 })
                }
                className={`w-full p-2.5 rounded-lg border text-xs font-mono focus:outline-hidden transition ${
                  formErrors.stockQuantity
                    ? 'border-rose-400 bg-rose-50/50'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.stockQuantity && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.stockQuantity}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Catalog Status
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
        </form>
      </Modal>

      {/* View Product Details Modal */}
      <Modal
        isOpen={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title="Product Specifications"
        maxWidth="md"
        footer={
          <button
            onClick={() => setViewProduct(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            Close
          </button>
        }
      >
        {viewProduct && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-mono text-xs text-blue-600 font-bold">
                  {viewProduct.productCode}
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{viewProduct.name}</h4>
                <span className="inline-block mt-1 text-[11px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  {viewProduct.category}
                </span>
              </div>
              <StatusBadge status={viewProduct.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-slate-100 bg-white">
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Selling Price</p>
                <p className="text-slate-900 font-mono font-bold text-sm mt-0.5">
                  {formatCurrency(viewProduct.price)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Current Stock</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-slate-900 font-mono font-bold text-sm">
                    {viewProduct.stockQuantity} units
                  </span>
                  <StatusBadge status={getStockStatus(viewProduct.stockQuantity).label} size="sm" />
                </div>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Created</p>
                <p className="text-slate-700 mt-0.5">{formatDate(viewProduct.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Last Stock Update</p>
                <p className="text-slate-700 mt-0.5">
                  {viewProduct.lastStockUpdate ? formatDate(viewProduct.lastStockUpdate) : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Product Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product Confirmation"
        message={`Are you sure you want to permanently delete "${productToDelete?.name}" (${productToDelete?.productCode})?`}
        variant="danger"
        confirmLabel="Delete Product"
        details={
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Integrity Guard:</strong> If this product is referenced by any sales order line items
              or historical stock movement records, the deletion will be rejected to preserve audit integrity.
              You may set its status to <em>Inactive</em> instead.
            </p>
          </div>
        }
      />
    </div>
  );
};
