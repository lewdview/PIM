import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Layers, Trophy, Wallet, LogOut, Zap, Menu, X, FileText, Flame, BookOpen, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useDisplayMode } from '../store/useDisplayMode';
import GuideModal from './GuideModal';

const links = [
  { to: '/arcade', label: 'Arcade', icon: Monitor },
  { to: '/vault', label: 'Vault', icon: Home },
  { to: '/vault/collection', label: 'Collection', icon: Layers },
  { to: '/vault/codex', label: 'Codex', icon: BookOpen },
  { to: '/vault/leaderboard', label: 'Ranks', icon: Trophy },
  { to: '/vault/forge', label: 'Forge', icon: Flame },
];

// ── The new logotype ──────────────────────────────────────────────────────────
function VaultLogo() {
  return (
    <Link to="/vault" className="flex items-center gap-2.5 no-underline group shrink-0" aria-label="th3vault home">
      {/* Icon mark */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            background: '#ff3800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '24px',
            fontWeight: 900,
            color: '#fff',
            transform: 'rotate(-4deg)',
            boxShadow: '3px 3px 0 #000, 0 0 18px rgba(255,56,0,0.5)',
            border: '2px solid #000',
            letterSpacing: '-2px',
          }}
        >
          V
        </div>
        {/* small accent tick */}
        <div style={{
          position: 'absolute',
          bottom: '-3px',
          right: '-3px',
          width: '10px',
          height: '10px',
          background: '#ffb800',
          border: '1.5px solid #000',
          transform: 'rotate(12deg)',
        }} />
      </div>

      {/* Word mark */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        {/* Main name */}
        <span
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '22px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.5px',
            color: '#fff',
            textShadow: '0 0 16px rgba(255,56,0,0.5), 2px 2px 0 rgba(0,0,0,0.9)',
            transform: 'scaleY(1.15)',
            transformOrigin: 'left center',
            display: 'block',
          }}
        >
          TH3V4ULT
        </span>
        {/* Attribution - Moved OUT of the inner Link to fix hydration warning if needed, 
           but actually we just need to make it a non-anchor if it's inside a Link, 
           or move the Link to only wrap the V + Name. 
           Let's wrap only the top part. */}
      </div>
    </Link>
  );
}

function VaultAttribution() {
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '8px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.25em',
        color: '#ff3800',
        opacity: 0.75,
        marginTop: '2px',
        display: 'block',
      }}
    >
      BY{' '}
      <a
        href="https://th3scr1b3.art"
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ color: '#ffb800', textDecoration: 'none', fontWeight: 700 }}
      >
        TH3SCR1B3
      </a>
    </span>
  );
}

