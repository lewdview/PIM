'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import WalletConnect from '../components/WalletConnect';
import IdentityTerminal from '../components/IdentityTerminal';
import { User, Shield, Key, Fingerprint, RefreshCw, ArrowLeft, Compass, ExternalLink } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import styles from './page.module.css';

export default function Home() {
  const [displayName, setDisplayName] = useState<string>('');
  const [activeUser, setActiveUser] = useState<SupabaseUser | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [redirectUri, setRedirectUri] = useState<string>('');

  const getAppName = (urlStr: string): string => {
    try {
      const url = new URL(urlStr);
      const host = url.hostname;
      const port = url.port;
      if (host.includes('pim.th3scr1b3.art') || host.includes('beatstar') || port === '5173') {
        return 'PIM : TH3V4ULT';
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
      };
    }
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return {
      main: isLocal ? 'http://localhost:3000' : 'https://th3scr1b3.art',
      pim: isLocal ? 'http://localhost:5173' : 'https://pim.th3scr1b3.art',
      base: 'https://base.th3scr1b3.art',
    };
  };

  const links = getEcosystemLinks();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uri = params.get('redirect_uri');
      if (uri) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRedirectUri(uri);
      }
    }

    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setActiveUser(session.user);
        
        // Fetch display name from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.display_name) {
          setDisplayName(profile.display_name);
        }
      }
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setActiveUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        if (profile?.display_name) {
          setDisplayName(profile.display_name);
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
      // 1. Update user metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (metaError) throw metaError;

      // 2. Upsert profiles table row
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

  return (
    <main className={styles.mainContainer}>
      {/* Glow Effects */}
      <div className={styles.radialGlow1} />
      <div className={styles.radialGlow2} />
      
      {/* Scanline Grid */}
      <div className={styles.gridOverlay} />

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
            Ecosystem Identity Hub & Telemetry Aggregator
          </p>
        </header>

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
              
              <WalletConnect />

              {activeUser && (
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
                <a href={links.main} className={`${styles.gatewayCard} ${styles.gatewayCardMain}`}>
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

                <a href={links.pim} className={`${styles.gatewayCard} ${styles.gatewayCardPim}`}>
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

                <a href={links.base} className={`${styles.gatewayCard} ${styles.gatewayCardBase}`}>
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
                    Aggregates play counts from 365 Warp and high scores/accuracy metrics from the beatstar rhythm game.
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
