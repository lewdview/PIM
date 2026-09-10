## 2024-05-24 - Avoid unread variables
**Learning:** When making code changes, avoid creating variables that are set but never read/used, as this can cause strict linting environments to fail.
**Action:** Always clean up unused variables, such as UI loading states that aren't actually mapped to any visible components.
