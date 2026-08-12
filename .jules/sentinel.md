## 2024-05-18 - [Hardcoded Admin Passphrase]
**Vulnerability:** A hardcoded admin passphrase ('th3scr1b3') was found in multiple files, including client-side validation logic.
**Learning:** Even for frontend-only admin gating, placing plaintext secrets in the source code exposes them in the production bundle.
**Prevention:** Use a secure hashing algorithm (like SHA-256 via Web Crypto API) to hash the expected passphrase and compare the hash of the user input against the stored hash.
