import React from 'react';
import { AlertTriangle, RotateCcw, MessageSquare } from 'lucide-react';
import { openGeneralWhatsApp } from '../../lib/whatsapp.js';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
  showWhatsAppHelp?: boolean;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
  showWhatsAppHelp = true
}: ErrorStateProps) {
  return (
    <div
      className={`py-10 px-4 sm:px-6 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 text-center flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 shadow-2xs mb-3.5">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm mb-6 leading-relaxed">
        {message}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#0F4C81] text-white hover:bg-[#0A2540] transition shadow-xs cursor-pointer focus-civic"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        )}

        {showWhatsAppHelp && (
          <button
            onClick={() => openGeneralWhatsApp('Hello My EasyDesk Support, I encountered an issue on the website.')}
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs cursor-pointer focus-civic"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ask Support on WhatsApp</span>
          </button>
        )}
      </div>
    </div>
  );
}
