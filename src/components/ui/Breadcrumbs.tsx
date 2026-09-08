import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center gap-1.5 text-xs text-slate-500 font-medium overflow-x-auto no-scrollbar py-1 ${className}`}
    >
      <button
        onClick={items[0]?.onClick}
        type="button"
        className="inline-flex items-center gap-1 text-slate-500 hover:text-[#0F4C81] transition-colors cursor-pointer shrink-0 focus-civic rounded px-1"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="sr-only">Home</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1 || item.active;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 select-none" aria-hidden="true" />
            {isLast ? (
              <span 
                className="font-bold text-slate-900 truncate max-w-[220px] sm:max-w-xs" 
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-[#0F4C81] transition-colors cursor-pointer truncate max-w-[150px] sm:max-w-[200px] shrink-0 focus-civic rounded px-1 text-slate-600"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
