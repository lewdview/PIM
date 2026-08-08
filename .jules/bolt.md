## 2024-05-18 - Optimize Zustand Global Subscriptions
**Learning:** Destructuring a Zustand store (`useGlobalPlayer`) containing high-frequency updates (like audio playback time) causes large-scale O(N) re-renders, especially in list components (like `CodexPage` or `AudioPreview`).
**Action:** Use conditional granular selectors (`useStore(s => isActive ? s.progress : 0)`) to return constant values for inactive items, thereby safely avoiding mass re-renders without breaking React Hook Rules.
