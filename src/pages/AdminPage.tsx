import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  getAdminConfig,
  initAdminConfig,
  saveAdminConfig,
  resetAdminConfig,
  exportAdminConfig,
  importAdminConfig,
  simulatePulls,
  getStreak,
  getConfigHistory,
  type AdminConfig,
  type ConditionalModifier,
} from '../utils/adminConfig';
import type { Rarity } from '../utils/rarity';
import { ROLL_RATES } from '../utils/rarity';
import { getEchoPoolStats, flushEchoPool } from '../utils/echoSystem';
import '../styles/AdminStyles.css';
import { supabase } from '../services/supabaseClient';
import { fetchAllCards, type VaultCard } from '../services/vaultService';
import { Users, BarChart3, RefreshCw, Filter, Calendar, Zap, Flame } from 'lucide-react';

// ===== RARITY DISPLAY HELPERS =====
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7a8090',
  uncommon: '#00d4aa',
  rare: '#4d8fff',
  legendary: '#c44dff',
  mythic: '#ffd700',
};

const PACK_KEYS = Object.keys(ROLL_RATES);
const PACK_LABELS: Record<string, string> = {
  free: 'FREE', taste: 'TASTE', light: 'LIGHT', dark: 'DARK',
  month: 'MONTH', miss_out: 'MISS OUT', special_picks: 'SPECIAL',
  prophecy: 'PROPHECY', alpha: 'ALPHA',
};

// ===== ADMIN GATE =====
const ADMIN_PASSPHRASE = 'th3scr1b3';
const ADMIN_AUTH_KEY = 'th3vault_admin_auth';

