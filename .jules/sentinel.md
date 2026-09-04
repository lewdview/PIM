
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2024-10-27 - [Sentinel] Remove hardcoded credentials from Supabase client and Firebase config
**Vulnerability:** Supabase URL, Anon Key, and Firebase configurations were hardcoded as fallbacks if environment variables were not set.
**Learning:** Hardcoded credentials even as fallbacks can be leaked in source code and can lead to unauthorized access or unintentional exposure, particularly in open-source or publicly visible repositories. Using functional fallback strings creates noise for security scanners and violates fail-fast principles on missing config.
**Prevention:** Always replace sensitive fallback values with empty strings `""` and ensure the application handles missing configurations correctly by throwing descriptive initialization errors. Ensure scanners do not trigger false positives by completely removing these strings.
