/**
 * /audius/reveal — preview of the weekly Audius card and its claim reveals.
 *
 * Uses this week's first contest song (and Wren's art when it exists) so the
 * cards look like the real thing. Nothing is claimed here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import Card from '@/components/Card';
import AudiusClaimReveal from '@/components/audius/AudiusClaimReveal';
import { findCardWithFallback, type VaultCard } from '@/services/vaultService';
import { registerAudiusCards } from '@/lib/audiusCardRegistry';
import { fetchContest, fetchContestArt, weekStart, type ContestTrack } from '@/lib/audiusContest';

const SAMPLE: ContestTrack = {
  id: 'preview',
  title: 'Sample Track',
  artist: 'Audius Artist',
  handle: 'audius',
  permalink: '',
  duration: 180,
  artwork: '/og-image.jpg',
  genre: 'Electronic',
};

export default function AudiusRevealPreview() {
  const [cards, setCards] = useState<{ standard: VaultCard; deluxe: VaultCard; artist: string } | null>(null);
  const [playing, setPlaying] = useState<VaultCard | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const week = weekStart();
      let track = SAMPLE;
      let art: Record<string, string> = {};
      try {
        const contest = await fetchContest(week);
        if (contest?.tracks?.[0]) track = contest.tracks[0];
        art = await fetchContestArt(week);
      } catch {
        /* sample card */
      }
      const base = { trackId: track.id, title: track.title, artist: track.artist, permalink: track.permalink, genre: track.genre, weekStart: week };
      registerAudiusCards([
        { ...base, cardId: `aud-${track.id}`, deluxe: false, coverUrl: art[`aud-${track.id}`] || track.artwork || '/og-image.jpg' },
        { ...base, cardId: `bombshell-aud-${track.id}`, deluxe: true, coverUrl: art[`aud-${track.id}_deluxe`] || art[`aud-${track.id}`] || track.artwork || '/og-image.jpg' },
      ]);
      if (!live) return;
      setCards({
        standard: findCardWithFallback([], `aud-${track.id}`, 'rare'),
        deluxe: findCardWithFallback([], `bombshell-aud-${track.id}`, 'legendary'),
        artist: track.artist,
      });
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto text-white">
      <h1 className="font-black uppercase tracking-tight text-2xl mb-1">Weekly Audius card reveals</h1>
      <p className="font-mono text-xs uppercase tracking-wider text-white/50 mb-8">
        Preview only, nothing is claimed. <Link href="/audius" className="underline">Back to Audius</Link>
      </p>
      {cards ? (
        <div className="grid grid-cols-2 gap-6">
          {(['standard', 'deluxe'] as const).map((k) => (
            <div key={k} className="flex flex-col gap-3">
              <Card card={cards[k]} />
              <button type="button" className="btn-3d" data-tone={k === 'deluxe' ? 'gold' : 'cyan'} onClick={() => setPlaying(cards[k])} data-testid={`play-${k}`}>
                Play {k === 'deluxe' ? 'Deluxe' : 'regular'} reveal
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-64 animate-pulse bg-white/5 rounded-lg" />
      )}
      {playing && cards && (
        <AudiusClaimReveal
          cardId={playing.id}
          card={playing}
          artist={cards.artist}
          onClose={() => setPlaying(null)}
          onViewCollection={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
