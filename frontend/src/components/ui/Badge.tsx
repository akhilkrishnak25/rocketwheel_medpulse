import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'royal' | 'pink' | 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const baseStyles = 'inline-flex items-center font-bold rounded-lg select-none';

  const variants = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    royal: 'bg-royal-50 text-royal-700 border border-royal-200',
    pink: 'bg-[#fff1f4] text-[#FF1D6B] border border-pink-200',
    gold: 'bg-amber-50 text-amber-900 border border-amber-300 font-extrabold',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-royal-50 text-royal-700 border border-royal-200',
    purple: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    outline: 'bg-transparent text-slate-600 border border-slate-300',
    primary: 'bg-royal-600 text-white border border-royal-600',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}>
      {children}
    </span>
  );
};
