
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Hardcoded Admin Passphrase Removal in Config Sync
**Vulnerability:** A hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/utils/adminConfig.ts` for background API synchronization.
**Learning:** Even if a primary auth gate is secured, secondary background services or silent sync functions in utility files can inadvertently leak secrets if they hardcode the required payload instead of reading it dynamically from temporary storage.
**Prevention:** Always rely on secure temporary storage (like `sessionStorage` post-authorization) to pass required plaintext payloads to backend services, avoiding hardcoded secrets entirely in the JS bundle.
