import React from 'react';

export type SectionBackgroundVariant = 'default' | 'subtle' | 'muted' | 'brand-tint' | 'dark';
export type SectionSize = 'sm' | 'md' | 'lg' | 'hero';

export interface SectionContainerProps {
  id?: string;
  variant?: SectionBackgroundVariant;
  size?: SectionSize;
  dividerTop?: boolean;
  dividerBottom?: boolean;
  topDivider?: boolean;
  bottomDivider?: boolean;
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  ariaLabel?: string;
}

const variantStyles: Record<SectionBackgroundVariant, string> = {
  default: 'bg-[#F4F8FC] dark:bg-[#151E2E] text-slate-900 dark:text-slate-100',
  subtle: 'bg-[#EBF3FC]/60 dark:bg-[#0E1524] text-slate-900 dark:text-slate-100 border-y border-[#D8E6F5] dark:border-slate-800',
  muted: 'bg-[#EBF2FA] dark:bg-[#131B2E] text-slate-900 dark:text-slate-100 border-y border-[#D8E6F5] dark:border-slate-800',
  'brand-tint': 'bg-gradient-to-b from-[#E6F0FA] via-[#EDF5FD] to-[#F4F8FC] dark:from-[#0c1a2f]/60 dark:to-[#0B0F19] text-slate-900 dark:text-slate-100 border-y border-[#D3E3F5] dark:border-slate-800/60',
  dark: 'bg-[#0B192C] text-white border-y border-slate-800'
};

const sizeStyles: Record<SectionSize, string> = {
  sm: 'py-8 sm:py-10',
  md: 'py-12 sm:py-16',
  lg: 'py-16 sm:py-20 lg:py-24',
  hero: 'pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24'
};

export default function SectionContainer({
  id,
  variant = 'default',
  size = 'md',
  dividerTop = false,
  dividerBottom = false,
  topDivider,
  bottomDivider,
  noPadding = false,
  children,
  className = '',
  containerClassName = '',
  ariaLabel
}: SectionContainerProps) {
  const bgClass = variantStyles[variant] || variantStyles.default;
  const paddingClass = noPadding ? '' : sizeStyles[size] || sizeStyles.md;
  const hasTopDivider = dividerTop || topDivider;
  const hasBottomDivider = dividerBottom || bottomDivider;
  const borderTop = hasTopDivider ? 'border-t border-slate-200/80 dark:border-slate-800' : '';
  const borderBottom = hasBottomDivider ? 'border-b border-slate-200/80 dark:border-slate-800' : '';

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`w-full max-w-full relative transition-colors duration-200 ${bgClass} ${paddingClass} ${borderTop} ${borderBottom} ${className}`}
    >
      <div className={`portal-container w-full max-w-full ${containerClassName}`}>
        {children}
      </div>
    </section>
  );
}
