import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Gift, Star } from 'lucide-react';
import { useLocation } from 'wouter';

interface UltraRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** True when triggered from a fresh pack reveal */
  isFreshFind?: boolean;
}

export default function UltraRewardModal({ isOpen, onClose, isFreshFind = false }: UltraRewardModalProps) {
  const [, setLocation] = useLocation();

  const handleClaim = () => {
    onClose();
    setLocation('/claim');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(0,0,0,0.88)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.88, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%', maxWidth: '420px',
                background: 'linear-gradient(160deg, #1a1200 0%, #241800 50%, #1a1000 100%)',
                border: '1px solid rgba(255,215,0,0.25)',
                borderRadius: '16px',
                boxShadow: '0 0 80px rgba(255,180,0,0.2), 0 40px 80px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                position: 'relative',
                pointerEvents: 'auto',
              }}
            >
              {/* Foil sweep */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'linear-gradient(120deg, rgba(255,200,0,0.05) 0%, rgba(255,255,180,0.10) 30%, rgba(255,160,0,0.04) 60%, rgba(255,215,0,0.08) 100%)',
                backgroundSize: '300% 100%',
                animation: 'foil-sweep 4s linear infinite',
              }} />

              {/* Radial glow */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.18), transparent 60%)',
              }} />

              {/* Diamond grid */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="modal-grid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                    <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke="#ffd700" strokeWidth="0.6" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#modal-grid)" />
              </svg>

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1 }}>

                {/* Top bar */}
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid rgba(255,215,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Star size={11} style={{ color: 'rgba(255,215,0,0.5)' }} fill="rgba(255,215,0,0.5)" />
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '9px', fontWeight: 700,
                      letterSpacing: '0.3em', textTransform: 'uppercase',
                      color: 'rgba(255,215,0,0.5)',
                    }}>
                      Ultra Reward
                    </span>
                    <Star size={11} style={{ color: 'rgba(255,215,0,0.5)' }} fill="rgba(255,215,0,0.5)" />
                  </div>
                  <button
                    onClick={onClose}
                    title="Close modal"
                    style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Hero */}
                <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
                  {/* Pulsing seal */}
                  <motion.div
                    animate={{ scale: [1, 1.07, 1] }}
                    transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
                    style={{
                      width: '72px', height: '72px', borderRadius: '50%',
                      background: 'linear-gradient(145deg, #ffd700, #ff9900)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 18px',
                      boxShadow: '0 0 40px rgba(255,180,0,0.45), 0 0 0 6px rgba(255,215,0,0.08)',
                    }}
                  >
                    <span style={{ fontSize: '30px', lineHeight: 1 }}>🎵</span>
                  </motion.div>

                  {isFreshFind ? (
                    <>
                      <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,215,0,0.55)', marginBottom: '8px' }}>
                        🎉 You found it
                      </p>
                      <h2 style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.5)', margin: '0 0 8px', lineHeight: 1.1 }}>
                        You Won a<br />Custom Song
                      </h2>
                    </>
                  ) : (
                    <>
                      <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,215,0,0.55)', marginBottom: '8px' }}>
                        What is this?
                      </p>
                      <h2 style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.5)', margin: '0 0 8px', lineHeight: 1.1 }}>
                        The Ultra Reward
                      </h2>
                    </>
                  )}

                  <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', lineHeight: 1.7, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                    {isFreshFind
                      ? 'This card is hiding one of only 5 secret prizes in the entire vault. Flip it over to reveal your reward — then claim below.'
                      : 'Hidden inside the vault are 5 ultra rare prizes. Any card, any rarity, could be carrying one. The only way to find out is to flip every card you own.'}
                  </p>
                </div>

                {/* Info rows */}
                <div style={{ margin: '0 20px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,215,0,0.1)' }}>
                  {[
                    {
                      icon: <Music size={14} />,
                      title: 'The Prize',
                      body: 'A custom song written and recorded exclusively for you by th3scr1b3. One-of-one. Yours forever.',
                    },
                    {
                      icon: <Gift size={14} />,
                      title: 'How Rare',
                      body: 'Only 5 prizes exist across all packs ever opened. Any card at any rarity could hold one — it\'s hidden on the back.',
                    },
                    {
                      icon: <span style={{ fontSize: '14px' }}>✦</span>,
                      title: 'How to Claim',
                      body: 'Fill out the claim form so th3scr1b3 can reach out. Your prize is verified by the ultra reward card in your collection.',
                    },
                  ].map(({ icon, title, body }, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: '12px', padding: '13px 16px',
                        borderBottom: i < 2 ? '1px solid rgba(255,215,0,0.08)' : 'none',
                        background: i % 2 === 0 ? 'rgba(255,215,0,0.02)' : 'transparent',
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: '2px', color: 'rgba(255,215,0,0.5)' }}>{icon}</div>
                      <div>
                        <p style={{ margin: '0 0 3px', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,215,0,0.6)' }}>{title}</p>
                        <p style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', lineHeight: 1.6, color: 'rgba(255,255,255,0.4)' }}>{body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {isFreshFind ? (
                    <button
                      onClick={handleClaim}
                      style={{
                        width: '100%', padding: '13px',
                        background: 'linear-gradient(135deg, #ffd700, #ff9900)',
                        color: '#000', border: 'none', borderRadius: '8px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 900, fontSize: '11px',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxShadow: '0 4px 30px rgba(255,180,0,0.4)',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.01)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    >
                      ✦ Claim Your Prize
                    </button>
                  ) : (
                    <button
                      onClick={handleClaim}
                      style={{
                        width: '100%', padding: '13px',
                        background: 'rgba(255,215,0,0.08)',
                        color: '#ffd700', border: '1px solid rgba(255,215,0,0.25)', borderRadius: '8px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 700, fontSize: '11px',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.14)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.08)'; }}
                    >
                      Go to Claim Page →
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    style={{
                      width: '100%', padding: '10px',
                      background: 'transparent', color: 'rgba(255,255,255,0.25)',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 700, fontSize: '10px',
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'rgba(255,255,255,0.4)'; b.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'rgba(255,255,255,0.25)'; b.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    {isFreshFind ? 'I\'ll Claim Later' : 'Close'}
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
