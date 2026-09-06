
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2024-09-06 - Firebase API Key Fallback Fix
**Vulnerability:** Found hardcoded fallback strings for Firebase API Key ("AIzaSy_dummy_api_key_replace_me") and App ID in src/lib/firebase.ts which could trigger false positives in secret scanners and prevent runtime assertions from catching missing environment variables.
**Learning:** Setting non-empty fallback strings for environment variables (like "dummy_api_key") masks the absence of actual credentials, which can cause subtle initialization bugs in production instead of failing fast. It also creates unnecessary noise for automated security scanning tools looking for "AIzaSy" patterns.
**Prevention:** Always fallback to empty strings `""` or `undefined` for `import.meta.env` variables in configuration files, as specified in the memory guidelines. This ensures fast failures during runtime and avoids secret-scanner noise.
