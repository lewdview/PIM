## 2024-05-24 - [Extracting High-Frequency Components]
**Learning:** When optimizing Zustand subscriptions (e.g., `useGlobalPlayer`), avoiding destructuring and using granular selectors is not enough if the component subscribes to frequently updating properties (like `progress` or `currentTime`). The entire parent component will still re-render massively.
**Action:** Extract the UI relying on those values into isolated child components (`ProgressBar`, `TimeDisplay`) that independently subscribe to the updates, keeping the parent component render count low.
