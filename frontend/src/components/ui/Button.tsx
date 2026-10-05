import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pink' | 'gold' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-royal-600 !text-white text-white hover:bg-royal-700 focus:ring-royal-500 shadow-sm active:bg-royal-800 font-bold',
    pink:
      'bg-[#FF1D6B] !text-white text-white hover:bg-[#e1145a] focus:ring-pink-500 shadow-sm active:bg-[#be0c47] font-bold',
    gold:
      'bg-[#FBA94C] text-slate-950 font-bold hover:bg-[#f59e0b] focus:ring-amber-400 shadow-sm',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400 active:bg-slate-300 font-semibold',
    outline:
      'border border-slate-300 bg-white text-slate-700 hover:bg-royal-50/50 hover:text-royal-600 hover:border-royal-300 focus:ring-royal-500 shadow-sm font-semibold',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300 font-semibold',
    danger:
      'bg-rose-600 !text-white text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm font-bold',
    success:
      'bg-emerald-600 !text-white text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm font-bold',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5',
  };

  const isLightTextVariant = variant === 'primary' || variant === 'pink' || variant === 'danger' || variant === 'success';

  return (
    <button
      type={type}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      style={{
        color: isLightTextVariant ? '#ffffff' : undefined,
        ...props.style,
      }}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      <span className="inline-flex items-center justify-center gap-2" style={{ color: 'inherit' }}>
        {children}
      </span>
    </button>
  );
};
