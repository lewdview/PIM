/**
 * WarpZonePage.tsx — The Experimental Warp Zone
 *
 * "These are strange places inside the 365 universe."
 *
 * Experiences:
 * - 01: Mood Map & Valence Spectrum (Valence vs Energy 2D plane)
 * - 02: ASCII Art & Cyber Terminal Visualizer
 * - 03: Sacred Geometry Audio Visualizer (Direct portal to /listen)
 * - 04: The 365 Hard Drive Lore & Manuscripts Archive
 * - 05: Character & Waifu Generative Synthesizer
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  Sparkles, Compass, Terminal, Activity, BookOpen, Layers,
  Play, Pause, Disc, ArrowUpRight, Shuffle, Volume2, Shield, Eye, Flame
} from 'lucide-react';
import { getCurrentDay } from '../utils/dayCalc';
import { loadCatalog, type GameSong } from '../game/api';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { audioManager } from '../game/audio';

type WarpModule = 'hub' | 'mood' | 'ascii' | 'lore';

export default function WarpZonePage() {
  const [, setLocation] = useLocation();
  const today = getCurrentDay();
  const [activeModule, setActiveModule] = useState<WarpModule>('hub');
  const [catalog, setCatalog] = useState<GameSong[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected item for interactive modules
  const [selectedSong, setSelectedSong] = useState<GameSong | null>(null);
  const [asciiInput, setAsciiInput] = useState('TH3SCR1B3');
  const [asciiDensity, setAsciiDensity] = useState<'normal' | 'dense' | 'glitch'>('dense');

  // Global player
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const playGlobal = useGlobalPlayer(s => s.play);
  const pauseGlobal = useGlobalPlayer(s => s.pause);

  useEffect(() => {
    let active = true;
    loadCatalog().then(songs => {
      if (!active) return;
      setCatalog(songs);
      const todaySong = songs.find(s => s.day === today) || songs[0];
      setSelectedSong(todaySong || null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [today]);

  const handleSelectSong = (song: GameSong) => {
    setSelectedSong(song);
    audioManager.playSfx('tap_nav', 0.3);
  };

  const handlePlaySong = (song: GameSong) => {
    playGlobal({
      title: song.title,
      artist: song.artist || 'th3scr1b3',
      audioUrl: song.audioUrl,
      coverUrl: song.coverArt || '',
      day: song.day,
      rarity: 'common',
      isDailyClaim: true,
      maxDuration: 0,
    });
    audioManager.playSfx('select_start_song', 0.4);
  };

  // Generate ASCII art based on current input & song
  const generatedAscii = useMemo(() => {
    const text = (asciiInput || 'TH3SCR1B3').toUpperCase();
    const songTitle = selectedSong?.title || '365 DAYS';
    const day = selectedSong?.day || today;
    const mood = selectedSong?.mood || 'dark';

    if (asciiDensity === 'glitch') {
      return `
  ██████╗  ██████╗  ██████╗  ██████╗  ██████╗ 
  ██╔══██╗ ██╔══██╗ ██╔══██╗ ██╔══██╗ ██╔══██╗
  ███████║ ███████║ ███████║ ███████║ ███████║
  ██╔══██║ ██╔══██║ ██╔══██║ ██╔══██║ ██╔══██║
  ██║  ██║ ██║  ██║ ██║  ██║ ██║  ██║ ██║  ██║
  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝
  :: [WARP ENGINE MATRIX] :: SIGNAL: ${mood.toUpperCase()} ::
  :: TARGET: ${text} // DAY #${day} (${songTitle}) ::
  :: RECOVERY STATUS: RECONSTRUCTED FROM RAW BITSTREAM ::
`;
    }

    return `
 ╔══════════════════════════════════════════════════════════════════╗
 ║  TH3SCR1B3 // 365 WARP EXPERIMENTAL ENGINE                       ║
 ║  INPUT BUFFER: ${text.padEnd(20)} REALM: ${mood.toUpperCase().padEnd(10)} DAY: #${String(day).padStart(3, '0')}     ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║                                                                  ║
 ║     .---.       .---.       .---.       .---.       .---.        ║
 ║    /  .  \\     /  .  \\     /  .  \\     /  .  \\     /  .  \\       ║
 ║   |  / \\  |   |  / \\  |   |  / \\  |   |  / \\  |   |  / \\  |      ║
 ║    \\  '  /     \\  '  /     \\  '  /     \\  '  /     \\  '  /       ║
 ║     '---'       '---'       '---'       '---'       '---'        ║
 ║                                                                  ║
 ║   [VALENCE] ────────► ${String(selectedSong?.valence || 0.5)}                                ║
 ║   [TEMPO]   ────────► ${String(selectedSong?.bpm || 120)} BPM                               ║
 ║   [STATION] ────────► SECTOR_${day} (CODENAME: ${songTitle.toUpperCase().slice(0, 16)})          ║
 ║                                                                  ║
 ╚══════════════════════════════════════════════════════════════════╝
`;
  }, [asciiInput, selectedSong, today, asciiDensity]);

  return (
    <div className="flex-1 w-full min-h-screen bg-[#060408] text-white select-none relative pb-24">
      {/* Ambient background glitch purple glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[5%] left-[20%] w-[600px] h-[600px] rounded-full blur-[180px] opacity-20"
          style={{ background: 'radial-gradient(circle, #A855F7, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] rounded-full blur-[180px] opacity-15"
          style={{ background: 'radial-gradient(circle, #00E5FF, transparent 70%)' }}
        />
      </div>

      {/* Grid line texture overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />

      {/* Header Banner */}
      <section className="relative z-10 border-b border-white/10 bg-[#0a0710]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#A855F7] animate-ping" />
              <span className="font-mono text-[10px] text-purple-400 uppercase font-bold tracking-[0.3em]">
                EXPERIMENTAL SECTOR // THE WARP
              </span>
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              STRANGE PLACES IN THE 365 UNIVERSE
            </h1>
            <p className="font-mono text-xs text-purple-200/70 uppercase tracking-widest mt-1">
              MOOD MAPS • ASCII ENGINES • SACRED GEOMETRY • UNIVERSE LORE
            </p>
          </div>

          {/* Module Selector Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveModule('hub'); audioManager.playSfx('tap_nav', 0.2); }}
              className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeModule === 'hub' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              ALL WARPS
            </button>
            <button
              onClick={() => { setActiveModule('mood'); audioManager.playSfx('tap_nav', 0.2); }}
              className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeModule === 'mood' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              MOOD MAP
            </button>
            <button
              onClick={() => { setActiveModule('ascii'); audioManager.playSfx('tap_nav', 0.2); }}
              className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeModule === 'ascii' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              ASCII ENGINE
            </button>
            <button
              onClick={() => { setActiveModule('lore'); audioManager.playSfx('tap_nav', 0.2); }}
              className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeModule === 'lore' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              ORIGIN LORE
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* MODULE 1: THE WARP HUB / PORTALS */}
        {activeModule === 'hub' && (
          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Portal 1: Mood Map */}
              <div
                onClick={() => setActiveModule('mood')}
                className="p-6 bg-purple-950/20 border border-purple-500/30 hover:border-purple-400/80 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                    <Activity size={24} />
                  </div>
                  <span className="font-mono text-[10px] text-purple-400 uppercase font-bold tracking-widest block mb-1">
                    EXPERIENCE 01
                  </span>
                  <h3 className="font-black text-xl text-white uppercase mb-2">Mood & Valence Map</h3>
                  <p className="font-mono text-xs text-white/60 leading-relaxed">
                    Plotting all 365 releases across emotional valence and rhythmic energy. Find music by feeling.
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs text-purple-400 font-bold uppercase tracking-wider mt-6 group-hover:text-purple-300">
                  <span>LAUNCH MAP</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>

              {/* Portal 2: ASCII Terminal Generator */}
              <div
                onClick={() => setActiveModule('ascii')}
                className="p-6 bg-cyan-950/20 border border-cyan-500/30 hover:border-cyan-400/80 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                    <Terminal size={24} />
                  </div>
                  <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold tracking-widest block mb-1">
                    EXPERIENCE 02
                  </span>
                  <h3 className="font-black text-xl text-white uppercase mb-2">ASCII Cyber Terminal</h3>
                  <p className="font-mono text-xs text-white/60 leading-relaxed">
                    Raw retro text art, command-line visualizers, and brutalist typographic experiments.
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs text-cyan-400 font-bold uppercase tracking-wider mt-6 group-hover:text-cyan-300">
                  <span>OPEN TERMINAL</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>

              {/* Portal 3: Sacred Geometry Visualizer */}
              <Link
                to={`/listen/${selectedSong?.id || 'day-001'}`}
                className="p-6 bg-pink-950/20 border border-pink-500/30 hover:border-pink-400/80 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col justify-between no-underline"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-4 group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                  </div>
                  <span className="font-mono text-[10px] text-pink-400 uppercase font-bold tracking-widest block mb-1">
                    EXPERIENCE 03
                  </span>
                  <h3 className="font-black text-xl text-white uppercase mb-2">Geometry Visualizer</h3>
                  <p className="font-mono text-xs text-white/60 leading-relaxed">
                    Sri Yantra, Metatron's Cube & Flower of Life audio-reactive particle engine across all 365 releases.
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs text-pink-400 font-bold uppercase tracking-wider mt-6 group-hover:text-pink-300">
                  <span>ENTER VISUALIZER</span>
                  <ArrowUpRight size={14} />
                </div>
              </Link>

              {/* Portal 4: Origin Lore & Manuscripts */}
              <div
                onClick={() => setActiveModule('lore')}
                className="p-6 bg-yellow-950/20 border border-yellow-500/30 hover:border-yellow-400/80 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-4 group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <span className="font-mono text-[10px] text-yellow-400 uppercase font-bold tracking-widest block mb-1">
                    EXPERIENCE 04
                  </span>
                  <h3 className="font-black text-xl text-white uppercase mb-2">Hard Drive Lore</h3>
                  <p className="font-mono text-xs text-white/60 leading-relaxed">
                    The origin story of the lost hard drive, recovered stems, and the journey to release 365 artifacts.
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs text-yellow-400 font-bold uppercase tracking-wider mt-6 group-hover:text-yellow-300">
                  <span>READ ARCHIVE</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MODULE 2: MOOD & VALENCE MAP */}
        {activeModule === 'mood' && (
          <div className="flex flex-col gap-6">
            <div className="p-6 bg-black/60 border border-white/15 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10 mb-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
                    VALENCE & MOOD MATRIX
                  </h2>
                  <p className="font-mono text-xs text-white/60 uppercase tracking-widest">
                    CLICK ANY EMOTIONAL NODE TO AUDITION OR JUMP TO ARTIFACT
                  </p>
                </div>

                {selectedSong && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlaySong(selectedSong)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FF1493] text-black font-mono text-xs font-black uppercase tracking-wider rounded cursor-pointer hover:scale-105 transition-transform"
                    >
                      <Play size={14} className="fill-black" />
                      <span>LISTEN: {selectedSong.title}</span>
                    </button>
                    <Link
                      to={`/day/${selectedSong.day}`}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold uppercase tracking-wider rounded no-underline"
                    >
                      View Artifact →
                    </Link>
                  </div>
                )}
              </div>

              {/* 2D Mood Scatterplot Canvas Representation */}
              <div className="relative w-full h-[400px] bg-[#0c0a10] border border-purple-500/20 rounded-xl overflow-hidden p-6 flex flex-col justify-between">
                
                {/* Axis Labels */}
                <div className="flex justify-between font-mono text-[10px] text-white/40 uppercase tracking-widest">
                  <span>DARK / MELANCHOLY (VALENCE 0.0)</span>
                  <span>LIGHT / ECSTATIC (VALENCE 1.0)</span>
                </div>

                {/* Nodes Grid */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 overflow-y-auto max-h-[300px] p-2">
                  {catalog.slice(0, 72).map(song => {
                    const isSelected = selectedSong?.day === song.day;
                    const isLight = song.mood === 'light';
                    return (
                      <button
                        key={song.id}
                        onClick={() => handleSelectSong(song)}
                        className={`aspect-square rounded flex flex-col items-center justify-center p-1 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black scale-110 z-20 ring-2 ring-purple-400'
                            : isLight
                            ? 'bg-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/40 border border-[#39FF14]/40'
                            : 'bg-[#FF1493]/20 text-[#FF1493] hover:bg-[#FF1493]/40 border border-[#FF1493]/40'
                        }`}
                        title={`Day #${song.day}: ${song.title} (${song.mood})`}
                      >
                        <span>#{song.day}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between font-mono text-[9px] text-purple-400/60 uppercase tracking-widest pt-2 border-t border-white/10">
                  <span>[ ◄ INTROSPECTIVE ACOUSTIC ]</span>
                  <span>[ HIGH-ENERGY SYNTH HYPERDRIVE ► ]</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 3: ASCII ENGINE */}
        {activeModule === 'ascii' && (
          <div className="flex flex-col gap-6">
            <div className="p-6 bg-black border border-white/20 rounded-2xl font-mono">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10 mb-6">
                <div>
                  <h2 className="text-xl font-bold uppercase text-[#39FF14]">
                    TERMINAL_ASCII_SYNTHESIZER // V2.4
                  </h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest">
                    CYBER BRUTALIST ALGORITHMIC TYPOGRAPHY
                  </p>
                </div>

                {/* Density Switcher */}
                <div className="flex items-center gap-2">
                  {(['normal', 'dense', 'glitch'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setAsciiDensity(d)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded border cursor-pointer ${
                        asciiDensity === d ? 'bg-[#39FF14] text-black border-[#39FF14]' : 'bg-transparent text-white/60 border-white/20'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Bar */}
              <div className="mb-4">
                <input
                  type="text"
                  value={asciiInput}
                  onChange={e => setAsciiInput(e.target.value)}
                  placeholder="TYPE CUSTOM PROMPT / CODENAME..."
                  className="w-full px-4 py-2 bg-[#0d0d0d] border border-white/20 text-[#39FF14] font-mono text-xs uppercase tracking-widest outline-none focus:border-[#39FF14] rounded"
                />
              </div>

              {/* ASCII Output Display */}
              <div className="bg-[#050505] p-4 rounded-xl border border-white/10 overflow-x-auto select-all">
                <pre className="text-xs sm:text-sm text-[#39FF14] leading-tight">
                  {generatedAscii}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 4: UNIVERSE LORE & ORIGIN */}
        {activeModule === 'lore' && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div className="p-8 bg-[#0c0912] border border-purple-500/30 rounded-2xl leading-relaxed space-y-6">
              <span className="font-mono text-[10px] text-purple-400 uppercase font-bold tracking-[0.3em]">
                HISTORICAL RECORD // HARD DRIVE RECONSTRUCTION
              </span>
              
              <h2 className="text-3xl sm:text-4xl font-black uppercase text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
                THE 365 ORIGIN & RECOVERY
              </h2>

              <div className="font-mono text-xs sm:text-sm text-white/80 space-y-4">
                <p>
                  Years ago, a catastrophic hardware failure on a primary production drive wiped hundreds of completed tracks, stems, and vocal sessions.
                </p>
                <p>
                  What remained were fragmented project files, bounced rough mixes, audio stems scattered across backup flash drives, and notebooks of lyrics.
                </p>
                <p>
                  Rather than surrendering to the loss, an obsessive recovery process began: restoring lost sessions, re-recording stems, remastering tracks, and designing an entirely new release paradigm.
                </p>
                <p className="p-4 bg-purple-950/40 border-l-4 border-purple-400 text-purple-200">
                  "Every day for 365 consecutive days, one original artifact is released to the world. It is not merely a song—it is an interactive rhythm experience, a piece of artwork, and a permanent collectible card."
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4">
                <Link
                  to="/365"
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold uppercase tracking-wider rounded no-underline"
                >
                  Explore the 365 Archive →
                </Link>
                <Link
                  to="/about"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold uppercase tracking-wider rounded no-underline"
                >
                  Read the Manifesto
                </Link>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
