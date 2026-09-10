
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2023-10-27 - Restoring Vite Config Issues
**Vulnerability:** A missing lucide-react icon export (`Github`) and missing workspace configuration caused the application to fail to build when running verification commands.
**Learning:** Build verification errors, especially from unrelated files, should be treated with extreme caution, and care should be taken to ensure they don't leak into the final PR if they modify unrelated files, which leads to large and noisy PRs.
**Prevention:** Rather than applying aggressive sed replacements or installing incorrect dependency versions, isolate the change. Reset files with `git checkout` after verification is completed, retaining only the actual security patch for the PR.
