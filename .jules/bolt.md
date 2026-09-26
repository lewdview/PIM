## 2023-11-20 - Zustand Destructuring Re-renders
**Learning:** Granular selectors aren't enough when subscribing to volatile properties (e.g. `progress` or `currentTime` during playback). If you extract `useGlobalPlayer` props individually, but the component still needs `progress` and `currentTime`, it'll re-render just as much anyway, and it hurts readability significantly.
**Action:** The right approach when dealing with volatile high-frequency updates from Zustand is often to extract the sub-components reliant on those updates, avoiding re-rendering the larger complex parent component (e.g. isolating the progress bar instead of updating the whole player bar).

## 2024-09-17 - Granular React Components for Volatile Zustand Properties
**Learning:** Even when using granular selectors from a Zustand store (like `useGlobalPlayer`), if the component subscribes to frequently updating properties (like `progress` or `currentTime` during audio playback), the entire component will re-render many times per second. This causes significant performance bottlenecks, especially for components that are used multiple times on a single page or contain complex internal logic.
**Action:** Extract the specific UI elements that rely on these volatile state properties into their own small, isolated child components. Have these child components subscribe directly to the store. This ensures only the tiny UI piece (like a progress bar or time display) re-renders at 60fps, preserving the performance of the complex parent component.
## 2025-01-26 - Optimized Zustand Destructuring
**Learning:** Destructuring variables directly from `useStore()` causes React components to re-render whenever ANY value in the store changes, rather than only when the destructured values change.
**Action:** Use Zustand's selector syntax instead: `const foo = useStore(s => s.foo)` to ensure components only re-render when the specific state they use is modified.
