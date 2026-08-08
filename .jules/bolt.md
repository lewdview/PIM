## 2024-08-04 - React.memo for complex card components
**Learning:** Highly visual and complex components like `Card` that are heavily used in grid/list views (e.g. `CollectionPage`, `ForgePage`) cause significant, expensive re-renders across the application when parent state changes.
**Action:** Always wrap these heavy presentational components in `React.memo()` to prevent unnecessary re-renders, especially when their props are mostly primitives or stable object references.
