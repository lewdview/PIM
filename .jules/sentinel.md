
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Hardcoded API Key Fallbacks Bypass Assertions
**Vulnerability:** In backend integration files (e.g., `src/services/supabaseClient.ts` and `src/lib/firebase.ts`), environment variables used hardcoded functional or dummy string fallbacks instead of safely failing.
**Learning:** Hardcoding active endpoints or arbitrary dummy values directly in fallback expressions (e.g., `|| 'https://api...'`) masks configuration errors. It bypasses essential runtime validations like `if (!KEY) throw new Error(...)` and risks accidentally executing API calls using unintended or globally visible credentials.
**Prevention:** Always default to empty strings (`""`) or `undefined` for fallback values of sensitive environment variables in configuration files, ensuring that subsequent runtime assertions strictly fail-fast when the necessary variables are missing from the build.
