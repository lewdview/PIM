// Mute switch for monthly Playgama builds, drawn in each in-song HUD's button
// row next to fullscreen (the floating menu button would sit on the score).

import { Volume2, VolumeX } from 'lucide-react';
import { useMuted } from '@/platform/playgama/muteSetting';

export default function HudMuteButton({ variant }: { variant: 'beta' | 'rail' | 'hud' }) {
  const [muted, setMuted] = useMuted();
  const label = muted ? 'Unmute sound' : 'Mute sound';
  const icon = muted ? <VolumeX size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />;
  if (variant === 'beta') {
    return (
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        title={label}
        aria-label={label}
        aria-pressed={muted}
        style={{ color: muted ? '#FF1493' : 'hsl(30 15% 28%)', lineHeight: 1, padding: '2px 3px', transition: 'color 0.15s' }}
      >
        {icon}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={variant === 'rail' ? 'pim-rail-btn' : 'pim-hud-btn'}
      onClick={() => setMuted(!muted)}
      title={label}
      aria-label={label}
      aria-pressed={muted}
      data-on={muted}
    >
      {icon}
    </button>
  );
}
