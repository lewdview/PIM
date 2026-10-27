import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Film, Shield, Sparkles } from 'lucide-react';
import AdminDropAnimationsSection from '../components/admin/AdminDropAnimationsSection';

export default function AdminDropAnimationsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#050402] text-white p-4 sm:p-6 md:p-8 select-none">
      {/* Top Header Navigation Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/admin')}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> ADMIN DASHBOARD
          </button>
          <div className="h-4 w-px bg-white/20" />
          <span className="font-mono text-xs text-zinc-400 tracking-wider">
            SECTOR: <span className="text-[#ff007f] font-bold">DROP_ANIMATIONS_LAB</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocation('/admin/card-designs')}
            className="px-3 py-1.5 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-mono text-[10px] uppercase tracking-wider border border-white/10 cursor-pointer"
          >
            🃏 CARD DESIGNS
          </button>
          <button
            onClick={() => setLocation('/admin/editor')}
            className="px-3 py-1.5 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-mono text-[10px] uppercase tracking-wider border border-white/10 cursor-pointer"
          >
            🎛️ BEATMAP EDITOR
          </button>
          <button
            onClick={() => setLocation('/vault/reveal')}
            className="px-3 py-1.5 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-mono text-[10px] uppercase tracking-wider border border-white/10 cursor-pointer"
          >
            ⚡ LIVE REVEAL PAGE
          </button>
        </div>
      </div>

      {/* Main Section */}
      <div className="max-w-7xl mx-auto">
        <AdminDropAnimationsSection />
      </div>
    </div>
  );
}
