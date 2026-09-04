import React from 'react';

interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  key?: React.Key;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function BaseCard({ children, className = '', hoverEffect = false, ...props }: BaseCardProps) {
  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-xs transition-all duration-300 ${
        hoverEffect ? 'hover-lift hover:border-blue-300 hover:shadow-xl' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function BaseCardHeader({ children, className = '', ...props }: BaseCardProps) {
  return (
    <div className={`p-5 border-b border-[#E5E7EB] bg-[#F8FAFC] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function BaseCardBody({ children, className = '', ...props }: BaseCardProps) {
  return (
    <div className={`p-[20px] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function BaseCardFooter({ children, className = '', ...props }: BaseCardProps) {
  return (
    <div className={`px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E5E7EB] ${className}`} {...props}>
      {children}
    </div>
  );
}
