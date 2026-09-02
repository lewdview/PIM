## 2024-05-18 - [Zustand High-Frequency Re-renders]
**Learning:** Destructuring entire Zustand stores or subscribing to high-frequency updates (like progress/currentTime) directly in large components causes massive unnecessary re-renders. Conditional selectors relying on external component variables create hook dependency issues and stale closures.
**Action:** Always use granular selectors. For high-frequency state, extract dependent UI into isolated child components. For conditional selectors, evaluate the condition internally using the store's state.
