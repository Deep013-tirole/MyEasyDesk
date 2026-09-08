import React from 'react';

export function ServiceCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between h-[280px] shadow-2xs overflow-hidden relative">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-20 h-5 rounded-full skeleton-shimmer" />
          <div className="w-16 h-4 rounded-full skeleton-shimmer" />
        </div>
        <div className="w-3/4 h-6 rounded-md skeleton-shimmer" />
        <div className="space-y-2">
          <div className="w-full h-3 rounded skeleton-shimmer" />
          <div className="w-5/6 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="w-24 h-5 rounded skeleton-shimmer" />
        <div className="w-20 h-8 rounded-xl skeleton-shimmer" />
      </div>
    </div>
  );
}

export function BlogCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs flex flex-col h-[320px]">
      <div className="w-full h-44 skeleton-shimmer" />
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="w-1/3 h-4 rounded-full skeleton-shimmer" />
          <div className="w-5/6 h-5 rounded skeleton-shimmer" />
          <div className="w-full h-3 rounded skeleton-shimmer" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="w-20 h-3 rounded skeleton-shimmer" />
          <div className="w-16 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function ServiceDetailsSkeleton() {
  return (
    <div className="portal-container py-8 sm:py-12 space-y-8 animate-in fade-in">
      <div className="w-48 h-4 rounded skeleton-shimmer mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-4">
            <div className="w-32 h-6 rounded-full skeleton-shimmer" />
            <div className="w-3/4 h-8 rounded skeleton-shimmer" />
            <div className="space-y-2 pt-4">
              <div className="w-full h-4 rounded skeleton-shimmer" />
              <div className="w-full h-4 rounded skeleton-shimmer" />
              <div className="w-2/3 h-4 rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-4">
            <div className="w-40 h-6 rounded skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="h-12 rounded-xl skeleton-shimmer" />
              <div className="h-12 rounded-xl skeleton-shimmer" />
              <div className="h-12 rounded-xl skeleton-shimmer" />
              <div className="h-12 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5">
          <div className="w-24 h-4 rounded skeleton-shimmer" />
          <div className="w-36 h-8 rounded skeleton-shimmer" />
          <div className="w-full h-11 rounded-xl skeleton-shimmer" />
          <div className="w-full h-11 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6, type = 'service' }: { count?: number; type?: 'service' | 'blog' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        type === 'service' ? <ServiceCardSkeleton key={i} /> : <BlogCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default {
  ServiceCardSkeleton,
  BlogCardSkeleton,
  ServiceDetailsSkeleton,
  GridSkeleton
};
