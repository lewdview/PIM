
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2023-10-27 - [Hardcoded Admin Passphrase in Background API Call]
**Vulnerability:** A hardcoded plaintext admin passphrase (`th3scr1b3`) was exposed in `src/utils/adminConfig.ts` inside a background API syncing function (`supabase.functions.invoke`).
**Learning:** Even if the main admin UI authentication relies on hashing the passphrase, background tasks or utility functions triggered from the client sometimes require the plaintext passphrase to authenticate with backend edge functions. Hardcoding it directly in the source file exposes it to anyone inspecting the frontend bundle.
**Prevention:** Rather than hardcoding the passphrase in the client bundle, securely route the plaintext passphrase via `sessionStorage` (e.g., retrieving it during manual login) to authenticate background tasks, removing the hardcoded value while maintaining functional edge function requests. Always ensure dummy API keys are replaced with empty strings (`""`) to prevent secret scanners from raising false positives and to enable fast-fail runtime assertions.
