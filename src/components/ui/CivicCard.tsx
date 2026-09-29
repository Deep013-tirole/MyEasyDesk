import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'subtle' | 'tinted' | 'outline' | 'interactive';

export interface CivicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  key?: React.Key | null | undefined;
  as?: 'div' | 'article' | 'section';
  variant?: CardVariant;
  hoverEffect?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 shadow-2xs',
  elevated: 'bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 shadow-md',
  subtle: 'bg-slate-50/70 dark:bg-[#0E1524] border border-slate-200/70 dark:border-slate-800/80',
  tinted: 'bg-blue-50/40 dark:bg-[#0f1f38]/40 border border-blue-100/70 dark:border-blue-900/40',
  outline: 'bg-transparent border border-slate-200 dark:border-slate-800',
  interactive: 'bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-[#0F4C81]/50 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200'
};

export default function CivicCard({
  as: Component = 'div',
  variant = 'default',
  hoverEffect = false,
  children,
  className = '',
  onClick,
  id,
  ...rest
}: CivicCardProps) {
  const baseVariant = variantStyles[variant] || variantStyles.default;
  const hoverClass = hoverEffect && variant !== 'interactive'
    ? 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'
    : '';

  return (
    <Component
      id={id}
      onClick={onClick}
      className={`rounded-2xl overflow-hidden transition-all duration-200 ${baseVariant} ${hoverClass} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
