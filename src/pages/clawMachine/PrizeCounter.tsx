import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { AlertTriangle, Flame } from 'lucide-react';
import TokenBundleShelf from '../../components/TokenBundleShelf';
import { useVaultStore } from '../../store/useVaultStore';
import { useLoadingToast } from '../../store/useLoadingToast';
import { useAuthStore } from '../../store/useAuthStore';
import { audioManager } from '../../game/audio';
import {
  targetedPull, upgradeRarity, fuseDuplicates, redeemBonusCode, fetchAllCards, findCardWithFallback,
  type OwnedCard,
} from '../../services/vaultService';

type Tab = 'targeted' | 'upgrade' | 'fusion' | 'code' | 'sparks';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'sparks', label: 'Get V⚡', icon: '⚡' },
  { id: 'targeted', label: 'Targeted', icon: '🎯' },
  { id: 'upgrade', label: 'Upgrade', icon: '⬆️' },
  { id: 'fusion', label: 'Fusion', icon: '🔥' },
  { id: 'code', label: 'Promo code', icon: '🔑' },
];

/** Map a raw vault-engine card row onto an OwnedCard. */
function mapEngineCard(pool: Awaited<ReturnType<typeof fetchAllCards>>, c: any): OwnedCard {
  const parent = findCardWithFallback(pool, c.card_id, c.rarity);
  return {
    id: c.id || crypto.randomUUID(),
    cardId: parent.id,
    card: { ...parent, rarity: c.rarity },
    source: c.source || 'promo_code',
    claimedAt: c.claimed_at,
    edition: c.edition,
    maxSupply: c.max_supply,
    isEcho: c.is_echo,
    echoGeneration: c.echo_generation,
    echoSourceDay: c.echo_source_day,
    proof: c.proof,
    ultraReward: c.ultra_reward,
    blockchainStatus: c.blockchain_status,
    fingerprint: c.fingerprint,
  } as OwnedCard;
}

