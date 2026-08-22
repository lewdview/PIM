
## 2024-05-18 - Hardcoded Admin Passphrase using Web Crypto API Hash
**Vulnerability:** The admin passphrase for gating the `AdminPage` and `BeatmapEditor` was hardcoded in plaintext (`th3scr1b3`) directly in the source code, allowing any user inspecting the bundle to bypass the admin check.
**Learning:** For purely frontend-gated admin panels where backend verification is separated or requires the plaintext passphrase anyway, hashing the expected value prevents casual exposure in the bundle.
**Prevention:** Always hash passphrases (e.g., using `window.crypto.subtle.digest('SHA-256')`) when doing client-side verification instead of comparing against plaintext strings. Keep secure contexts in mind when relying on Web Crypto API.
