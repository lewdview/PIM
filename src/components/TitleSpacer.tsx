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
    <div className={`relative flex items-center gap-3 mb-5 mt-3 select-none ${className}`}>
      {/* Tactile Hardware Section Pill */}
      {label && (
        <div
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-lg shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(26, 20, 38, 0.95), rgba(14, 10, 22, 0.98))',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderLeft: `3px solid ${accent}`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 3px 0 #050308',
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.26em] uppercase font-bold text-white/95 whitespace-nowrap">
              {label}
            </span>
            {sublabel && (
              <span className="text-[7.5px] font-mono tracking-widest uppercase text-zinc-400 whitespace-nowrap">
                {sublabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Center Integrated Logo Badge */}
      {showLogo && (
        <div className="relative shrink-0 max-w-[120px] sm:max-w-[155px] hidden sm:block">
          <img
            src="/data/logos/top_left_site.png"
            alt="PIM th3v4ult"
            className="w-full h-auto max-h-5 object-contain opacity-75 hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        </div>
      )}

      {/* Trailing Laser Line */}
      <div 
        className="flex-1 h-[1px] min-w-[20px]" 
        style={{ 
          background: `linear-gradient(90deg, ${accent}90, ${accent}25 65%, transparent 100%)`,
          boxShadow: `0 0 6px ${accent}40`
        }} 
      />
    </div>
  );
}

export default TitleSpacer;
