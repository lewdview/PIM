// The chapter's Endings panel: the four endings with what each needs, how far
// along the player is, and Watch for the ones earned (rules in endings.ts).

import { Lock, Play, X } from 'lucide-react';
import { ENDING_INFO, type EndingState } from '@/platform/playgama/endings';
import '@/styles/monthPanels.css';

export default function MonthEndings({ endings, onWatch, onClose }: {
  endings: EndingState[];
  onWatch: (e: EndingState) => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label="Endings" onClick={onClose}>
      <div className="mb-lb-card mend-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head">
          <div>
            <div className="cs-eyebrow">Four ways this chapter ends</div>
            <h2 className="cs-display">Endings</h2>
          </div>
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <ol className="mend-list">
          {endings.map((e, i) => {
            // An ending's card stays a mystery until the one before it is earned.
            const hidden = !e.earned && i > 0 && !endings[i - 1].earned;
            const info = ENDING_INFO[e.id];
            return (
              <li key={e.id} className="mend-item" data-earned={e.earned || undefined} data-new={(e.earned && !e.seen) || undefined}>
                <span className="mend-n">{i + 1}</span>
                <div className="mend-text">
                  <b>{hidden ? '???' : info.title}</b>
                  <small>{info.condition}{info.reward ? ` · ${info.reward}` : ''}</small>
                  {!e.earned && (
                    <div className="mend-bar" aria-label={`${e.have} of ${e.need}`}>
                      <span style={{ width: `${e.need ? Math.round((e.have / e.need) * 100) : 0}%` }} />
                      <em>{e.have}/{e.need}</em>
                    </div>
                  )}
                </div>
                {e.earned ? (
                  <button type="button" className="btn-3d" data-size="sm" data-tone={e.seen ? 'quiet' : 'gold'} onClick={() => onWatch(e)}>
                    <Play size={14} fill="currentColor" /> {e.seen ? 'Watch again' : 'Watch'}
                  </button>
                ) : (
                  <span className="mend-lock" aria-label="Locked"><Lock size={16} /></span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
