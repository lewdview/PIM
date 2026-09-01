## 2025-05-18 - Avoid Zustand Store Destructuring
**Learning:** Destructuring a Zustand store (`const { a, b } = useStore()`) causes the component to re-render whenever *any* property in the store changes, even those not utilized. While the component still re-renders on properties it does select (like `progress`), using granular selectors protects it from massive re-renders triggered by unrelated state updates.
**Action:** Always use individual, granular selectors (e.g., `const a = useStore(s => s.a)`) or `useShallow` when pulling from a Zustand store.
