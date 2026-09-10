
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Hardcoded API Fallbacks Bypass Assertions
**Vulnerability:** A critical security practice failure where hardcoded production API keys (e.g. Supabase, Firebase) or dummy keys containing truthy values were used as fallback values in configuration files when environment variables were missing.
**Learning:** Fallback dummy strings or hardcoded production endpoints bypass runtime fail-fast assertions (e.g. `if (!KEY) throw new Error(...)`), leading to unexpected application behavior, exposing sensitive credentials in source code, and triggering false positive alerts in automated secret scanners.
**Prevention:** Always default to empty strings `""` or `undefined` for sensitive environment variables in configuration files. Never include raw credentials in JS bundles. This forces developers to use `.env` files correctly and keeps the bundle clean of secrets.
