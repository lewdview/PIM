## 2026-08-06 - [Zustand O(N) Re-render Pitfall]
**Learning:** [Destructuring Zustand state (e.g. `const { progress } = useStore()`) causes entire components to re-render on ANY store change. In lists like AudioPreview, this creates O(N) re-renders on high-frequency time updates.]
**Action:** [Use granular selectors (e.g. `useStore(s => s.progress)`). For list items, use conditional selectors (e.g. `useStore(s => isPlaying ? s.progress : 0)`) to return constants for inactive items, turning O(N) re-renders into O(1).]
