/**
 * /s/<songId>?... (rewritten here by vercel.json): a share link for one run.
 * Link previews read the Open Graph tags (the card comes from share-image.ts);
 * people who open it go straight to the song.
 */
import { headline, monthOf, readRun } from './_shareRun';

export const config = { runtime: 'edge' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const run = await readRun(url);
  if (!run) return Response.redirect(new URL('/', url.origin), 302);

  const play = new URL(`/play/${run.playId}`, url.origin).toString();
  // req.url is the rewritten /api/s?id=...; previews should name the /s/ link.
  const link = new URL(`/s/${url.searchParams.get('id')}`, url.origin);
  const image = new URL('/api/share-image', url.origin);
  url.searchParams.forEach((v, k) => {
    image.searchParams.set(k, v);
    if (k !== 'id') link.searchParams.set(k, v);
  });
  const title = `${headline(run)} | PIM`;
  const description = `Day ${run.day} of 365 Days of Light and Dark by th3scr1b3 (${monthOf(run.date)}). ${run.accuracy}% accuracy, ${run.combo}x combo${run.fullCombo ? ', full combo' : ''}. Can you beat it?`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PIM: Poetry in Motion">
<meta property="og:url" content="${esc(link.toString())}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image.toString())}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image.toString())}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${esc(play)}">
</head>
<body style="background:#07060a;color:#fff;font-family:system-ui,sans-serif">
<p><a href="${esc(play)}" style="color:#00E5FF">Play "${esc(run.title)}" in PIM</a></p>
<script>location.replace(${JSON.stringify(play)})</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=86400' },
  });
}
