/**
 * "My card" tab: every copy of this day the player owns, with the registry,
 * provenance and prestige for the selected copy. Shows how to collect the
 * card when the player has none.
 */
import { useLocation } from 'wouter';
import { Download, ExternalLink, Flame, ShieldCheck, Share2, Layers } from 'lucide-react';
import { generateCardMetadata, type OwnedCard } from '../../services/vaultService';
import { useVaultStore, getGen0ShardsForDay, getBombshellShardsForDay } from '../../store/useVaultStore';
import { RARITY_CONFIG, getMintableCap, getSupplyCap, type Rarity } from '../../utils/rarity';
import { getArtTypeForDay, OUTFIT_STYLES } from '../../utils/artTypes';
import { isBombshellCard } from '../../utils/bombshellCards';
import { getDayFromDate } from '../../utils/dayCalc';
import RarityBadge from '../RarityBadge';
import type { TrackDetailData } from './useTrackDetail';

const BASE_POINTS: Record<string, number> = { common: 10, uncommon: 25, rare: 60, legendary: 350, mythic: 800 };

function Row({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[11px] font-mono py-1 border-b border-white/5 last:border-b-0">
      <span className="text-white/40">{label}</span>
      <span className="font-bold text-right truncate" style={{ color: accent || 'rgba(255,255,255,0.9)' }}>{children}</span>
    </div>
  );
}

interface Props {
  data: TrackDetailData;
  selected: OwnedCard | null;
  onSelect: (c: OwnedCard) => void;
  onBurn?: (card: OwnedCard) => void;
  onShare: () => void;
  onNavigateAway?: () => void;
}

