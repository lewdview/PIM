'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, ShieldAlert, LogOut, Loader2, Github, Mail, User2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import styles from './WalletConnect.module.css';

const BASE_CHAIN_ID_HEX = '0x2105'; // 8453
const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://base.blockscout.com'],
} as const;

interface WalletRequest {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

interface WalletConnectProps {
  redirectUri?: string;
}

export default function WalletConnect({ redirectUri }: WalletConnectProps) {
  const [activeUser, setActiveUser] = useState<SupabaseUser | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth view states
  const [activeTab, setActiveTab] = useState<'wallet' | 'email'>('wallet');
  const [magicEmail, setMagicEmail] = useState<string>('');
  const [emailSent, setEmailSent] = useState<string | null>(null);

  useEffect(() => {
    // Check active session on load
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setActiveUser(session.user);
        setWalletAddress(session.user.user_metadata?.wallet || null);
      }
    };
    fetchSession();

    // Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setActiveUser(session?.user || null);
      setWalletAddress(session?.user?.user_metadata?.wallet || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    setError(null);

    const wallet = typeof window !== 'undefined'
      ? (window as unknown as { ethereum?: WalletRequest }).ethereum
      : undefined;

    if (!wallet) {
      const msg = 'No Base-compatible wallet detected. Install Metamask or Coinbase Wallet to continue.';
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      // 1. Ensure user is connected to Base Mainnet
      const chainId = await wallet.request({ method: 'eth_chainId' });
      if (typeof chainId === 'string' && chainId.toLowerCase() !== BASE_CHAIN_ID_HEX) {
        try {
          await wallet.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          });
        } catch (switchError: unknown) {
          const sErr = switchError as { code?: number };
          // If chain is not added, add it
          if (sErr.code === 4902) {
            try {
              await wallet.request({
                method: 'wallet_addEthereumChain',
                params: [BASE_CHAIN_CONFIG],
              });
            } catch {
              const msg = 'Please add Base Mainnet to your wallet.';
              setError(msg);
              setLoading(false);
              return;
            }
          } else {
            const msg = 'Please switch to Base Mainnet.';
            setError(msg);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Request accounts
      const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }
      const address = accounts[0];

      // 3. Initiate Supabase Web3 authentication via Edge Function
      const message = `Sign in to user.th3scr1b3.art on Base. Nonce: ${Date.now()}`;
      const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signature = await wallet.request({
        method: 'personal_sign',
        params: [hexMsg, address],
      }) as string;

      const { data: functionData, error: funcError } = await supabase.functions.invoke('auth-smart-wallet', {
        body: { address, message, signature }
      });

      if (funcError || !functionData?.success) {
        throw new Error(functionData?.error || funcError?.message || 'Verification failed');
      }

      // 4. Establish Session
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: functionData.session.access_token,
        refresh_token: functionData.session.refresh_token,
      });

      if (sessionError) {
        throw sessionError;
      }

      // 5. Update the profile with the wallet address
      const user = sessionData?.user;
      if (user) {
        await supabase.auth.updateUser({
          data: { wallet: address }
        });
        
        // Upsert into public profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: user.user_metadata?.display_name || `scribe_${address.slice(2, 8)}`,
            wallet: address,
            updated_at: new Date().toISOString()
          } as Record<string, unknown>);
          
        if (profileError) {
          console.error('Error updating profile:', profileError.message);
        }
      }

      setWalletAddress(address);
    } catch (err: unknown) {
      console.error('Connection failed:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUriParam = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin + redirectUriParam,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || 'GitHub connection failed');
      setLoading(false);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail || !magicEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setEmailSent(null);
    try {
      const redirectUriParam = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
      const { error } = await supabase.auth.signInWithOtp({
        email: magicEmail.trim(),
        options: {
          emailRedirectTo: window.location.origin + redirectUriParam,
        },
      });
      if (error) throw error;
      setEmailSent('Magic link sent. Check your inbox.');
      setMagicEmail('');
    } catch (err: any) {
      setError(err?.message || 'Magic link request failed');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setWalletAddress(null);
      setActiveUser(null);
    } catch (err: unknown) {
      console.error('Disconnect failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const displayIdentity = walletAddress 
    ? truncateAddress(walletAddress) 
    : (activeUser?.email || 'Authenticated User');

  return (
    <div className={styles.wrapper}>
      {activeUser ? (
        <div className={styles.connectedBox}>
          <div className={styles.addressInfo}>
            <span className={styles.indicator} />
            {walletAddress ? (
              <Zap size={14} className={styles.connectedIconZap} />
            ) : (
              <User2 size={14} className={styles.connectedIconUser} />
            )}
            <span className={styles.addressText} title={walletAddress || activeUser.email}>
              {displayIdentity}
            </span>
          </div>
          <button onClick={disconnectWallet} className={styles.disconnectBtn} disabled={loading}>
            {loading ? <Loader2 className={styles.spinner} size={14} /> : <LogOut size={14} />}
            <span>Disconnect</span>
          </button>
        </div>
      ) : (
        <div className={styles.authContainer}>
          {/* Custom navigation tabs inside CSS module classes */}
          <div className={styles.tabs}>
            <button
              onClick={() => { setActiveTab('wallet'); setError(null); setEmailSent(null); }}
              className={`${styles.tabBtn} ${activeTab === 'wallet' ? styles.tabActive : ''}`}
            >
              <Zap size={13} />
              <span>Base Wallet</span>
            </button>
            <button
              onClick={() => { setActiveTab('email'); setError(null); setEmailSent(null); }}
              className={`${styles.tabBtn} ${activeTab === 'email' ? styles.tabActive : ''}`}
            >
              <Mail size={13} />
              <span>Email & Social</span>
            </button>
          </div>

          {/* Tab content panels */}
          <div className={styles.tabContent}>
            {activeTab === 'wallet' ? (
              <div className={styles.walletPanel}>
                <p className={styles.descText}>
                  Connect Base-compatible Web3 wallet to authenticate and synchronize assets.
                </p>
                <button onClick={connectWallet} className={styles.connectBtn} disabled={loading}>
                  {loading ? (
                    <Loader2 className={styles.spinner} size={16} />
                  ) : (
                    <Zap className={styles.zapIcon} size={16} />
                  )}
                  <span>{loading ? 'Authorizing...' : 'Connect Base Wallet'}</span>
                </button>
              </div>
            ) : (
              <div className={styles.identityPanel}>
                {/* GitHub Auth */}
                <button onClick={connectGitHub} className={styles.githubBtn} disabled={loading}>
                  {loading ? (
                    <Loader2 className={styles.spinner} size={14} />
                  ) : (
                    <Github size={14} />
                  )}
                  <span>Continue with GitHub</span>
                </button>

                <div className={styles.separator}>
                  <div className={styles.sepLine} />
                  <span className={styles.sepText}>OR</span>
                  <div className={styles.sepLine} />
                </div>

                {/* Magic Link */}
                {emailSent ? (
                  <div className={styles.emailSentMsg}>
                    <Mail size={14} className={styles.sentIcon} />
                    <span>{emailSent}</span>
                  </div>
                ) : (
                  <form onSubmit={sendMagicLink} className={styles.magicLinkForm}>
                    <div className={styles.inputGroup}>
                      <input
                        type="email"
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        placeholder="operator@domain.com"
                        className={styles.emailInput}
                        required
                        disabled={loading}
                      />
                      <button type="submit" className={styles.magicLinkBtn} disabled={loading}>
                        {loading ? <Loader2 className={styles.spinner} size={14} /> : <Mail size={14} />}
                        <span>Send Link</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className={styles.errorAlert}>
          <ShieldAlert size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
