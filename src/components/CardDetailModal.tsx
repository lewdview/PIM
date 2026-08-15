import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Download, ShieldCheck, Share2, Info, Flame, Film, Play, Disc } from 'lucide-react';
import { useLocation } from 'wouter';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useVaultStore } from '../store/useVaultStore';
import type { OwnedCard } from '../services/vaultService';
import { generateCardMetadata, requestNftMint } from '../services/vaultService';
import { RARITY_CONFIG, getSupplyCap, getMintableCap, type Rarity } from '../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt } from '../utils/rarityArtwork';
import { getArtTypeForDay, OUTFIT_STYLES } from '../utils/artTypes';
import RarityBadge from './RarityBadge';
import AudioPreview from './AudioPreview';
import { getDayFromDate } from '../utils/dayCalc';
import { isBombshellCard, downloadBombshellHiResArtwork } from '../utils/bombshellCards';
import PrizeProgressMenu from './PrizeProgressMenu';

const NFT_MINT_COSTS: Record<Rarity, number> = {
  common: 0,
  uncommon: 0,
  rare: 300,
  legendary: 600,
  mythic: 1200,
};

interface CardDetailModalProps {
  card: OwnedCard | null;
  isOpen: boolean;
  onClose: () => void;
  onBurn?: (card: OwnedCard) => void;
}

function TraitBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">{label}</span>
        <span className="text-[11px] font-mono font-black" style={{ color }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}40` }}
        />
      </div>
    </div>
  );
}

export default function CardDetailModal({ card, isOpen, onClose, onBurn }: CardDetailModalProps) {
  const [, setLocation] = useLocation();
  const stop = useGlobalPlayer((s) => s.stop);
  const [isMinting, setIsMinting] = useState(false);
  const fragments = useVaultStore((s) => s.fragments);

  const { src: modalCoverUrl, handleError: handleModalCoverError } = useSmartCoverArt(card?.card.coverUrl, card?.card.rarity);

  if (!card) return null;

  const getFragmentsForDay = (day: number) => {
    const cardKey = `card-${day}`;
    const dayKey = `day-${String(day).padStart(3, '0')}`;
    const dayKeyRaw = `day-${day}`;
    return (
      fragments[cardKey] ??
      fragments[dayKey] ??
      fragments[dayKeyRaw] ??
      0
    );
  };

  const handleMint = async () => {
    if (!card || isMinting) return;
    setIsMinting(true);
    try {
      const res = await requestNftMint(card.id);
      if (res.success) {
        alert(`Success! Minted NFT on Base. Tx: ${res.txHash}`);
        await useVaultStore.getState().loadVaultData();
      } else {
        alert(`Minting failed: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsMinting(false);
    }
  };

  const rc = RARITY_CONFIG[card.card.rarity];
  const metadata = generateCardMetadata(card);
  const claimedDay = getDayFromDate(card.claimedAt);

  const rarity = card.card.rarity;
  const isDailyClaim = card.source === 'daily_claim';
  const DURATION_LIMITS: Record<string, number> = {
    common: 15,
    uncommon: 60,
    rare: 0,
    legendary: 0,
    mythic: 0,
  };
  const maxDuration = isDailyClaim ? 0 : (DURATION_LIMITS[rarity] ?? 15);
  const isFullSong = maxDuration === 0;

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(metadata, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `th3vault_${card.card.id}_metadata.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  let basePoints = 0;
  if (rarity === 'common') basePoints = 10;
  else if (rarity === 'uncommon') basePoints = 25;
  else if (rarity === 'rare') basePoints = 60;
  else if (rarity === 'legendary') basePoints = 350;
  else if (rarity === 'mythic') basePoints = 800;

  const discovererPoints = card.edition === 1 ? 500 : 0;
  const proofPoints = (card.proof && card.proof !== 'none' as any) ? 200 : 0;
  const echoPoints = card.isEcho ? 400 : 0;
  const totalCardPrestige = basePoints + discovererPoints + proofPoints + echoPoints;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl"
            style={{ pointerEvents: 'auto' }}
          />

          {/* Container */}
          <div className="fixed inset-0 z-[101] overflow-y-auto pointer-events-none flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden pointer-events-auto shadow-2xl relative"
              style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
              {/* Scanlines layer */}
              <div className="absolute inset-0 scanlines opacity-[0.03] pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] h-full">
                
                {/* LEFT: Visual Preview */}
                <div className="relative bg-black/40 border-b lg:border-r lg:border-b-0 border-white/5 flex flex-col items-center justify-center p-4 sm:p-8 gap-6 sm:gap-8">
                  {/* Card Display */}
                  <div className="relative w-full max-w-[280px] group">
                    <div className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl transition-all duration-700"
                      style={{ background: `radial-gradient(circle, ${rc.color}, transparent 70%)` }} />
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                      <img
                        src={modalCoverUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={handleModalCoverError}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <RarityBadge rarity={card.card.rarity} size="lg" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Metadata */}
                  <div className="w-full space-y-4">
                    <div className="border border-white/10 bg-white/5 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase opacity-40">
                        <ShieldCheck size={12} />
                        Vault Registry
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="opacity-40">Serial:</span>
                          <span className="font-bold"># {String(card.card.day).padStart(3, '0')}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="opacity-40">Playable Limit:</span>
                          <span className="font-bold text-white/90">{card.edition || '???'} / {getSupplyCap(card.card.rarity as Rarity, card.card.day)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="opacity-40">Mintable Limit:</span>
                          <span className="font-bold text-white/90">
                            {getMintableCap(card.card.rarity as Rarity) > 0
                              ? `${getMintableCap(card.card.rarity as Rarity)} Max`
                              : 'Not Mintable'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="opacity-40">Blockchain:</span>
                          <span className="font-bold text-white/90">
                            {card.blockchainStatus === 'minted' ? 'Minted (Base)' : card.blockchainStatus === 'pending' ? 'Pending' : 'Off-Chain'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="opacity-40">Card Set:</span>
                          <span className="font-bold text-[#FF1493]">
                            {isBombshellCard(card) ? '🔥 Bombshell Series' : 'Gen-0 Archive'}
                          </span>
                        </div>
                        {(card.coverArtwork || card.card.coverArtwork) && (
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="opacity-40">Artwork:</span>
                            <span className="font-bold text-[#00E5FF] truncate max-w-[150px]" title={card.coverArtwork || card.card.coverArtwork}>
                              {card.coverArtwork || card.card.coverArtwork}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px] font-mono border-t border-white/5 pt-1.5 mt-1.5">
                          <span className="opacity-40">Decrypt Shards:</span>
                          <span className="font-bold text-[#39FF14]">
                            {getFragmentsForDay(card.card.day)} / 10 (UNLOCKED)
                          </span>
                        </div>
                        {(() => {
                          const isBombshell = isBombshellCard(card);
                          if (isBombshell) {
                            const artworkName = card.coverArtwork || card.card.coverArtwork || '';
                            const isLB = artworkName.startsWith('lb') || card.card.coverUrl.includes('lb%20') || card.card.coverUrl.includes('lb ');
                            return (
                              <>
                                <div className="flex justify-between items-center text-[11px] font-mono border-t border-white/5 pt-1.5 mt-1.5">
                                  <span className="opacity-40">Deck Series:</span>
                                  <span className="font-bold text-[#ff1493]">🔥 Bombshell Series</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-mono">
                                  <span className="opacity-40">Cover Variant:</span>
                                  <span
                                    className="font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                                    style={{
                                      background: isLB ? 'rgba(255, 184, 0, 0.2)' : 'rgba(255, 20, 147, 0.2)',
                                      color: isLB ? '#ffb800' : '#ff1493',
                                      border: isLB ? '1px solid rgba(255, 184, 0, 0.4)' : '1px solid rgba(255, 20, 147, 0.4)',
                                    }}
                                  >
                                    {isLB ? 'Light / Bust (LB)' : 'Normal / Full Cover'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-mono">
                                  <span className="opacity-40">Vault Directory:</span>
                                  <span className="font-bold text-white/90 font-mono text-[10px]">
                                    day {card.card.day} (Day Registry)
                                  </span>
                                </div>
                                <div className="pt-2 border-t border-white/5 mt-1.5 flex gap-2">
                                  <button
                                    onClick={async () => {
                                      if (artworkName) {
                                        await downloadBombshellHiResArtwork(card.card.day, artworkName);
                                      }
                                    }}
                                    className="w-full py-1.5 px-2.5 rounded bg-gradient-to-r from-[#FF1493]/20 to-[#ff4081]/20 hover:from-[#FF1493]/40 hover:to-[#ff4081]/40 border border-[#FF1493]/40 text-[#ff85c0] font-mono text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Download size={11} /> Download Hi-Res Master PNG
                                  </button>
                                </div>
                              </>
                            );
                          }

                          const artData = getArtTypeForDay(card.card.day);
                          const outfitMeta = OUTFIT_STYLES[artData.outfitStyle];
                          return (
                            <>
                              <div className="flex justify-between items-center text-[11px] font-mono border-t border-white/5 pt-1.5 mt-1.5">
                                <span className="opacity-40">Art Spec (#{(card.card.day % 365) || 365}):</span>
                                <span className="font-bold text-[#00f0ff]">{artData.artType}</span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] font-mono">
                                <span className="opacity-40">Outfit Material:</span>
                                <span
                                  className="font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                                  style={{
                                    background: `${outfitMeta.tagColor}20`,
                                    color: outfitMeta.tagColor,
                                    border: `1px solid ${outfitMeta.tagColor}40`,
                                  }}
                                >
                                  {outfitMeta.label}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] font-mono">
                                <span className="opacity-40">Color Combo:</span>
                                <span className="font-bold flex items-center gap-1.5 text-white/90">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                                    style={{
                                      background: artData.colorCombo.primary,
                                      boxShadow: `0 0 6px ${artData.colorCombo.primary}`,
                                    }}
                                  />
                                  <span className="text-[10px]">{artData.colorCombo.name}</span>
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {card.proof && (
                      <div className="p-4 rounded-xl border-2 border-[#fff]/10 relative overflow-hidden" style={{ background: card.proof === 'proof_of_first' ? 'rgba(167,139,250,0.1)' : 'rgba(239,68,68,0.1)', borderColor: card.proof === 'proof_of_first' ? 'rgba(167,139,250,0.3)' : 'rgba(239,68,68,0.3)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{card.proof === 'proof_of_first' ? '🔮' : '🎲'}</span>
                          <span className="text-[10px] font-mono font-black uppercase tracking-widest" style={{ color: card.proof === 'proof_of_first' ? '#a78bfa' : '#ef4444' }}>
                            {card.proof === 'proof_of_first' ? 'PROOF OF FIRST' : 'HEARD FIRST PROOF'}
                          </span>
                        </div>
                        <p className="text-[9px] font-mono opacity-50 uppercase leading-tight">
                          Ultra-rare 1/1 verification stamp. This card represents a historical milestone in the vault archive.
                        </p>
                      </div>
                    )}

                    <AudioPreview 
                      audioUrl={card.card.audioUrl} 
                      title={card.card.title} 
                      rarity={card.card.rarity} 
                      coverUrl={isBombshellCard(card) ? card.card.coverUrl : getCoverUrlForRarity(card.card.coverUrl, card.card.rarity)}
                      day={card.card.day}
                      isDailyClaim={card.source === 'daily_claim'}
                    />
                  </div>
                </div>

                {/* RIGHT: Stats & Playback */}
                <div className="p-6 sm:p-10 pb-28 lg:pb-10 flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-[0.4em] opacity-40">ITEM DATA // {card.card.day} OF 365</div>
                      <h2 className="text-3xl sm:text-4xl brutalist-title italic truncate" style={{ '--neon-accent': rc.color } as any}>
                        {card.card.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isFullSong && (
                        <button
                          onClick={() => {
                            stop();
                            setLocation(`/play/card-${card.card.day}`);
                          }}
                          className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[rgba(0,240,255,0.15)] border border-[#00f0ff] text-[#00f0ff] text-[11px] font-mono font-black uppercase tracking-wider active:scale-95 shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                        >
                          <Play size={13} fill="#00f0ff" />
                          <span>PLAY PIM</span>
                        </button>
                      )}
                      <button aria-label="Close" onClick={onClose} className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors opacity-40 hover:opacity-100 active:scale-95 duration-150 cursor-pointer">
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-2 mt-3 mb-6">
                    {/* Owned since Day X */}
                    <div className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Owned since Day {claimedDay}</span>
                    </div>

                    {/* First Discoverer Badge */}
                    {(card.edition === 1 || card.proof === 'proof_of_first') && (
                      <div className="px-2.5 py-1 rounded bg-[#ffd700]/10 border border-[#ffd700]/30 text-[10px] font-mono font-black uppercase tracking-widest text-[#ffd700] flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,215,0,0.15)] animate-pulse">
                        <span>👑</span>
                        <span>First Discoverer</span>
                      </div>
                    )}
                  </div>

                  {/* Traits Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl relative overflow-hidden">
                    <TraitBar label="Energy" value={card.card.energy} color="var(--color-neon-cyan)" />
                    <TraitBar label="Valence" value={card.card.valence} color="var(--color-neon-gold)" />
                    <TraitBar label="Tempo" value={(card.card.tempo - 70) / 110} color="var(--color-neon-purple)" />
                    <div className="space-y-1.5">
                       <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">Mood</span>
                       <div className="flex items-center gap-2">
                        <div className={`px-2.5 py-1 rounded text-xs font-black uppercase ${card.card.mood === 'light' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>
                           {card.card.mood}
                        </div>
                       </div>
                    </div>
                  </div>

                  {/* Metadata Table */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase opacity-40 tracking-widest">
                       <Info size={12} />
                       Metadata Properties
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {[
                        { label: 'Rarity', value: card.card.rarity },
                        { label: 'Playable Edition', value: `${card.edition || 1} of ${getSupplyCap(card.card.rarity as Rarity, card.card.day)}` },
                        { label: 'Mintable Limit', value: getMintableCap(card.card.rarity as Rarity) > 0 ? `${getMintableCap(card.card.rarity as Rarity)} Max` : 'Not Mintable' },
                        { label: 'Claimed', value: new Date(card.claimedAt).toLocaleDateString() },
                        { label: 'Source', value: card.source.replace('pack_', '').replace('_', ' ') }
                      ].map((item, i) => (
                        <div key={i} className="p-3 border border-white/5 bg-white/[0.03] rounded-lg space-y-1">
                          <div className="text-[9px] font-mono uppercase opacity-30">{item.label}</div>
                          <div className="text-xs font-bold uppercase truncate">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Song Vault Prizes Status */}
                  <div className="mb-6">
                    <PrizeProgressMenu songId={`card-${card.card.day}`} />
                  </div>

                  {/* Archivist Provenance Log */}
                  <div className="space-y-4 border border-dashed border-white/10 bg-white/[0.01] p-5 rounded-xl mb-6">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-[#ffaa00]">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={12} className="text-[#ffaa00]" />
                        Archivist Provenance Log
                      </div>
                      <span className="opacity-50">STATUS: VERIFIED</span>
                    </div>

                    <div className="font-mono text-[10px] space-y-2 text-white/60">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>TIMESTAMP LOGGED:</span>
                        <span className="text-white font-bold">{new Date(card.claimedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>SERIALIZED PATH:</span>
                        <span className="text-white font-bold">TH3V4ULT://DAY-{card.card.day}/ED-{card.edition || 1}</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        <div className="text-[9px] text-[#ffaa00] font-black uppercase tracking-wider mb-1.5">PRESTIGE SCORE BREAKDOWN:</div>
                        <div className="flex justify-between opacity-80 pl-2">
                          <span>• {rc.label} RARITY WEIGHT:</span>
                          <span className="font-bold text-white">+{basePoints} pts</span>
                        </div>
                        {discovererPoints > 0 && (
                          <div className="flex justify-between opacity-80 pl-2 text-[#ffd700]">
                            <span>• FIRST DISCOVERER BONUS:</span>
                            <span className="font-bold text-[#ffd700]">+{discovererPoints} pts</span>
                          </div>
                        )}
                        {proofPoints > 0 && (
                          <div className="flex justify-between opacity-80 pl-2 text-[#a78bfa]">
                            <span>• REGISTRY PROOF BONUS:</span>
                            <span className="font-bold text-[#a78bfa]">+{proofPoints} pts</span>
                          </div>
                        )}
                        {echoPoints > 0 && (
                          <div className="flex justify-between opacity-80 pl-2 text-red-400">
                            <span>• ECHO RE-ENTRY FACTOR:</span>
                            <span className="font-bold text-red-400">+{echoPoints} pts</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-white/15 pt-1.5 mt-1 text-[11px] font-black text-white">
                          <span>TOTAL PRESTIGE CONTRIBUTION:</span>
                          <span style={{ color: rc.color }}>{totalCardPrestige} PTS</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-auto pt-8 border-t border-white/5 flex flex-wrap gap-4">
                    <button 
                      onClick={downloadJson}
                      className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-white/10 active:scale-95"
                    >
                      <Download size={14} />
                      Export Metadata JSON
                    </button>
                    <button className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-white/10 active:scale-95">
                      <Share2 size={14} />
                      Share Card
                    </button>
                    {isFullSong && (
                      <>
                        <button
                          onClick={() => {
                            stop();
                            setLocation(`/play/card-${card.card.day}`);
                          }}
                          className="flex items-center gap-2 px-5 py-3 bg-[rgba(0,240,255,0.1)] border border-neon-cyan text-neon-cyan rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all hover:bg-[rgba(0,240,255,0.2)] hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                          style={{
                            borderColor: 'var(--color-neon-cyan, #00f0ff)',
                            color: 'var(--color-neon-cyan, #00f0ff)',
                          }}
                        >
                          PLAY PIM
                        </button>
                        {import.meta.env.DEV && (
                          <button
                            onClick={() => {
                              stop();
                              sessionStorage.setItem(`export_video_card-${card.card.day}`, 'true');
                              setLocation(`/play/card-${card.card.day}`);
                            }}
                            title="Export frame-perfect 100% PERFECT+ run video (DEV ONLY)"
                            className="flex items-center gap-2 px-4 py-3 bg-[#FF1493]/15 border border-[#FF1493] text-[#FF1493] rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all hover:bg-[#FF1493] hover:text-black hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(255,20,147,0.2)] cursor-pointer"
                          >
                            <Film size={14} />
                            <span>EXPORT VIDEO</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            stop();
                            sessionStorage.setItem(`game_origin_card-${card.card.day}`, 'vault/collection');
                            setLocation(`/listen/card-${card.card.day}`);
                          }}
                          className="flex items-center gap-2 px-5 py-3 bg-[rgba(57,255,20,0.1)] border border-[#39FF14] text-[#39FF14] rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all hover:bg-[rgba(57,255,20,0.2)] hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(57,255,20,0.15)]"
                        >
                          🎧 JUST LISTEN
                        </button>
                      </>
                    )}
                    {card.blockchainStatus === 'minted' ? (
                      <a
                        href={`https://base.blockscout.com/tx/${card.fingerprint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                      >
                        View on Chain
                        <ExternalLink size={14} />
                      </a>
                    ) : card.blockchainStatus === 'pending' || isMinting ? (
                      <button
                        disabled
                        className="ml-auto flex items-center gap-2 px-6 py-3 bg-white/10 text-white/50 border border-white/5 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest cursor-not-allowed"
                      >
                        Minting...
                      </button>
                    ) : rarity === 'common' ? (
                      <button
                        disabled
                        className="ml-auto flex items-center gap-2 px-6 py-3 bg-white/5 text-white/30 border border-white/5 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest cursor-not-allowed"
                      >
                        Not Mintable
                      </button>
                    ) : (
                      <button
                        onClick={handleMint}
                        disabled={useVaultStore.getState().tokenBalance < (NFT_MINT_COSTS[rarity] ?? 0)}
                        className="ml-auto flex items-center gap-2 px-6 py-3 bg-[#E5B800] text-black hover:bg-yellow-400 disabled:bg-white/5 disabled:text-white/30 disabled:border disabled:border-white/5 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                      >
                        Mint NFT {(NFT_MINT_COSTS[rarity] ?? 0) > 0 ? `(${NFT_MINT_COSTS[rarity]} V⚡)` : '(FREE)'}
                      </button>
                    )}

                    {(card.edition || 0) > getSupplyCap(card.card.rarity as Rarity, card.card.day) && onBurn && (
                      <button 
                        onClick={() => { onBurn(card); onClose(); }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs font-mono font-black uppercase tracking-[0.2em] transition-all hover:bg-red-500/20 active:scale-[0.98] mt-4"
                      >
                        <Flame size={16} />
                         Burn Minted Out Card
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Sticky Bottom Action Dock */}
              {isFullSong && (
                <div className="lg:hidden sticky bottom-0 inset-x-0 p-3 bg-[#0a0a0e]/95 backdrop-blur-xl border-t border-white/15 z-40 flex items-center gap-2">
                  <button
                    onClick={() => {
                      stop();
                      setLocation(`/play/card-${card.card.day}`);
                    }}
                    className="flex-1 py-3.5 px-4 rounded-xl font-mono font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 text-black transition-all active:scale-[0.98] shadow-lg cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #00f0ff, #ff1493)',
                      boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)',
                    }}
                  >
                    <Play size={15} fill="#000" />
                    <span>PLAY PIM GAME</span>
                  </button>
                  <button
                    onClick={() => {
                      stop();
                      sessionStorage.setItem(`game_origin_card-${card.card.day}`, 'vault/collection');
                      setLocation(`/listen/card-${card.card.day}`);
                    }}
                    className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                    title="Listen to track"
                  >
                    <Disc size={15} className="text-[#39FF14]" />
                    <span>LISTEN</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
