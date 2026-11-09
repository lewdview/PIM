import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import SongLeaderboard from '../SongLeaderboard';

/** A song's leaderboard in a dialog. Escape or a click outside closes it. */
export default function RanksDialog({ label, title, songId, accent, onClose, rankingTitle = 'ALL-TIME RANKINGS', action }: {
  label: string;
  title: string;
  songId: string;
  accent: string;
  onClose: () => void;
  rankingTitle?: string;
  action?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} leaderboard`}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-white/15 bg-[#0a0805] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>{label}</div>
            <div className="font-black uppercase text-white text-lg tracking-tight truncate">{title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <SongLeaderboard songId={songId} defaultLimit={10} title={rankingTitle} />
        {action && <div className="mt-4 flex justify-end">{action}</div>}
      </div>
    </div>
  );
}
