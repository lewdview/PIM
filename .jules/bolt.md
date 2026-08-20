## 2024-06-25 - Safe Zustand Extraction
**Learning:** When using script-based find-and-replace to extract UI into a child component and replace its usage in the parent JSX, naive global replacements can accidentally replace text inside the newly created component, causing recursive `<Component>` rendering leading to a Stack Overflow crash.
**Action:** Always replace the old text specifically in the parent component's body, or use strict multi-line exact matches, to avoid accidental circular rendering definitions.
