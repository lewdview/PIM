import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useTransmissionStore,
  type HUDToast,
  type TransmissionType,
} from '../store/useTransmissionStore';
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Zap,
  Flame,
  X,
  ArrowUpRight,
} from 'lucide-react';

const ICON_MAP: Record<TransmissionType, React.ComponentType<{ size: number; color?: string }>> = {
  info: Zap,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  loot: Sparkles,
  telemetry: Flame,
};

export const TransmissionToastContainer: React.FC = () => {
  const toasts = useTransmissionStore((s) => s.toasts);
  const dismissToast = useTransmissionStore((s) => s.dismissToast);

  return (
    <div
      className="fixed z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-sm w-[calc(100vw-32px)] sm:w-96"
      style={{
        bottom: '84px',
        right: '16px',
      }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast: HUDToast) => {
          const Icon = ICON_MAP[toast.type] || Zap;
          const accent = toast.accentColor || '#00e5ff';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="pointer-events-auto relative flex flex-col p-3 border-2 border-black select-none overflow-hidden"
              style={{
                background: 'rgba(10, 8, 12, 0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderLeft: `4px solid ${accent}`,
                boxShadow: `0 4px 24px rgba(0, 0, 0, 0.8), 0 0 16px ${accent}25`,
              }}
            >
              {/* Scanline CRT overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-5"
                style={{
                  background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%)',
                  backgroundSize: '100% 4px',
                }}
              />

              {/* Header row: Icon, Badge, Dismiss */}
              <div className="flex items-center justify-between gap-2 mb-1.5 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex items-center justify-center p-1 rounded-sm shrink-0"
                    style={{ background: `${accent}18` }}
                  >
                    <Icon size={13} color={accent} />
                  </div>
                  <span
                    className="font-mono text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 border border-black shrink-0"
                    style={{
                      background: accent,
                      color: '#000',
                      boxShadow: '1px 1px 0 #000',
                    }}
                  >
                    {toast.badgeText || toast.type.toUpperCase()}
                  </span>
                </div>

                <button
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss transmission"
                  className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Title */}
              <div className="z-10">
                <h4
                  className="font-sans font-black text-xs uppercase tracking-wide text-white"
                  style={{ fontFamily: '"Outfit", sans-serif' }}
                >
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="font-mono text-[10px] text-white/70 leading-relaxed mt-0.5">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Action Button if provided */}
              {toast.action && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-end z-10">
                  <button
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 text-black cursor-pointer transition-transform active:scale-95"
                    style={{
                      background: accent,
                      boxShadow: '2px 2px 0 #000',
                    }}
                  >
                    {toast.action.label}
                    <ArrowUpRight size={10} />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
