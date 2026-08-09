## 2024-05-31 - [Hardcoded Admin Passphrase]
**Vulnerability:** A plaintext admin passphrase was hardcoded into the client-side JavaScript bundle.
**Learning:** Static client-side gating must never include plaintext secrets, as they are trivially extracted from the bundle or minified source maps by inspection.
**Prevention:** Always use a non-reversible cryptographic hash (e.g., SHA-256) on the client side to compare user input against an expected value. Ensure the original secret is removed entirely from the code, including comments.
