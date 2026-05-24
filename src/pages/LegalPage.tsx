import { motion } from 'framer-motion';
import { ShieldCheck, Info, Scale } from 'lucide-react';
export default function LegalPage() {

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 space-y-12">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => window.history.back()}
        className="text-xs font-mono uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
      >
        ← Back to Vault
      </motion.button>

      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--color-light-cream)' }}>
          Legal & Disclaimer
        </h1>
        <p className="text-sm opacity-60 font-mono">Last Updated: April 2026</p>
      </header>

      <section className="space-y-8 prose prose-invert max-w-none">
        <div className="p-6 rounded-xl border border-white/5 bg-white/5 space-y-4">
          <div className="flex items-center gap-2 text-neon-yellow">
            <Info size={18} />
            <h2 className="text-lg font-bold m-0 text-inherit">General Information</h2>
          </div>
          <p className="text-sm leading-relaxed opacity-80">
            Th3v4ult is a digital collectible platform and companion application for th3scr1b3.art. 
            All musical content, artwork, and associated metadata are the intellectual property of 
            th3scr1b3 and protected under international copyright laws.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2" style={{ color: 'var(--color-neon-cyan)' }}>
            <Scale size={18} />
            <h2 className="text-lg font-bold m-0">Terms of Use</h2>
          </div>
          <p className="text-sm leading-relaxed opacity-80">
            By accessing Th3v4ult, you acknowledge that digital collectibles (NFTs) are subject to 
            market volatility and technical risks associated with blockchain technology (Base Chain). 
            We do not provide financial advice. The acquisition of packs and cards is for 
            entertainment and collectible purposes only.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2" style={{ color: 'var(--color-neon-purple)' }}>
            <ShieldCheck size={18} />
            <h2 className="text-lg font-bold m-0">Privacy & Data</h2>
          </div>
          <p className="text-sm leading-relaxed opacity-80">
            We value your privacy. Your wallet address is used solely for the purpose of identifying 
            your digital collection and facilitating transactions. We do not collect personally 
            identifiable information (PII) beyond what is publicly available on the blockchain.
          </p>
        </div>

        <footer className="pt-12 border-top border-white/5">
          <p className="text-[11px] font-mono opacity-40 leading-loose">
            © 2026 TH3SCR1B3. ALL RIGHTS RESERVED. <br />
            BUILT ON BASE. STORAGE BY SUPABASE. <br />
            MUSIC BY TH3SCR1B3.
          </p>
        </footer>
      </section>
    </div>
  );
}
