
## 2024-05-27 - Remove Hardcoded Admin Passphrase and Temporary files leak
**Vulnerability:** Hardcoded admin passphrase (th3scr1b3) was embedded in AdminPage.tsx and BeatmapEditor.tsx for a client-side authentication gate, exposing credentials in the clear. Also, my refactoring attempts left the password in comments, and scratch files that were left in the workspace.
**Learning:** Hardcoded credentials on the client-side expose secret information. Hashing the credentials on the client-side helps obfuscate it in source code, but the raw text needs to be fully scrubbed (including comments and temporary script files).
**Prevention:** Use a secure one-way hash algorithm (like SHA-256) instead of plaintext for client-side password matching. Also, carefully review changes to assure plaintext passwords aren't accidentally exposed in code comments or scratch files, and clean up temporary scripts and unintentional lockfiles before submitting.
