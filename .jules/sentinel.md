## 2025-02-14 - Fix Hardcoded Admin Passphrase
**Vulnerability:** Found a hardcoded plaintext admin passphrase (`th3scr1b3`) in `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Hardcoded secrets in client-side code are easily extracted by inspecting the application bundle. Even for simple admin gates, plaintext passphrases should never be stored in the frontend.
**Prevention:** Always use one-way hashing (e.g., SHA-256 via Web Crypto API) to verify client-side inputs against a hashed constant rather than a plaintext string.
