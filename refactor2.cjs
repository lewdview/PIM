const fs = require('fs');

let content = fs.readFileSync('src/components/GlobalPlayerBar.tsx', 'utf8');

// Replace standard destructuring
const destructuringBlock = `  const {
    currentTrack,
    playlist,
    isPlaying,
    progress,
    currentTime,
    duration,
    loopMode,
    shuffle,
    toggle,
    stop,
    seek,
    nextTrack,
    previousTrack,
    toggleShuffle,
    setLoopMode,
  } = useGlobalPlayer();`;

const replacementSelectors = `  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const playlist = useGlobalPlayer(s => s.playlist);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const duration = useGlobalPlayer(s => s.duration);
  const loopMode = useGlobalPlayer(s => s.loopMode);
  const shuffle = useGlobalPlayer(s => s.shuffle);
  const toggle = useGlobalPlayer(s => s.toggle);
  const stop = useGlobalPlayer(s => s.stop);
  const nextTrack = useGlobalPlayer(s => s.nextTrack);
  const previousTrack = useGlobalPlayer(s => s.previousTrack);
  const toggleShuffle = useGlobalPlayer(s => s.toggleShuffle);
  const setLoopMode = useGlobalPlayer(s => s.setLoopMode);`;

if (content.includes(destructuringBlock)) {
    content = content.replace(destructuringBlock, replacementSelectors);
}

// Add ProgressBar and TimeDisplay components at the top (after formatTime)
const componentsToAdd = `

const ProgressBar = ({ accent }: { accent: string }) => {
  const progress = useGlobalPlayer(s => s.progress);
  const seek = useGlobalPlayer(s => s.seek);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  };

  return (
    <div
      onClick={handleSeek}
      style={{
        height: '3px',
        background: 'rgba(255,255,255,0.06)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <motion.div
        style={{
          height: '100%',
          width: \`\${progress * 100}%\`,
          background: \`linear-gradient(90deg, \${accent}, \${accent}cc)\`,
          boxShadow: \`0 0 8px \${accent}60\`,
          transition: 'width 0.3s linear',
        }}
      />
    </div>
  );
};

const TimeDisplay = ({ effectiveDuration }: { effectiveDuration: number }) => {
  const currentTime = useGlobalPlayer(s => s.currentTime);
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '8px',
      color: 'rgba(255,255,255,0.3)',
    }}>
      {formatTime(currentTime)} / {formatTime(effectiveDuration)}
    </span>
  );
};
`;

const formatTimeBlock = `function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return \`\${m}:\${s.toString().padStart(2, '0')}\`;
}`;

if (content.includes(formatTimeBlock)) {
    content = content.replace(formatTimeBlock, formatTimeBlock + componentsToAdd);
}

// Remove the old handleSeek inside GlobalPlayerBar
const handleSeekBlock = `  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  };`;

if (content.includes(handleSeekBlock)) {
    content = content.replace(handleSeekBlock, '');
}

// Replace ProgressBar UI
const progressBarUI = `{/* Progress bar — clickable */}
        <div
          onClick={handleSeek}
          style={{
            height: '3px',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              width: \`\${progress * 100}%\`,
              background: \`linear-gradient(90deg, \${accent}, \${accent}cc)\`,
              boxShadow: \`0 0 8px \${accent}60\`,
              transition: 'width 0.3s linear',
            }}
          />
        </div>`;

if (content.includes(progressBarUI)) {
    content = content.replace(progressBarUI, `{/* Progress bar — clickable */}
        <ProgressBar accent={accent} />`);
}

// Replace Time UI
const timeUI = `<span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                color: 'rgba(255,255,255,0.3)',
              }}>
                {formatTime(currentTime)} / {formatTime(effectiveDuration)}
              </span>`;

if (content.includes(timeUI)) {
    content = content.replace(timeUI, `<TimeDisplay effectiveDuration={effectiveDuration} />`);
}

fs.writeFileSync('src/components/GlobalPlayerBar.tsx', content);
console.log('Refactoring complete.');
