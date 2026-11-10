import React from 'react';
import { Printer, Download, CheckCircle, Clock, XCircle } from 'lucide-react';
import { SalesOrder } from '../types';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

interface OrderInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder | null;
}

export const OrderInvoiceModal: React.FC<OrderInvoiceModalProps> = ({ isOpen, onClose, order }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sales Order Invoice - ${order.orderNumber}`}
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400">
            Internal Document • SavyaNT ERP
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 sm:p-6 bg-white text-slate-800 space-y-6 print:p-0 print:text-black">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                S
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                SavyaNT Trading Systems Pvt. Ltd.
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Plot 42, Electronics Complex, Andheri East, Mumbai 400093
            </p>
            <p className="text-xs text-slate-500">
              GSTIN: 27AABCS1429B1Z8 • contact@savya.com • +91 22 2847 0000
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Tax Invoice / Sales Order
            </span>
            <h3 className="text-2xl font-black text-blue-600 tracking-tight mt-0.5">
              {order.orderNumber}
            </h3>
            <div className="mt-2 flex sm:justify-end">
              <StatusBadge status={order.status} size="sm" />
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To Customer</p>
            <p className="text-sm font-bold text-slate-900">{order.customerName}</p>
            <p className="text-slate-600 mt-0.5">Customer ID: {order.customerId}</p>
            <p className="text-slate-500 mt-1">Created on: {formatDate(order.orderDate)}</p>
          </div>

          <div className="sm:text-right">
            <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Order Details</p>
            <p className="text-slate-700">
              <span className="font-semibold">Order Date:</span> {formatDate(order.orderDate)}
            </p>
            <p className="text-slate-700 mt-0.5">
              <span className="font-semibold">Sales Representative:</span> {order.createdBy}
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
        </div>

        {/* Items Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Product Description</th>
                <th className="py-3 px-3 text-right">Unit Rate (₹)</th>
                <th className="py-3 px-3 text-center">Quantity</th>
                <th className="py-3 px-3 text-right">Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-400">{index + 1}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.productCode}</p>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatCurrency(item.rate)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
          <div className="text-xs text-slate-500 max-w-sm">
            {order.notes && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                <span className="font-bold text-slate-700 block">Notes &amp; Instructions:</span>
                <span className="italic">{order.notes}</span>
              </div>
            )}
            <p className="leading-relaxed">
              Standard commercial terms apply. Goods once sold can be returned only in compliance
              with SavyaNT warranty and return policies.
            </p>
          </div>

          <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-medium">{formatCurrency(order.subtotal)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Order Discount ({order.discountPercentage}%):</span>
              <span className="font-mono text-rose-600 font-medium">
                -{formatCurrency(order.discountAmount)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-extrabold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-base text-blue-600">
                {formatCurrency(order.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
