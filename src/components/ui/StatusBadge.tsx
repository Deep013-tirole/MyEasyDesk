import React from 'react';

export type StatusBadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  primary: 'bg-blue-50 text-[#0F4C81] border-blue-200/70 dark:bg-blue-950/60 dark:text-cyan-300 dark:border-blue-800/80',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  info: 'bg-cyan-50 text-cyan-800 border-cyan-200/70 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/80'
};

export default function StatusBadge({
  variant = 'primary',
  icon,
  children,
  className = '',
  size = 'sm'
}: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm font-bold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border shadow-2xs ${variantStyles[variant]} ${sizeClass} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
