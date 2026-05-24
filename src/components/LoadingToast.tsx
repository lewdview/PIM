import { motion, AnimatePresence } from 'framer-motion';
import { useLoadingToast } from '../store/useLoadingToast';

// ═══════════════════════════════════════════════════════════════
// Loading Toast — fixed bottom-center pill that appears during
// async operations (DB calls, audio buffering, fusion, etc.)
// ═══════════════════════════════════════════════════════════════

export default function LoadingToast() {
  const message = useLoadingToast((s) => s.message);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="loading-toast"
          initial={{ y: 30, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 20px',
            background: 'rgba(10, 8, 6, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 153, 0, 0.25)',
            borderRadius: '999px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,153,0,0.1)',
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid rgba(255,153,0,0.2)',
              borderTopColor: '#ff9900',
              animation: 'loading-toast-spin 0.7s linear infinite',
              flexShrink: 0,
            }}
          />

          {/* Message */}
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.7)',
              whiteSpace: 'nowrap',
            }}
          >
            {message}
          </span>

          {/* Pulse dot */}
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#ff9900',
              flexShrink: 0,
            }}
          />

          <style>{`
            @keyframes loading-toast-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
