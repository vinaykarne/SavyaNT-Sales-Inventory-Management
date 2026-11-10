import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate';
  badge?: {
    text: string;
    variant: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  badge,
  onClick,
}) => {
  const getTheme = () => {
    switch (variant) {
      case 'emerald':
        return {
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          accent: 'border-l-4 border-l-emerald-500',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
          accent: 'border-l-4 border-l-amber-500',
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
          accent: 'border-l-4 border-l-purple-500',
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
          accent: 'border-l-4 border-l-rose-500',
        };
      case 'slate':
        return {
          iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
          accent: 'border-l-4 border-l-slate-400',
        };
      case 'blue':
      default:
        return {
          iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
          accent: 'border-l-4 border-l-blue-600',
        };
    }
  };

  const getBadgeClass = (bVariant: string) => {
    switch (bVariant) {
      case 'positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'negative':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const theme = getTheme();

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-5 border border-slate-200 shadow-xs transition duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''
      } ${theme.accent}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight truncate">{value}</h4>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${theme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span
            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium border ${getBadgeClass(
              badge.variant
            )}`}
          >
            {badge.text}
          </span>
        </div>
      )}
    </div>
  );
};
