/**
 * AboutPage.tsx — Origin, Ethos & The 365 Manifesto
 *
 * Routes: /about, /manifesto
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Compass, Flame, Disc, Gamepad2, Layers, Zap, ArrowRight, Sparkles, Shield
} from 'lucide-react';
import MainBrandLogo from '../components/MainBrandLogo';

export default function AboutPage() {
  return (
    <div className="flex-1 w-full min-h-screen bg-[#050402] text-white select-none relative pb-24">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[5%] left-[50%] -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[180px] opacity-15"
          style={{ background: 'radial-gradient(circle, #FF1493, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <MainBrandLogo size="hero" priority={true} interactive={false} />
          <span className="font-mono text-xs text-[#E5B800] uppercase font-bold tracking-[0.3em] block mt-4 mb-1">
            THE 365 MANIFESTO & ORIGIN
          </span>
          <h1
            className="text-4xl sm:text-6xl font-black uppercase text-white tracking-tight"
            style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
          >
            POETRY IN MOTION
          </h1>
        </div>

        {/* Narrative Manifesto */}
        <div className="space-y-8 font-mono text-xs sm:text-sm leading-relaxed text-white/80">
          
          <div className="p-6 sm:p-8 bg-[#0a0805] border border-white/15 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold uppercase text-[#00E5FF] font-mono">
              01 // THE HARD DRIVE LOSS & REBIRTH
            </h2>
            <p>
              Years ago, a catastrophic hardware failure claimed hundreds of finished songs, multi-track sessions, and vocal recordings.
            </p>
            <p>
              Rather than mourning the lost work, it became a catalyst for a radical artistic vow:
              <strong> to create, mix, and release 365 original musical artifacts across 365 consecutive days.</strong>
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-[#0a0805] border border-white/15 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold uppercase text-[#FF1493] font-mono">
              02 // MUSIC AS AN EXPERIENCE, NOT A STREAM
            </h2>
            <p>
              Modern streaming platforms have flattened music into passive background noise. We believe music should demand your focus, reward your reflexes, and feel like an event.
            </p>
            <p>
              <strong>PIM (Poetry in Motion)</strong> turns every song into a playable 3-lane rhythm game. When you play a track, your timing controls the mix: hit notes cleanly to keep the audio pristine; miss notes, and the audio filter degrades.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-[#0a0805] border border-white/15 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold uppercase text-[#E5B800] font-mono">
              03 // PARTICIPATION UNLOCKS OWNERSHIP
            </h2>
            <p>
              Every day you participate, you earn a collectible card representing that day's release.
            </p>
            <p>
              Collecting is about memory and presence: <em>"I was there on Day 42. I heard the song, I played the level, and I hold the artifact."</em>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="pt-6 flex flex-wrap gap-4 justify-center">
            <Link
              to="/365"
              className="px-8 py-4 bg-[#E5B800] text-black font-mono text-xs font-black uppercase tracking-wider rounded no-underline hover:scale-105 transition-transform"
            >
              Explore 365 Archive →
            </Link>
            <Link
              to="/pim"
              className="px-8 py-4 bg-[#FF1493] text-black font-mono text-xs font-black uppercase tracking-wider rounded no-underline hover:scale-105 transition-transform"
            >
              Launch PIM Arcade ⚡
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
