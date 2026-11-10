import React from 'react';
import { OrderStatus, EntityStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus | EntityStatus | 'In Stock' | 'Low Stock' | 'Out of Stock' | 'ADMIN' | 'SALES' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (status) {
    // Order Statuses
    case 'Draft':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Draft
        </span>
      );
    case 'Confirmed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Confirmed
        </span>
      );
    case 'Cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Cancelled
        </span>
      );

    // Stock Statuses
    case 'In Stock':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          In Stock
        </span>
      );
    case 'Low Stock':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Low Stock
        </span>
      );
    case 'Out of Stock':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-rose-100 text-rose-800 border border-rose-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Out of Stock
        </span>
      );

    // Entity status
    case 'Active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      );
    case 'Inactive':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Inactive
        </span>
      );

    // Role
    case 'ADMIN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}
        >
          Admin
        </span>
      );
    case 'SALES':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses}`}
        >
          Sales User
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
