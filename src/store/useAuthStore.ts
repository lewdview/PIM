import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { useVaultStore } from './useVaultStore';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { Wallet } from 'ethers';
import { logAnalyticsEvent } from '../services/telemetryService';
import { farcasterService } from '../services/farcasterService';

const BASE_CHAIN_ID_HEX = '0x2105';
const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://base.blockscout.com'],
} as const;

type WalletRequest = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

interface AuthState {
  user: User | null;
  session: Session | null;
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  showIdentityModal: boolean;
  setShowIdentityModal: (show: boolean) => void;
  initialize: () => Promise<void>;
  signInWithWallet: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithEphemeralWallet: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; confirmationRequired?: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithProvider: (provider: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithPasskey: () => Promise<{ error: string | null }>;
  registerPasskey: (email?: string) => Promise<{ error: string | null; data?: any }>;
  isPasskeySupported: () => boolean;
  ensureProfileAndWallet: (user: User) => Promise<void>;
}

let subscribed = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  status: 'idle',
  error: null,
  showAuthModal: false,
  setShowAuthModal: (show: boolean) => {
    set({ showAuthModal: show });
  },
  showIdentityModal: false,
  setShowIdentityModal: (show: boolean) => {
    set({ showIdentityModal: show });
  },
  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    console.log('[Auth] Initializing with Redirect Token check...');

    // Safeguard: Ensure auth initialization never hangs UI for more than 2.5 seconds
    const safetyTimer = setTimeout(() => {
      if (get().status === 'loading' || get().status === 'idle') {
        console.warn('[Auth] Auth initialization timeout fallback reached. Unblocking app.');
        set({ status: 'ready' });
      }
    }, 2500);

    // 1. Inspect URL for redirect tokens or PKCE auth codes (hash fragments preferred, query params as fallback)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
    const code = urlParams.get('code') || hashParams.get('code');
    let activeSession: Session | null = null;