export default function CardSection({ data, selected, onSelect, onBurn, onShare, onNavigateAway }: Props) {
  const [, setLocation] = useLocation();
  const fragments = useVaultStore((s) => s.fragments);
  const { day, ownedCopies } = data;

  if (ownedCopies.length === 0 || !selected) {
    return (
      <div className="space-y-5">
        <div className="hw-well p-5 space-y-2">
          <div className="td-label">Collectible status</div>
          <p className="text-sm font-bold text-white">You don't own Day {day} yet.</p>
          <p className="td-muted">
            {day === data.today
              ? "Today's card is free: press Play and it's added to your vault."
              : 'Find it in packs, or claim it on its release day.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={() => { onNavigateAway?.(); setLocation('/shop'); }}>Shop packs</button>
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => { onNavigateAway?.(); setLocation('/vault'); }}>Open vault</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['common', 'uncommon', 'rare', 'legendary', 'mythic'] as Rarity[]).map((r) => (
            <div key={r} className="td-cell">
              <span className="td-label" style={{ color: RARITY_CONFIG[r].color }}>{RARITY_CONFIG[r].label}</span>
              <span className="font-mono text-xs font-bold">{getSupplyCap(r, day)} editions</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const card = selected;
  const rarity = card.card.rarity as Rarity;
  const rc = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const supplyCap = getSupplyCap(rarity, card.card.day);
  const bombshell = isBombshellCard(card);
  const shards = bombshell ? getBombshellShardsForDay(fragments, day) : getGen0ShardsForDay(fragments, day);
  const artworkName = card.coverArtwork || card.card.coverArtwork || '';
  // Stored proofs are 'proof_of_first' or 'proof_of_listen' (the type still says heard_first)
  const proof = card.proof as string | null | undefined;
  const hasRealProof = proof === 'proof_of_first' || proof === 'proof_of_listen';
  const basePoints = BASE_POINTS[rarity] ?? 0;
  const discovererPoints = card.edition === 1 ? 500 : 0;
  const proofPoints = hasRealProof ? 200 : 0;
  const echoPoints = card.isEcho ? 400 : 0;
  const totalPrestige = basePoints + discovererPoints + proofPoints + echoPoints;
  const art = getArtTypeForDay(day);
  const outfit = OUTFIT_STYLES[art.outfitStyle];

  const downloadJson = () => {
    const metadata = generateCardMetadata(card);
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metadata, null, 2));
    a.download = `th3vault_${card.card.id}_metadata.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Copies */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-white/50" />
          <h3 className="td-h">Your copies ({ownedCopies.length})</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {ownedCopies.map((c) => {
            const isSel = c.id === card.id;
            const crc = RARITY_CONFIG[c.card.rarity as Rarity] || RARITY_CONFIG.common;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={`shrink-0 px-3 py-2 rounded-lg border text-left cursor-pointer transition-all ${isSel ? 'bg-white/10' : 'bg-white/[0.02] hover:bg-white/5'}`}
                style={{ borderColor: isSel ? crc.color : 'rgba(255,255,255,0.08)' }}
              >
                <div className="text-[9px] font-mono font-black uppercase" style={{ color: crc.color }}>{crc.label}</div>
                <div className="text-[10px] font-mono text-white/70">
                  #{c.edition || '?'} · {isBombshellCard(c) ? 'Bombshell' : 'Gen-0'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <RarityBadge rarity={rarity} size="sm" />
        <span className="td-chip">📅 Owned since Day {getDayFromDate(card.claimedAt)}</span>
        {(card.edition === 1 || card.proof === 'proof_of_first') && (
          <span className="td-chip" style={{ color: '#ffd700', borderColor: 'rgba(255,215,0,0.3)', background: 'rgba(255,215,0,0.08)' }}>👑 First discoverer</span>
        )}
      </div>

      {hasRealProof && (
        <div className="p-4 rounded-xl border" style={{ background: card.proof === 'proof_of_first' ? 'rgba(167,139,250,0.1)' : 'rgba(239,68,68,0.1)', borderColor: card.proof === 'proof_of_first' ? 'rgba(167,139,250,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div className="text-[10px] font-mono font-black uppercase tracking-widest" style={{ color: card.proof === 'proof_of_first' ? '#a78bfa' : '#ef4444' }}>
            {card.proof === 'proof_of_first' ? '🔮 Proof of first' : '🎲 Heard first proof'}
          </div>
          <p className="text-[10px] font-mono text-white/50 mt-1">1-of-1 stamp. This card marks a milestone in the vault archive.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Registry */}
        <section className="hw-well p-4">
          <div className="flex items-center gap-2 td-label mb-2"><ShieldCheck size={12} /> Vault registry</div>
          <Row label="Serial"># {String(day).padStart(3, '0')}</Row>
          <Row label="Playable edition">{card.edition || '???'} of {supplyCap}</Row>
          <Row label="Mintable limit">{getMintableCap(rarity) > 0 ? 'Coming soon' : 'Not mintable'}</Row>
          <Row label="Blockchain">{card.blockchainStatus === 'minted' ? 'Minted' : card.blockchainStatus === 'pending' ? 'Minting…' : 'Off-chain'}</Row>
          <Row label="Card set" accent="#FF1493">{bombshell ? '🔥 Bombshell Series' : 'Gen-0 Archive'}</Row>
          <Row label="Claimed">{new Date(card.claimedAt).toLocaleDateString()}</Row>
          <Row label="Source">{card.source.replace('pack_', '').replace(/_/g, ' ')}</Row>
          <Row label="Decrypt shards" accent="#39FF14">{shards} / 10</Row>
          {bombshell ? (
            <>
              {artworkName && <Row label="Artwork" accent="#00E5FF">{artworkName}</Row>}
              <Row label="Cover variant" accent={artworkName.toLowerCase().startsWith('lb') ? '#ffb800' : '#ff1493'}>
                {artworkName.toLowerCase().startsWith('lb') ? 'Letterbox (LB)' : 'Full frame'}
              </Row>
            </>
          ) : (
            <>
              <Row label={`Art spec (#${(day % 365) || 365})`} accent="#00f0ff">{art.artType}</Row>
              <Row label="Outfit material" accent={outfit.tagColor}>{outfit.label}</Row>
              <Row label="Colour combo">{art.colorCombo.name}</Row>
            </>
          )}
        </section>

        {/* Provenance */}
        <section className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
          <div className="flex items-center justify-between td-label mb-2" style={{ color: '#ffaa00' }}>
            <span className="flex items-center gap-2"><ShieldCheck size={12} /> Provenance log</span>
            <span className="opacity-60">Verified</span>
          </div>
          <Row label="Logged">{new Date(card.claimedAt).toLocaleString()}</Row>
          <Row label="Path">TH3V4ULT://DAY-{day}/ED-{card.edition || 1}</Row>
          <div className="pt-2 space-y-1 font-mono text-[10px]">
            <div className="text-[9px] text-[#ffaa00] font-black uppercase tracking-wider">Prestige</div>
            <div className="flex justify-between text-white/70"><span>{rc.label} rarity</span><span className="font-bold text-white">+{basePoints}</span></div>
            {discovererPoints > 0 && <div className="flex justify-between text-[#ffd700]"><span>First discoverer</span><span className="font-bold">+{discovererPoints}</span></div>}
            {proofPoints > 0 && <div className="flex justify-between text-[#a78bfa]"><span>Registry proof</span><span className="font-bold">+{proofPoints}</span></div>}
            {echoPoints > 0 && <div className="flex justify-between text-red-400"><span>Echo re-entry</span><span className="font-bold">+{echoPoints}</span></div>}
            <div className="flex justify-between border-t border-white/15 pt-1.5 text-[11px] font-black text-white">
              <span>Total</span><span style={{ color: rc.color }}>{totalPrestige} pts</span>
            </div>
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-3d" data-size="sm" data-tone="ghost" onClick={downloadJson}><Download size={12} /> Export metadata JSON</button>
        <button type="button" className="btn-3d" data-size="sm" data-tone="ghost" onClick={onShare}><Share2 size={12} /> Share card</button>
        {card.blockchainStatus === 'minted' ? (
          <a href={`https://base.blockscout.com/tx/${card.fingerprint}`} target="_blank" rel="noopener noreferrer" className="btn-3d" data-size="sm" data-tone="default">
            View on chain <ExternalLink size={12} />
          </a>
        ) : (
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" disabled>
            {card.blockchainStatus === 'pending' ? 'Minting…' : rarity === 'common' ? 'Not mintable' : 'Minting soon'}
          </button>
        )}
        {(card.edition || 0) > supplyCap && onBurn && (
          <button type="button" className="btn-3d w-full justify-center" data-tone="vermilion" onClick={() => onBurn(card)}>
            <Flame size={14} /> Burn excess copy
          </button>
        )}
      </div>
    </div>
  );
}
