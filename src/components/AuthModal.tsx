import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Wallet, 
  Mail, 
  Lock, 
  AlertTriangle, 
  Key, 
  Github, 
  Fingerprint, 
  CheckCircle2, 
  Shield, 
  Zap, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles,
  Layers
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { audioManager } from '../game/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'passkey' | 'github' | 'email' | 'web3';
type EmailMode = 'magic-link' | 'password-signin' | 'password-signup';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { 
    user,
    signInWithWallet, 
    signInWithEphemeralWallet,
    signInWithProvider, 
    signInWithMagicLink, 
    signInWithEmail,
    signUpWithEmail,
    signInWithPasskey, 
    registerPasskey,
    isPasskeySupported, 
    status, 
    error: storeError 
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<AuthTab>('passkey');
  
  // Email states
  const [emailMode, setEmailMode] = useState<EmailMode>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Passkey states
  const [passkeyMode, setPasskeyMode] = useState<'signin' | 'register'>('signin');
  const [passkeyEmail, setPasskeyEmail] = useState('');
  const [passkeySuccess, setPasskeySuccess] = useState<string | null>(null);

  // General UI states
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isGuest = user?.is_anonymous || (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);
  const hasWebAuthn = isPasskeySupported();

  // Reset errors and states on open/tab change
  useEffect(() => {
    setLocalError(null);
    setPasskeySuccess(null);
    if (user?.email) {
      setPasskeyEmail(user.email);
    }
  }, [activeTab, isOpen, user]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleTabSwitch = (tab: AuthTab) => {
    audioManager.playSfx('tap_nav', 0.4);
    setActiveTab(tab);
    setLocalError(null);
    setConfirmationSent(false);
  };

  // 1. Passkey Handlers
  const handlePasskeySignIn = async () => {
    setLocalError(null);
    setPasskeySuccess(null);
    setLoading(true);
    audioManager.playSfx('tap_nav', 0.5);
    try {
      const res = await signInWithPasskey();
      if (res?.error) {
        setLocalError(res.error);
        audioManager.playSfx('error', 0.5);
      } else {
        audioManager.playSfx('gold_get', 0.6);
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Passkey authentication failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);
    setPasskeySuccess(null);

    const targetEmail = (passkeyEmail || email).trim();
    if (isGuest && (!targetEmail || !targetEmail.includes('@'))) {
      setLocalError('Please enter a valid email address to bind your biometric passkey.');
      audioManager.playSfx('error', 0.4);
      return;
    }

    setLoading(true);
    audioManager.playSfx('tap_nav', 0.5);
    try {
      const res = await registerPasskey(targetEmail || undefined);
      if (res?.error) {
        setLocalError(res.error);
        audioManager.playSfx('error', 0.5);
      } else {
        setPasskeySuccess('✨ Biometric passkey registered successfully! You can now log in anytime with 1 touch.');
        audioManager.playSfx('reveal', 0.6);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Passkey registration failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  // 2. GitHub OAuth Handler
  const handleGitHubSignIn = async () => {
    setLocalError(null);
    setLoading(true);
    audioManager.playSfx('menu_confirm', 0.5);
    try {
      const res = await signInWithProvider('github');
      if (res?.error) {
        setLocalError(res.error);
        audioManager.playSfx('error', 0.5);
      } else {
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'GitHub OAuth failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  // 3. Email Handlers
  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      audioManager.playSfx('error', 0.4);
      return;
    }

    setLoading(true);
    audioManager.playSfx('menu_confirm', 0.5);
    try {
      const res = await signInWithMagicLink(email.trim());
      if (res?.error) {
        setLocalError(res.error);
        audioManager.playSfx('error', 0.5);
      } else {
        setConfirmationSent(true);
        setResendCooldown(45);
        audioManager.playSfx('gold_get', 0.5);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Magic link request failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      audioManager.playSfx('error', 0.4);
      return;
    }
    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      audioManager.playSfx('error', 0.4);
      return;
    }

    setLoading(true);
    audioManager.playSfx('menu_confirm', 0.5);
    try {
      if (emailMode === 'password-signup') {
        const res = await signUpWithEmail(email.trim(), password);
        if (res?.error) {
          setLocalError(res.error);
          audioManager.playSfx('error', 0.5);
        } else if (res.confirmationRequired) {
          setConfirmationSent(true);
          setResendCooldown(45);
          audioManager.playSfx('gold_get', 0.5);
        } else {
          audioManager.playSfx('gold_get', 0.6);
          onClose();
        }
      } else {
        const res = await signInWithEmail(email.trim(), password);
        if (res?.error) {
          setLocalError(res.error);
          audioManager.playSfx('error', 0.5);
        } else {
          audioManager.playSfx('gold_get', 0.6);
          onClose();
        }
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  // 4. Web3 Handlers
  const handleWalletConnect = async () => {
    setLocalError(null);
    setLoading(true);
    audioManager.playSfx('menu_confirm', 0.5);
    try {
      const res = await signInWithWallet();
      if (res?.error) {
        setLocalError(res.error);
        audioManager.playSfx('error', 0.5);
      } else {
        audioManager.playSfx('gold_get', 0.6);
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Wallet connection failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  const handleEphemeralConnect = async () => {
    setLocalError(null);
    setLoading(true);
    audioManager.playSfx('menu_confirm', 0.5);
    try {
      await signInWithEphemeralWallet();
      audioManager.playSfx('gold_get', 0.6);
      onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Ephemeral wallet authentication failed.');
      audioManager.playSfx('error', 0.5);
    } finally {
      setLoading(false);
    }
  };

  const currentError = localError || storeError;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        >
          {/* Main Modal Container */}
          <motion.div
            initial={{ scale: 0.93, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 16, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg overflow-hidden border border-white/15 bg-[#09080c] shadow-[0_0_80px_rgba(0,229,255,0.12),0_25px_60px_rgba(0,0,0,0.95)]"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            {/* Top Multi-Tone Cyber Stripe */}
            <div className="h-[3px] w-full bg-gradient-to-r from-[#00E5FF] via-[#A855F7] via-[#FF1493] to-[#E5B800]" />

            {/* Corner Decorative Tech Brackets */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[#00E5FF]/70 pointer-events-none" />
            <div className="absolute top-2 right-4 w-2 h-2 border-t-2 border-r-2 border-[#A855F7]/70 pointer-events-none" />
            <div className="absolute bottom-2 left-4 w-2 h-2 border-b-2 border-l-2 border-[#FF1493]/70 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[#E5B800]/70 pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={() => {
                audioManager.playSfx('back', 0.4);
                onClose();
              }}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all active:scale-90 cursor-pointer z-50 rounded-sm"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div className="pt-6 pb-4 px-6 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-zinc-400">
                  SYSTEM SECURITY // IDENTITY PORTAL
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5 font-display">
                Connect Sovereign Identity
              </h2>
              <p className="font-mono text-[11px] text-zinc-400 mt-1 leading-relaxed">
                Select your preferred authentication clearance protocol below.
              </p>
            </div>

            {/* Guest Session Status Banner */}
            {isGuest && (
              <div className="px-6 py-2 bg-gradient-to-r from-[#00E5FF]/10 via-[#A855F7]/10 to-transparent border-b border-white/5 flex items-center gap-2 text-[10px] font-mono text-[#00E5FF]">
                <Sparkles size={13} className="shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <span>
                  <strong>GUEST PROGRESSION DETECTED:</strong> High scores, unlocked cards, and $V⚡ tokens will automatically link to your identity.
                </span>
              </div>
            )}

            {/* 4-Column Authentication Tabs */}
            <div className="grid grid-cols-4 border-b border-white/10 bg-black/40 text-center">
              {/* Tab 1: Passkey */}
              <button
                onClick={() => handleTabSwitch('passkey')}
                className={`py-3 px-1 flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                  activeTab === 'passkey' 
                    ? 'text-[#00E5FF] bg-[#00E5FF]/[0.06]' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <Fingerprint size={16} className={activeTab === 'passkey' ? 'text-[#00E5FF]' : ''} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Passkey</span>
                {activeTab === 'passkey' && (
                  <motion.div layoutId="authTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                )}
              </button>

              {/* Tab 2: GitHub */}
              <button
                onClick={() => handleTabSwitch('github')}
                className={`py-3 px-1 flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                  activeTab === 'github' 
                    ? 'text-[#A855F7] bg-[#A855F7]/[0.06]' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <Github size={16} className={activeTab === 'github' ? 'text-[#A855F7]' : ''} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider">GitHub</span>
                {activeTab === 'github' && (
                  <motion.div layoutId="authTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A855F7] shadow-[0_0_8px_#A855F7]" />
                )}
              </button>

              {/* Tab 3: Email */}
              <button
                onClick={() => handleTabSwitch('email')}
                className={`py-3 px-1 flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                  activeTab === 'email' 
                    ? 'text-[#FF1493] bg-[#FF1493]/[0.06]' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <Mail size={16} className={activeTab === 'email' ? 'text-[#FF1493]' : ''} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Email</span>
                {activeTab === 'email' && (
                  <motion.div layoutId="authTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF1493] shadow-[0_0_8px_#FF1493]" />
                )}
              </button>

              {/* Tab 4: Web3 */}
              <button
                onClick={() => handleTabSwitch('web3')}
                className={`py-3 px-1 flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                  activeTab === 'web3' 
                    ? 'text-[#E5B800] bg-[#E5B800]/[0.06]' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <Wallet size={16} className={activeTab === 'web3' ? 'text-[#E5B800]' : ''} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Web3</span>
                {activeTab === 'web3' && (
                  <motion.div layoutId="authTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E5B800] shadow-[0_0_8px_#E5B800]" />
                )}
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="p-6">
              {/* ═══════════ TAB 1 : PASSKEY (BIOMETRICS) ═══════════ */}
              {activeTab === 'passkey' && (
                <div className="space-y-5">
                  <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] font-mono text-[9px] uppercase tracking-widest rounded-sm">
                      <Shield size={11} />
                      {hasWebAuthn ? 'FIDO2 / WebAuthn Certified' : 'Hardware Key Ready'}
                    </div>
                    <h3 className="text-lg font-black uppercase text-white tracking-wide">
                      {passkeyMode === 'register' ? 'Register Device Passkey' : 'Passwordless Biometric Clearance'}
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      {passkeyMode === 'register' 
                        ? 'Bind your Face ID, Touch ID, or Windows Hello biometrics to this device for instant access.'
                        : 'Instant 1-touch authentication using Face ID, Touch ID, or Windows Hello biometrics.'}
                    </p>
                  </div>

                  {passkeySuccess ? (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded text-emerald-300 font-mono text-xs space-y-3 text-center">
                      <div className="flex items-center justify-center gap-2 font-bold text-sm text-emerald-400">
                        <CheckCircle2 size={18} />
                        Passkey Active
                      </div>
                      <p className="leading-relaxed">{passkeySuccess}</p>
                      <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-emerald-500 text-black font-black uppercase text-xs tracking-wider hover:bg-emerald-400 transition-colors cursor-pointer"
                      >
                        Enter Vault
                      </button>
                    </div>
                  ) : passkeyMode === 'signin' ? (
                    <div className="space-y-3">
                      {/* Primary Action: Sign In */}
                      <button
                        onClick={handlePasskeySignIn}
                        disabled={loading || status === 'loading'}
                        className="w-full py-3.5 px-4 flex items-center justify-center gap-2.5 bg-[#00E5FF] hover:bg-[#33ebff] text-black font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_25px_rgba(0,229,255,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        style={{
                          clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                        }}
                      >
                        {loading || status === 'loading' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Verifying Biometric Sensor...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint size={18} />
                            <span>Sign In with Passkey / Face ID</span>
                          </>
                        )}
                      </button>

                      {/* Secondary Action: Register New Passkey */}
                      <button
                        onClick={() => {
                          setLocalError(null);
                          setPasskeyMode('register');
                        }}
                        disabled={loading || status === 'loading'}
                        className="w-full py-2.5 px-4 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles size={14} className="text-[#00E5FF]" />
                        <span>Register This Device's Passkey</span>
                      </button>

                      {/* Key features callouts */}
                      <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono text-[9px] text-zinc-400">
                        <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                          <span className="text-[#00E5FF] block font-bold mb-0.5">⚡ 1-TOUCH</span>
                          Fastest Login
                        </div>
                        <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                          <span className="text-[#39FF14] block font-bold mb-0.5">🛡️ SECURE</span>
                          Phishing-Proof
                        </div>
                        <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                          <span className="text-[#A855F7] block font-bold mb-0.5">🔒 PRIVATE</span>
                          On-Device Only
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCreatePasskey} className="space-y-3">
                      {isGuest && (
                        <div className="space-y-1">
                          <label className="block text-[9px] font-mono uppercase text-zinc-400 tracking-wider">
                            Email to Bind Passkey
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 text-zinc-500" size={14} />
                            <input
                              type="email"
                              value={passkeyEmail}
                              onChange={e => setPasskeyEmail(e.target.value)}
                              placeholder="operator@th3vault.art"
                              className="w-full pl-9 pr-4 py-2.5 bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#00E5FF] transition-colors rounded-sm"
                              required
                            />
                          </div>
                        </div>
                      )}

                      {!isGuest && user?.email && (
                        <div className="p-2.5 bg-white/[0.02] border border-white/10 rounded font-mono text-[10px] text-zinc-300">
                          Binding passkey to: <strong className="text-white">{user.email}</strong>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || status === 'loading'}
                        className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#33ebff] text-black font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        style={{
                          clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                        }}
                      >
                        {loading || status === 'loading' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Registering Biometric Key...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint size={16} />
                            <span>Create Device Passkey</span>
                            <ArrowRight size={14} className="ml-auto" />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLocalError(null);
                          setPasskeyMode('signin');
                        }}
                        className="w-full py-2 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        ← Back to Passkey Sign In
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ═══════════ TAB 2 : GITHUB (OAUTH) ═══════════ */}
              {activeTab === 'github' && (
                <div className="space-y-5">
                  <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#A855F7]/10 border border-[#A855F7]/30 text-[#A855F7] font-mono text-[9px] uppercase tracking-widest rounded-sm">
                      <Github size={11} />
                      OAuth 2.0 Clearance
                    </div>
                    <h3 className="text-lg font-black uppercase text-white tracking-wide">
                      Developer Social Access
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Authorize in one click via your GitHub account. Synchronizes avatar and handles cross-device.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleGitHubSignIn}
                      disabled={loading || status === 'loading'}
                      className="w-full py-3.5 px-4 flex items-center justify-center gap-2.5 bg-[#24292e] hover:bg-[#2f363d] text-white border border-white/20 font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      style={{
                        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                      }}
                    >
                      {loading || status === 'loading' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Routing to GitHub...</span>
                        </>
                      ) : (
                        <>
                          <Github size={18} />
                          <span>Continue with GitHub</span>
                          <ArrowRight size={14} className="text-[#A855F7] ml-auto" />
                        </>
                      )}
                    </button>

                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded text-left font-mono text-[10px] text-zinc-400 leading-relaxed">
                      💡 <strong>Seamless Linking:</strong> If you are currently playing as a guest, your GitHub connection will bind your cards and save state to your developer handle.
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 3 : EMAIL (MAGIC LINK / PASSWORD) ═══════════ */}
              {activeTab === 'email' && (
                <div className="space-y-4">
                  {/* Sub-mode switcher */}
                  <div className="flex bg-black/50 p-1 border border-white/10 rounded-sm">
                    <button
                      onClick={() => { setEmailMode('magic-link'); setLocalError(null); setConfirmationSent(false); }}
                      className={`flex-1 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        emailMode === 'magic-link' 
                          ? 'bg-[#FF1493] text-white shadow-[0_0_10px_rgba(255,20,147,0.4)]' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      ✨ Magic Link (OTP)
                    </button>
                    <button
                      onClick={() => { setEmailMode('password-signin'); setLocalError(null); setConfirmationSent(false); }}
                      className={`flex-1 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        emailMode === 'password-signin' 
                          ? 'bg-[#FF1493] text-white shadow-[0_0_10px_rgba(255,20,147,0.4)]' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      🔑 Password
                    </button>
                    <button
                      onClick={() => { setEmailMode('password-signup'); setLocalError(null); setConfirmationSent(false); }}
                      className={`flex-1 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        emailMode === 'password-signup' 
                          ? 'bg-[#FF1493] text-white shadow-[0_0_10px_rgba(255,20,147,0.4)]' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      + Register
                    </button>
                  </div>

                  {confirmationSent ? (
                    <div className="space-y-4 text-center py-2">
                      <div className="w-12 h-12 rounded-full bg-[#FF1493]/15 border border-[#FF1493]/40 flex items-center justify-center mx-auto text-[#FF1493] animate-pulse">
                        <Mail size={22} />
                      </div>
                      <h3 className="font-bold text-white text-sm tracking-wider uppercase">
                        Transmission Dispatched
                      </h3>
                      <p className="font-mono text-zinc-300 text-[11px] leading-relaxed">
                        We sent a secure activation link to <span className="text-white font-bold">{email}</span>. Click the link in your inbox to complete clearance.
                      </p>
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmationSent(false);
                            setLocalError(null);
                          }}
                          className="flex-1 py-2.5 font-mono font-bold text-[10px] tracking-widest bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all uppercase cursor-pointer"
                        >
                          Change Email
                        </button>
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || loading}
                          onClick={handleMagicLinkSubmit}
                          className="flex-1 py-2.5 font-mono font-bold text-[10px] tracking-widest bg-[#FF1493]/20 border border-[#FF1493]/50 text-[#FF1493] hover:bg-[#FF1493]/30 transition-all uppercase disabled:opacity-40 cursor-pointer"
                        >
                          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Link'}
                        </button>
                      </div>
                    </div>
                  ) : emailMode === 'magic-link' ? (
                    <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-zinc-400 tracking-wider">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-zinc-500" size={14} />
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="operator@th3vault.art"
                            className="w-full pl-9 pr-4 py-2.5 bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#FF1493] transition-colors rounded-sm"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || status === 'loading'}
                        className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-[#FF1493] hover:bg-[#ff33a8] text-white font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(255,20,147,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        style={{
                          clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                        }}
                      >
                        {loading || status === 'loading' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Dispatching Transmission...</span>
                          </>
                        ) : (
                          <>
                            <Mail size={16} />
                            <span>Transmit Magic Link</span>
                            <ArrowRight size={14} className="ml-auto" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-zinc-400 tracking-wider">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-zinc-500" size={14} />
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="operator@th3vault.art"
                            className="w-full pl-9 pr-4 py-2.5 bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#FF1493] transition-colors rounded-sm"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-zinc-400 tracking-wider">
                          Password {emailMode === 'password-signup' && '(min 6 chars)'}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-zinc-500" size={14} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full pl-9 pr-10 py-2.5 bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#FF1493] transition-colors rounded-sm"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || status === 'loading'}
                        className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-[#FF1493] hover:bg-[#ff33a8] text-white font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(255,20,147,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        style={{
                          clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                        }}
                      >
                        {loading || status === 'loading' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Authenticating Credentials...</span>
                          </>
                        ) : (
                          <>
                            <Key size={16} />
                            <span>{emailMode === 'password-signup' ? 'Create Account' : 'Sign In with Password'}</span>
                            <ArrowRight size={14} className="ml-auto" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ═══════════ TAB 4 : WEB3 (BASE NETWORK) ═══════════ */}
              {activeTab === 'web3' && (
                <div className="space-y-5">
                  <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#E5B800]/10 border border-[#E5B800]/30 text-[#E5B800] font-mono text-[9px] uppercase tracking-widest rounded-sm">
                      <Zap size={11} />
                      Base Mainnet (Chain ID 8453)
                    </div>
                    <h3 className="text-lg font-black uppercase text-white tracking-wide">
                      Universal EVM Smart Wallet
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Connect via MetaMask, Rabby, Coinbase Smart Wallet, or generate a zero-friction ephemeral key.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Connect EVM Wallet */}
                    <button
                      onClick={handleWalletConnect}
                      disabled={loading || status === 'loading'}
                      className="w-full py-3.5 px-4 flex items-center justify-center gap-2.5 bg-[#E5B800] hover:bg-[#ffd11a] text-black font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_25px_rgba(229,184,0,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      style={{
                        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)'
                      }}
                    >
                      {loading || status === 'loading' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Establishing Base Connection...</span>
                        </>
                      ) : (
                        <>
                          <Wallet size={18} />
                          <span>Connect Web3 Wallet (Base)</span>
                        </>
                      )}
                    </button>

                    {/* Connect Ephemeral / Guest Key */}
                    <button
                      onClick={handleEphemeralConnect}
                      disabled={loading || status === 'loading'}
                      className="w-full py-2.5 px-4 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      <Layers size={14} className="text-[#E5B800]" />
                      <span>Create Encrypted Ephemeral Key</span>
                    </button>

                    {/* Network Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-2 text-center font-mono text-[9px] text-zinc-400">
                      <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                        <span className="text-[#E5B800] block font-bold mb-0.5">⚡ ZERO GAS UX</span>
                        Base Network Native
                      </div>
                      <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                        <span className="text-[#39FF14] block font-bold mb-0.5">🔒 EIP-1271</span>
                        Smart Signatures
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              <AnimatePresence>
                {currentError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-[10px] leading-relaxed flex items-start gap-2 rounded-sm"
                  >
                    <AlertTriangle className="shrink-0 text-red-400 mt-0.5" size={13} />
                    <div className="flex-1">
                      <strong className="text-red-400 uppercase tracking-wide mr-1">SECURITY ERROR:</strong>
                      {currentError}
                    </div>
                    <button
                      onClick={() => setLocalError(null)}
                      className="text-red-400/60 hover:text-red-200"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Security Assurance Footer */}
              <div className="mt-5 pt-3 border-t border-white/5 text-[9px] font-mono text-zinc-500 text-center flex items-center justify-center gap-3">
                <span className="flex items-center gap-1">
                  <Shield size={10} className="text-[#39FF14]" /> End-to-End Encrypted
                </span>
                <span>•</span>
                <span>Base EVM Mainnet</span>
                <span>•</span>
                <span>PIM : th3v4ult</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
