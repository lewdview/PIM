import React from 'react';
import type { GhostReplay } from '../../utils/ghostReplay';

interface GhostHighwayProps {
  ghost: GhostReplay | null;
  currentTime: number;
  isPlaying: boolean;
}

/**
 * Task 4E: Ghost Highway Overlay
 * Renders competitor ghost status HUD badge with holder name, score, and real-time ghost lead/trail
 */
export const GhostHighway: React.FC<GhostHighwayProps> = ({ ghost, currentTime, isPlaying }) => {
  if (!ghost || !isPlaying) return null;

  // Find most recent ghost hit within the last 1.2 seconds
  const currentMs = currentTime * 1000;
  const recentEvent = ghost.events.find(
    (ev) => currentMs >= ev.t - 100 && currentMs <= ev.t + 400
  );

  return (
    <div className="absolute top-16 right-4 pointer-events-none z-20 flex flex-col items-end gap-1 select-none animate-fadeIn">
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-purple-500/40 backdrop-blur-md shadow-[0_0_12px_rgba(168,85,247,0.3)]">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_#c084fc]" />
        <span className="text-[10px] font-mono font-bold tracking-wider text-purple-300 uppercase">
          GHOST: {ghost.displayName || 'RECORD HOLDER'}
        </span>
        <span className="text-[9px] font-mono text-purple-400/80 bg-purple-950/60 px-1 py-0.2 rounded">
          {ghost.score.toLocaleString()}
        </span>
      </div>

      {recentEvent && (
        <div className="text-[9px] font-mono font-black tracking-widest text-purple-300/90 bg-purple-900/40 px-1.5 py-0.5 rounded border border-purple-500/30 animate-bounce">
          L{recentEvent.lane + 1} {recentEvent.judgment}
        </div>
      )}
    </div>
  );
};

export default GhostHighway;
