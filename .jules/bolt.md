## 2024-05-18 - Avoid destructuring useStore()
**Learning:** Destructuring the entire Zustand store (e.g. \`const { ... } = useGlobalPlayer();\`) causes the component to re-render whenever ANY property in the store changes. In the case of \`useGlobalPlayer\`, properties like \`progress\` and \`currentTime\` update very frequently (at ~2Hz during playback), causing unnecessary re-renders of the entire component.
**Action:** Always use granular selectors (e.g. \`useGlobalPlayer(s => s.currentTrack)\`) when reading from a Zustand store, especially for high-frequency stores like an audio player.
