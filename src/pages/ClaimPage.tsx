import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import { Gift, Music, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

interface ClaimForm {
  name: string;
  email: string;
  farcaster: string;
  wallet: string;
  note: string;
}

const EMPTY: ClaimForm = { name: '', email: '', farcaster: '', wallet: '', note: '' };

function InputField({
  label, sublabel, value, onChange, type = 'text', placeholder, required,
}: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'rgba(255,215,0,0.6)' }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        {sublabel && <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{sublabel}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          background: 'rgba(255,215,0,0.04)',
          border: '1px solid rgba(255,215,0,0.18)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          color: '#faf0d8',
          outline: 'none',
          width: '100%',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.5)';
          e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.06)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.18)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function TextareaField({
  label, sublabel, value, onChange, placeholder,
}: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'rgba(255,215,0,0.6)' }}>
          {label}
        </label>
        {sublabel && <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{sublabel}</span>}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={{
          background: 'rgba(255,215,0,0.04)',
          border: '1px solid rgba(255,215,0,0.18)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
          color: '#faf0d8',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          minHeight: '96px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.5)';
          e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.06)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.18)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

export default function ClaimPage() {
  const [form, setForm] = useState<ClaimForm>(EMPTY);
  const [state, setState] = useState<FormState>('idle');

  // Check for ultra rewards in the user's collection
  const collection = useVaultStore((s) => s.collection);
  const ultraCards = useMemo(() => {
    return collection.filter(c => c.ultraReward);
  }, [collection]);

  const hasReward = ultraCards.length > 0;

  const field = (key: keyof ClaimForm) => ({
    value: form[key],
    onChange: (v: string) => setForm(f => ({ ...f, [key]: v })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    setState('submitting');

    // Simulate submission (no backend yet — mailto fallback)
    await new Promise(r => setTimeout(r, 1400));

    // Build mailto as the real delivery mechanism until a backend exists
    const subject = encodeURIComponent('TH3V4ULT ULTRA REWARD CLAIM');
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nFarcaster: ${form.farcaster || '-'}\nWallet: ${form.wallet || '-'}\n\nNote from winner:\n${form.note || '-'}\n\n---\nCard IDs: ${ultraCards.map(c => c.cardId).join(', ')}\nClaim submitted via th3vault`
    );
    window.open(`mailto:claim@th3scr1b3.art?subject=${subject}&body=${body}`, '_blank');

    setState('done');
  };

  // ── No Reward Found ──────────────────────────────────────────────────────
  if (!hasReward) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm"
        >
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={28} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#faf0d8' }}>
              No Prize Found
            </h1>
            <p className="text-sm font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              You don't have an Ultra Reward card in your collection yet. Flip every card you own — the prize is hidden on the back.
            </p>
          </div>
          <Link
            to="/vault/collection"
            style={{
              padding: '10px 24px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#faf0d8', fontSize: '11px',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 700, letterSpacing: '0.15em',
              textDecoration: 'none', textTransform: 'uppercase',
            }}
          >
            Go to Collection →
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Success State ─────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm"
        >
          {/* Pulsing seal */}
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            style={{
              width: '88px', height: '88px', borderRadius: '50%',
              background: 'linear-gradient(145deg, #ffd700, #ff9900)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(255,180,0,0.45), 0 0 0 8px rgba(255,215,0,0.08)',
            }}
          >
            <CheckCircle size={36} color="#000" strokeWidth={2.5} />
          </motion.div>

          <div>
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color: 'rgba(255,215,0,0.55)' }}>
              ★ CLAIM RECEIVED ★
            </p>
            <h1 className="text-3xl font-black uppercase mb-3" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
              You're In
            </h1>
            <p className="text-sm font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              th3scr1b3 will reach out to coordinate your custom song. Keep an eye on your email and Farcaster DMs.
            </p>
          </div>

          <div style={{
            padding: '12px 20px', borderRadius: '8px',
            background: 'rgba(255,215,0,0.05)',
            border: '1px solid rgba(255,215,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Music size={16} style={{ color: '#ffd700', flexShrink: 0 }} />
            <p className="text-[11px] font-mono text-left" style={{ color: 'rgba(255,240,200,0.5)' }}>
              Your custom song is a one-of-one — written and recorded specifically for you by th3scr1b3.
            </p>
          </div>

          <Link
            to="/vault"
            style={{
              padding: '10px 24px', borderRadius: '6px',
              background: 'rgba(255,215,0,0.08)',
              border: '1px solid rgba(255,215,0,0.2)',
              color: '#ffd700', fontSize: '11px',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 700, letterSpacing: '0.15em',
              textDecoration: 'none', textTransform: 'uppercase',
            }}
          >
            Back to Vault
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Main Claim Form ───────────────────────────────────────────────────────
  return (
    <div className="flex-1 px-4 py-12 max-w-xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8"
      >

        {/* Header */}
        <div className="text-center space-y-4">
          {/* Animated seal */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="mx-auto"
            style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(145deg, #ffd700, #ff9900)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 50px rgba(255,180,0,0.35), 0 0 0 8px rgba(255,215,0,0.07)',
            }}
          >
            <span style={{ fontSize: '34px', lineHeight: 1 }}>🎵</span>
          </motion.div>

          <div>
            <p className="text-[9px] font-mono font-bold tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,215,0,0.5)' }}>
              ★ ULTRA REWARD ★
            </p>
            <h1 className="text-4xl font-black uppercase" style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              color: '#ffd700',
              textShadow: '0 0 40px rgba(255,215,0,0.4)',
              letterSpacing: '-0.5px',
            }}>
              Claim Your<br />Custom Song
            </h1>
          </div>

          <p className="text-sm font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '360px', margin: '0 auto' }}>
            You found one of only <strong style={{ color: 'rgba(255,215,0,0.8)' }}>5 hidden prizes</strong> in the vault. th3scr1b3 will write and record a personal song just for you.
          </p>

          {/* Prize card indicator */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '7px 16px', borderRadius: '20px',
            background: 'rgba(255,215,0,0.06)',
            border: '1px solid rgba(255,215,0,0.2)',
          }}>
            <Gift size={12} style={{ color: '#ffd700' }} />
            <span className="text-[10px] font-mono font-bold" style={{ color: 'rgba(255,215,0,0.7)' }}>
              {ultraCards.length} PRIZE CARD{ultraCards.length > 1 ? 'S' : ''} DETECTED
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)' }} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Your Name" required placeholder="First & last" {...field('name')} />
            <InputField label="Email" type="email" required placeholder="you@example.com" sublabel="keeps it private" {...field('email')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Farcaster" placeholder="@handle" sublabel="optional" {...field('farcaster')} />
            <InputField label="Wallet Address" placeholder="0x..." sublabel="optional" {...field('wallet')} />
          </div>

          <TextareaField
            label="Song Direction"
            sublabel="optional — helps th3scr1b3 write for you"
            placeholder="Tell th3scr1b3 anything — a mood, a memory, a theme, a colour. Don't overthink it."
            {...field('note')}
          />

          {/* Fine print */}
          <div style={{
            padding: '12px 14px', borderRadius: '6px',
            background: 'rgba(255,215,0,0.03)',
            border: '1px solid rgba(255,215,0,0.1)',
          }}>
            <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Submitting this form opens your email client (mailto). Your prize is verified by the Ultra Reward card in your collection. th3scr1b3 will reach out within 2–4 weeks. One prize per winner.
            </p>
          </div>

          {/* Submit */}
          <AnimatePresence mode="wait">
            <motion.button
              key={state}
              type="submit"
              disabled={!form.name || !form.email || state === 'submitting'}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', padding: '14px',
                borderRadius: '8px',
                background: (!form.name || !form.email || state === 'submitting')
                  ? 'rgba(255,215,0,0.15)'
                  : 'linear-gradient(135deg, #ffd700, #ff9900)',
                color: (!form.name || !form.email || state === 'submitting') ? 'rgba(255,215,0,0.4)' : '#000',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 900, fontSize: '12px',
                letterSpacing: '0.2em', textTransform: 'uppercase',
                border: 'none', cursor: (!form.name || !form.email || state === 'submitting') ? 'not-allowed' : 'pointer',
                boxShadow: (!form.name || !form.email || state === 'submitting') ? 'none' : '0 4px 30px rgba(255,180,0,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {state === 'submitting' ? '✦ Sending...' : '✦ Submit Claim'}
            </motion.button>
          </AnimatePresence>
        </form>

        {/* External link note */}
        <div className="flex items-center justify-center gap-2 opacity-30">
          <ExternalLink size={10} />
          <p className="text-[9px] font-mono tracking-widest uppercase">Claim opens your email client</p>
        </div>

      </motion.div>
    </div>
  );
}
