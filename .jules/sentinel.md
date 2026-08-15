## 2026-08-15 - [Hardcoded Admin Passphrase]
**Vulnerability:** Hardcoded admin passphrase `'th3scr1b3'` was exposed in plaintext on the frontend.
**Learning:** Using `crypto.subtle` allows replacing the plaintext passphrase with an SHA-256 hash. If backend requires the plaintext string, it must be stored dynamically (e.g., in `sessionStorage`) at login, rather than hardcoded. Watch out for unintended generated files like `pnpm-lock.yaml` when running `pnpm install`.
**Prevention:** Always hash frontend secrets and only pass plain text dynamically from login context. Verify `git diff` for unexpected artifacts.
