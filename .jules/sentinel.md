
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-27 - Hardcoded Admin Passphrase Removal in Admin Config
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase (`th3scr1b3`) was being sent directly in the source code within `src/utils/adminConfig.ts` to a background API function (`vault-engine`).
**Learning:** Hardcoding passphrases or API credentials in utility files exposes them immediately when the client bundle is generated, entirely bypassing client-side gate mechanisms (like password fields or hash comparisons).
**Prevention:** Rather than keeping the credential raw in the source files, dynamically fetch the authenticated secret from `sessionStorage` (where it was deposited by the Admin Gate following a successful hash match). Default to empty strings or fallbacks that gracefully fail the server-side authentication without exposing static credentials in the repo.
