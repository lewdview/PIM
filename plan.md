1. **Refactor `GlobalPlayerBar.tsx`**
   - The `GlobalPlayerBar` destructures all values from `useGlobalPlayer()`, including high-frequency states like `progress` and `currentTime`. This means the *entire* player bar, which includes multiple buttons, tooltips, images, and layout calculations, re-renders frequently (e.g. 4+ times a second during playback, or more depending on timeupdate frequency).
   - As indicated by memory, "avoiding destructuring and using granular selectors is not enough if the component subscribes to frequently updating properties (like `progress` or `currentTime`). To prevent massive re-renders of complex parent components during high-frequency events (like `timeupdate`), extract the UI relying on those values into isolated child components that independently subscribe to the updates."
   - I will extract the progress bar (`ProgressBar`) and the time display (`TimeDisplay`) into their own child components inside `GlobalPlayerBar.tsx`.
   - I will update `GlobalPlayerBar` to use granular selectors for the state it actually needs (e.g. `currentTrack`, `isPlaying`, etc.) and remove the full destructuring.

2. **Add a Journal Entry for Bolt**
   - Record the learning that separating high-frequency state updates (like audio progress) into small child components is required when using Zustand to prevent parent component re-rendering overhead.

3. **Verify the Changes**
   - Run `pnpm install` if needed, then `pnpm typecheck` and `pnpm build`.
   - Start the dev server and make sure the audio player bar still works correctly.

4. **Complete Pre-Commit Steps**
   - Call `pre_commit_instructions` to ensure proper testing, verification, review, and reflection are done.

5. **Submit PR**
   - Branch: `perf-player-bar-re-renders`
   - Title: `⚡ Bolt: Optimize GlobalPlayerBar re-renders`
