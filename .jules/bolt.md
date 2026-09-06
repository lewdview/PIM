## 2024-05-18 - [Avoid object destructuring in Zustand stores]
**Learning:** Destructuring the entire store object (e.g. `const { a, b } = useStore()`) causes the component to re-render whenever *any* property in the store changes.
**Action:** Always use individual, granular selectors (e.g. `const a = useStore(s => s.a)`) to restrict subscriptions solely to the properties the component utilizes.
