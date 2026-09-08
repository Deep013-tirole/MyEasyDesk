import React from 'react';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs.js';

interface PageShellProps {
  id?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: {
    text: string;
    icon?: React.ReactNode;
  };
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  compactHeader?: boolean;
}

export default function PageShell({
  id,
  breadcrumbs,
  badge,
  title,
  description,
  actions,
  children,
  className = '',
  headerClassName = '',
  compactHeader = false
}: PageShellProps) {
  return (
    <div id={id} className={`w-full max-w-full overflow-x-hidden min-h-[70vh] ${className}`}>
      {/* Consistent Page Header Banner */}
      <section className={`border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/30 ${headerClassName}`}>
        <div className="portal-container py-6 sm:py-9 space-y-4">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumbs items={breadcrumbs} />
          )}

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              {badge && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0F4C81] border border-blue-200/60 shadow-2xs">
                  {badge.icon}
                  <span>{badge.text}</span>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight m-0">
                {title}
              </h1>
              {description && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal m-0 max-w-2xl">
                  {description}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Page Content Body */}
      <div className="portal-container py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
