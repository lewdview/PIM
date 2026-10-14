// Which remote media files a monthly Playgama build ships, and where each one
// lives inside the archive. Shared by scripts/build-playgama.mjs (which fetches
// the files) and src/platform/playgama/paths.ts (which points the app's CDN
// URLs at the bundled copies), so both sides always agree on the names.

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const pad3 = (n) => String(n).padStart(3, '0');

/** Days (1-365) of the given month, from day_file_map.json. */
export function monthDays(month, dayFileMap) {
  return Object.values(dayFileMap)
    .filter((e) => e && e.month === MONTHS[month - 1])
    .map((e) => e.day)
    .sort((a, b) => a - b);
}

/** The Bombshell artwork a perfect run unlocks for a day: its first full-frame cover. */
export function bombshellFileForDay(day, bombshellMap) {
  const entry = bombshellMap[String(day)];
  return (entry && entry.normalFiles && entry.normalFiles[0]) || (entry && entry.lbFiles && entry.lbFiles[0]) || null;
}

/**
 * One entry per bundled file: `remote` is its path on files.th3scr1b3.art
 * (decoded), `aliases` are other paths the app may ask for the same file
 * under, and `local` is its plain-Latin path inside the archive.
 */
export function monthMediaEntries(month, dayFileMap, bombshellMap, withBombshell) {
  const out = [];
  for (const day of monthDays(month, dayFileMap)) {
    const m = dayFileMap[String(day)];
    if (m.audio) {
      const mp3 = m.audio.replace(/\.wav$/i, '.mp3');
      out.push({ kind: 'audio', day, remote: mp3, aliases: [mp3.replace(/\.mp3$/i, '.wav')], local: `media/audio/d${pad3(day)}.mp3` });
    }
    if (m.cover) {
      out.push({ kind: 'cover', day, remote: m.cover, aliases: [m.cover.replace(/\.jpe?g$/i, '.png')], local: `media/cover/d${pad3(day)}.jpg` });
    }
    const bs = withBombshell ? bombshellFileForDay(day, bombshellMap) : null;
    if (bs) {
      out.push({
        kind: 'bombshell',
        day,
        remote: `rare_covers/day ${day}/${bs}`,
        aliases: [`girl-covers/days/day ${day}/${bs}`],
        local: `media/bombshell/d${pad3(day)}.jpg`,
      });
    }
  }
  return out;
}
