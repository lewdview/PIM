import { useState, useEffect, useCallback } from 'react';
import { getDebugStats } from '../services/vaultService';
import { Bug, X, RefreshCw, Zap, Flame } from 'lucide-react';

const RARITY_COLORS: Record<string, string> = {
  common: '#8a8ea0',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  legendary: '#b44dff',
  mythic: '#ffd700',
};

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await getDebugStats();
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && !stats) refresh();
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '140px', right: '16px', zIndex: 9999,
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255, 56, 0, 0.15)', border: '1px solid rgba(255, 56, 0, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}
        title="RC1 Debug Panel"
      >
        <Bug size={18} style={{ color: '#ff3800' }} />
        <span style={{
          position: 'absolute', top: '-2px', right: '-2px',
          fontFamily: '"JetBrains Mono", monospace', fontSize: '6px', fontWeight: 700,
          background: '#ff3800', color: '#000', padding: '1px 3px',
          lineHeight: 1, letterSpacing: '0.05em',
        }}>RC1</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '140px', right: '16px', zIndex: 9999,
      width: '320px', maxHeight: '500px', overflow: 'auto',
      background: 'rgba(10, 10, 10, 0.95)', border: '1px solid rgba(255, 56, 0, 0.3)',
      backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bug size={14} style={{ color: '#ff3800' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ff3800' }}>
            RC1 Debug
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button aria-label="Refresh stats" onClick={refresh} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
            <RefreshCw size={12} style={{ color: 'rgba(255,255,255,0.5)', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button aria-label="Close debug panel" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
            <X size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
      </div>

      {!stats ? (
        <div style={{ padding: '20px', textAlign: 'center', fontSize: '9px', opacity: 0.4 }}>
          {loading ? 'Loading...' : 'No data'}
        </div>
      ) : (
        <div style={{ padding: '10px 14px' }}>
          {/* Overview */}
          <Section title="INVENTORY">
            <StatRow label="Cards Owned" value={stats.cardsOwned} />
            <StatRow label="Echo Cards" value={stats.echoCount} accent="#00d4aa" />
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
              {Object.entries(stats.rarityDist || {}).map(([rarity, count]) => (
                <div key={rarity} style={{
                  padding: '2px 8px', fontSize: '8px', fontWeight: 700,
                  background: `${RARITY_COLORS[rarity] || '#888'}15`,
                  border: `1px solid ${RARITY_COLORS[rarity] || '#888'}33`,
                  color: RARITY_COLORS[rarity] || '#888',
                  textTransform: 'uppercase',
                }}>
                  {rarity.slice(0, 3)}: {count as number}
                </div>
              ))}
            </div>
          </Section>

          <Section title="ECONOMY">
            <StatRow label="V⚡ Balance" value={stats.tokens} accent="#ff9900" icon={<Zap size={10} />} />
            <StatRow label="Earned (Lifetime)" value={stats.tokensEarned} accent="#4ade80" />
            <StatRow label="Spent (Lifetime)" value={stats.tokensSpent} accent="#ff3800" />
            <StatRow label="Net Flow" value={(stats.tokensEarned || 0) - (stats.tokensSpent || 0)}
              accent={(stats.tokensEarned || 0) - (stats.tokensSpent || 0) >= 0 ? '#4ade80' : '#ff3800'} />
          </Section>

          <Section title="BURNS">
            <StatRow label="Total Burns" value={stats.totalBurns} icon={<Flame size={10} />} />
            <StatRow label="Burns Today" value={stats.dailyBurns} accent={stats.dailyBurns >= 20 ? '#ff3800' : undefined} />
            <StatRow label="Echo Pulls Rx'd" value={stats.echoPullsReceived} accent="#00d4aa" />
          </Section>

          <Section title="PULLS">
            <StatRow label="Total Pulls" value={stats.totalPulls} />
            <StatRow label="Pity Counter" value={`${stats.pityCounter}/25`}
              accent={stats.pityCounter >= 20 ? '#ffd700' : undefined} />
            <StatRow label="Streak" value={`${stats.streak} days`} accent="#ff9900" />
          </Section>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        fontSize: '8px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.15em', opacity: 0.4, marginBottom: '6px',
        paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, accent, icon }: {
  label: string; value: any; accent?: string; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', fontSize: '10px',
    }}>
      <span style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon}{label}
      </span>
      <span style={{ fontWeight: 700, color: accent || 'rgba(255,255,255,0.9)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}
