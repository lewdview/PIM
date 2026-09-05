
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-14 - Initialize Journal
**Vulnerability:** N/A
**Learning:** Initialize Sentinel journal.
**Prevention:** N/A

## 2025-02-14 - Removed hardcoded admin passphrase
**Vulnerability:** A hardcoded plaintext admin passphrase (`th3scr1b3`) was being included in the frontend bundle inside `src/utils/adminConfig.ts`, exposing it to anyone inspecting the client-side code.
**Learning:** Hardcoding credentials that are synchronized with the backend poses a critical security risk. When client-side hashing is used (e.g., `ADMIN_PASSPHRASE_HASH`), the plaintext must never be statically embedded in the code.
**Prevention:** Store sensitive values dynamically using secure runtime storage mechanisms like `sessionStorage`, ensuring they are removed from static config files and client-side bundles. Always use fallback mechanisms (e.g., empty strings) with environment safety checks (`typeof window !== 'undefined'`) for non-browser environments.
