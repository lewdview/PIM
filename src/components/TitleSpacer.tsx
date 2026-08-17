import React from 'react';

interface TitleSpacerProps {
  label?: string;
  sublabel?: string;
  accent?: string;
  className?: string;
  showLogo?: boolean;
  variant?: 'banner' | 'section' | 'divider';
}

export function TitleSpacer({
  label,
  sublabel,
  accent = '#ff3800',
  className = '',
  showLogo = true,
  variant = 'section',
}: TitleSpacerProps) {
  if (variant === 'banner') {
    return (
      <div className={`relative w-full py-6 flex flex-col items-center justify-center my-6 select-none ${className}`}>
        {/* Subtle Horizontal Grid Laser Lines */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none opacity-40">
          <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, ${accent})` }} />
          <div className="w-16" />
          <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}60, transparent)` }} />
        </div>

        {/* Ambient Backlight Glow */}
        <div 
          className="absolute inset-0 max-w-xl h-20 m-auto rounded-full blur-[40px] opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
        />

        {/* Main Title Spacer Logo Banner */}
        <div className="relative z-10 flex flex-col items-center gap-2 max-w-full px-4">
          <img
            src="/data/logos/top_left_site.png"
            alt="PIM th3v4ult Poetry in Motion"
            className="w-full max-w-[380px] sm:max-w-[480px] md:max-w-[560px] h-auto object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />

          {(label || sublabel) && (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: accent }} />
              {label && (
                <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.35em] uppercase font-bold text-white/80">
                  {label}
                </span>
              )}
              {sublabel && (
                <span className="font-mono text-[8px] sm:text-[9px] tracking-wider uppercase text-zinc-400">
                  // {sublabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Section Header Format (default)
  return (
    <div className={`relative flex items-center gap-3.5 mb-6 mt-4 select-none ${className}`}>
      {/* Accent Bar */}
      <div 
        className="w-1.5 h-7 rounded-sm shrink-0" 
        style={{ 
          background: accent, 
          boxShadow: `0 0 10px ${accent}aa` 
        }} 
      />

      {/* Label Text */}
      {label && (
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.35em] uppercase font-bold text-white/90">
            {label}
          </span>
          {sublabel && (
            <span className="text-[7.5px] font-mono tracking-widest uppercase text-zinc-400">
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Center Integrated Logo Badge */}
      {showLogo && (
        <div className="relative shrink-0 max-w-[130px] sm:max-w-[170px] hidden xs:block">
          <img
            src="/data/logos/top_left_site.png"
            alt="PIM th3v4ult"
            className="w-full h-auto max-h-6 object-contain opacity-80 hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        </div>
      )}

      {/* Trailing Laser Line */}
      <div 
        className="flex-1 h-[1px] min-w-[20px]" 
        style={{ 
          background: `linear-gradient(90deg, ${accent}80, ${accent}20 60%, transparent 100%)`,
          boxShadow: `0 0 4px ${accent}40`
        }} 
      />
    </div>
  );
}

export default TitleSpacer;
