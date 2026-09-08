
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-05-24 - [Remove Hardcoded Passphrase Sync in adminConfig]
**Vulnerability:** A hardcoded plaintext admin passphrase (`th3scr1b3`) was being passed in the payload of a `supabase.functions.invoke` call in `src/utils/adminConfig.ts`.
**Learning:** Hardcoded credentials should not be present in background sync functions.
**Prevention:** Always pull credentials securely (like from `sessionStorage` where the authenticated session stores it) or handle authorization securely without exposing raw secrets in code.