export default function PrizeCounter({ today, tab, onTab }: { today: number; tab: Tab; onTab: (t: Tab) => void }) {
  const [, setLocation] = useLocation();
  const user = useAuthStore(s => s.user);
  const { tokenBalance, collection, loadVaultData, addToCollection, removeFromCollection, startReveal } = useVaultStore();

  const [busy, setBusy] = useState(false);
  const [targetDay, setTargetDay] = useState('');
  const [upgradeId, setUpgradeId] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [code, setCode] = useState('');
  const [ageGateCode, setAgeGateCode] = useState<string | null>(null);

  const upgradeable = useMemo(
    () => collection.filter(c => c?.card && !['legendary', 'mythic'].includes(c.card.rarity)),
    [collection],
  );
  const fusable = useMemo(() => {
    const groups: Record<string, OwnedCard[]> = {};
    for (const c of collection) {
      if (!c?.card) continue;
      (groups[`${c.cardId}-${c.card.rarity}`] ??= []).push(c);
    }
    return Object.entries(groups).filter(([, cards]) => cards.length >= 3);
  }, [collection]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    useLoadingToast.getState().show(label);
    try {
      await fn();
    } catch (err: any) {
      console.error(err);
      audioManager.playSfx('error', 0.6);
      setNote({ tone: 'err', text: err?.message || 'Something went wrong. Try again.' });
    } finally {
      useLoadingToast.getState().hide();
      setBusy(false);
    }
  }, []);

  const day = parseInt(targetDay, 10);
  const doTargeted = () => run(`Pulling Day ${day}…`, async () => {
    const card = await targetedPull(day);
    await loadVaultData(true);
    if (!card) throw new Error('That pull didn’t go through.');
    addToCollection([card]);
    audioManager.playSfx('targeted', 0.9);
    startReveal([card], {
      category: 'targeted', label: `Targeted Pull: Day ${day}`, icon: '🎯',
      accent: '#3b82f6', gradient: 'linear-gradient(145deg, #0a192f, #020c1b)',
      price: '275 V⚡', cardCount: 1, revealType: 'cinematic', redirectPath: '/next-vault',
    });
    setLocation('/vault/reveal');
  });

  const doUpgrade = () => run('Upgrading rarity…', async () => {
    const res = await upgradeRarity(upgradeId);
    await loadVaultData(true);
    if (!res.success) throw new Error('Upgrade didn’t go through.');
    audioManager.playSfx('upgrade', 0.9);
    setUpgradeId('');
    setNote({ tone: 'ok', text: `Upgraded to ${res.newRarity?.toUpperCase()}.` });
  });

  const doFusion = (cards: OwnedCard[]) => run('Fusing cards…', async () => {
    const card = await fuseDuplicates(cards.map(c => c.id));
    await loadVaultData(true);
    if (!card) throw new Error('Fusion didn’t go through.');
    cards.forEach(c => removeFromCollection(c.id));
    addToCollection([card]);
    audioManager.playSfx('fusion', 0.9);
    startReveal([card], {
      category: 'fusion', label: 'Duplicate Fusion', icon: '🔥',
      accent: '#fbbf24', gradient: 'linear-gradient(145deg, #2a1600, #0a0500)',
      price: 'FREE', cardCount: 1, revealType: 'cinematic', redirectPath: '/next-vault',
    });
    setLocation('/vault/reveal');
  });

  const doRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    run('Checking code…', async () => {
      const res = await redeemBonusCode(code);
      if (!res.success || !res.rewardType || !res.rewardValue) {
        throw new Error(res.error || 'Invalid or expired code.');
      }
      setCode('');
      if (res.rewardType === 'age_gate_required') {
        setAgeGateCode(res.rewardValue);
        return;
      }
      const rawCards: any[] | null =
        res.rewardType === 'pack' && res.result?.cards ? res.result.cards
        : res.rewardType === 'card' && res.result?.card ? [res.result.card]
        : null;
      if (rawCards && rawCards.length > 0) {
        const pool = await fetchAllCards();
        const cards = rawCards.map(c => mapEngineCard(pool, c));
        addToCollection(cards);
        audioManager.playSfx('open_chest', 0.9);
        startReveal(cards, {
          category: 'promo_code',
          label: cards.length === 1 ? 'Promo Card' : 'Promo Pack',
          icon: cards.length === 1 ? '⭐' : '🎁',
          accent: '#3b82f6', gradient: 'linear-gradient(145deg, #0f172a, #020617)',
          price: 'PROMO', cardCount: cards.length, revealType: 'cinematic', redirectPath: '/next-vault',
        });
        await loadVaultData();
        setLocation('/vault/reveal');
        return;
      }
      audioManager.playSfx('song_completion', 0.85);
      await loadVaultData();
      const text =
        res.rewardType === 'tokens' ? `+${parseInt(res.rewardValue, 10)} V⚡ added.`
        : res.rewardType === 'background_skin' ? `Skin unlocked: ${res.rewardValue}.`
        : res.rewardType === 'cheat_code' ? (res.rewardValue === 'iddqd' ? 'Lyric and BPM chart modes unlocked.' : 'Miss system settings unlocked.')
        : 'Reward unlocked.';
      setNote({ tone: 'ok', text });
    });
  };

  const confirmAge = () => {
    if (!ageGateCode) return;
    try {
      localStorage.setItem('opt_18_confirmed', 'true');
      let text = 'Content unlocked.';
      if (ageGateCode === 'stunnerofthemonthunlock') {
        localStorage.setItem('opt_unlocked_stunner_section', 'true');
        text = 'Stunner of the Month unlocked.';
      } else if (ageGateCode === 'freebstella') {
        localStorage.setItem('opt_free_stella_unlocked', 'true');
        localStorage.setItem('opt_unlocked_stunner_section', 'true');
        text = 'Stella Luxx unlocked in Slideshows.';
      }
      audioManager.playSfx('song_completion', 0.85);
      setNote({ tone: 'ok', text });
      window.dispatchEvent(new Event('cheat_code_activated'));
    } catch (err: any) {
      setNote({ tone: 'err', text: 'Age check failed: ' + err?.message });
    } finally {
      setAgeGateCode(null);
    }
  };

  return (
    <section className="claw-counter" id="prize-counter">
      <header className="claw-counter-head">
        <h2>Prize counter</h2>
        <button type="button" className="claw-link" onClick={() => setLocation('/vault/forge')}>
          <Flame size={14} /> Burn cards in the Forge
        </button>
      </header>

      <div className="claw-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`claw-tab${tab === t.id ? ' is-on' : ''}`}
            onClick={() => { onTab(t.id); setNote(null); }}
          >
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {!user && tab !== 'sparks' ? (
        <div className="claw-counter-body">
          <p className="claw-muted">Sign in to use the counter. Your cards and V⚡ live on your account.</p>
          <button type="button" className="claw-btn claw-btn-gold" onClick={() => useAuthStore.getState().setShowAuthModal(true)}>
            Sign in
          </button>
        </div>
      ) : (
        <div className="claw-counter-body">
          {tab === 'sparks' && <TokenBundleShelf onPurchased={loadVaultData} />}

          {tab === 'targeted' && (
            <>
              <p className="claw-muted">Pick any released day (1–{today}) and pull a card from that drop. 275 V⚡.</p>
              <div className="claw-row">
                <input
                  type="number" min={1} max={today} inputMode="numeric"
                  value={targetDay} onChange={e => setTargetDay(e.target.value)}
                  placeholder={`Day 1–${today}`} className="claw-input"
                />
                <button
                  type="button" className="claw-btn claw-btn-blue"
                  disabled={busy || !day || day < 1 || day > today || tokenBalance < 275}
                  onClick={doTargeted}
                >
                  Pull · 275 V⚡
                </button>
              </div>
              {day > today && <p className="claw-warn">Day {day} hasn’t dropped yet. Future days come from the Prophecy pit.</p>}
              {tokenBalance < 275 && <p className="claw-warn">You need {275 - tokenBalance} more V⚡.</p>}
            </>
          )}

          {tab === 'upgrade' && (
            <>
              <p className="claw-muted">Raise one card below Legendary by a rarity tier. 150 V⚡.</p>
              <div className="claw-row">
                <select value={upgradeId} onChange={e => setUpgradeId(e.target.value)} className="claw-input">
                  <option value="">{upgradeable.length ? 'Choose a card' : 'No cards to upgrade'}</option>
                  {upgradeable.map(c => (
                    <option key={c.id} value={c.id}>Day {c.card.day}: {c.card.title} ({c.card.rarity})</option>
                  ))}
                </select>
                <button
                  type="button" className="claw-btn claw-btn-gold"
                  disabled={busy || !upgradeId || tokenBalance < 150}
                  onClick={doUpgrade}
                >
                  Upgrade · 150 V⚡
                </button>
              </div>
            </>
          )}

          {tab === 'fusion' && (
            <>
              <p className="claw-muted">Three copies of the same day and rarity fuse into one card a tier up. Free.</p>
              {fusable.length === 0 ? (
                <p className="claw-empty">No triples yet. Keep pulling.</p>
              ) : (
                <ul className="claw-fuse-list">
                  {fusable.map(([key, cards]) => (
                    <li key={key}>
                      <span>Day {cards[0].card.day} · <em>{cards[0].card.rarity}</em> ×{cards.length}</span>
                      <button type="button" className="claw-btn claw-btn-red" disabled={busy} onClick={() => doFusion(cards.slice(0, 3))}>
                        Fuse 3
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'code' && (
            <form onSubmit={doRedeem} className="claw-row">
              <input
                type="text" value={code} onChange={e => setCode(e.target.value)}
                placeholder="ENTER CODE" className="claw-input claw-input-code" disabled={busy}
              />
              <button type="submit" className="claw-btn claw-btn-blue" disabled={busy || !code.trim()}>Redeem</button>
            </form>
          )}

          <AnimatePresence>
            {note && (
              <motion.p
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={note.tone === 'ok' ? 'claw-note-ok' : 'claw-note-err'}
              >
                {note.tone === 'err' && <AlertTriangle size={14} />} {note.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {ageGateCode && (
          <motion.div className="claw-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="claw-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <div className="claw-modal-icon">🔞</div>
              <h3>Age-restricted reward</h3>
              <p className="claw-muted">This reward has age-restricted audio and art. Confirm you’re 18+ to claim it.</p>
              <div className="claw-row">
                <button type="button" className="claw-btn claw-btn-ghost" onClick={() => setAgeGateCode(null)}>Cancel</button>
                <button type="button" className="claw-btn claw-btn-gold" onClick={confirmAge}>I am 18+</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export type { Tab as CounterTab };
