import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CreditCard, ShieldAlert, AlertCircle } from 'lucide-react';

interface PaymentSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: 'crypto' | 'stripe') => void;
  packLabel: string;
  price: string;
  priceValue?: number;
  accent: string;
}

export default function PaymentSelectModal({
  isOpen,
  onClose,
  onSelect,
  packLabel,
  price,
  priceValue,
  accent,
}: PaymentSelectModalProps) {
  const numericPrice = priceValue !== undefined
    ? priceValue
    : parseFloat(price.replace(/[^0-9.]/g, '') || '0');

  // Stripe requires minimum $0.50 USD for checkout charges
  const isCardDisabled = numericPrice > 0 && numericPrice < 0.50;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.93, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.93, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-md overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0a0705 0%, #030202 100%)',
            border: `2px solid ${accent}45`,
            boxShadow: `0 0 40px ${accent}12, 0 30px 60px rgba(0,0,0,0.9)`,
          }}
        >
          {/* Animated top stripe */}
          <div style={{
            height: '3px',
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95 duration-150 cursor-pointer z-50"
            title="Cancel transaction"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="pt-8 pb-5 px-6 text-center border-b border-white/5">
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '8px',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: '#ff3800',
              marginBottom: '4px',
            }}>
              PAYMENT CLEARANCE PORTAL
            </div>
            <h2 style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '22px',
              letterSpacing: '-0.5px',
              color: '#fff',
              textTransform: 'uppercase',
              margin: 0,
            }}>
              Clearance required
            </h2>
            <div className="mt-2.5 inline-block">
              <div className="sticker-gun-tag sticker-slits font-black text-[10px] tracking-tight uppercase"
                style={{
                  background: '#fff',
                  color: '#000',
                  '--slit-color': 'rgba(0,0,0,0.08)',
                  padding: '3px 12px',
                  border: '1.5px solid #000',
                  transform: 'rotate(-0.5deg)',
                } as any}>
                {packLabel} • {price}
              </div>
            </div>
          </div>

          {/* Selector options */}
          <div className="p-6 space-y-4">
            <p className="text-center font-mono text-[10px] text-white/40 leading-relaxed max-w-xs mx-auto">
              Decrypting assets requires network fee confirmation. Select your preferred gateway below.
            </p>

            {/* Pay with Crypto Option */}
            <button
              onClick={() => onSelect('crypto')}
              className="w-full p-4 border-2 border-black flex items-center justify-between text-left transition-all hover:scale-[1.01] hover:bg-white/3 active:scale-98 group cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1.5px solid rgba(255,255,255,0.08)',
                boxShadow: '3px 3px 0 #000',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-500">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '15px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    color: '#fff',
                  }}>
                    Pay with Crypto
                  </h4>
                  <p className="font-mono text-[9px] text-white/40 mt-0.5">
                    Pay on Base via Coinbase Smart Wallet (Any amount)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-orange-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                PROCEED →
              </span>
            </button>

            {/* Pay with Stripe Card Option */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!isCardDisabled) onSelect('stripe');
                }}
                disabled={isCardDisabled}
                className={`w-full p-4 border-2 border-black flex items-center justify-between text-left transition-all ${
                  isCardDisabled
                    ? 'opacity-40 cursor-not-allowed border-dashed bg-white/[0.01]'
                    : 'hover:scale-[1.01] hover:bg-white/3 active:scale-98 group cursor-pointer'
                }`}
                style={{
                  background: isCardDisabled ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                  border: isCardDisabled ? '1.5px dashed rgba(255,255,255,0.15)' : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: '3px 3px 0 #000',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                    isCardDisabled ? 'bg-white/5 text-white/30 border border-white/10' : 'bg-cyan-600/10 border border-cyan-500/20 text-cyan-400'
                  }`}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 style={{
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                        fontSize: '15px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        color: isCardDisabled ? 'rgba(255,255,255,0.5)' : '#fff',
                      }}>
                        Pay with Card
                      </h4>
                      {isCardDisabled && (
                        <span className="font-mono text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[9px] text-white/40 mt-0.5">
                      Stripe credit/debit card secure checkout
                    </p>
                  </div>
                </div>

                {!isCardDisabled ? (
                  <span className="text-[10px] font-mono text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    PROCEED →
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-amber-400/80 font-bold">
                    MIN $0.50
                  </span>
                )}
              </button>

              {/* Note for disabled card transaction */}
              {isCardDisabled && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[8.5px] leading-tight">
                  <AlertCircle size={11} className="flex-shrink-0 text-amber-400" />
                  <span>
                    Card transactions must be $0.50 minimum. Use Crypto above or select a multi-card pack.
                  </span>
                </div>
              )}
            </div>

            {/* Security banner */}
            <div className="pt-4 border-t border-white/5 flex gap-2.5 items-start font-mono text-[8px] text-white/35 leading-normal">
              <ShieldAlert className="flex-shrink-0 text-white/40 mt-0.5" size={12} />
              <span>
                Clearance protocols encrypt your details end-to-end. Decrypted items are automatically minted to your connected profile wallet upon approval.
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
