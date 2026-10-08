import React from 'react';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs.js';

export type PageHeaderBadge = string | {
  text: string;
  icon?: React.ReactNode;
};

export interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  badge?: PageHeaderBadge;
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  breadcrumbs,
  badge,
  icon,
  title,
  description,
  subtitle,
  actions,
  className = ''
}: PageHeaderProps) {
  const badgeObj = typeof badge === 'string' ? { text: badge, icon: icon } : badge;
  const descContent = description || subtitle;

  return (
    <section className={`border-b border-[#D3E3F5] dark:border-slate-800 bg-gradient-to-b from-[#E6F0FA] via-[#EDF5FD] to-[#F4F8FC] dark:from-[#0B0F19] dark:via-[#111827] dark:to-[#0B0F19] ${className}`}>
      <div className="portal-container py-6 sm:py-9 space-y-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} />
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            {badgeObj && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-blue-100/90 text-[#0062FF] border border-blue-200/90 dark:bg-blue-950/60 dark:text-cyan-300 dark:border-blue-800/80 shadow-2xs">
                {badgeObj.icon}
                <span>{badgeObj.text}</span>
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0B192C] dark:text-white tracking-tight leading-tight m-0">
              {title}
            </h1>
            {descContent && (
              <p className="text-xs sm:text-sm text-[#334E68] dark:text-slate-300 leading-relaxed font-normal m-0 max-w-2xl">
                {descContent}
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
  );
}
