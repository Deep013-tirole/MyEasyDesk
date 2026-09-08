import React from 'react';
import { LucideIcon, ShieldCheck, Lock, Zap, FileCheck, Award, Clock } from 'lucide-react';

interface TrustBadgeProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  variant?: 'default' | 'compact' | 'pill';
  className?: string;
}

export default function TrustBadge({
  icon: Icon = ShieldCheck,
  title,
  description,
  variant = 'default',
  className = ''
}: TrustBadgeProps) {
  if (variant === 'pill') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50/80 text-[#0F4C81] border border-blue-200/60 shadow-2xs ${className}`}
      >
        <Icon className="w-3.5 h-3.5 text-[#0F4C81] shrink-0" aria-hidden="true" />
        <span>{title}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs ${className}`}
      >
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0F4C81] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="text-xs font-bold text-slate-800 leading-tight">{title}</span>
      </div>
    );
  }

  return (
    <div 
      className={`p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-start gap-3.5 ${className}`}
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#0F4C81] border border-blue-100/70 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
        <Icon className="w-5 h-5 text-[#0F4C81]" aria-hidden="true" />
      </div>
      <div className="space-y-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 tracking-tight leading-snug m-0">{title}</h4>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed font-normal m-0">{description}</p>
        )}
      </div>
    </div>
  );
}
