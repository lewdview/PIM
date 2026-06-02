import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { useVaultStore } from './useVaultStore';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { Wallet } from 'ethers';

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
  initialize: () => Promise<void>;
  signInWithWallet: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithEphemeralWallet: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
}

let subscribed = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  status: 'idle',
  error: null,
  showAuthModal: false,
  setShowAuthModal: (show: boolean) => set({ showAuthModal: show }),
  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    console.log('[Auth] Initializing with Anonymous Sign-In check...');
    
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      set({ error: error.message, status: 'ready' });
    } else if (data.session) {
      const user = data.session.user;
      if (user && user.email) {
        const userPkey = localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${user.id}`);
        if (userPkey) {
          localStorage.setItem('th3vault_ephemeral_wallet_pkey', userPkey);
        }
      }
      set({
        session: data.session,
        user: user ?? null,
        status: 'ready',
      });
    } else {
      // Frictionless flow: Auto sign in anonymously (or fallback to Ephemeral Wallet if disabled)
      try {
        console.log('[Auth] No session found. Signing in anonymously...');
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          console.warn('[Auth] Anonymous sign in failed (disabled or configuration mismatch):', anonError.message);
          console.log('[Auth] Falling back to Ephemeral Wallet authentication...');
          await get().signInWithEphemeralWallet();
        } else {
          console.log('[Auth] Anonymous session created:', anonData.session?.user?.id?.slice(0, 8));
          set({
            session: anonData.session,
            user: anonData.session?.user ?? null,
            status: 'ready',
          });
        }
      } catch (err) {
        console.error('[Auth] Anonymous sign in threw:', err);
        console.log('[Auth] Falling back to Ephemeral Wallet authentication after throw...');
        await get().signInWithEphemeralWallet();
      }
    }

    if (!subscribed) {
      supabase.auth.onAuthStateChange((event, session) => {
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
          useVaultStore.getState().loadVaultData();
        }
      });
      subscribed = true;
    }

    // Initial load if already signed in
    if (data.session?.user) {
      useVaultStore.getState().loadVaultData();
    }
  },
  signInWithWallet: async () => {
    set({ error: null });
    console.log('[Auth] signInWithWallet started');

    let wallet = (window as any)?.ethereum as WalletRequest | undefined;

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
      if (typeof chainId === 'string' && chainId.toLowerCase() !== BASE_CHAIN_ID_HEX && chainId !== '8453') {
        console.log('[Auth] Switching to Base...');
        try {
          await wallet.request({ method: 'personal_sign', params: ['Switching to Base network. Confirm network request.', ''] });
        } catch {
          // ignore prompt wrapper if it fails
        }
        try {
          await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
        } catch {
          try {
            await wallet.request({ method: 'wallet_addEthereumChain', params: [BASE_CHAIN_CONFIG] });
          } catch (addErr) {
            console.warn('[Auth] Failed to switch or add Base network:', addErr);
          }
        }
      }
    } catch (chainErr) {
      console.warn('[Auth] Chain check failed (non-fatal):', chainErr);
    }

    try {
      console.log('[Auth] Using Universal Smart Wallet EIP-1271 Auth Flow...');
      
      // 1. Get Address
      const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts[0];
      if (!address) throw new Error('No account found');

      // 2. Prepare Message
      const message = `Sign in to th3vault on Base. Nonce: ${Date.now()}`;
      const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Sign Message
      const signature = await wallet.request({
        method: 'personal_sign',
        params: [hexMsg, address],
      });

      // 4. Verify via Edge Function
      const { data, error } = await supabase.functions.invoke('auth-smart-wallet', {
        body: { address, message, signature }
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

      set({ session: data.session, user: data.user, showAuthModal: false });

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
      const message = `Sign in to th3vault on Base. Nonce: ${Date.now()}`;
      
      console.log('[Auth] Signing with Ephemeral Wallet:', address);
      const signature = await wallet.signMessage(message);
      
      const { data, error } = await supabase.functions.invoke('auth-smart-wallet', {
        body: { address, message, signature }
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Verification failed');
      }
      
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      
      if (sessionError) throw sessionError;
      
      set({ session: data.session, user: data.user, status: 'ready' });
      
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

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, wallet_address: address });

      if (profileErr) {
        console.warn('[Auth] Profiles upsert error:', profileErr.message);
      }

      set({ session: data.session, user: data.user, status: 'ready', showAuthModal: false });

      try {
        await useVaultStore.getState().loadVaultData();
      } catch (loadErr) {
        console.warn('[Auth] loadVaultData failed:', loadErr);
      }

      return { error: null };
    } catch (err: any) {
      console.error('[Auth] signUpWithEmail error:', err);
      set({ error: err.message, status: 'ready' });
      return { error: err.message };
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
          const wallet = Wallet.createRandom();
          pkey = wallet.privateKey;
          linkedAddress = wallet.address;

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
    await supabase.auth.signOut();
    localStorage.removeItem('th3vault_ephemeral_wallet_pkey');
    set({ user: null, session: null, error: null });
  },
}));
