## 2026-08-16 - Fix Hardcoded Admin Passphrases
**Vulnerability:** Plaintext admin passphrase 'th3scr1b3' was hardcoded in multiple components and passed as plaintext in API payload.
**Learning:** Required client-side hashes (SHA-256) instead of plaintext, but also needed a mechanism (like sessionStorage) to temporarily hold the plaintext for backend APIs that expect it, otherwise replacing it breaks functionality.
**Prevention:** Avoid hardcoding credentials. Use a combination of hashed verification on the frontend and temporary session storage caching for authenticated API payloads.
