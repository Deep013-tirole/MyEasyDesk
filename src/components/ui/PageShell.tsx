import React from 'react';
import PageHeader from './PageHeader.js';
import { BreadcrumbItem } from './Breadcrumbs.js';

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
  bodyClassName?: string;
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
  bodyClassName = ''
}: PageShellProps) {
  return (
    <div id={id} className={`w-full max-w-full overflow-x-hidden min-h-[70vh] ${className}`}>
      {/* Consistent Page Header Banner */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        badge={badge}
        title={title}
        description={description}
        actions={actions}
        className={headerClassName}
      />

      {/* Main Page Content Body */}
      <div className={`portal-container py-8 sm:py-12 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
