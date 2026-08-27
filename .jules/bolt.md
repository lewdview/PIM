## 2025-02-20 - GlobalPlayerBar Store Destructuring Fix
**Learning:** Found an anti-pattern where components using Zustand stores were destructuring the entire store object (e.g., \`const { a, b } = useGlobalPlayer()\`) instead of using granular selectors (\`const a = useGlobalPlayer(s => s.a)\`). This causes massive React re-renders when high-frequency state updates like \`timeupdate\` occur.
**Action:** Always replace entire store destructuring with granular selectors in components subscribed to frequently updated properties like \`useGlobalPlayer\`.
