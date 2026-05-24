import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Package, Flame, Zap, AlertTriangle, BookOpen, Gift } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const RC1_SEEN_KEY = 'th3v4ult_rc1_seen';

/**
 * Full-screen RC1 welcome modal — shows once per device.
 * Also doubles as the "connect wallet" CTA for unauthenticated users.
 */
export default function RC1WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const { user, signInWithWallet, status } = useAuthStore();

  useEffect(() => {
    const seen = localStorage.getItem(RC1_SEEN_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(RC1_SEEN_KEY, '1');
    setVisible(false);
  };

  const handleConnect = async () => {
    await signInWithWallet();
    // Don't auto-dismiss — let them read, they can close after
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, #0d0a08, #080604)',
            border: '2px solid rgba(255,56,0,0.3)',
            boxShadow: '0 0 60px rgba(255,56,0,0.15), 0 40px 80px rgba(0,0,0,0.8)',
            scrollbarWidth: 'none',
            position: 'relative',
          }}
        >
          {/* Animated top accent line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #ff3800, #ff9900, #ff3800, transparent)',
            animation: 'shimmer 3s ease-in-out infinite',
          }} />
          {/* Close button */}
          <button
            aria-label="Close modal"
            onClick={handleDismiss}
            style={{
              position: 'sticky',
              top: '12px',
              float: 'right',
              marginRight: '12px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <X size={14} />
          </button>

          {/* Header */}
          <div style={{ padding: '32px 28px 0', textAlign: 'center' }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: '#ff3800',
              marginBottom: '8px',
            }}>
              RELEASE CANDIDATE 1
            </div>
            <h1 style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '42px',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ff3800, #ff9900)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              lineHeight: 0.9,
            }}>
              TH3V4ULT
            </h1>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '6px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              th3scr1b3.art collectors companion
            </p>
          </div>

          {/* RC1 Notice */}
          <div style={{
            margin: '24px 28px 0',
            padding: '14px 16px',
            background: 'rgba(255,180,0,0.06)',
            border: '1px solid rgba(255,180,0,0.2)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}>
              <AlertTriangle size={14} style={{ color: '#ffb800' }} />
              <span style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '14px',
                textTransform: 'uppercase',
                color: '#ffb800',
              }}>
                RC1 TEST MODE
              </span>
            </div>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.6,
              margin: 0,
            }}>
              This is a <strong style={{ color: '#ffb800' }}>stress test release</strong>. 
              All packs are free. All cards are temporary. 
              Nothing you collect here will carry over to the final release.
              Your job: break things, find exploits, and push limits.
            </p>
          </div>

          {/* Feature breakdown */}
          <div style={{
            padding: '20px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {[
              { icon: Package, color: '#00f0ff', label: 'ALL PACKS FREE', desc: 'Rip unlimited packs. Standard (60/day) and Premium (5/day) limits still apply.' },
              { icon: Gift, color: '#ffd700', label: 'DAILY DROPS', desc: 'Claim a free card every day. Full song unlocked on every daily claim.' },
              { icon: Flame, color: '#ff3800', label: 'THE FORGE', desc: 'Burn cards for V⚡ tokens. Upgrade rarities. Fuse duplicates.' },
              { icon: BookOpen, color: '#b44dff', label: 'THE CODEX', desc: 'Track your complete 365-day card checklist. Play every song.' },
              { icon: Zap, color: '#ff9900', label: 'V⚡ ECONOMY', desc: 'Earn tokens from burns. Spend on targeted pulls, upgrades, and vault packs.' },
            ].map(({ icon: Icon, color, label, desc }) => (
              <div key={label} style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${color}10`,
                  border: `1px solid ${color}25`,
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div>
                  <div style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    color: '#fff',
                    letterSpacing: '0.02em',
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1.5,
                    marginTop: '2px',
                  }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* How to start */}
          <div style={{
            margin: '0 28px',
            padding: '16px',
            background: 'rgba(255,56,0,0.04)',
            border: '1px solid rgba(255,56,0,0.15)',
          }}>
            <div style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '13px',
              textTransform: 'uppercase',
              color: '#ff3800',
              marginBottom: '10px',
            }}>
              How To Start
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {[
                { step: '1', text: 'Connect your wallet (MetaMask, Coinbase, or any EVM wallet)' },
                { step: '2', text: 'Enter your invite code during onboarding' },
                { step: '3', text: 'Claim your first daily drop — it\'s free' },
                { step: '4', text: 'Rip packs, burn cards, explore the Codex' },
              ].map(({ step, text }) => (
                <div key={step} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <div style={{
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ff3800',
                    border: '1.5px solid #000',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '12px',
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.4,
                  }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ padding: '24px 28px 28px' }}>
            {!user ? (
              <button
                onClick={handleConnect}
                disabled={status === 'loading'}
                style={{
                  width: '100%',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: '#ff3800',
                  border: '3px solid #000',
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '20px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000, 0 0 30px rgba(255,56,0,0.3)',
                  animation: 'cta-pulse 2s ease-in-out infinite',
                }}
              >
                <Wallet size={20} />
                {status === 'loading' ? 'CONNECTING...' : 'CONNECT WALLET TO START'}
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                style={{
                  width: '100%',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: '#ff3800',
                  border: '3px solid #000',
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '20px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000, 0 0 30px rgba(255,56,0,0.3)',
                }}
              >
                ENTER TH3V4ULT
              </button>
            )}

            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '8px',
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              marginTop: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Invite-only • RC1 test build • No real-money transactions
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Inject keyframes
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes cta-pulse {
    0%, 100% { box-shadow: 4px 4px 0 #000, 0 0 30px rgba(255,56,0,0.3); }
    50% { box-shadow: 4px 4px 0 #000, 0 0 50px rgba(255,56,0,0.5), 0 0 80px rgba(255,56,0,0.2); }
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
`;
if (!document.querySelector('[data-rc1-styles]')) {
  styleEl.setAttribute('data-rc1-styles', '');
  document.head.appendChild(styleEl);
}
