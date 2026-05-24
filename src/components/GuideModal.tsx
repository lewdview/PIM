import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, BookOpen } from 'lucide-react';
import { getAdminConfig, type ConditionalModifier } from '../utils/adminConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ isOpen, onClose }: Props) {
  const [modifiers, setModifiers] = useState<ConditionalModifier[]>([]);

  useEffect(() => {
    if (isOpen) {
      const config = getAdminConfig();
      // Show all modifiers or only enabled ones? Let's show all so they know what exists,
      // but maybe highlight enabled ones. Actually, the prompt says "all the buffs you can get",
      // so showing enabled ones is probably best to avoid confusion, or show all but mark disabled.
      // Let's just show all enabled ones.
      setModifiers(config.modifiers.filter(m => m.enabled));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col bg-[#050402] border-2 border-white/10 rounded-xl"
          style={{
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[#ffb800]" />
              <h2 className="font-['Impact'] text-xl tracking-wide uppercase m-0 leading-none">
                Vault Guide
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full transition-colors opacity-50 hover:opacity-100"
              aria-label="Close guide"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8" style={{ scrollbarWidth: 'none' }}>
            
            {/* Ultra Rewards Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-[#b44dff]" />
                <h3 className="font-['Impact'] text-lg uppercase tracking-wide m-0 text-[#b44dff]">
                  Ultra Rewards
                </h3>
              </div>
              <div className="p-4 rounded-lg bg-[#b44dff]/10 border border-[#b44dff]/20">
                <p className="font-mono text-[11px] leading-relaxed text-[#b44dff]/90 m-0">
                  Every card pulled from the Vault has an independent <strong className="text-white">0.3% chance</strong> to reveal an Ultra Reward hiding on its back face.
                  <br /><br />
                  Distinguished by a premium gold foil design, Ultra Rewards are globally capped and can be redeemed via the <strong className="text-white">/claim</strong> flow for physical 1-of-1s, exclusive custom drops, or rare physical artifacts.
                </p>
              </div>
            </section>

            {/* Modifiers / Buffs Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-[#00d4aa]" />
                <h3 className="font-['Impact'] text-lg uppercase tracking-wide m-0 text-[#00d4aa]">
                  Forge Buffs
                </h3>
              </div>
              
              <p className="font-mono text-[10px] text-white/50 mb-4">
                These global modifiers can conditionally boost your drop rates or grant special bonuses based on your activity:
              </p>

              {modifiers.length === 0 ? (
                <div className="text-center p-4 border border-white/5 bg-white/[0.02] rounded-lg">
                  <span className="font-mono text-[10px] text-white/30 uppercase">No active buffs right now.</span>
                </div>
              ) : (
                <div className="grid gap-3">
                  {modifiers.map(mod => (
                    <div key={mod.id} className="p-3 rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#00d4aa] uppercase tracking-wider">
                          {mod.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-white/60 leading-relaxed">
                        {mod.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Need to import BookOpen inside since I forgot to add it to the top level import.
// Let me fix that.
