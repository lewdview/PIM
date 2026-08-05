## 2024-08-05 - Zustand Selectors for High-Frequency State
**Learning:** Using destructuring (`const { progress, currentTime } = useGlobalPlayer()`) on a Zustand store that updates multiple times per second (like an audio player) causes every subscribed component on the page to re-render constantly, even if they aren't the active track.
**Action:** Always use precise inline selectors (`useStore(s => (condition) ? s.val : 0)`) when subscribing to global stores in lists to isolate re-renders strictly to the active component.
