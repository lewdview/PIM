## 2023-11-20 - Zustand Destructuring Re-renders
**Learning:** Granular selectors aren't enough when subscribing to volatile properties (e.g. `progress` or `currentTime` during playback). If you extract `useGlobalPlayer` props individually, but the component still needs `progress` and `currentTime`, it'll re-render just as much anyway, and it hurts readability significantly.
**Action:** The right approach when dealing with volatile high-frequency updates from Zustand is often to extract the sub-components reliant on those updates, avoiding re-rendering the larger complex parent component (e.g. isolating the progress bar instead of updating the whole player bar).
## 2024-03-24 - AudioPreview Re-renders Fixed
**Learning:** Extracting complex components dependent on high-frequency state updates like `progress` into separate memoized subcomponents is crucial for maintaining performance and preventing excessive re-renders.
**Action:** Always check if a component subscribing to a volatile state update can be broken down into smaller components that only subscribe to the parts they strictly need.
