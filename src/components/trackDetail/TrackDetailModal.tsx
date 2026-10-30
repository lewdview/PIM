/**
 * TrackDetailModal — the universal track detail view as an overlay, for
 * places that keep the player on their current page (collection, codex,
 * daily drop).
 */
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TrackDetail, { type TrackDetailProps } from './TrackDetail';

type Props = Omit<TrackDetailProps, 'variant' | 'day'> & {
  day: number | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function TrackDetailModal({ isOpen, day, onClose, ...rest }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && day && (
        <div className="fixed inset-0 z-[220] flex items-start lg:items-center justify-center lg:p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="relative w-full lg:max-w-6xl h-[100dvh] lg:h-auto lg:max-h-[92vh] overflow-y-auto bg-[#0a0806] lg:border lg:border-white/10 lg:rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.9)]"
            style={{ scrollbarWidth: 'thin' }}
          >
            <TrackDetail {...rest} day={day} variant="modal" onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
