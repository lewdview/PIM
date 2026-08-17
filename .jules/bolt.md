## 2023-10-24 - Zustand destructuring anti-pattern
**Learning:** Using `const { prop } = useStore()` in Zustand subscribes the component to the ENTIRE store, causing it to re-render on EVERY update. For stores with high-frequency updates (like audio progress), this causes massive O(N) re-renders across the app.
**Action:** Always use granular selectors (e.g., `useStore(s => s.prop)`) instead of destructured global subscriptions. For list items, use conditional granular selectors (e.g., `useStore(s => (s.currentTrack?.id === id) ? s.progress : 0)`) to prevent re-renders in inactive items.
