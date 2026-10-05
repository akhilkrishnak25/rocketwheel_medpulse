import React, { useState } from 'react';
import { Loader2, ImageOff } from 'lucide-react';

/**
 * Standard Inline Spinner for Buttons, Inputs, Dropdowns
 */
export const InlineSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  return (
    <Loader2 className={`animate-spin text-current shrink-0 ${sizeMap[size]} ${className}`} />
  );
};

/**
 * Full page or section loader with Rocket Wheel styling
 */
export const PageLoader: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading MediPulse clinical data...',
  className = '',
}) => {
  return (
    <div
      className={`min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4 text-center ${className}`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-3 border-royal-200 border-t-royal-600 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF1D6B]"></div>
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-500 tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );
};

/**
 * Shimmer base skeleton block
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-xl overflow-hidden relative ${className}`}
    />
  );
};

/**
 * Multi-line Text Skeleton
 */
export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? 'w-3/4' : 'w-full'} rounded-md`}
        />
      ))}
    </div>
  );
};

/**
 * Dashboard / Catalog Card Skeleton Placeholder
 */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
};

/**
 * Table Rows Skeleton Placeholder
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 5,
  className = '',
}) => {
  return (
    <div className={`w-full divide-y divide-slate-100 ${className}`}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center justify-between p-4 gap-4">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-4 ${
                cIdx === 0 ? 'w-24' : cIdx === 1 ? 'w-48' : cIdx === columns - 1 ? 'w-16' : 'w-32'
              } rounded`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Responsive Image with Loading Placeholder & Fallback
 */
export const ImageWithFallback: React.FC<{
  src?: string | null;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}> = ({ src, alt, className = '', fallbackIcon }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(!src);

  if (hasError || !src) {
    return (
      <div
        className={`bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden ${className}`}
        title={alt}
      >
        {fallbackIcon || <ImageOff className="w-5 h-5 opacity-50" />}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <Skeleton className="absolute inset-0 w-full h-full" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
