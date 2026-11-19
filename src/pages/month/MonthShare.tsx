// Share panel of a monthly Playgama build, for one run (results screen) or the
// whole month (chapter screen). Nothing in it is a link: the player copies a
// text grid, saves a picture card, or posts through the portal's own share
// where the portal has one (Discord, Reddit, VK, OK, Facebook, MSN). On the
// chapter it also lists the month's trophies.

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Lock, MessageSquare, Share2, Trophy, UserPlus, X } from 'lucide-react';
import { copyText, shareKinds, shareThroughPortal, type ShareKind } from '@/platform/playgama/bridge';
import { canvasBlob, saveCard } from '@/platform/playgama/shareCard';
import type { AchievementState } from '@/platform/playgama/achievements';
import '@/styles/monthPanels.css';
import { t } from '@/i18n';

const PORTAL: Record<ShareKind, { label: string; icon: typeof Share2 }> = {
  share: { label: 'Share', icon: Share2 },
  post: { label: 'Post', icon: MessageSquare },
  invite: { label: 'Invite friends', icon: UserPlus },
};

export default function MonthShare({ eyebrow, title, text, copyLabel, fileName, draw, trophies, onClose }: {
  eyebrow: string;
  title: string;
  text: string;
  copyLabel: string;
  fileName: string;
  draw: () => Promise<HTMLCanvasElement>;
  /** The chapter passes the month's trophies; the results screen doesn't. */
  trophies?: AchievementState[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'share' | 'trophies'>('share');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const kinds = shareKinds();
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare;

  useEffect(() => {
    let alive = true;
    let url = '';
    draw().then(async (canvas) => {
      const b = await canvasBlob(canvas);
      if (!alive || !b) return;
      url = URL.createObjectURL(b);
      setBlob(b);
      setPreview(url);
      // Portals take the card as a data URL; a JPEG keeps it small.
      setDataUrl(canvas.toDataURL('image/jpeg', 0.85));
    }).catch(() => setStatus(t('The card could not be drawn here. You can still copy the text.')));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  // Drawn once when the panel opens; the screen behind may re-render meanwhile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    setStatus(t(ok ? 'Copied. Paste it anywhere.' : 'Copy is blocked here. Select the text below and copy it yourself.'));
    if (ok) setTimeout(() => setCopied(false), 2000);
  };
  const save = async () => {
    if (!blob) return;
    const r = await saveCard(blob, fileName, text);
    setStatus(t(r === 'shared' ? 'Sent.' : r === 'downloaded'
      ? 'Saved. If nothing downloaded, long-press or right-click the card to save it.'
      : 'Long-press or right-click the card to save it.'));
  };
  const portal = async (kind: ShareKind) => {
    const ok = await shareThroughPortal(kind, text, dataUrl);
    if (ok) setStatus(t('Shared.'));
  };

  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="mb-lb-card msh-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head">
          <div>
            <div className="cs-eyebrow">{eyebrow}</div>
            <h2 className="cs-display">{title}</h2>
          </div>
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label={t('Close')}><X size={16} /></button>
        </div>

        {trophies && (
          <div className="mo-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'share'} onClick={() => setTab('share')}>{t('Share')}</button>
            <button type="button" role="tab" aria-selected={tab === 'trophies'} onClick={() => setTab('trophies')}>
              {t('Trophies')} {trophies.filter((tr) => tr.earned).length}/{trophies.length}
            </button>
          </div>
        )}

        {tab === 'share' ? (
          <div className="msh-body">
            <div className="msh-preview">
              {preview ? <img src={preview} alt={t('Your share card')} /> : <div className="msh-wait" aria-hidden="true" />}
            </div>
            <div className="msh-side">
              <pre className="msh-text" aria-label={t('Text to share')}>{text}</pre>
              <div className="msh-actions">
                <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={copy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copyLabel}
                </button>
                <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" disabled={!blob} onClick={save}>
                  {canShareFiles ? <Share2 size={14} /> : <Download size={14} />} {t(canShareFiles ? 'Send the card' : 'Save the card')}
                </button>
                {kinds.map((k) => {
                  const { label, icon: Icon } = PORTAL[k];
                  return (
                    <button key={k} type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => void portal(k)}>
                      <Icon size={14} /> {t(label)}
                    </button>
                  );
                })}
              </div>
              <p className="msh-status" role="status">{status}</p>
            </div>
          </div>
        ) : (
          <ol className="msh-trophies">
            {trophies?.map((tr) => (
              <li key={tr.id} data-earned={tr.earned || undefined}>
                <span className="msh-trophy-icon">{tr.earned ? <Trophy size={16} /> : <Lock size={14} />}</span>
                <span className="msh-trophy-text">
                  <b>{t(tr.name)}</b>
                  <small>{t(tr.description)}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
