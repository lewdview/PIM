## 2026-09-04 - Granular Zustand Selectors for High-Frequency Updates
**Learning:** Component `GlobalPlayerBar` destructured the entire `useGlobalPlayer` Zustand store. In a global player where variables like `progress` and `currentTime` are updated roughly 60 times a second, this causes the entire component to rapidly re-render.
**Action:** Always use granular selectors for Zustand stores, particularly when dealing with frequently updated state properties. Use `const prop = useStore(s => s.prop)` instead of destructuring `const { prop } = useStore()`.
