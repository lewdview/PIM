## 2024-05-18 - [Optimizing Zustand subscriptions in GlobalPlayerBar]
**Learning:** Extracting components and granular Zustand selectors allows to prevent huge parent component from re-rendering multiple times per second due to high-frequency state updates like progress or currentTime.
**Action:** Identify and optimize global state selectors that are updated very frequently (e.g. progress from a timeupdate event).
