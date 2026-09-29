import React from 'react';

export type EyebrowBadge = string | {
  text: string;
  icon?: React.ReactNode;
};

export interface SectionHeaderProps {
  badge?: EyebrowBadge;
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  align?: 'left' | 'center';
  actions?: React.ReactNode;
  className?: string;
  inverted?: boolean;
}

export default function SectionHeader({
  badge,
  icon,
  title,
  subtitle,
  align = 'left',
  actions,
  className = '',
  inverted = false
}: SectionHeaderProps) {
  const isCenter = align === 'center';
  const badgeObj = typeof badge === 'string' ? { text: badge, icon: icon } : badge;

  return (
    <div
      className={`mb-8 sm:mb-12 w-full ${
        isCenter ? 'text-center flex flex-col items-center' : 'flex flex-col md:flex-row md:items-end justify-between gap-4'
      } ${className}`}
    >
      <div className={`space-y-2.5 ${isCenter ? 'max-w-2xl mx-auto' : 'max-w-3xl'}`}>
        {badgeObj && (
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-2xs ${
              inverted
                ? 'bg-white/10 text-cyan-300 border border-white/20'
                : 'bg-blue-50 text-[#0F4C81] border border-blue-200/70 dark:bg-blue-950/60 dark:text-cyan-300 dark:border-blue-800/80'
            }`}
          >
            {badgeObj.icon}
            <span>{badgeObj.text}</span>
          </div>
        )}

        <h2
          className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight m-0 ${
            inverted ? 'text-white' : 'text-slate-900 dark:text-slate-50'
          }`}
        >
          {title}
        </h2>

        {subtitle && (
          <p
            className={`text-xs sm:text-sm md:text-base leading-relaxed font-normal m-0 ${
              inverted ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="shrink-0 flex items-center gap-2.5 pt-2 md:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
