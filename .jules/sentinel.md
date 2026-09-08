
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-14 - Fix Hardcoded Admin Passphrase in adminConfig.ts
**Vulnerability:** A hardcoded admin passphrase was found in `src/utils/adminConfig.ts` when making a call to `vault-engine`.
**Learning:** This existed to sync the admin config to the backend edge function, which apparently requires the plaintext passphrase to authenticate.
**Prevention:** Hardcoded secrets should never be embedded in the client code bundle. The plaintext secret must be dynamically provided at runtime (e.g., from `sessionStorage` populated during manual admin login) to prevent it from leaking in the static client build while still satisfying the edge function's authentication requirements.