    if (code) {
      console.log('[Auth] Detected OAuth PKCE authorization code. Exchanging for session...');
      try {
        const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;

        // Clean code from browser history/address bar
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('code');
        window.history.replaceState({}, document.title, cleanUrl.toString());

        activeSession = exchangeData.session;
      } catch (err) {
        console.error('[Auth] Failed to exchange PKCE code for session:', err);
      }
    } else if (accessToken && refreshToken) {
      console.log('[Auth] Detected authorization redirect tokens. Establishing session...');
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;

        // Clean tokens from browser history/address bar
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('access_token');
        cleanUrl.searchParams.delete('refresh_token');
        cleanUrl.hash = '';
        window.history.replaceState({}, document.title, cleanUrl.toString());

        activeSession = sessionData.session;
      } catch (err) {
        console.error('[Auth] Failed to set session from URL redirect tokens:', err);
      }
    }

    // 2. Fetch existing session if we didn't just get one from redirect params
    if (!activeSession) {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        set({ error: error.message });
      } else {
        activeSession = data.session;
      }
    }

    if (activeSession) {
      const user = activeSession.user;
      if (user && user.email) {
        const userPkey = localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${user.id}`);
        if (userPkey) {
          localStorage.setItem('th3vault_ephemeral_wallet_pkey', userPkey);
        }
      }
      clearTimeout(safetyTimer);
      set({
        session: activeSession,
        user: user ?? null,
        status: 'ready',
      });
      if (user) {
        void get().ensureProfileAndWallet(user);
      }
    } else {
      // 3. No session found: perform direct anonymous sign-in for seamless gameplay
      const path = window.location.pathname;
      const isPublicPath = path === '/pitch-deck' || path === '/vault/legal';
      
      if (!isPublicPath) {
        console.log('[Auth] Attempting direct anonymous sign in...');
        try {
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;
          console.log('[Auth] Direct anonymous sign-in successful:', anonData.session?.user?.id);
          set({
            session: anonData.session,
            user: anonData.session?.user ?? null,
            status: 'ready',
          });
          if (anonData.session?.user) {
            void get().ensureProfileAndWallet(anonData.session.user);
          }
        } catch (err) {
          console.error('[Auth] Direct anonymous sign-in error:', err);
          set({ status: 'ready' });
        }
      } else {
        // Public pages can continue in idle/ready state without a session
        set({ status: 'ready' });
      }
    }

    if (!subscribed) {
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] onAuthStateChange:', event, { hasSession: !!session, userId: session?.user?.id?.slice(0, 8) });
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          const user = session.user;
          if (user.email) {
            const userPkey = localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${user.id}`);
            if (userPkey) {
              localStorage.setItem('th3vault_ephemeral_wallet_pkey', userPkey);
            }
          }
          await get().ensureProfileAndWallet(user);
          useVaultStore.getState().loadVaultData();
        }
      });
      subscribed = true;
    }

    // Initial load if already signed in
    if (activeSession?.user) {
      useVaultStore.getState().loadVaultData();
    }
  },
  signInWithWallet: async () => {
    set({ error: null });
    console.log('[Auth] signInWithWallet started');

    const fcProvider = await farcasterService.getEthereumProvider();
    let wallet = (fcProvider || (window as any)?.ethereum) as WalletRequest | undefined;

    // If no standard wallet extension is found, fallback to Coinbase Smart Wallet (SDK v4)
    if (!wallet) {
      console.log('[Auth] No window.ethereum found. Initializing Coinbase Smart Wallet SDK v4...');
      try {
        const sdk = new CoinbaseWalletSDK({
          appName: 'Th3vault',
          appLogoUrl: 'https://th3scr1b3.art/icon.png',
        });
        // v4 uses makeWeb3Provider() — getProvider() was removed
        wallet = sdk.makeWeb3Provider() as unknown as WalletRequest;
      } catch (err) {
        console.error('Failed to init Coinbase Smart Wallet SDK:', err);
      }
    }

    if (!wallet) {
      const msg = 'No wallet found. Install MetaMask or use a Coinbase Wallet compatible browser.';
      set({ error: msg });
      return { error: msg };
    }

    console.log('[Auth] Wallet provider detected:', typeof wallet);

    // Ensure Base chain 
    try {
      const chainId = await wallet.request({ method: 'eth_chainId' });
      console.log('[Auth] Current chain:', chainId);
      const isBase = typeof chainId === 'number'
        ? chainId === 8453
        : typeof chainId === 'string' && (chainId.toLowerCase() === BASE_CHAIN_ID_HEX || chainId === '8453' || chainId.toLowerCase() === 'eip155:8453');

      if (!isBase) {
        console.log('[Auth] Switching to Base...');
        try {
          await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
        } catch (switchError: any) {
          // Error code 4902 indicates that the chain has not been added to the wallet
          if (switchError.code === 4902) {
            console.log('[Auth] Base chain not added. Adding Base chain...');
            await wallet.request({ method: 'wallet_addEthereumChain', params: [BASE_CHAIN_CONFIG] });
          } else if (farcasterService.isFarcaster()) {
            console.warn('[Auth] Farcaster host bypassed wallet_switchEthereumChain RPC:', switchError);
          } else {
            throw switchError;
          }
        }
        
        // Wait a short duration to let the provider update its internal state
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Double check chainId (only strictly enforce for external browser extensions, not embedded Farcaster)
        if (!farcasterService.isFarcaster()) {
          const verifyChainId = await wallet.request({ method: 'eth_chainId' });
          const verifiedBase = typeof verifyChainId === 'number'
            ? verifyChainId === 8453
            : typeof verifyChainId === 'string' && (verifyChainId.toLowerCase() === BASE_CHAIN_ID_HEX || verifyChainId === '8453' || verifyChainId.toLowerCase() === 'eip155:8453');
          if (!verifiedBase) {
            throw new Error('Please switch to the Base network in your wallet to proceed.');
          }
        }
      }
    } catch (chainErr: any) {
      if (farcasterService.isFarcaster()) {
        console.warn('[Auth] Farcaster chain verification bypassed for auth:', chainErr);
      } else {
        console.error('[Auth] Chain switch failed:', chainErr);
        const msg = chainErr?.message || String(chainErr);
        set({ error: `Network switch failed: ${msg}` });
        return { error: msg };
      }
    }

    try {
      console.log('[Auth] Using Universal Smart Wallet EIP-1271 Auth Flow...');
      
      // 1. Get Address
      const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts[0];
      if (!address) throw new Error('No account found');

      // 2. Request server-generated nonce for replay protection (C2 audit fix)
      const { data: nonce, error: nonceErr } = await supabase.rpc('generate_auth_nonce', {
        p_wallet_address: address,
      });
      if (nonceErr || !nonce) throw new Error('Failed to generate auth nonce: ' + (nonceErr?.message || 'empty response'));

      // 3. Prepare Message with nonce and timestamp
      const timestamp = new Date().toISOString();
      const message = `Sign in to PIM : th3v4ult\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 4. Sign Message
      const signature = await wallet.request({
        method: 'personal_sign',
        params: [hexMsg, address],
      });

      // 5. Verify via Edge Function (pass nonce for server-side validation)
      const { data, error } = await supabase.functions.invoke('auth-smart-wallet', {
        body: { address, message, signature, nonce }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Verification failed');
      }

      // 5. Establish Session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      // Clear ephemeral flag since user explicitly connected an external Web3 wallet
      localStorage.removeItem('th3vault_is_ephemeral_wallet');

      set({ session: data.session, user: data.user, showAuthModal: false });

      // Log EVM Wallet connect event
      logAnalyticsEvent('wallet_connect', { address });

      // Trigger data load
      try {
        await useVaultStore.getState().loadVaultData();
        console.log('[Auth] loadVaultData completed');
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed (non-fatal):', loadErr);
      }

      return { error: null };

    } catch (thrown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      console.error('[Auth] signInWithWallet THREW:', thrown);
      set({ error: `Wallet sign-in failed: ${msg}` });
      return { error: msg };
    }
  },
  signInWithEphemeralWallet: async () => {
    console.log('[Auth] Starting Ephemeral Wallet fallback...');
    try {
      let pkey = localStorage.getItem('th3vault_ephemeral_wallet_pkey');
      if (!pkey) {
        const wallet = Wallet.createRandom();
        pkey = wallet.privateKey;
        localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);
        console.log('[Auth] Generated new ephemeral wallet address:', wallet.address);
      }
      
      const wallet = new Wallet(pkey);
      const address = wallet.address;

      // Request server-generated nonce for replay protection (C2 audit fix)
      const { data: nonce, error: nonceErr } = await supabase.rpc('generate_auth_nonce', {
        p_wallet_address: address,
      });
      if (nonceErr || !nonce) throw new Error('Failed to generate auth nonce: ' + (nonceErr?.message || 'empty response'));

      const timestamp = new Date().toISOString();
      const message = `Sign in to PIM : th3v4ult\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      
      console.log('[Auth] Signing with Ephemeral Wallet:', address);
      const signature = await wallet.signMessage(message);
      
      const { data, error } = await supabase.functions.invoke('auth-smart-wallet', {
        body: { address, message, signature, nonce }
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Verification failed');
      }
      
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      
      if (sessionError) throw sessionError;

      // Mark session explicitly as ephemeral and persist user key
      if (data.user?.id) {
        localStorage.setItem('th3vault_is_ephemeral_wallet', 'true');
        localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${data.user.id}`, pkey);
        localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);
      }
      
      set({ session: data.session, user: data.user, status: 'ready', showAuthModal: false });

      // Log Ephemeral Wallet create event
      logAnalyticsEvent('ephemeral_wallet_create', { address });
      
      try {
        await useVaultStore.getState().loadVaultData();
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed:', loadErr);
      }
    } catch (err) {
      console.error('[Auth] Ephemeral Wallet authentication failed:', err);
      set({ error: `Authentication failed: ${err instanceof Error ? err.message : String(err)}`, status: 'ready' });
    }
  },
  signUpWithEmail: async (email, password) => {
    set({ error: null, status: 'loading' });
    try {
      const wallet = Wallet.createRandom();
      const address = wallet.address;
      const pkey = wallet.privateKey;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            wallet_address: address,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed: no user data returned.');

      const userId = data.user.id;
      localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${userId}`, pkey);
      localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);

      // Only upsert profile if session is established. (Trigger handle_new_user automatically creates
      // the profile row anyway, so this is redundant and would fail due to RLS if session is null)
      if (data.session) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({ id: userId, wallet_address: address });

        if (profileErr) {
          console.warn('[Auth] Profiles upsert error:', profileErr.message);
        }
      }

      set({ 
        session: data.session, 
        user: data.user, 
        status: 'ready', 
        showAuthModal: !data.session 
      });

      try {
        if (data.session) {
          await useVaultStore.getState().loadVaultData();
        }
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed:', loadErr);
      }

      if (!data.session) {
        return { error: null, confirmationRequired: true };
      }

      return { error: null };
    } catch (err: any) {
      console.error('[Auth] signUpWithEmail error:', err);
      const rawMsg = err?.message || String(err);
      let friendlyMsg = rawMsg;
      if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('over_email_send_rate_limit')) {
        friendlyMsg = 'Email hourly send limit reached. Connect via Web3 (instant) or GitHub for immediate access.';
      }
      set({ error: friendlyMsg, status: 'ready' });
      return { error: friendlyMsg };
    }
  },
  signInWithEmail: async (email, password) => {
    set({ error: null, status: 'loading' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign in failed: no user returned.');

      const userId = data.user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .maybeSingle();

      let linkedAddress = profile?.wallet_address;
      let pkey = localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${userId}`);

      if (!linkedAddress) {
        const wallet = Wallet.createRandom();
        linkedAddress = wallet.address;
        pkey = wallet.privateKey;

        localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${userId}`, pkey);
        localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);

        await supabase
          .from('profiles')
          .upsert({ id: userId, wallet_address: linkedAddress });

        await supabase.auth.updateUser({
          data: { wallet_address: linkedAddress }
        });
      } else {
        if (pkey) {
          localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);
        } else {
          // SECURITY: Existing wallet detected but local private key is missing (new device).
          // Do NOT overwrite the wallet_address — this would orphan any on-chain assets.
          // Keep the DB wallet address and warn the user to import their key.
          console.warn('[Auth] New device detected. Existing wallet preserved:', linkedAddress, '— user must import their private key to sign transactions on this device.');
          // Still set linkedAddress from DB so the app can display it
        }
      }

      set({ session: data.session, user: data.user, status: 'ready', showAuthModal: false });

      try {
        await useVaultStore.getState().loadVaultData();
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed:', loadErr);
      }

      return { error: null };
    } catch (err: any) {
      console.error('[Auth] signInWithEmail error:', err);
      set({ error: err.message, status: 'ready' });
      return { error: err.message };
    }
  },
  signOut: async () => {
    const userId = get().user?.id;
    await supabase.auth.signOut();
    localStorage.removeItem('th3vault_ephemeral_wallet_pkey');
    if (userId) {
      localStorage.removeItem(`th3vault_ephemeral_wallet_pkey_${userId}`);
    }
    set({ user: null, session: null, error: null });
  },
  signInWithProvider: async (provider) => {
    set({ error: null, status: 'loading' });
    const currentUser = get().user;
    const isAnon = currentUser?.is_anonymous || currentUser?.app_metadata?.provider === 'anonymous';

    try {
      if (isAnon) {
        // Upgrade anonymous user by linking OAuth identity (preserves user ID + all data)
        const { data, error } = await supabase.auth.linkIdentity({
          provider: provider as any,
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          // If social account is already linked to an existing account, fallback to standard OAuth login
          if (msg.includes('already') || msg.includes('linked') || msg.includes('exists')) {
            console.log('[Auth] Provider account already registered. Falling back to OAuth sign-in...');
            const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
              provider: provider as any,
              options: {
                redirectTo: window.location.origin,
              },
            });
            if (oauthError) {
              set({ error: oauthError.message, status: 'ready' });
              return { error: oauthError.message };
            }
            if (oauthData?.url) {
              window.location.href = oauthData.url;
              return { error: null };
            }
            return { error: null };
          }
          set({ error: error.message, status: 'ready' });
          return { error: error.message };
        }
        if (data?.url) {
          window.location.href = data.url;
          return { error: null };
        }
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider as any,
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) {
          set({ error: error.message, status: 'ready' });
          return { error: error.message };
        }
        if (data?.url) {
          window.location.href = data.url;
          return { error: null };
        }
      }

      return { error: null };
    } catch (thrown: any) {
      const msg = thrown?.message || String(thrown);
      set({ error: msg, status: 'ready' });
      return { error: msg };
    }
  },
  signInWithMagicLink: async (email) => {
    set({ error: null, status: 'loading' });
    const currentUser = get().user;
    const isAnon = currentUser?.is_anonymous || currentUser?.app_metadata?.provider === 'anonymous';

    try {
      if (isAnon) {
        // Upgrade anonymous user by adding email (preserves user ID + all data)
        const { error } = await supabase.auth.updateUser({ email });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
            const friendly = 'Email transmission limit reached for this hour. Connect via Web3 (instant) or GitHub for immediate access.';
            set({ error: friendly, status: 'ready' });
            return { error: friendly };
          }
          // If email already belongs to an existing account, fallback to Magic Link OTP sign-in
          if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
            console.log('[Auth] Email already registered to existing account. Falling back to OTP sign-in...');
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email,
              options: {
                emailRedirectTo: window.location.origin,
              },
            });
            if (otpError) {
              const otpMsg = otpError.message.toLowerCase();
              const friendly = otpMsg.includes('rate limit') || otpMsg.includes('over_email_send_rate_limit')
                ? 'Email transmission limit reached for this hour. Connect via Web3 (instant) or GitHub for immediate access.'
                : otpError.message;
              set({ error: friendly, status: 'ready' });
              return { error: friendly };
            }
            set({ status: 'ready' });
            return { error: null };
          }
          set({ error: error.message, status: 'ready' });
          return { error: error.message };
        }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          const friendly = msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')
            ? 'Email transmission limit reached for this hour. Connect via Web3 (instant) or GitHub for immediate access.'
            : error.message;
          set({ error: friendly, status: 'ready' });
          return { error: friendly };
        }
      }

      set({ status: 'ready' });
      return { error: null };
    } catch (thrown: any) {
      const msg = thrown?.message || String(thrown);
      let friendly = msg;
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('over_email_send_rate_limit')) {
        friendly = 'Email transmission limit reached for this hour. Connect via Web3 (instant) or GitHub for immediate access.';
      }
      set({ error: friendly, status: 'ready' });
      return { error: friendly };
    }
  },
  isPasskeySupported: () => {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
  },
  signInWithPasskey: async () => {
    set({ error: null, status: 'loading' });
    try {
      console.log('[Auth] Initiating WebAuthn Passkey sign-in...');
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      if (!data?.session || !data?.user) {
        throw new Error('Passkey verification failed: no session returned.');
      }

      set({
        session: data.session,
        user: data.user,
        status: 'ready',
        showAuthModal: false,
      });

      logAnalyticsEvent('passkey_login_success', { userId: data.user.id });

      await get().ensureProfileAndWallet(data.user);
      try {
        await useVaultStore.getState().loadVaultData();
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed:', loadErr);
      }

      return { error: null };
    } catch (err: any) {
      console.error('[Auth] signInWithPasskey error:', err);
      const msg = err?.name === 'NotAllowedError' || err?.message?.includes('NotAllowedError') || err?.message?.includes('cancelled')
        ? 'Passkey authentication was dismissed or timed out.'
        : err?.message || 'Passkey sign-in failed.';
      set({ error: msg, status: 'ready' });
      return { error: msg };
    }
  },
  registerPasskey: async (email?: string) => {
    set({ error: null });
    try {
      console.log('[Auth] Initiating WebAuthn Passkey registration...');
      let currentUser = get().user;
      const isAnon = !currentUser || currentUser.is_anonymous || currentUser.app_metadata?.provider === 'anonymous';

      if (isAnon) {
        if (email && email.trim().includes('@')) {
          // Upgrade anonymous user by adding email identity first
          const { data: updateData, error: updateErr } = await supabase.auth.updateUser({ email: email.trim() });
          if (updateErr) {
            const msg = updateErr.message.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
              throw new Error('Email transmission limit reached for this hour. Connect via Web3 (instant) or GitHub.');
            }
            if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
              throw new Error('This email is already registered. Please sign in with Passkey or Magic Link.');
            }
            throw updateErr;
          }
          if (updateData?.user) {
            currentUser = updateData.user;
            set({ user: currentUser });
          }
        } else {
          const msg = 'Please provide an email address to bind your biometric passkey.';
          set({ error: msg });
          return { error: msg };
        }
      }

      const { data, error } = await supabase.auth.registerPasskey();
      if (error) {
        if (error.message.toLowerCase().includes('anonymous')) {
          const msg = 'Please enter your email to bind your biometric passkey.';
          set({ error: msg });
          return { error: msg };
        }
        throw error;
      }

      logAnalyticsEvent('passkey_registered', { userId: get().user?.id });
      return { error: null, data };
    } catch (err: any) {
      console.error('[Auth] registerPasskey error:', err);
      let msg = err?.message || 'Passkey registration failed.';
      if (err?.name === 'NotAllowedError' || msg.includes('NotAllowedError') || msg.includes('cancelled') || msg.includes('dismissed')) {
        msg = 'Passkey registration prompt was dismissed.';
      } else if (msg.toLowerCase().includes('anonymous')) {
        msg = 'Please enter your email to bind your biometric passkey.';
      }
      set({ error: msg });
      return { error: msg };
    }
  },
  ensureProfileAndWallet: async (user: User) => {
    const userId = user.id;
    // 1. Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    // 1b. Sync Farcaster profile identity if running inside Farcaster Mini App
    const fcUser = farcasterService.getUser();
    if (fcUser && fcUser.username) {
      const updates: Record<string, string> = {};
      const currentUsername = profile?.username;
      if (!currentUsername || currentUsername.startsWith('user_') || currentUsername.startsWith('anon_')) {
        updates.username = fcUser.username;
      }
      if (fcUser.displayName && !profile?.display_name) {
        updates.display_name = fcUser.displayName;
      }
      if (fcUser.pfpUrl && !profile?.avatar_url) {
        updates.avatar_url = fcUser.pfpUrl;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', userId);
        console.log('[Auth] Farcaster profile identity synced:', updates);
      }
    }

    let linkedAddress = profile?.wallet_address;
    let pkey = localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${userId}`);
    const globalPkey = localStorage.getItem('th3vault_ephemeral_wallet_pkey');

    // Check if this session is an internal ephemeral wallet (either explicit flag or existing private key)
    const isEphemeralSession = localStorage.getItem('th3vault_is_ephemeral_wallet') === 'true' ||
      !!pkey ||
      !!globalPkey;

    // If it's a real external Web3 wallet login (MetaMask / Coinbase Smart Wallet with NO local private key)
    const isExternalWallet = !isEphemeralSession && (
      user.user_metadata?.is_smart_wallet || 
      !user.email || 
      user.email.endsWith('@smartwallet.th3vault.art')
    );

    if (isExternalWallet) {
      localStorage.removeItem('th3vault_ephemeral_wallet_pkey');
      return;
    }

    // Restore or sync ephemeral key across keys
    if (pkey && !globalPkey) {
      localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);
    } else if (!pkey && globalPkey) {
      pkey = globalPkey;
      localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${userId}`, pkey);
    }

    if (!linkedAddress) {
      // Generate or reuse existing ephemeral wallet
      const wallet = pkey ? new Wallet(pkey) : Wallet.createRandom();
      linkedAddress = wallet.address;
      pkey = wallet.privateKey;

      localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${userId}`, pkey);
      localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);

      await supabase
        .from('profiles')
        .upsert({ id: userId, wallet_address: linkedAddress });

      await supabase.auth.updateUser({
        data: { wallet_address: linkedAddress }
      });
      console.log('[Auth] Ephemeral wallet bound to profile:', linkedAddress);
    } else {
      if (pkey) {
        localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);
      } else {
        // New device: regenerate ephemeral wallet
        const wallet = Wallet.createRandom();
        linkedAddress = wallet.address;
        pkey = wallet.privateKey;

        localStorage.setItem(`th3vault_ephemeral_wallet_pkey_${userId}`, pkey);
        localStorage.setItem('th3vault_ephemeral_wallet_pkey', pkey);

        await supabase
          .from('profiles')
          .upsert({ id: userId, wallet_address: linkedAddress });

        await supabase.auth.updateUser({
          data: { wallet_address: linkedAddress }
        });
        console.log('[Auth] New device detected. Regenerated ephemeral wallet:', linkedAddress);
      }
    }
  },
}));
