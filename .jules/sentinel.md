
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2024-08-30 - Fallback Values for Environment Variables
**Vulnerability:** Fallbacks for environment variables (like API keys, URLs) had hardcoded credentials or dummy keys (e.g., `import.meta.env.VITE_SUPABASE_URL || 'https://production-url...'`).
**Learning:** Using functional values or hardcoded production endpoints as fallbacks for environment variables bypasses runtime assertions (`if (!KEY) throw ...`), potentially leading to unauthorized access, unexpected behaviors, or silent failures.
**Prevention:** Always use empty strings (`''`) or `undefined` as fallback values for environment variables. This ensures runtime checks correctly identify when required configuration is missing, allowing the app to fail fast securely.
