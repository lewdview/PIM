
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-28 - Hardcoded Admin Passphrase in API Call
**Vulnerability:** A hardcoded admin passphrase (`th3scr1b3`) was found in `src/utils/adminConfig.ts` within the `saveAdminConfig` function to authenticate requests to the backend Edge Function `vault-engine`.
**Learning:** Hardcoded credentials on the client-side expose sensitive administrative capabilities to users and attackers examining the client bundle. Since the edge function needs this plaintext secret, using a temporary user-entered storage element provides a pragmatic tradeoff compared to exposing it in source.
**Prevention:** Avoid placing authentication secrets statically inside the frontend application. If required by backend edge functions, retrieve them dynamically from authenticated user contexts or temporary short-lived storage variables populated through secure gateways (e.g., `sessionStorage`).
