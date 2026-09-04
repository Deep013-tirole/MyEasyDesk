import React from 'react';
import { FileQuestion, AlertCircle, RefreshCw, ArrowLeft, Home, HelpCircle, PhoneCall } from 'lucide-react';

export interface ContentUnavailableProps {
  title?: string;
  message?: string;
  statusCode?: number | string;
  onRetry?: () => void;
  retryText?: string;
  primaryActionText?: string;
  onPrimaryAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
  id?: string;
}

export default function ContentUnavailable({
  title = 'Content Unavailable',
  message = 'The requested information, service, or resource is currently unavailable or may have been updated.',
  statusCode = 404,
  onRetry,
  retryText = 'Try Again',
  primaryActionText,
  onPrimaryAction,
  secondaryActionText,
  onSecondaryAction,
  icon,
  compact = false,
  className = '',
  id = 'content-unavailable-state'
}: ContentUnavailableProps) {
  if (compact) {
    return (
      <div 
        id={id}
        className={`p-6 rounded-2xl border border-slate-200/90 bg-white shadow-xs text-center flex flex-col items-center justify-center gap-3 ${className}`}
      >
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/80">
          {icon || <FileQuestion className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            {statusCode && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {statusCode}
              </span>
            )}
            <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C81] hover:text-[#0b3b64] bg-blue-50/80 hover:bg-blue-100/80 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{retryText}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      id={id}
      className={`min-h-[50vh] flex flex-col items-center justify-center px-4 py-16 text-center max-w-xl mx-auto animate-in fade-in duration-300 ${className}`}
    >
      {/* Icon Capsule */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-100/80 text-slate-600 flex items-center justify-center border border-slate-200/80 shadow-xs">
          {icon || <FileQuestion className="w-8 h-8 text-slate-500 stroke-[1.75]" />}
        </div>
        {statusCode && (
          <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-mono font-bold tracking-tight rounded-md bg-[#0F4C81] text-white shadow-xs">
            {statusCode}
          </span>
        )}
      </div>

      {/* Title & Message */}
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
        {title}
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
        {message}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{retryText}</span>
          </button>
        )}

        {primaryActionText && onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{primaryActionText}</span>
          </button>
        )}

        {secondaryActionText && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs transition-all cursor-pointer hover:border-slate-300"
          >
            <Home className="w-3.5 h-3.5 text-slate-500" />
            <span>{secondaryActionText}</span>
          </button>
        )}
      </div>

      {/* Support footer helper */}
      <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
        <span>Need assistance? Contact our verified helpdesk team for instant support.</span>
      </div>
    </div>
  );
}
