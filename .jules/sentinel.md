
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Hardcoded Fallback Environments
**Vulnerability:** Hardcoded API keys, wallet addresses, and production URLs left as default fallback strings in logical OR (`||`) operators next to environment variables.
**Learning:** During local development, it is a common anti-pattern to hardcode production URLs or dummy keys as fallbacks for `.env` variables to avoid crashes. However, these get statically compiled into the client-side bundle and silently expose production infrastructure or cause confusion when migrating environments.
**Prevention:** Always default to empty strings `""` for environment variable fallbacks instead of functional URLs or keys. Use explicit runtime assertions (like `if (!API_KEY) throw new Error(...)`) that intentionally fail fast to ensure the environment is correctly configured without leaking information.
