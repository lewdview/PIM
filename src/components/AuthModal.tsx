import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Mail, Lock, AlertTriangle, Key, Github } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithWallet, signInWithProvider, signInWithMagicLink, status, error: storeError } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'wallet' | 'email'>('wallet');
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isOpen) return null;

  const handleWalletConnect = async () => {
    setLocalError(null);
    const res = await signInWithWallet();
    if (res?.error) {
      setLocalError(res.error);
    } else {
      onClose();
    }
  };

  const handleProviderSignIn = async (provider: string) => {
    setLocalError(null);
    setLoading(true);
    try {
      const res = await signInWithProvider(provider);
      if (res?.error) {
        setLocalError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'OAuth authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithMagicLink(email.trim());
      if (res?.error) {
        setLocalError(res.error);
      } else {
        setConfirmationSent(true);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Magic link request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.94, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-md overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0d0907 0%, #060403 100%)',
            border: '2px solid rgba(255,56,0,0.3)',
            boxShadow: '0 0 50px rgba(255,56,0,0.1), 0 30px 60px rgba(0,0,0,0.85)',
          }}
        >
          {/* Animated top stripe */}
          <div style={{
            height: '3px',
            background: 'linear-gradient(90deg, #ff3800, #ff9900, #ff3800)',
          }} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95 duration-150 cursor-pointer z-50"
            title="Close authentication screen"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="pt-8 pb-5 px-6 text-center border-b border-white/5">
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '8px',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: '#ff3800',
              marginBottom: '4px',
            }}>
              SECURE ACCESS PORTAL
            </div>
            <h2 style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '24px',
              letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #ffffff, #888888)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase',
              margin: 0,
            }}>
              Connect Identity
            </h2>
          </div>

          {/* Navigation tabs */}
          <div className="flex bg-white/2">
            <button
              onClick={() => { setActiveTab('wallet'); setLocalError(null); setConfirmationSent(false); }}
              className="flex-1 py-3 font-black text-xs uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5"
              style={{
                borderColor: activeTab === 'wallet' ? '#ff3800' : 'transparent',
                background: activeTab === 'wallet' ? 'rgba(255,56,0,0.03)' : 'transparent',
                color: activeTab === 'wallet' ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              <Wallet size={12} />
              Base Wallet
            </button>
            <button
              onClick={() => { setActiveTab('email'); setLocalError(null); setConfirmationSent(false); }}
              className="flex-1 py-3 font-black text-xs uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5"
              style={{
                borderColor: activeTab === 'email' ? '#ff3800' : 'transparent',
                background: activeTab === 'email' ? 'rgba(255,56,0,0.03)' : 'transparent',
                color: activeTab === 'email' ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              <Mail size={12} />
              Email & Social
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'wallet' ? (
              <div className="space-y-5 text-center">
                <p style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.6,
                }}>
                  Authenticate securely using smart contracts on Base. Supports MetaMask, Coinbase, or any EIP-1193 compatible provider.
                </p>

                <button
                  onClick={handleWalletConnect}
                  disabled={status === 'loading'}
                  className="w-full py-3.5 flex items-center justify-center gap-2 border-2 border-black font-black uppercase text-sm tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{
                    background: '#ff3800',
                    color: '#fff',
                    boxShadow: '3px 3px 0 #000, 0 0 20px rgba(255,56,0,0.3)',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                  }}
                >
                  {status === 'loading' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet size={15} />
                      Connect via Web3 Wallet
                    </>
                  )}
                </button>

                <div className="pt-2">
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    color: '#ffb800',
                    background: 'rgba(255,184,0,0.06)',
                    border: '1px solid rgba(255,184,0,0.18)',
                    padding: '4px 8px',
                    display: 'inline-block',
                  }}>
                    ⚡ Base Gas fees covered by smart wallet integration
                  </span>
                </div>
              </div>
            ) : confirmationSent ? (
              <div className="space-y-5 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-[#ff3800]/10 border border-[#ff3800]/30 flex items-center justify-center mx-auto text-[#ff3800] animate-pulse">
                  <Mail size={22} />
                </div>
                <h3 className="font-bold text-white text-sm tracking-wider uppercase" style={{ fontFamily: '"Impact", sans-serif' }}>
                  Verification Link Sent
                </h3>
                <p className="font-mono text-zinc-400 text-[10px] leading-relaxed">
                  A verification transmission was dispatched to <span className="text-white font-bold">{email}</span>. Click the activation link in the email, then return here to log in.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationSent(false);
                    setLocalError(null);
                  }}
                  className="w-full py-3 font-mono font-bold text-[10px] tracking-widest bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all uppercase"
                >
                  Return to Log In
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* GitHub OAuth Button */}
                <button
                  onClick={() => handleProviderSignIn('github')}
                  disabled={loading || status === 'loading'}
                  className="w-full py-3 flex items-center justify-center gap-2 border-2 border-black font-black uppercase text-xs tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{
                    background: '#24292e',
                    color: '#fff',
                    boxShadow: '3px 3px 0 #000',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                  }}
                >
                  <Github size={14} />
                  <span>Continue with GitHub</span>
                </button>

                {/* Separator */}
                <div className="flex items-center my-4">
                  <div className="flex-1 h-[1px] bg-white/10" />
                  <span className="px-3 text-[10px] font-mono text-white/30 uppercase tracking-widest">OR</span>
                  <div className="flex-1 h-[1px] bg-white/10" />
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {/* Email field */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono uppercase text-white/50 tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-white/20" size={13} />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="operator@domain.com"
                        className="w-full pl-9 pr-4 py-2 bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#ff3800] transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || status === 'loading'}
                      className="w-full py-3.5 flex items-center justify-center gap-2 border-2 border-black font-black uppercase text-sm tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                      style={{
                        background: '#ff3800',
                        color: '#fff',
                        boxShadow: '3px 3px 0 #000, 0 0 20px rgba(255,56,0,0.3)',
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                      }}
                    >
                      {loading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Mail size={14} />
                          <span>Send Magic Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Error notifications */}
            <AnimatePresence>
              {(localError || storeError) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 bg-red-950/20 border border-red-500/20 text-red-400 font-mono text-[10px] leading-relaxed flex gap-2"
                >
                  <AlertTriangle className="flex-shrink-0 text-red-500 mt-0.5" size={12} />
                  <div>
                    <span className="font-bold text-red-500">DECRYPT ERROR:</span>{' '}
                    {localError || storeError}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Anonymous wallet notice */}
            <div className="mt-5 pt-4 border-t border-white/5 text-[9px] font-mono text-white/30 text-center leading-normal">
              🛡️ Email profiles auto-generate an encrypted anonymous client wallet address stored locally on this machine to bypass EVM clearance.
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
