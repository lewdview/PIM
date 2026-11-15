// The portal build's stand-in for store/useAuthStore (vite.config.ts swaps it in). klyo
// gives every player its own account and does not allow a game to bring a login, so the
// monthly game runs as a guest: there is never a user or session, the sign-in screens never
// open, and every sign-in action reports that it is unavailable. The real store, with its
// email, passkey, wallet and GitHub flows, stays out of the package altogether.

import { create } from 'zustand';

export type AuthModalTab = 'web3' | 'email' | 'github' | 'passkey';
export type SignInMethod = 'email' | 'wallet' | 'passkey' | 'github';

const UNAVAILABLE = { error: 'Sign-in is not available in this build.' };
const unavailable = async () => UNAVAILABLE;
const nothing = () => {};

export const useAuthStore = create<any>(() => ({
  user: null,
  session: null,
  status: 'ready',
  error: null,
  showArcadeSplash: false,
  setShowArcadeSplash: nothing,
  showAuthModal: false,
  authModalTab: 'web3',
  setAuthModalTab: nothing,
  setShowAuthModal: nothing,
  showIdentityModal: false,
  setShowIdentityModal: nothing,
  showSignedInConfirm: false,
  signedInAlias: null,
  signedInMethod: null,
  signedInEmail: null,
  setShowSignedInConfirm: nothing,
  confirmSignIn: async () => {},
  initialize: async () => {},
  signInWithWallet: unavailable,
  signOut: async () => {},
  signInWithEphemeralWallet: unavailable,
  signInWithPrivateKey: unavailable,
  signUpWithEmail: unavailable,
  signInWithEmail: unavailable,
  signInWithProvider: unavailable,
  signInWithMagicLink: unavailable,
  verifyEmailOtp: unavailable,
  signInWithPasskey: unavailable,
  registerPasskey: unavailable,
  isPasskeySupported: () => false,
  ensureProfileAndWallet: async () => {},
}));
