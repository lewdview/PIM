## 2025-05-18 - First entry\n**Learning:** Just starting\n**Action:** Let's find performance issues.
## 2025-05-18 - Zustand O(N) Re-render Anti-pattern
**Learning:** Destructured Zustand subscriptions (e.g. `const { progress } = useGlobalPlayer()`) in list components cause O(N) re-renders during high-frequency updates like audio playback.
**Action:** Always use conditional granular selectors (e.g. `useStore(s => isActive ? s.progress : 0)`) for high-frequency state in list items to return constant values for inactive items.
