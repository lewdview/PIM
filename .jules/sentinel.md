
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Functional Dummy API Keys
**Vulnerability:** Dummy strings used as fallbacks for API keys in configuration files (e.g., `import.meta.env.VITE_API_KEY || "dummy_api_key"`) were triggering false positives in automated secret scanners and preventing runtime failure on missing configuration.
**Learning:** Using placeholder strings as fallbacks for required environment variables is a poor practice. It circumvents the fail-fast principle where missing configuration should explicitly fail rather than silently falling back to an invalid functional state, and it introduces unnecessary noise for security scanning tools.
**Prevention:** Always default missing environment variables to empty strings `""` or `undefined`. This ensures any runtime assertions will throw errors appropriately and avoids automated scanner false alarms.
