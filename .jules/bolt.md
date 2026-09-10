## YYYY-MM-DD - [GlobalPlayerBar Re-renders]
**Learning:** Destructuring global store state (`useGlobalPlayer()`) causes the entire component to re-render whenever *any* property in the store changes. The `GlobalPlayerBar` is subscribing to highly volatile properties like `progress` and `currentTime` by destructuring.
**Action:** Use granular selectors for store properties to avoid unnecessary O(N) or rapid re-renders across the whole component.
