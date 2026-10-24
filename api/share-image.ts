/**
 * /api/share-image?id=...: the 1200x630 card link previews show for a share
 * link (see s.ts). Plain element objects instead of JSX, so the function needs
 * no JSX setup.
 */
import { ImageResponse } from '@vercel/og';
import { MEDAL_COLOR, monthOf, readRun } from './_shareRun';

export const config = { runtime: 'edge' };

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter((c) => c !== null && c !== false) },
});

function chip(text: string, bg: string, fg = '#0a0a0a') {
  return h('div', { alignItems: 'center', padding: '8px 18px', borderRadius: 999, background: bg, color: fg, fontSize: 22, fontWeight: 700, letterSpacing: 2 }, text);
}

export default async function handler(req: Request): Promise<Response> {
  const run = await readRun(new URL(req.url));
  if (!run) return new Response('Not found', { status: 404 });
  const color = MEDAL_COLOR[run.medal];
  const medal = run.medal === 'NONE' ? 'CLEAR' : run.medal;

  const tree = h('div', { width: '100%', height: '100%', background: '#07060a', color: '#fff', fontFamily: 'sans-serif' },
    h('div', { width: 630, height: 630, position: 'relative', background: '#16131c' },
      run.cover ? { type: 'img', props: { src: run.cover, width: 630, height: 630, style: { objectFit: 'cover' } } } : null,
      h('div', { position: 'absolute', right: 24, bottom: 24, width: 150, height: 150, borderRadius: 999, background: '#0a0a0a', border: `8px solid ${color}`, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
        h('div', { fontSize: 22, fontWeight: 700, color, letterSpacing: 2 }, medal)),
    ),
    h('div', { flex: 1, flexDirection: 'column', padding: '48px 48px 40px', borderLeft: `8px solid ${color}` },
      h('div', { fontSize: 24, color: '#00E5FF', letterSpacing: 4, fontWeight: 700 }, `PIM · DAY ${run.day} · ${monthOf(run.date).toUpperCase()}`),
      h('div', { fontSize: run.title.length > 22 ? 52 : 66, fontWeight: 800, lineHeight: 1.05, marginTop: 18 }, run.title),
      h('div', { fontSize: 96, fontWeight: 800, color, marginTop: 'auto' }, run.score.toLocaleString('en-US')),
      h('div', { fontSize: 30, color: 'rgba(255,255,255,0.75)', marginTop: 4 }, `${run.accuracy}% accuracy · ${run.combo}x combo`),
      h('div', { gap: 12, marginTop: 22 },
        run.fullCombo ? chip('FULL COMBO', '#39FF14') : null,
        run.deluxe ? chip('DELUXE', '#FF1493', '#fff') : null,
        chip('CAN YOU BEAT IT?', 'rgba(255,255,255,0.12)', '#fff'),
      ),
      h('div', { fontSize: 22, color: 'rgba(255,255,255,0.5)', marginTop: 26 }, 'th3scr1b3 · 365 Days of Light and Dark'),
    ),
  );

  return new ImageResponse(tree as unknown as ConstructorParameters<typeof ImageResponse>[0], {
    width: 1200,
    height: 630,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' },
  });
}
