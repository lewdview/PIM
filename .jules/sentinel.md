## 2024-08-06 - Hardcoded Admin Passphrase
**Vulnerability:** Found plaintext admin passphrase (`th3scr1b3`) hardcoded directly in `AdminPage.tsx` and `BeatmapEditor.tsx` components.
**Learning:** Frontend gating is inherently insecure, but storing the plaintext password in the bundle makes it trivial to bypass without execution by simply reading the source.
**Prevention:** Instead of plaintext strings, use client-side hashing (like Web Crypto API SHA-256) to compare user input against a hardcoded hash.
