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
  default: 'bg-white dark:bg-[#151E2E] border border-[#DCE8F5] dark:border-slate-800 shadow-[0_1px_3px_rgba(11,25,44,0.04)]',
  elevated: 'bg-white dark:bg-[#151E2E] border border-[#CBDFF7] dark:border-slate-800 shadow-lg shadow-blue-950/5',
  subtle: 'bg-[#F0F5FA] dark:bg-[#0E1524] border border-[#D8E6F5] dark:border-slate-800/80',
  tinted: 'bg-gradient-to-r from-[#EBF3FC] to-[#F1F6FD] dark:bg-[#0f1f38]/40 border border-[#CBDFF7] dark:border-blue-900/40',
  outline: 'bg-transparent border border-[#D8E6F5] dark:border-slate-800',
  interactive: 'bg-white dark:bg-[#151E2E] border border-[#DCE8F5] dark:border-slate-800 shadow-2xs hover:border-[#0062FF]/50 hover:shadow-xl hover:shadow-blue-950/8 hover:-translate-y-1 cursor-pointer transition-all duration-200'
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
    ? 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl hover:shadow-blue-950/8 hover:-translate-y-1 transition-all duration-200'
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
