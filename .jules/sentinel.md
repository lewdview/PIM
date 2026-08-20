## 2024-05-18 - Hardcoded Admin Passphrase in Client-Side Code
**Vulnerability:** Found a hardcoded plaintext admin passphrase (`th3scr1b3`) used for client-side authentication gating in `AdminPage.tsx` and `BeatmapEditor.tsx`.
**Learning:** Storing plain text passphrases directly in the front-end code allows any user to inspect the source and extract the credential, bypassing the intended security gate.
**Prevention:** Use a client-side hashing mechanism (like `crypto.subtle` for SHA-256) to verify the user input against a pre-computed hash. Never store the plaintext passphrase in the client bundle.
