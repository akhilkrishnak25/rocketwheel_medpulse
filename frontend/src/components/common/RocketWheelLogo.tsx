import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'on-blue';
  showSubtitle?: boolean;
}

export const RocketWheelLogo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'dark',
  showSubtitle = false,
}) => {
  const sizeClasses = {
    sm: {
      textR: 'text-2xl',
      textOcket: 'text-2xl',
      tagText: 'text-[9px]',
      rocketSize: 'w-5 h-5 -top-1.5 left-3.5',
      trail: 'w-7 h-3 top-2.5 -left-1',
      tagPadding: 'px-1.5 py-0.5',
      container: 'gap-1',
    },
    md: {
      textR: 'text-3xl',
      textOcket: 'text-3xl',
      tagText: 'text-[11px]',
      rocketSize: 'w-6 h-6 -top-2 left-4',
      trail: 'w-9 h-4 top-3.5 -left-1',
      tagPadding: 'px-2 py-0.5',
      container: 'gap-1.5',
    },
    lg: {
      textR: 'text-4xl',
      textOcket: 'text-4xl',
      tagText: 'text-xs',
      rocketSize: 'w-8 h-8 -top-2.5 left-5',
      trail: 'w-12 h-5 top-4 -left-1.5',
      tagPadding: 'px-2.5 py-1',
      container: 'gap-2',
    },
    xl: {
      textR: 'text-5xl',
      textOcket: 'text-5xl',
      tagText: 'text-sm',
      rocketSize: 'w-10 h-10 -top-3 left-6',
      trail: 'w-14 h-6 top-5 -left-2',
      tagPadding: 'px-3 py-1',
      container: 'gap-2.5',
    },
  };

  const s = sizeClasses[size];

  // Determine color of 'R'
  const rColor = variant === 'on-blue' ? 'text-white' : variant === 'light' ? 'text-white' : 'text-royal-600';

  return (
    <div className="flex flex-col">
      <div className={`inline-flex items-center ${s.container} select-none`}>
        {/* 'R' with launching rocket and orbit */}
        <div className="relative font-black tracking-tight font-sans">
          {/* Orbital curved streak */}
          <svg
            className={`absolute ${s.trail} -rotate-12 pointer-events-none z-10`}
            viewBox="0 0 50 20"
            fill="none"
          >
            <path
              d="M2 14 C15 2, 35 2, 48 10"
              stroke="#FBA94C"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Rocket Icon */}
          <svg
            className={`absolute ${s.rocketSize} rotate-45 z-20 drop-shadow-sm`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Rocket fuselage */}
            <path
              d="M12 2C9 5 8 9 9 13L11 15C15 16 19 15 22 12C20 9 17 6 12 2Z"
              fill={variant === 'on-blue' ? '#FFFFFF' : '#1E20E0'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            {/* Rocket fins */}
            <path d="M7 11L4 14L8 15" fill="#FF1D6B" />
            <path d="M13 17L14 21L17 18" fill="#FF1D6B" />
            {/* Flame */}
            <circle cx="6" cy="18" r="2.5" fill="#FBA94C" />
          </svg>

          {/* Letter R */}
          <span className={`${s.textR} ${rColor} font-black tracking-tighter leading-none inline-block pr-0.5`}>
            R
          </span>
        </div>

        {/* 'OCKET' in bright pink/magenta */}
        <span
          className={`${s.textOcket} font-black tracking-tight leading-none text-[#FF1D6B]`}
          style={{ letterSpacing: '-0.03em' }}
        >
          OCKET
        </span>

        {/* 'wheel' price/tag in golden yellow hanging at angle */}
        <div className="relative -mt-1 ml-0.5">
          {/* Hanging string */}
          <span className="absolute -top-1.5 -left-1 text-slate-400 text-[10px] font-mono leading-none">
            \
          </span>
          <div
            className={`bg-[#FBA94C] text-slate-950 font-black rounded-md rotate-12 shadow-sm ${s.tagPadding} ${s.tagText} uppercase tracking-wider border border-amber-500/40 inline-flex items-center gap-0.5`}
          >
            <span>wheel</span>
          </div>
        </div>
      </div>

      {showSubtitle && (
        <span className={`text-[10px] font-bold uppercase tracking-widest -mt-0.5 ${variant === 'on-blue' ? 'text-blue-200' : 'text-slate-500'}`}>
          Multi-Hospital Healthcare Network
        </span>
      )}
    </div>
  );
};