// ── Token pill ────────────────────────────────────────────────────────────────
function TokenPill({ balance, compact = false }: { balance: number; compact?: boolean }) {
  const lit = balance > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: compact ? '5px 10px' : '6px 12px',
        border: '2px solid #000',
        background: lit ? '#ff9900' : '#1a1610',
        color: lit ? '#000' : '#555',
        boxShadow: lit ? '2px 2px 0 #000, 0 0 12px rgba(255,153,0,0.4)' : '2px 2px 0 #000',
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
    >
      <Zap size={11} />
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 900 }}>
        {balance}
      </span>
    </div>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [location] = useLocation();
  const { user, signInWithWallet, signOut, status, error: authError } = useAuthStore();
  const tokenBalance = useVaultStore(s => s.tokenBalance);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const { is4K, toggle: toggle4K, detectCapability } = useDisplayMode();

  const handleConnectWallet = async () => {
    if (walletConnecting) return;
    setWalletConnecting(true);
    try {
      await signInWithWallet();
    } finally {
      setWalletConnecting(false);
    }
  };

  useEffect(() => {
    detectCapability();
  }, [detectCapability]);

  return (
    <>
      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <nav
        className="sticky top-0 z-50 px-4 md:px-8"
        style={{
          background: 'rgba(8, 6, 4, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,56,0,0.15)',
          boxShadow: '0 1px 0 rgba(255,56,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between h-14">
          <div className="flex flex-col">
            <VaultLogo />
            <div className="hidden md:block">
              <VaultAttribution />
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-2">
            {links.map(({ to, label, icon: Icon }, i) => {
              const active = location === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className="sticker-gun-tag sticker-slits transition-all hover:scale-105 active:scale-95 no-underline flex flex-row items-center gap-1.5"
                  style={{
                    transform: `rotate(${(i - 1) * 1.2}deg)`,
                    opacity: active ? 1 : 0.6,
                    '--slit-color': active ? 'rgba(255,56,0,0.18)' : 'rgba(0,0,0,0.04)',
                    background: active ? '#fff5f0' : '#f8f5f0',
                    padding: '6px 14px',
                  } as any}
                >
                  <Icon size={11} style={{ color: active ? '#ff3800' : '#333' }} />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-black">{label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setGuideOpen(true)}
              className="p-2 rounded-full transition-all hover:bg-white/10 active:scale-90 ml-1"
              style={{ color: 'var(--color-text-primary)' }}
              title="Vault Guide & Rules"
            >
              <BookOpen size={16} />
            </button>

            {/* 4K HDR Toggle */}
            <div
              className="flex items-center gap-2 ml-1 px-2 py-1 rounded"
              style={{
                background: is4K ? 'rgba(255,215,0,0.06)' : 'transparent',
                border: is4K ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <Monitor size={12} style={{ color: is4K ? '#ffd700' : 'rgba(255,255,255,0.3)', transition: 'color 0.3s' }} />
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: is4K ? '#ffd700' : 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                transition: 'color 0.3s',
                whiteSpace: 'nowrap',
              }}>
                {is4K ? '4K HDR' : 'HDR'}
              </span>
              <div
                className={`toggle-4k${is4K ? ' active' : ''}`}
                onClick={toggle4K}
                role="switch"
                aria-checked={is4K}
                aria-label="Toggle 4K HDR mode"
              />
            </div>

            <TokenPill balance={tokenBalance} />

            {/* Wallet Integration */}
            {user ? (
              <div className="flex items-center gap-2 ml-1">
                <div
                  className="sticker-gun-tag sticker-slits"
                  style={{
                    background: '#fff5f0',
                    '--slit-color': 'rgba(255,56,0,0.1)',
                    padding: '5px 10px',
                    transform: 'rotate(-1deg)',
                  } as any}
                >
                   <span className="text-[9px] font-black tracking-tighter uppercase" style={{ color: '#1a0a00' }}>
                    {(() => {
                      const email = user?.email;
                      if (email) {
                        const cleaned = email.split('@')[0];
                        if (cleaned.startsWith('0x') && cleaned.length === 42) {
                          return `${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`;
                        }
                        return cleaned;
                      }
                      return user?.id.slice(0, 8) || 'ANONYMOUS';
                    })()}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 rounded-full transition-all hover:bg-white/10 active:scale-90"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Disconnect Wallet"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={walletConnecting}
                className="sticker-gun-tag sticker-slits ml-1 font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                style={{
                  background: authError ? '#ff3800' : 'var(--color-neon-gold)',
                  color: '#000',
                  '--slit-color': 'rgba(0,0,0,0.12)',
                  padding: '7px 16px',
                  transform: 'rotate(1deg)',
                  boxShadow: `3px 3px 0 #000, 0 0 14px ${authError ? 'rgba(255,56,0,0.4)' : 'rgba(255,215,0,0.4)'}`,
                  border: '2px solid #000',
                } as any}
              >
                <div className="flex items-center gap-1.5">
                  {walletConnecting ? (
                    <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Wallet size={13} />
                  )}
                  <span>{walletConnecting ? 'Connecting...' : authError ? 'Retry Connect' : 'Connect Wallet'}</span>
                </div>
              </button>
            )}
          </div>

          {/* Mobile: token + burger */}
          <div className="flex md:hidden items-center gap-2">
            <TokenPill balance={tokenBalance} compact />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center justify-center w-10 h-10 border-2 border-black transition-all active:scale-90"
              style={{
                background: menuOpen ? '#ff3800' : '#1a1610',
                color: '#fff',
                boxShadow: menuOpen ? '2px 2px 0 #000, 0 0 12px rgba(255,56,0,0.5)' : '2px 2px 0 #000',
              }}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ══ MOBILE DROPDOWN ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.65)' }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="fixed top-14 left-0 right-0 z-50 md:hidden"
              style={{
                background: 'rgba(8,6,4,0.98)',
                backdropFilter: 'blur(24px)',
                borderBottom: '3px solid rgba(255,56,0,0.3)',
              }}
            >
              {/* th3scr1b3 credit strip */}
              <div style={{
                background: '#ff3800',
                padding: '4px 16px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.3em',
                color: '#fff',
                textTransform: 'uppercase',
              }}>
                An archive by{' '}
                <a
                  href="https://th3scr1b3.art"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#ffb800', textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}
                >
                  th3scr1b3.art
                </a>
              </div>

              <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
                {links.map(({ to, label, icon: Icon }, i) => {
                  const active = location === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 no-underline transition-all"
                      style={{
                        background: active ? '#ff3800' : 'rgba(255,255,255,0.03)',
                        border: active ? '2px solid #000' : '1px solid rgba(255,255,255,0.06)',
                        color: active ? '#fff' : 'var(--color-text-primary)',
                        boxShadow: active ? '3px 3px 0 #000' : 'none',
                        transform: `rotate(${i % 2 === 0 ? -0.3 : 0.3}deg)`,
                      }}
                    >
                      <Icon size={16} style={{ opacity: active ? 1 : 0.5, color: active ? '#fff' : 'inherit' }} />
                      <span style={{
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                        fontSize: '24px',
                        fontWeight: 900,
                        letterSpacing: '-0.5px',
                        textTransform: 'uppercase',
                      }}>
                        {label}
                      </span>
                      {active && (
                        <span className="ml-auto text-[8px] font-mono uppercase tracking-widest opacity-60">← now</span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

              <div className="px-4 py-2">
                <button
                  onClick={() => { setGuideOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 w-full border border-white/10 hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <BookOpen size={16} style={{ opacity: 0.5 }} />
                  <span style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '20px',
                    fontWeight: 900,
                    letterSpacing: '-0.5px',
                    textTransform: 'uppercase',
                  }}>
                    Vault Guide
                  </span>
                </button>
              </div>

              <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

              {/* 4K HDR toggle — mobile drawer */}
              <div className="px-4 py-2">
                <div
                  className="flex items-center justify-between px-4 py-3 border border-white/10"
                  style={{ background: is4K ? 'rgba(255,215,0,0.06)' : 'transparent' }}
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={16} style={{ color: is4K ? '#ffd700' : 'rgba(255,255,255,0.4)' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '20px',
                      fontWeight: 900,
                      letterSpacing: '-0.5px',
                      textTransform: 'uppercase',
                      color: is4K ? '#ffd700' : 'var(--color-text-primary)',
                    }}>
                      4K HDR
                    </span>
                    {is4K && (
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '7px',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: '#ffd700',
                        background: 'rgba(255,215,0,0.15)',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        textTransform: 'uppercase',
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div
                    className={`toggle-4k${is4K ? ' active' : ''}`}
                    onClick={toggle4K}
                    role="switch"
                    aria-checked={is4K}
                    aria-label="Toggle 4K HDR mode"
                    style={{ transform: 'scale(1.3)' }}
                  />
                </div>
              </div>

              <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

              <div className="px-4 py-3">
                {user ? (
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.45, textTransform: 'uppercase' }}>
                      {user.email?.slice(0, 16) || user.id.slice(0, 16)}…
                    </span>
                    <button
                      onClick={() => { signOut(); setMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 border border-white/10 hover:bg-white/5 transition-colors"
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
                    >
                      <LogOut size={12} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { handleConnectWallet(); setMenuOpen(false); }}
                    disabled={status === 'loading'}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-black font-black uppercase tracking-wider transition-all active:scale-95"
                    style={{
                      background: '#ff3800',
                      color: '#fff',
                      boxShadow: '4px 4px 0 #000, 0 0 20px rgba(255,56,0,0.4)',
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '20px',
                    }}
                  >
                    <Wallet size={18} />
                    Connect Wallet
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ MOBILE BOTTOM TAB BAR ════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: 'rgba(8,6,4,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,56,0,0.2)',
        }}
      >
        <div className="flex items-stretch h-[62px]">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location === to;
            return (
              <Link
                key={to}
                to={to}
                className="flex-1 flex flex-col items-center justify-center gap-1 no-underline transition-all active:scale-95"
                style={{
                  color: active ? '#ff3800' : 'rgba(255,255,255,0.3)',
                  borderTop: active ? '2px solid #ff3800' : '2px solid transparent',
                  background: active ? 'rgba(255,56,0,0.06)' : 'transparent',
                  marginTop: '-2px',
                }}
              >
                <Icon size={20} />
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '8px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Legal — compact muted fourth tab */}
          <Link
            to="/vault/legal"
            className="flex flex-col items-center justify-center gap-1 no-underline transition-all active:scale-95"
            style={{
              width: '52px',
              flexShrink: 0,
              color: location === '/vault/legal' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)',
              borderTop: location === '/vault/legal' ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
              background: 'transparent',
              marginTop: '-2px',
            }}
          >
            <FileText size={14} />
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '7px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Legal
            </span>
          </Link>
        </div>
      </nav>

      {/* Spacer for bottom tab bar + player on mobile */}
      <div className="h-[130px] md:hidden" />

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
