'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import WalletConnect from '../components/WalletConnect';
import IdentityTerminal from '../components/IdentityTerminal';
import {
  User, Shield, Key, Fingerprint, RefreshCw, ArrowLeft, Compass, ExternalLink,
  Layers, Zap, Award
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import styles from './page.module.css';

export default function Home() {
  const [displayName, setDisplayName] = useState<string>('');
  const [activeUser, setActiveUser] = useState<SupabaseUser | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [redirectUri, setRedirectUri] = useState<string>('');

  // 3D Perspective Card Tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const isAnonymousUser = !!activeUser && (
    activeUser.is_anonymous || 
    activeUser.app_metadata?.provider === 'anonymous' || 
    (!activeUser.email && !activeUser.user_metadata?.wallet)
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * 22, y: -x * 22 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const getAppName = (urlStr: string): string => {
    try {
      const url = new URL(urlStr);
      const host = url.hostname;
      const port = url.port;
      if (host.includes('pim.th3scr1b3.art') || host.includes('vault') || port === '5173') {
        return 'PIM : TH3V4ULT';
      }
      if (host.includes('video.th3scr1b3.art')) {
        return '365 POSTER';
      }
      if (host.includes('mood.th3scr1b3.art')) {
        return 'MOOD BOARD';
      }
      if (host.includes('ce.th3scr1b3.art')) {
        return 'SONG ANALYZER';
      }
      if (host.includes('base.th3scr1b3.art')) {
        return 'BASE MINI-APP';
      }
      if (host.includes('th3scr1b3.art') || port === '3000' || port === '3001') {
        return 'TH3SCR1B3';
      }
      return host.toUpperCase();
    } catch {
      return 'PREVIOUS NODE';
    }
  };

  const getEcosystemLinks = () => {
    if (typeof window === 'undefined') {
      return {
        main: 'https://th3scr1b3.art',
        pim: 'https://pim.th3scr1b3.art',
        base: 'https://base.th3scr1b3.art',
        video: 'https://video.th3scr1b3.art',
        mood: 'https://th3scr1b3.art/mood-map',
        ce: 'https://ce.th3scr1b3.art',
      };
    }
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return {
      main: isLocal ? 'http://localhost:3000' : 'https://th3scr1b3.art',
      pim: isLocal ? 'http://localhost:5173' : 'https://pim.th3scr1b3.art',
      base: 'https://base.th3scr1b3.art',
      video: 'https://video.th3scr1b3.art',
      mood: 'https://th3scr1b3.art/mood-map',
      ce: 'https://ce.th3scr1b3.art',
    };
  };

  const links = getEcosystemLinks();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uri = params.get('redirect_uri');
      if (uri) {
        setRedirectUri(uri);
        sessionStorage.setItem('pim_redirect_uri', uri);
      } else {
        const saved = sessionStorage.getItem('pim_redirect_uri');
        if (saved) setRedirectUri(saved);
      }
    }

    const getRedirectUri = (): string | null => {
      const params = new URLSearchParams(window.location.search);
      return params.get('redirect_uri') || sessionStorage.getItem('pim_redirect_uri');
    };

    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setActiveUser(session.user);

        const uri = getRedirectUri();
        const isAnon = session.user.is_anonymous ||
                       session.user.app_metadata?.provider === 'anonymous' ||
                       (!session.user.email && !session.user.user_metadata?.wallet);
        if (uri && !isAnon) {
          console.log('[SYSTEM] Active session detected. Redirecting with tokens...');
          sessionStorage.removeItem('pim_redirect_uri');
          const url = new URL(uri);
          url.searchParams.set('access_token', session.access_token);
          url.searchParams.set('refresh_token', session.refresh_token);
          window.location.href = url.toString();
          return;
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.display_name) {
            setDisplayName(profile.display_name);
          }
        } catch {
          // Graceful fallback if profile record does not exist yet
        }
      }
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setActiveUser(session.user);

        const uri = getRedirectUri();
        const isAnon = session.user.is_anonymous ||
                       session.user.app_metadata?.provider === 'anonymous' ||
                       (!session.user.email && !session.user.user_metadata?.wallet);
        if (uri && !isAnon) {
          console.log('[SYSTEM] Session state changed. Redirecting with tokens...');
          sessionStorage.removeItem('pim_redirect_uri');
          const url = new URL(uri);
          url.searchParams.set('access_token', session.access_token);
          url.searchParams.set('refresh_token', session.refresh_token);
          window.location.href = url.toString();
          return;
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.display_name) {
            setDisplayName(profile.display_name);
          }
        } catch {
          // Graceful fallback
        }
      } else {
        setActiveUser(null);
        setDisplayName('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    
    setUpdating(true);
    setMessage(null);

    try {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (metaError) throw metaError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: activeUser.id,
          display_name: displayName,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      setMessage({ text: 'Identity updated successfully. Signal synchronized.', type: 'success' });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error updating profile.';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const walletAddr = activeUser?.user_metadata?.wallet || activeUser?.email;
  const aliasDisplay = displayName || (walletAddr ? walletAddr.slice(0, 10) + '…' : 'SOVEREIGN SCRIBE');

  return (
    <main className={styles.mainContainer}>
      {/* Noise Overlay */}
      <div className={styles.noiseOverlay} />

      {/* Glow Effects */}
      <div className={styles.radialGlow1} />
      <div className={styles.radialGlow2} />
      <div className={styles.radialGlow3} />

      <div className={styles.contentWrapper}>
        {redirectUri && (
          <div className={styles.returnBanner}>
            <a href={redirectUri} className={styles.returnLink}>
              <ArrowLeft size={16} className={styles.returnIcon} />
              <span>RETURN TO {getAppName(redirectUri)}</span>
            </a>
          </div>
        )}

        {/* Title */}
        <header className={styles.header}>
          <Fingerprint size={48} className={styles.fingerprintIcon} />
          <h1 className={styles.glitchTitle}>
            user.th3scr1b3.art
          </h1>
          <p className={styles.subtitle}>
            Ecosystem Identity Hub & Sovereign Passport
          </p>
        </header>

        {/* 3D Passport Pedestal */}
        <section className={styles.passportPedestal}>
          <div
            ref={cardRef}
            className={styles.passport3dWrapper}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
          >
            <div className={styles.spinningVinylDisc}>
              <div
                className={styles.vinylCenterArt}
                style={{
                  backgroundImage: `radial-gradient(circle at center, rgba(255,56,0,0.8), #0d0006), url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            </div>

            <div className={styles.passport3dCard}>
              <div className={styles.specularGlare} />

              <div className={styles.avatarNeonFrame}>
                <div className="w-full h-full rounded-full bg-[#0d0d14] flex items-center justify-center">
                  <User size={36} className="text-white/40" />
                </div>
              </div>

              <div>
                <h2 className={styles.passportAliasHeadline}>{aliasDisplay}</h2>
                <p className={styles.passportStatusSub}>
                  {isAnonymousUser ? 'GUEST SESSION // EPHEMERAL' : 'SOVEREIGN IDENTITY // VERIFIED'}
                </p>

                <div className={styles.passportTagsRow}>
                  <span className={styles.passportTagChip}>
                    {activeUser?.app_metadata?.provider || 'Web3'}
                  </span>
                  <span className={styles.passportTagChip}>
                    Day 213 Active
                  </span>
                </div>
              </div>

              <div className="font-mono text-[9px] text-white/30 tracking-widest uppercase">
                user.th3scr1b3.art // PASSPORT MATRIX
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <div className={styles.dashboardGrid}>
          {/* Settings / Auth Card */}
          <section className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <Key size={16} className={styles.panelIcon} />
              <h2>Authorization Matrix</h2>
            </div>
            
            <div className={styles.panelBody}>
              <p className={styles.panelDesc}>
                Secure your cryptographic credentials. Connect your Base-compatible Web3 wallet to authenticate and synchronize assets across all th3scr1b3 endpoints.
              </p>
              
              <WalletConnect redirectUri={redirectUri} />

              {activeUser && !isAnonymousUser && (
                <form onSubmit={updateProfile} className={styles.profileForm}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="displayName" className={styles.inputLabel}>
                      Display Name / Scribe Alias
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="scribe_alias"
                        required
                        className={styles.textInput}
                        maxLength={24}
                      />
                      <button type="submit" className={styles.saveBtn} disabled={updating}>
                        {updating ? <RefreshCw className={styles.spin} size={14} /> : 'Sync'}
                      </button>
                    </div>
                  </div>
                  {message && (
                    <div className={message.type === 'success' ? styles.successAlert : styles.errorAlert}>
                      {message.text}
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>

          {/* Telemetry Card */}
          <section className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <User size={16} className={styles.panelIcon} />
              <h2>Integrated Telemetry</h2>
            </div>
            
            <div className={styles.panelBody}>
              <IdentityTerminal />
            </div>
          </section>

          {/* Scribe Gateway Hub Card */}
          <section className={`${styles.panelCard} ${styles.fullWidthCard}`}>
            <div className={styles.panelHeader}>
              <Compass size={16} className={styles.panelIcon} />
              <h2>Scribe Gateway Hub</h2>
            </div>
            
            <div className={styles.panelBody}>
              <p className={styles.panelDesc}>
                Traverse the sibling subdomains of the th3scr1b3 ecosystem. Access telemetry, interactive play, and cryptographic assets.
              </p>
              
              <div className={styles.gatewayGrid}>
                <a href={links.main} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    th3scr1b3.art
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    Main ecosystem hub, narrative engine, and 365 Warp portal.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / MAIN_NODE
                  </span>
                </a>

                <a href={links.pim} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    PIM : TH3V4ULT
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    Arcade rhythm game and player cabinet. Synchronizes play telemetry.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / PLAY_NODE
                  </span>
                </a>

                <a href={links.base} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    BASE MINI-APP
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    Farcaster Frame and on-chain mini-application integration.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / WEB3_NODE
                  </span>
                </a>

                <a href={links.video} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    365 POSTER
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    Visual archive of the 365 daily release poster series.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / VISUAL_NODE
                  </span>
                </a>

                <a href={links.mood} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    MOOD MAP
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    Interactive mood map and poem analyzer on th3scr1b3.art.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / MOOD_NODE
                  </span>
                </a>

                <a href={links.ce} className={styles.gatewayCard}>
                  <h3 className={styles.gatewayCardTitle}>
                    SONG ANALYZER
                    <ExternalLink size={14} className={styles.gatewayCardTitleIcon} />
                  </h3>
                  <p className={styles.gatewayCardDesc}>
                    CE — audio analysis, lyrics, and spectral telemetry engine.
                  </p>
                  <span className={styles.gatewayCardStatus}>
                    <span className={styles.statusIndicator} />
                    ONLINE / CE_NODE
                  </span>
                </a>
              </div>
            </div>
          </section>

          {/* API Documentation Card */}
          <section className={`${styles.panelCard} ${styles.fullWidthCard}`}>
            <div className={styles.panelHeader}>
              <Shield size={16} className={styles.panelIcon} />
              <h2>Ecosystem Endpoint APIs</h2>
            </div>
            
            <div className={styles.panelBody}>
              <p className={styles.panelDesc}>
                Cross-origin resource APIs available for integrating client subdomains (`th3scr1b3.art`, `base.th3scr1b3.art`, `pim.th3scr1b3.art`):
              </p>
              
              <div className={styles.apiGrid}>
                <div className={styles.apiItem}>
                  <div className={styles.apiPath}>
                    <span className={styles.methodGet}>GET</span>
                    <code>/api/profile</code>
                  </div>
                  <p className={styles.apiDesc}>
                    Returns connected wallet address, username/alias, and account metadata. Expects Bearer JWT verification.
                  </p>
                </div>

                <div className={styles.apiItem}>
                  <div className={styles.apiPath}>
                    <span className={styles.methodGet}>GET</span>
                    <code>/api/analytics</code>
                  </div>
                  <p className={styles.apiDesc}>
                    Aggregates play counts from 365 Warp and high scores/accuracy metrics from the PIM rhythm game.
                  </p>
                </div>

                <div className={styles.apiItem}>
                  <div className={styles.apiPath}>
                    <span className={styles.methodPost}>POST</span>
                    <code>/api/collection</code>
                  </div>
                  <p className={styles.apiDesc}>
                    Allows syncing and saving card collection drops securely in the cloud, replacing localStorage caches.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>SYSTEM_ID: USER_IDENT_MATRIX.v365 // STATUS: SECURED</p>
          <p>© 2026 th3scr1b3. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
