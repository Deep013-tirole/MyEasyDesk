import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = ''
}: EmptyStateProps) {
  return (
    <div
      className={`py-12 px-4 sm:px-6 rounded-3xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-center flex flex-col items-center justify-center max-w-xl mx-auto ${className}`}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-2xs mb-4">
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-slate-500 dark:text-slate-400" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionText && onAction && (
            <button
              onClick={onAction}
              type="button"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#0F4C81] text-white hover:bg-[#0A2540] transition shadow-xs cursor-pointer focus-civic"
            >
              {actionText}
            </button>
          )}

          {secondaryActionText && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              type="button"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer focus-civic"
            >
              {secondaryActionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