function AdminGate({ onAuthenticate }: { onAuthenticate: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase() === ADMIN_PASSPHRASE) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      onAuthenticate();
    } else {
      setError(true);
      setTimeout(() => setError(false), 800);
    }
  };

  return (
    <div className="admin-gate">
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: '48px',
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          color: '#ff3800',
          textShadow: '0 0 20px rgba(255, 56, 0, 0.3)',
        }}>
          ADMIN
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
          opacity: 0.4,
          marginTop: '4px',
        }}>
          th3v4ult control panel
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="admin-gate-box" style={{
          transition: 'transform 0.1s',
          transform: error ? 'translateX(8px)' : 'none',
          animation: error ? 'shake 0.3s ease-in-out' : 'none',
        }}>
          <label style={{
            display: 'block',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            opacity: 0.5,
            marginBottom: '8px',
          }}>
            Passphrase
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter admin passphrase"
            autoFocus
          />
          <button aria-label="Action button" type="submit">Access Dashboard</button>
          {error && (
            <div style={{
              marginTop: '12px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: '#ff3800',
              textAlign: 'center',
            }}>
              INVALID PASSPHRASE
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ===== RATE BAR VISUALIZATION =====
function RateBar({ rates }: { rates: number[] }) {
  return (
    <div className="rate-bar-container">
      {RARITIES.map((r, i) => {
        const val = rates[i] || 0;
        if (val <= 0) return null;
        return (
          <div
            key={r}
            className="rate-bar-segment"
            style={{
              width: `${val}%`,
              background: RARITY_COLORS[r],
            }}
            title={`${r}: ${val}%`}
          >
            {val >= 5 && <span>{val.toFixed(val % 1 === 0 ? 0 : 1)}%</span>}
          </div>
        );
      })}
    </div>
  );
}

// ===== SIMULATION CHART =====
function SimulationChart({ results, total }: { results: Record<Rarity, number>; total: number }) {
  const maxCount = Math.max(...RARITIES.map(r => results[r] || 0), 1);

  return (
    <div className="sim-chart">
      {RARITIES.map(r => {
        const count = results[r] || 0;
        const pct = ((count / total) * 100).toFixed(1);
        const height = (count / maxCount) * 100;

        return (
          <div key={r} className="sim-bar">
            <div className="sim-bar-value" style={{ color: RARITY_COLORS[r] }}>
              {pct}%
            </div>
            <div
              className="sim-bar-fill"
              style={{
                height: `${height}%`,
                background: RARITY_COLORS[r],
                boxShadow: `0 0 8px ${RARITY_COLORS[r]}44`,
              }}
            />
            <div className="sim-bar-label" style={{ color: RARITY_COLORS[r] }}>
              {r.slice(0, 3)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== TOGGLE SWITCH =====
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`admin-toggle ${on ? 'on' : ''}`}
      onClick={onToggle}
      type="button"
    >
      <div className="admin-toggle-knob" />
    </button>
  );
}

// ===== MODIFIER CARD =====
function ModifierCard({
  modifier,
  onToggle,
  onUpdateThreshold,
  onUpdateTimeRange,
}: {
  modifier: ConditionalModifier;
  onToggle: () => void;
  onUpdateThreshold: (val: number) => void;
  onUpdateTimeRange?: (start: string, end: string) => void;
}) {
  const EFFECT_LABELS: Record<string, string> = {
    rate_boost: '↑ Rate Boost',
    rate_nerf: '↓ Rate Nerf',
    guaranteed_floor: '🛡 Guaranteed Floor',
    bonus_card: '+ Bonus Card',
    token_multiplier: '× Token Multiplier',
  };

  const CONDITION_LABELS: Record<string, string> = {
    streak: '🔥 Login Streak',
    collection_size: '📦 Collection Size',
    time_of_day: '🕐 Time of Day',
    rarity_drought: '🏜 Drought Protection',
    first_pack: '🆕 First Pack',
    milestone: '🏆 Milestone',
    day_range: '📅 Day Range',
  };

  return (
    <div className={`modifier-card ${modifier.enabled ? 'active' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}>
            {modifier.name}
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            opacity: 0.5,
            marginTop: '2px',
          }}>
            {modifier.description}
          </div>
        </div>
        <Toggle on={modifier.enabled} onToggle={onToggle} />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {/* Condition */}
        <div style={{
          flex: 1,
          minWidth: '120px',
          padding: '8px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            opacity: 0.4,
            marginBottom: '6px',
          }}>
            Condition
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            color: '#00d4aa',
            marginBottom: '6px',
          }}>
            {CONDITION_LABELS[modifier.condition.type] || modifier.condition.type}
          </div>
          {modifier.condition.type !== 'first_pack' && modifier.condition.type !== 'time_of_day' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.5 }}>≥</span>
              <input
                type="number"
                className="admin-input"
                value={modifier.condition.threshold}
                onChange={(e) => onUpdateThreshold(Number(e.target.value))}
                min={1}
                style={{ width: '60px' }}
              />
            </div>
          )}
          {modifier.condition.type === 'time_of_day' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="time"
                className="admin-input"
                value={modifier.condition.timeStart || '00:00'}
                onChange={(e) => onUpdateTimeRange?.(e.target.value, modifier.condition.timeEnd || '02:00')}
                style={{ width: '80px', fontSize: '10px' }}
              />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.5 }}>→</span>
              <input
                type="time"
                className="admin-input"
                value={modifier.condition.timeEnd || '02:00'}
                onChange={(e) => onUpdateTimeRange?.(modifier.condition.timeStart || '00:00', e.target.value)}
                style={{ width: '80px', fontSize: '10px' }}
              />
            </div>
          )}
        </div>

        {/* Effect */}
        <div style={{
          flex: 1,
          minWidth: '120px',
          padding: '8px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            opacity: 0.4,
            marginBottom: '6px',
          }}>
            Effect
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            color: '#ff3800',
          }}>
            {EFFECT_LABELS[modifier.effect.type] || modifier.effect.type}
          </div>
          {modifier.effect.target && (
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              marginTop: '2px',
              color: RARITY_COLORS[modifier.effect.target],
            }}>
              Target: {modifier.effect.target.toUpperCase()}
            </div>
          )}
          {modifier.effect.type !== 'guaranteed_floor' && (
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              marginTop: '2px',
              opacity: 0.6,
            }}>
              Value: ×{modifier.effect.value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== MAIN ADMIN PAGE =====
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() =>
    sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true'
  );
  const [config, setConfig] = useState<AdminConfig>(() => getAdminConfig());
  const [activePackTab, setActivePackTab] = useState(PACK_KEYS[0]);
  const [simResults, setSimResults] = useState<Record<Rarity, number> | null>(null);
  const [simCount, setSimCount] = useState(1000);
  const [hasChanges, setHasChanges] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [activeSection, setActiveSection] = useState<'rates' | 'modifiers' | 'economy' | 'echo' | 'simulation' | 'config' | 'analytics'>('rates');

  // Analytics States
  const [catalog, setCatalog] = useState<VaultCard[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalUsers: 0,
    totalCards: 0,
    totalTokens: 0,
    totalBurns: 0
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  useEffect(() => {
    initAdminConfig().then(cfg => setConfig(cfg));
    fetchAllCards().then(cards => setCatalog(cards));
  }, []);

  // Track streak for display
  const streak = useMemo(() => getStreak(), []);
  const history = useMemo(() => getConfigHistory(), [config.version]);

  // Update config and mark as changed
  const updateConfig = useCallback((updater: (c: AdminConfig) => AdminConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      setHasChanges(true);
      return next;
    });
  }, []);

  // Save config
  const handleSave = useCallback(() => {
    saveAdminConfig(config);
    setHasChanges(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  }, [config]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaults = resetAdminConfig();
    setConfig(defaults);
    setHasChanges(false);
  }, []);

  // Export
  const handleExport = useCallback(() => {
    const json = exportAdminConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `th3vault-config-v${config.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  // Import
  const handleImport = useCallback(() => {
    const result = importAdminConfig(importJson);
    if (result) {
      setConfig(result);
      setShowImport(false);
      setImportJson('');
      setHasChanges(false);
    }
  }, [importJson]);

  // Simulation
  const handleSimulate = useCallback(() => {
    const results = simulatePulls(activePackTab, simCount, true);
    setSimResults(results);
  }, [activePackTab, simCount]);

  // Rate change handler
  const handleRateChange = useCallback((pack: string, rarityIdx: number, value: number) => {
    updateConfig(c => {
      const newConfig = { ...c };
      newConfig.rollRates = { ...c.rollRates };
      const rates = [...(c.rollRates[pack] || [60, 25, 12, 3])];
      rates[rarityIdx] = value;
      newConfig.rollRates[pack] = rates;
      return newConfig;
    });
  }, [updateConfig]);

  // Get current rates for active pack
  const activeRates = useMemo(() => {
    return config.rollRates?.[activePackTab] || ROLL_RATES[activePackTab] || [60, 25, 12, 3];
  }, [config, activePackTab]);

  const loadAnalyticsData = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      // 1. Fetch users list
      const { data: users, error: usersErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersErr) throw usersErr;
      setUsersList(users || []);

      // 2. Fetch total collected cards count
      const { count: cardCount, error: cardErr } = await supabase
        .from('vault_collections')
        .select('*', { count: 'exact', head: true });

      // 3. Compute stats
      const totalTokens = (users || []).reduce((sum, u) => sum + (u.tokens || 0), 0);
      const totalBurns = (users || []).reduce((sum, u) => sum + (u.total_burns || 0), 0);

      setSummaryStats({
        totalUsers: users?.length || 0,
        totalCards: cardCount || 0,
        totalTokens,
        totalBurns
      });

      // 4. Fetch telemetry events
      const validTypes = [
        'pack_purchase', 'game_end', 'card_burn', 'daily_claim', 
        'targeted_pull', 'rarity_upgrade', 'duplicate_fusion', 
        'nft_mint', 'bonus_code_redeem', 'invite_redeem'
      ];
      
      const { data: events, error: eventsErr } = await supabase
        .from('telemetry_events')
        .select('*')
        .in('event_type', validTypes)
        .order('created_at', { ascending: false })
        .limit(200);

      if (eventsErr) throw eventsErr;
      setTelemetryLogs(events || []);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'analytics') {
      loadAnalyticsData();
    }
  }, [activeSection, loadAnalyticsData]);

  useEffect(() => {
    let filtered = telemetryLogs;
    if (selectedUser !== 'all') {
      filtered = filtered.filter(e => e.user_id === selectedUser);
    }
    if (selectedEventType !== 'all') {
      filtered = filtered.filter(e => e.event_type === selectedEventType);
    }
    setFilteredEvents(filtered);
  }, [telemetryLogs, selectedUser, selectedEventType]);

  const formatEventDetails = (type: string, payload: any) => {
    if (!payload) return '—';
    switch (type) {
      case 'game_end': {
        const songDay = payload.songId?.replace('card-', '').replace('day-', '') || 'unknown';
        const matched = catalog.find(c => String(c.day) === songDay || c.id === payload.songId);
        const songTitle = matched ? matched.title : `Day ${songDay}`;
        return `Song: "${songTitle}" | Score: ${payload.score?.toLocaleString() || 0} (${payload.accuracy || 0}%) | Medal: ${payload.medal || 'None'}`;
      }
      case 'card_burn':
        return `Burned ${String(payload.rarity).toUpperCase()} for +${payload.tokensEarned || 0} V⚡${payload.willEcho ? ' (Echoed)' : ''}`;
      case 'pack_purchase':
        return `Ripped ${String(payload.packType).toUpperCase()} pack (${payload.count || 1} cards)`;
      case 'daily_claim':
        return `Claimed Day ${payload.day} drop (${String(payload.rarity).toUpperCase()})`;
      case 'targeted_pull':
        return `Targeted Day ${payload.day} pull (Cost: ${payload.cost || 0} V⚡)`;
      case 'rarity_upgrade':
        return `Upgraded card to ${String(payload.to || 'rare').toUpperCase()}`;
      case 'duplicate_fusion':
        return `Fused duplicates into ${String(payload.to || 'rare').toUpperCase()}`;
      case 'nft_mint':
        return `Minted card #${payload.cardId?.replace('card-', '').replace('day-', '') || ''} | TX: ${payload.txHash ? `${payload.txHash.slice(0, 8)}...` : 'Success'}`;
      case 'bonus_code_redeem':
        return `Redeemed code for ${String(payload.rewardType).toUpperCase()}`;
      default:
        return JSON.stringify(payload);
    }
  };

  const rateSum = useMemo(() => activeRates.reduce((a: number, b: number) => a + b, 0), [activeRates]);

  if (!authenticated) {
    return (
      <div className="admin-page">
        <AdminGate onAuthenticate={() => setAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '36px',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#ff3800',
            textShadow: '0 0 20px rgba(255, 56, 0, 0.3)',
          }}>
            ADMIN DASHBOARD
          </div>
          <div className="status-dot active" />
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#00d4aa',
          }}>
            LIVE
          </span>
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '9px',
          opacity: 0.4,
          display: 'flex',
          gap: '16px',
        }}>
          <span>Config v{config.version}</span>
          <span>·</span>
          <span>Last modified: {new Date(config.lastModified).toLocaleString()}</span>
          <span>·</span>
          <span>Streak: {streak} days</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {([
          { key: 'rates', label: '📊 DROP RATES', color: '#ff3800' },
          { key: 'modifiers', label: '⚡ MODIFIERS', color: '#00d4aa' },
          { key: 'economy', label: '💰 ECONOMY', color: '#ffb800' },
          { key: 'echo', label: '◎ ECHO SYSTEM', color: '#00d4aa' },
          { key: 'simulation', label: '🎲 SIMULATION', color: '#4d8fff' },
          { key: 'config', label: '⚙️ CONFIG', color: '#c44dff' },
          { key: 'analytics', label: '📈 ANALYTICS & USERS', color: '#00ffff' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            style={{
              padding: '10px 20px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              background: activeSection === tab.key ? `${tab.color}15` : 'transparent',
              border: `1px solid ${activeSection === tab.key ? `${tab.color}55` : 'rgba(255,255,255,0.08)'}`,
              color: activeSection === tab.key ? tab.color : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== SECTION: DROP RATES ===== */}
      {activeSection === 'rates' && (
        <div className="admin-panel" style={{ '--panel-accent': '#ff3800' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>Drop Rate Editor</h2>
            <div style={{
              marginLeft: 'auto',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              opacity: 0.5,
            }}>
              SUM: {rateSum.toFixed(1)}%
              {Math.abs(rateSum - 100) > 0.5 && (
                <span style={{ color: '#ff3800', marginLeft: '8px' }}>⚠ MUST = 100%</span>
              )}
            </div>
          </div>
          <div className="admin-panel-body">
            {/* Pack Tabs */}
            <div className="pack-tabs" style={{ marginBottom: '20px' }}>
              {PACK_KEYS.map(key => (
                <button
                  key={key}
                  className={`pack-tab ${activePackTab === key ? 'active' : ''}`}
                  onClick={() => { setActivePackTab(key); setSimResults(null); }}
                >
                  {PACK_LABELS[key] || key.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Rate visualization bar */}
            <div style={{ marginBottom: '24px' }}>
              <RateBar rates={activeRates} />
            </div>

            {/* Sliders for each rarity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {RARITIES.map((r, i) => {
                if (i >= activeRates.length && (activeRates[i] || 0) === 0) return null;
                const val = activeRates[i] || 0;
                return (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '80px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: RARITY_COLORS[r],
                    }}>
                      {r}
                    </div>
                    <input
                      type="range"
                      className="admin-slider"
                      min={0}
                      max={100}
                      step={0.5}
                      value={val}
                      onChange={(e) => handleRateChange(activePackTab, i, Number(e.target.value))}
                      style={{
                        '--slider-color': RARITY_COLORS[r],
                        '--slider-glow': `${RARITY_COLORS[r]}66`,
                        flex: 1,
                      } as React.CSSProperties}
                    />
                    <input
                      type="number"
                      className="admin-input"
                      value={val}
                      onChange={(e) => handleRateChange(activePackTab, i, Number(e.target.value))}
                      min={0}
                      max={100}
                      step={0.5}
                      style={{ width: '60px' }}
                    />
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px',
                      opacity: 0.4,
                    }}>%</span>
                  </div>
                );
              })}
            </div>

            {/* Proof rates (if applicable) */}
            {config.proofRates?.[activePackTab] !== undefined && (
              <div style={{ marginTop: '24px', padding: '16px', border: '1px solid rgba(196,77,255,0.2)', background: 'rgba(196,77,255,0.03)' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#c44dff',
                  marginBottom: '12px',
                }}>
                  🔮 Proof Rate (Phase 1)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    className="admin-slider"
                    min={0}
                    max={25}
                    step={0.5}
                    value={config.proofRates[activePackTab]}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      proofRates: { ...c.proofRates, [activePackTab]: Number(e.target.value) },
                    }))}
                    style={{
                      '--slider-color': '#c44dff',
                      '--slider-glow': 'rgba(196,77,255,0.5)',
                      flex: 1,
                    } as React.CSSProperties}
                  />
                  <input
                    type="number"
                    className="admin-input"
                    value={config.proofRates[activePackTab]}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      proofRates: { ...c.proofRates, [activePackTab]: Number(e.target.value) },
                    }))}
                    min={0}
                    max={25}
                    step={0.5}
                    style={{ width: '60px' }}
                  />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4 }}>%</span>
                </div>
              </div>
            )}

            {/* Daily Claim Rates */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}>
                Daily Claim Rates
              </div>

              <div className="admin-grid-2">
                {/* Standard Day */}
                <div style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    opacity: 0.5,
                    marginBottom: '12px',
                  }}>
                    Standard Day
                  </div>
                  {RARITIES.slice(0, 4).map((r, i) => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ width: '60px', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: RARITY_COLORS[r], fontWeight: 700, textTransform: 'uppercase' }}>
                        {r.slice(0, 4)}
                      </span>
                      <input
                        type="number"
                        className="admin-input"
                        value={config.dailyClaimRates.standard[i] || 0}
                        onChange={(e) => updateConfig(c => {
                          const rates = [...c.dailyClaimRates.standard];
                          rates[i] = Number(e.target.value);
                          return { ...c, dailyClaimRates: { ...c.dailyClaimRates, standard: rates } };
                        })}
                        min={0} max={100} step={1}
                        style={{ width: '50px' }}
                      />
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.4 }}>%</span>
                    </div>
                  ))}
                </div>

                {/* Featured Day */}
                <div style={{ padding: '12px', border: '1px solid rgba(255,215,0,0.15)', background: 'rgba(255,215,0,0.02)' }}>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#ffd700',
                    marginBottom: '12px',
                  }}>
                    ⭐ Featured Day
                  </div>
                  {RARITIES.map((r, i) => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ width: '60px', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: RARITY_COLORS[r], fontWeight: 700, textTransform: 'uppercase' }}>
                        {r.slice(0, 4)}
                      </span>
                      <input
                        type="number"
                        className="admin-input"
                        value={config.dailyClaimRates.featured[i] || 0}
                        onChange={(e) => updateConfig(c => {
                          const rates = [...c.dailyClaimRates.featured];
                          rates[i] = Number(e.target.value);
                          return { ...c, dailyClaimRates: { ...c.dailyClaimRates, featured: rates } };
                        })}
                        min={0} max={100} step={1}
                        style={{ width: '50px' }}
                      />
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.4 }}>%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: MODIFIERS ===== */}
      {activeSection === 'modifiers' && (
        <div className="admin-panel" style={{ '--panel-accent': '#00d4aa' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>Conditional Modifiers</h2>
            <span style={{
              marginLeft: 'auto',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              color: '#00d4aa',
            }}>
              {config.modifiers.filter(m => m.enabled).length} / {config.modifiers.length} ACTIVE
            </span>
          </div>
          <div className="admin-panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {config.modifiers.map((mod, idx) => (
                <ModifierCard
                  key={mod.id}
                  modifier={mod}
                  onToggle={() => updateConfig(c => {
                    const mods = [...c.modifiers];
                    mods[idx] = { ...mods[idx], enabled: !mods[idx].enabled };
                    return { ...c, modifiers: mods };
                  })}
                  onUpdateThreshold={(val) => updateConfig(c => {
                    const mods = [...c.modifiers];
                    mods[idx] = { ...mods[idx], condition: { ...mods[idx].condition, threshold: val } };
                    return { ...c, modifiers: mods };
                  })}
                  onUpdateTimeRange={(start, end) => updateConfig(c => {
                    const mods = [...c.modifiers];
                    mods[idx] = { ...mods[idx], condition: { ...mods[idx].condition, timeStart: start, timeEnd: end } };
                    return { ...c, modifiers: mods };
                  })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: ECONOMY ===== */}
      {activeSection === 'economy' && (
        <div className="admin-panel" style={{ '--panel-accent': '#ffb800' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>Economy Tuning</h2>
          </div>
          <div className="admin-panel-body">
            {/* Token Values */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}>
                Token Burn Values (V⚡)
              </div>
              <div className="admin-grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {RARITIES.map(r => (
                  <div key={r} className="stat-readout" style={{ '--stat-color': RARITY_COLORS[r] } as React.CSSProperties}>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.tokenValues[r]}
                      onChange={(e) => updateConfig(c => ({
                        ...c,
                        tokenValues: { ...c.tokenValues, [r]: Number(e.target.value) },
                      }))}
                      min={0}
                      style={{ width: '70px', textAlign: 'center', fontSize: '18px', fontFamily: '"Impact", sans-serif', background: 'transparent', border: 'none', color: RARITY_COLORS[r] }}
                    />
                    <div className="stat-label">{r}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supply Caps */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}>
                Supply Caps (Max Editions)
              </div>
              <div className="admin-grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {RARITIES.map(r => (
                  <div key={r} className="stat-readout" style={{ '--stat-color': RARITY_COLORS[r] } as React.CSSProperties}>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.supplyCaps[r]}
                      onChange={(e) => updateConfig(c => ({
                        ...c,
                        supplyCaps: { ...c.supplyCaps, [r]: Number(e.target.value) },
                      }))}
                      min={1}
                      style={{ width: '70px', textAlign: 'center', fontSize: '18px', fontFamily: '"Impact", sans-serif', background: 'transparent', border: 'none', color: RARITY_COLORS[r] }}
                    />
                    <div className="stat-label">{r}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Economy Settings */}
            <div className="admin-grid-2">
              {/* Ultra Reward */}
              <div style={{ padding: '16px', border: '1px solid rgba(255,215,0,0.15)', background: 'rgba(255,215,0,0.02)' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#ffd700',
                  marginBottom: '12px',
                }}>
                  🌟 Ultra Reward Settings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.6 }}>Chance</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        className="admin-input"
                        value={(config.ultraRewardChance * 100).toFixed(1)}
                        onChange={(e) => updateConfig(c => ({ ...c, ultraRewardChance: Number(e.target.value) / 100 }))}
                        min={0} max={10} step={0.1}
                        style={{ width: '60px' }}
                      />
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4 }}>%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.6 }}>Max Total</span>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.ultraRewardMax}
                      onChange={(e) => updateConfig(c => ({ ...c, ultraRewardMax: Number(e.target.value) }))}
                      min={0} max={100}
                      style={{ width: '60px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Daily Limits & Token Cost */}
              <div style={{ padding: '16px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  opacity: 0.5,
                  marginBottom: '12px',
                }}>
                  Limits & Pricing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.6 }}>Daily Standard</span>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.dailyStandardLimit}
                      onChange={(e) => updateConfig(c => ({ ...c, dailyStandardLimit: Number(e.target.value) }))}
                      min={1}
                      style={{ width: '60px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.6 }}>Daily Premium</span>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.dailyPremiumLimit}
                      onChange={(e) => updateConfig(c => ({ ...c, dailyPremiumLimit: Number(e.target.value) }))}
                      min={1}
                      style={{ width: '60px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.6 }}>Token Pack Cost</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        className="admin-input"
                        value={config.tokenPackCost}
                        onChange={(e) => updateConfig(c => ({ ...c, tokenPackCost: Number(e.target.value) }))}
                        min={1}
                        style={{ width: '70px' }}
                      />
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.4 }}>V⚡</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Pack Rates */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}>
                Token Pack Roll Rates
              </div>
              <RateBar rates={config.tokenPackRates} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                {RARITIES.map((r, i) => (
                  <div key={r} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      className="admin-input"
                      value={config.tokenPackRates[i] || 0}
                      onChange={(e) => updateConfig(c => {
                        const rates = [...c.tokenPackRates];
                        rates[i] = Number(e.target.value);
                        return { ...c, tokenPackRates: rates };
                      })}
                      min={0} max={100} step={1}
                      style={{ width: '50px', textAlign: 'center' }}
                    />
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: RARITY_COLORS[r], textTransform: 'uppercase' }}>{r.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: SIMULATION ===== */}
      {activeSection === 'simulation' && (
        <div className="admin-panel" style={{ '--panel-accent': '#4d8fff' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>Pull Simulation</h2>
          </div>
          <div className="admin-panel-body">
            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div className="pack-tabs">
                {PACK_KEYS.map(key => (
                  <button
                    key={key}
                    className={`pack-tab ${activePackTab === key ? 'active' : ''}`}
                    onClick={() => { setActivePackTab(key); setSimResults(null); }}
                  >
                    {PACK_LABELS[key] || key.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.5 }}>PULLS:</span>
                {[100, 1000, 10000].map(n => (
                  <button
                    key={n}
                    onClick={() => setSimCount(n)}
                    style={{
                      padding: '4px 10px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px',
                      fontWeight: simCount === n ? 700 : 400,
                      background: simCount === n ? 'rgba(77,143,255,0.15)' : 'transparent',
                      border: `1px solid ${simCount === n ? 'rgba(77,143,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: simCount === n ? '#4d8fff' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSimulate}
              className="config-btn primary"
              style={{ width: '100%', marginBottom: '20px', fontSize: '14px', padding: '12px' }}
            >
              🎲 SIMULATE {simCount.toLocaleString()} PULLS — {PACK_LABELS[activePackTab] || activePackTab.toUpperCase()} PACK
            </button>

            {/* Results */}
            {simResults && (
              <div>
                <SimulationChart results={simResults} total={simCount} />

                {/* Detailed breakdown */}
                <table className="admin-table" style={{ marginTop: '16px' }}>
                  <thead>
                    <tr>
                      <th>Rarity</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Count</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RARITIES.map((r, i) => {
                      const expected = activeRates[i] || 0;
                      const actual = ((simResults[r] || 0) / simCount) * 100;
                      const delta = actual - expected;
                      return (
                        <tr key={r}>
                          <td style={{ color: RARITY_COLORS[r], fontWeight: 700, textTransform: 'uppercase' }}>{r}</td>
                          <td>{expected.toFixed(1)}%</td>
                          <td style={{ fontWeight: 700 }}>{actual.toFixed(2)}%</td>
                          <td>{(simResults[r] || 0).toLocaleString()}</td>
                          <td style={{
                            color: Math.abs(delta) < 1 ? '#00d4aa' : Math.abs(delta) < 3 ? '#ffb800' : '#ff3800',
                            fontWeight: 700,
                          }}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* EV Calculation */}
                <div style={{ marginTop: '16px', padding: '12px', border: '1px solid rgba(255,153,0,0.15)', background: 'rgba(255,153,0,0.03)' }}>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#ff9900',
                    marginBottom: '8px',
                  }}>
                    Expected Value per Card
                  </div>
                  <div style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '24px',
                    color: '#ff9900',
                  }}>
                    {(() => {
                      let ev = 0;
                      RARITIES.forEach((r, i) => {
                        const rate = (activeRates[i] || 0) / 100;
                        ev += rate * config.tokenValues[r];
                      });
                      return ev.toFixed(1);
                    })()}{' '}
                    <span style={{ fontSize: '14px', opacity: 0.6 }}>V⚡</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SECTION: ECHO SYSTEM ===== */}
      {activeSection === 'echo' && (
        <div className="admin-panel" style={{ '--panel-accent': '#00d4aa' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>◎ Echo System</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                color: config.echoSystem.enabled ? '#00d4aa' : 'rgba(255,255,255,0.3)',
              }}>
                {config.echoSystem.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <Toggle
                on={config.echoSystem.enabled}
                onToggle={() => updateConfig(c => ({
                  ...c,
                  echoSystem: { ...c.echoSystem, enabled: !c.echoSystem.enabled },
                }))}
              />
            </div>
          </div>
          <div className="admin-panel-body">
            {/* Core Controls */}
            <div className="admin-grid-2">
              {/* Echo Chance */}
              <div style={{ padding: '16px', border: '1px solid rgba(0,212,170,0.15)', background: 'rgba(0,212,170,0.03)' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#00d4aa',
                  marginBottom: '12px',
                }}>
                  ◎ Echo Pull Chance
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    className="admin-slider"
                    min={0} max={50} step={1}
                    value={config.echoSystem.echoChance}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      echoSystem: { ...c.echoSystem, echoChance: Number(e.target.value) },
                    }))}
                    style={{ '--slider-color': '#00d4aa', '--slider-glow': 'rgba(0,212,170,0.5)', flex: 1 } as React.CSSProperties}
                  />
                  <input
                    type="number"
                    className="admin-input"
                    value={config.echoSystem.echoChance}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      echoSystem: { ...c.echoSystem, echoChance: Number(e.target.value) },
                    }))}
                    min={0} max={50} step={1}
                    style={{ width: '50px' }}
                  />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4 }}>%</span>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, marginTop: '6px' }}>
                  % chance each pack pull draws from echo pool (packs only, no daily)
                </div>
              </div>

              {/* Token Split */}
              <div style={{ padding: '16px', border: '1px solid rgba(255,153,0,0.15)', background: 'rgba(255,153,0,0.03)' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#ff9900',
                  marginBottom: '12px',
                }}>
                  ⚡ Token Split %
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    className="admin-slider"
                    min={10} max={90} step={5}
                    value={config.echoSystem.tokenSplitPercent}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      echoSystem: { ...c.echoSystem, tokenSplitPercent: Number(e.target.value) },
                    }))}
                    style={{ '--slider-color': '#ff9900', '--slider-glow': 'rgba(255,153,0,0.5)', flex: 1 } as React.CSSProperties}
                  />
                  <input
                    type="number"
                    className="admin-input"
                    value={config.echoSystem.tokenSplitPercent}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      echoSystem: { ...c.echoSystem, tokenSplitPercent: Number(e.target.value) },
                    }))}
                    min={10} max={90} step={5}
                    style={{ width: '50px' }}
                  />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4 }}>%</span>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, marginTop: '6px' }}>
                  % of burn value kept as V⚡ tokens (rest becomes echo)
                </div>
              </div>
            </div>

            {/* Generation Value Multipliers */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}>
                Generation Value Multipliers
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { key: 'gen1ValueMultiplier' as const, label: 'GEN 1', defaultVal: 0.6, color: '#00d4aa' },
                  { key: 'gen2ValueMultiplier' as const, label: 'GEN 2', defaultVal: 0.3, color: '#4d8fff' },
                  { key: 'gen3ValueMultiplier' as const, label: 'GEN 3+', defaultVal: 0.1, color: '#7a8090' },
                ].map(gen => (
                  <div key={gen.key} style={{
                    flex: 1, minWidth: '100px',
                    padding: '12px', border: `1px solid ${gen.color}22`,
                    background: `${gen.color}05`,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px', fontWeight: 700,
                      color: gen.color,
                      marginBottom: '8px',
                    }}>{gen.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.5 }}>×</span>
                      <input
                        type="number"
                        className="admin-input"
                        value={config.echoSystem[gen.key]}
                        onChange={(e) => updateConfig(c => ({
                          ...c,
                          echoSystem: { ...c.echoSystem, [gen.key]: Number(e.target.value) },
                        }))}
                        min={0} max={1} step={0.05}
                        style={{ width: '55px', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '8px', opacity: 0.3, marginTop: '4px',
                    }}>
                      = {Math.round((config.echoSystem[gen.key]) * 100)}% value
                    </div>
                  </div>
                ))}

                {/* Max Generation */}
                <div style={{
                  flex: 1, minWidth: '100px',
                  padding: '12px', border: '1px solid rgba(255,56,0,0.2)',
                  background: 'rgba(255,56,0,0.03)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10px', fontWeight: 700,
                    color: '#ff3800',
                    marginBottom: '8px',
                  }}>MAX GEN</div>
                  <input
                    type="number"
                    className="admin-input"
                    value={config.echoSystem.maxGeneration}
                    onChange={(e) => updateConfig(c => ({
                      ...c,
                      echoSystem: { ...c.echoSystem, maxGeneration: Number(e.target.value) },
                    }))}
                    min={1} max={10} step={1}
                    style={{ width: '55px', textAlign: 'center' }}
                  />
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '8px', opacity: 0.3, marginTop: '4px',
                  }}>
                    entropy death
                  </div>
                </div>
              </div>
            </div>

            {/* Echo Pool Stats */}
            <div style={{ marginTop: '24px', padding: '16px', border: '1px solid rgba(0,212,170,0.15)', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '16px',
                  textTransform: 'uppercase',
                }}>
                  Echo Pool Status
                </div>
                <button
                  type="button"
                  onClick={() => { flushEchoPool(); setConfig(c => ({ ...c })); }}
                  style={{
                    padding: '6px 14px',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px', fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    background: 'rgba(255,56,0,0.1)',
                    border: '1px solid rgba(255,56,0,0.3)',
                    color: '#ff3800',
                    cursor: 'pointer',
                  }}
                >
                  🗑 Flush Pool
                </button>
              </div>

              {(() => {
                const stats = getEchoPoolStats();
                return (
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '4px' }}>Total Echoes</div>
                      <div style={{ fontFamily: '"Impact", sans-serif', fontSize: '32px', color: '#00d4aa' }}>{stats.total}</div>
                    </div>

                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '8px' }}>By Rarity</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {RARITIES.map(r => (
                          <div key={r} style={{
                            padding: '4px 8px',
                            border: `1px solid ${RARITY_COLORS[r]}30`,
                            background: `${RARITY_COLORS[r]}08`,
                          }}>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: RARITY_COLORS[r], fontWeight: 700 }}>
                              {r.slice(0, 3).toUpperCase()}: {stats.byRarity[r] || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ minWidth: '80px' }}>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '8px' }}>By Generation</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {Object.entries(stats.byGeneration).sort(([a], [b]) => Number(a) - Number(b)).map(([gen, count]) => (
                          <div key={gen} style={{
                            padding: '4px 8px',
                            border: '1px solid rgba(0,212,170,0.2)',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '9px',
                            color: '#00d4aa',
                          }}>
                            G{gen}: {count as number}
                          </div>
                        ))}
                        {Object.keys(stats.byGeneration).length === 0 && (
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.3 }}>Empty pool</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Degradation Preview */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                opacity: 0.5,
                marginBottom: '12px',
              }}>
                Rarity Degradation Chain
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {RARITIES.slice().reverse().map(r => {
                  const chain = [r];
                  let current = r;
                  for (let g = 0; g < config.echoSystem.maxGeneration; g++) {
                    const idx = RARITIES.indexOf(current);
                    current = RARITIES[Math.max(0, idx - 1)];
                    chain.push(current);
                  }
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {chain.map((step, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {i > 0 && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.3 }}>→</span>}
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '9px',
                            fontWeight: 700,
                            color: RARITY_COLORS[step],
                            padding: '2px 6px',
                            border: `1px solid ${RARITY_COLORS[step]}30`,
                            background: `${RARITY_COLORS[step]}08`,
                            opacity: i === 0 ? 1 : 0.7 - (i * 0.15),
                          }}>
                            {i === 0 ? step.toUpperCase() : `G${i}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: CONFIG ===== */}
      {activeSection === 'config' && (
        <div className="admin-panel" style={{ '--panel-accent': '#c44dff' } as React.CSSProperties}>
          <div className="admin-panel-header">
            <h2>Config Management</h2>
          </div>
          <div className="admin-panel-body">
            <div className="config-actions" style={{ marginBottom: '20px' }}>
              <button aria-label="Action button" className="config-btn primary" onClick={handleSave}>
                💾 Save Config
              </button>
              <button aria-label="Action button" className="config-btn" onClick={handleExport}>
                📤 Export JSON
              </button>
              <button aria-label="Action button" className="config-btn" onClick={() => setShowImport(!showImport)}>
                📥 Import JSON
              </button>
              <button aria-label="Action button" className="config-btn danger" onClick={handleReset}>
                🔄 Reset Defaults
              </button>
              <button aria-label="Action button" 
                className="config-btn danger" 
                onClick={() => {
                  if (confirm('Are you sure you want to completely wipe all player collection data, tokens, and progress?')) {
                    // wipeAllPlayerData();
                  }
                }}
                style={{ marginLeft: 'auto' }}
              >
                🗑 Wipe All Player Data
              </button>
            </div>

            {showImport && (
              <div style={{ marginBottom: '20px' }}>
                <textarea
                  className="admin-textarea"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder="Paste config JSON here..."
                />
                <button
                  className="config-btn primary"
                  onClick={handleImport}
                  style={{ marginTop: '8px' }}
                  disabled={!importJson}
                >
                  Apply Import
                </button>
              </div>
            )}

            {/* History */}
            <div>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}>
                Change History
              </div>
              {history.length === 0 ? (
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4 }}>
                  No history recorded yet
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>v{h.version}</td>
                        <td>{new Date(h.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Current Config Preview */}
            <div style={{ marginTop: '20px' }}>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}>
                Live Config Preview
              </div>
              <pre className="admin-textarea" style={{ minHeight: '300px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: ANALYTICS & USERS ===== */}
      {activeSection === 'analytics' && (
        <div className="admin-panel" style={{ '--panel-accent': '#00ffff' } as React.CSSProperties}>
          <div className="admin-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} style={{ color: '#00ffff' }} />
              <h2>Analytics & Users</h2>
            </div>
            <button
              onClick={loadAnalyticsData}
              disabled={loadingAnalytics}
              className="config-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <RefreshCw size={12} className={loadingAnalytics ? 'animate-spin' : ''} />
              {loadingAnalytics ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="admin-panel-body">
            {/* KPI Cards */}
            <div className="admin-grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
              <div className="stat-readout" style={{ '--stat-color': '#00ffff' } as React.CSSProperties}>
                <div className="stat-value">{summaryStats.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-readout" style={{ '--stat-color': '#c44dff' } as React.CSSProperties}>
                <div className="stat-value">{summaryStats.totalCards}</div>
                <div className="stat-label">Cards Collected</div>
              </div>
              <div className="stat-readout" style={{ '--stat-color': '#ffb800' } as React.CSSProperties}>
                <div className="stat-value">{summaryStats.totalTokens.toLocaleString()}</div>
                <div className="stat-label">V⚡ in Circulation</div>
              </div>
              <div className="stat-readout" style={{ '--stat-color': '#ff3800' } as React.CSSProperties}>
                <div className="stat-value">{summaryStats.totalBurns}</div>
                <div className="stat-label">Total Burns</div>
              </div>
            </div>

            {/* Split Grid: Users Left, Events Right */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }} className="admin-grid-layout">
              {/* Users Directory */}
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', padding: '16px' }}>
                <div style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '18px',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Users size={16} />
                  <span>Users Directory</span>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Wallet / Display Name</th>
                        <th style={{ textAlign: 'right' }}>Tokens</th>
                        <th style={{ textAlign: 'right' }}>Pulls</th>
                        <th style={{ textAlign: 'right' }}>Streak</th>
                        <th>Created At</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', opacity: 0.4, padding: '20px' }}>No users registered</td>
                        </tr>
                      ) : (
                        usersList.map((user) => {
                          const display = user.display_name || (user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : `User_${user.id.slice(0, 4)}`);
                          return (
                            <tr key={user.id} style={{ background: selectedUser === user.id ? 'rgba(0,255,255,0.05)' : 'transparent' }}>
                              <td style={{ fontWeight: 700 }} title={user.wallet_address || user.id}>{display}</td>
                              <td style={{ textAlign: 'right', color: '#ffb800', fontWeight: 'bold' }}>{user.tokens || 0}</td>
                              <td style={{ textAlign: 'right' }}>{user.total_pulls || 0}</td>
                              <td style={{ textAlign: 'right', color: '#39ff14' }}>{user.streak_count || 0}d</td>
                              <td style={{ opacity: 0.6 }}>{new Date(user.created_at).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="config-btn"
                                  onClick={() => setSelectedUser(selectedUser === user.id ? 'all' : user.id)}
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '8px',
                                    border: selectedUser === user.id ? '1px solid #00ffff' : '1px solid rgba(255,255,255,0.15)',
                                    color: selectedUser === user.id ? '#00ffff' : 'inherit'
                                  }}
                                >
                                  {selectedUser === user.id ? 'Selected' : 'Filter'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Telemetry Events Feed */}
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', padding: '16px' }}>
                <div style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '18px',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={16} />
                    <span>Live Telemetry logs</span>
                  </div>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.4 }}>
                    showing {filteredEvents.length} events
                  </span>
                </div>

                {/* Dropdowns Filter Bar */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {/* Event Type Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '120px' }}>
                    <label style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.5, textTransform: 'uppercase' }}>Event Type</label>
                    <select
                      className="admin-input"
                      value={selectedEventType}
                      onChange={(e) => setSelectedEventType(e.target.value)}
                      style={{ width: '100%', textAlign: 'left', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="all">All Events</option>
                      <option value="game_end">game_end (Song Clears)</option>
                      <option value="card_burn">card_burn (Burns)</option>
                      <option value="pack_purchase">pack_purchase (Packs)</option>
                      <option value="daily_claim">daily_claim (Daily Drop)</option>
                      <option value="targeted_pull">targeted_pull (Targeted)</option>
                      <option value="rarity_upgrade">rarity_upgrade (Upgrades)</option>
                      <option value="duplicate_fusion">duplicate_fusion (Fusions)</option>
                      <option value="nft_mint">nft_mint (Mints)</option>
                      <option value="bonus_code_redeem">bonus_code_redeem (Promo Codes)</option>
                    </select>
                  </div>

                  {/* User Filter Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '160px' }}>
                    <label style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.5, textTransform: 'uppercase' }}>Filter User</label>
                    <select
                      className="admin-input"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      style={{ width: '100%', textAlign: 'left', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="all">All Users</option>
                      {usersList.map((user) => {
                        const label = user.display_name || (user.wallet_address ? `${user.wallet_address.slice(0, 10)}...${user.wallet_address.slice(-6)}` : `User_${user.id.slice(0, 8)}`);
                        return (
                          <option key={user.id} value={user.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Events Feed Table */}
                <div style={{ maxHeight: '438px', overflowY: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Event</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', opacity: 0.4, padding: '20px' }}>No events match filters</td>
                        </tr>
                      ) : (
                        filteredEvents.map((evt) => {
                          const matchedUser = usersList.find(u => u.id === evt.user_id);
                          const userLabel = matchedUser 
                            ? (matchedUser.display_name || (matchedUser.wallet_address ? `${matchedUser.wallet_address.slice(0, 5)}...${matchedUser.wallet_address.slice(-3)}` : `User_${evt.user_id.slice(0, 3)}`))
                            : 'Guest';
                          
                          // Style colors for events
                          const badgeColor = 
                            evt.event_type === 'game_end' ? '#00ffff' :
                            evt.event_type === 'card_burn' ? '#ff7700' :
                            evt.event_type === 'pack_purchase' ? '#ff007f' :
                            evt.event_type === 'nft_mint' ? '#3b82f6' :
                            evt.event_type === 'daily_claim' ? '#39ff14' : '#ffd700';

                          return (
                            <tr key={evt.id}>
                              <td style={{ whiteSpace: 'nowrap', opacity: 0.6 }}>{new Date(evt.created_at).toLocaleTimeString()}</td>
                              <td style={{ fontWeight: 'bold' }}>{userLabel}</td>
                              <td>
                                <span style={{
                                  fontSize: '8px', padding: '1px 4px', border: `1px solid ${badgeColor}`, color: badgeColor,
                                  fontWeight: 'bold', textTransform: 'uppercase', background: `${badgeColor}10`
                                }}>
                                  {evt.event_type}
                                </span>
                              </td>
                              <td style={{ opacity: 0.85, wordBreak: 'break-all', fontSize: '10px' }}>
                                {formatEventDetails(evt.event_type, evt.payload)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FLOATING SAVE BAR ===== */}
      <div className={`save-bar ${hasChanges ? 'visible' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-dot warning" />
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Unsaved Changes
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button aria-label="Action button" className="config-btn" onClick={() => {
            setConfig(getAdminConfig());
            setHasChanges(false);
          }}>
            Discard
          </button>
          <button aria-label="Action button" className="config-btn primary" onClick={handleSave}>
            Save Config
          </button>
          <button
            className="config-btn"
            disabled={pushStatus === 'pushing'}
            onClick={async () => {
              setPushStatus('pushing');
              try {
                const { supabase } = await import('../services/supabaseClient');
                const { data, error } = await supabase.functions.invoke('vault-engine', {
                  body: { action: 'updateAdminConfig', payload: { config, passphrase: 'th3scr1b3' } }
                });
                if (error || !data?.success) {
                  console.error('Push to server failed:', error?.message || data?.error);
                  setPushStatus('error');
                  setTimeout(() => setPushStatus('idle'), 3000);
                } else {
                  setPushStatus('success');
                  setTimeout(() => setPushStatus('idle'), 2000);
                }
              } catch (e) {
                console.error('Push to server error:', e);
                setPushStatus('error');
                setTimeout(() => setPushStatus('idle'), 3000);
              }
            }}
            style={{
              background: pushStatus === 'success' ? 'rgba(0,212,170,0.2)' : pushStatus === 'error' ? 'rgba(255,56,0,0.2)' : 'rgba(196,77,255,0.15)',
              border: `1px solid ${pushStatus === 'success' ? '#00d4aa' : pushStatus === 'error' ? '#ff3800' : 'rgba(196,77,255,0.4)'}`,
              color: pushStatus === 'success' ? '#00d4aa' : pushStatus === 'error' ? '#ff3800' : '#c44dff',
            }}
          >
            {pushStatus === 'pushing' ? '⏳ Pushing...' : pushStatus === 'success' ? '✓ Live!' : pushStatus === 'error' ? '✗ Failed' : '🚀 Push to Server'}
          </button>
        </div>
      </div>

      {/* Save flash */}
      {saveFlash && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 200,
          padding: '12px 24px',
          background: '#00d4aa',
          color: '#000',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          boxShadow: '4px 4px 0 #000',
          animation: 'slide-up 0.3s ease',
        }}>
          ✓ Config Saved
        </div>
      )}
    </div>
  );
}
