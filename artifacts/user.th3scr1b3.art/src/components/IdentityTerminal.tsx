'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal as TerminalIcon, Loader2, Sparkles } from 'lucide-react';
import styles from './IdentityTerminal.module.css';

interface ProfileStats {
  tokens: number;
  streakCount: number;
  totalPulls: number;
}

interface CollectionStats {
  totalCards: number;
  echoesCount: number;
  rarityBreakdown: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
    mythic: number;
  };
}

interface MusicStats {
  totalListens: number;
}

interface GamingStats {
  totalGames: number;
  maxScore: number;
  maxCombo: number;
  avgAccuracy: number;
  medals: {
    BRONZE: number;
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
    NONE: number;
  };
}

interface UserStats {
  profile: ProfileStats;
  collection: CollectionStats;
  music: MusicStats;
  gaming: GamingStats;
}

export default function IdentityTerminal() {
  const [loading, setLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    let active = true;

    const runBootSequence = async () => {
      const addLog = (msg: string) => {
        if (active) setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      };

      addLog('INITIALIZING IDENTITY BOOTSTRAP...');
      await new Promise(r => setTimeout(r, 600));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addLog('WARNING: NO ACTIVE USER SESSION DETECTED. WEBLINK IDLE.');
        setLoading(false);
        return;
      }

      addLog(`IDENTITY DECRYPTED: ${session.user.id.slice(0, 8)}...`);
      await new Promise(r => setTimeout(r, 500));
      
      addLog('CONNECTING TO ANALYTICS SECURE CORE...');
      
      try {
        const token = session.access_token;
        const analyticsRes = await fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } });
        const analyticsData = await analyticsRes.json();

        if (analyticsData.authenticated) {
          setStats(analyticsData.stats);
          addLog('TELEMETRY MATRIX ONLINE.');
        } else {
          addLog('ERROR: TELEMETRY ACCESS REJECTED.');
        }

        await new Promise(r => setTimeout(r, 400));
        addLog('IDENTITY LOG STREAMS ESTABLISHED. TERMINAL ACTIVE.');

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog(`ERROR INCORPORATING DATA SOURCES: ${errMsg}`);
      } finally {
        setLoading(false);
      }
    };

    runBootSequence();

    // Subscribe to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setLogs([`[${new Date().toLocaleTimeString()}] SYSTEM SHUTDOWN. IDLE.`]);
        setStats(null);
      } else if (event === 'SIGNED_IN') {
        setLogs([]);
        setLoading(true);
        runBootSequence();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className={styles.terminalContainer}>
      {/* Header */}
      <div className={styles.terminalHeader}>
        <div className={styles.terminalIcons}>
          <span className={styles.dotRed} />
          <span className={styles.dotYellow} />
          <span className={styles.dotGreen} />
        </div>
        <div className={styles.terminalTitle}>
          <TerminalIcon size={12} className={styles.termIcon} />
          <span>telemetry_stream.v365</span>
        </div>
        <div className={styles.glitchGlow}>SECURE</div>
      </div>

      {/* Screen */}
      <div className={styles.terminalScreen}>
        {/* Log stream */}
        <div className={styles.logStream}>
          {logs.map((log, idx) => (
            <div key={idx} className={styles.logLine}>{log}</div>
          ))}
          {loading && (
            <div className={styles.loadingLine}>
              <Loader2 className={styles.spinner} size={12} />
              <span>FETCHING SECURE DATA CHUNKS...</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        {stats && !loading && (
          <div className={styles.statsLayout}>
            {/* Profile Matrix */}
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>
                <Sparkles size={12} className={styles.cardIconTeal} />
                <span>Ecosystem Identity</span>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>V⚡ Token Balance:</span>
                  <span className={styles.statValueTeal}>{stats.profile.tokens} V⚡</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Daily Claim Streak:</span>
                  <span className={styles.statValueTeal}>{stats.profile.streakCount} Days</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Pack Pulls:</span>
                  <span className={styles.statValueTeal}>{stats.profile.totalPulls} Pulls</span>
                </div>
              </div>
            </div>

            {/* Collectibles Inventory */}
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>
                <Sparkles size={12} className={styles.cardIconViolet} />
                <span>Collectibles Inventory</span>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Cards Owned:</span>
                  <span className={styles.statValueViolet}>{stats.collection.totalCards} Cards</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Duplicates Fused (Echo):</span>
                  <span className={styles.statValueViolet}>{stats.collection.echoesCount} Echoes</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Rarity Breakdown:</span>
                  <span className={styles.statValueViolet} style={{ fontSize: '9px' }}>
                    C:{stats.collection.rarityBreakdown.common} | U:{stats.collection.rarityBreakdown.uncommon} | R:{stats.collection.rarityBreakdown.rare} | E:{stats.collection.rarityBreakdown.epic} | L:{stats.collection.rarityBreakdown.legendary} | M:{stats.collection.rarityBreakdown.mythic}
                  </span>
                </div>
              </div>
            </div>

            {/* Gaming Performance */}
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>
                <Sparkles size={12} className={styles.cardIconViolet} />
                <span>Rhythm Performance</span>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Runs Finished:</span>
                  <span className={styles.statValueViolet}>{stats.gaming.totalGames}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Peak Score:</span>
                  <span className={styles.statValueViolet}>{stats.gaming.maxScore.toLocaleString()}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Max Combo:</span>
                  <span className={styles.statValueViolet}>{stats.gaming.maxCombo}x</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Avg Accuracy:</span>
                  <span className={styles.statValueViolet}>{stats.gaming.avgAccuracy}%</span>
                </div>
              </div>
            </div>

            {/* Music Listening */}
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>
                <Sparkles size={12} className={styles.cardIconTeal} />
                <span>Ecosystem Listening</span>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Audio Listens:</span>
                  <span className={styles.statValueTeal}>{stats.music.totalListens}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Sync Node:</span>
                  <span className={styles.statValueTeal}>ONLINE</span>
                </div>
              </div>
            </div>

            {/* Medals Showcase */}
            {stats.gaming.totalGames > 0 && (
              <div className={styles.medalsRow}>
                <span className={styles.medalsLabel}>Medals Claimed:</span>
                <div className={styles.medalsGroup}>
                  {stats.gaming.medals.PLATINUM > 0 && (
                    <span className={styles.medalPlatinum} title="Platinum Medals">
                      ✸ {stats.gaming.medals.PLATINUM}P
                    </span>
                  )}
                  {stats.gaming.medals.GOLD > 0 && (
                    <span className={styles.medalGold} title="Gold Medals">
                      ✦ {stats.gaming.medals.GOLD}G
                    </span>
                  )}
                  {stats.gaming.medals.SILVER > 0 && (
                    <span className={styles.medalSilver} title="Silver Medals">
                      ✦ {stats.gaming.medals.SILVER}S
                    </span>
                  )}
                  {stats.gaming.medals.BRONZE > 0 && (
                    <span className={styles.medalBronze} title="Bronze Medals">
                      ✦ {stats.gaming.medals.BRONZE}B
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
