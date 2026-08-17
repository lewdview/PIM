1. **Fix `useGlobalPlayer` destructuring in `src/components/AudioPreview.tsx`**
   - The memory warns about destructuring in list components causing massive re-renders. We should change `const { currentTrack, isPlaying: globalPlaying, progress, currentTime, duration, toggle: globalToggle } = useGlobalPlayer();` to use granular selectors.
   - For `progress`, `currentTime`, and `duration`, we should conditionally select them: `const progress = useGlobalPlayer(s => isThisTrack ? s.progress : 0);`. Wait, `isThisTrack` depends on `currentTrack`.
   - We can do:
     ```typescript
     const currentTrack = useGlobalPlayer(s => s.currentTrack);
     const isThisTrack = currentTrack?.audioUrl === audioUrl && currentTrack?.day === day;
     const globalPlaying = useGlobalPlayer(s => isThisTrack ? s.isPlaying : false);
     const progress = useGlobalPlayer(s => isThisTrack ? s.progress : 0);
     const currentTime = useGlobalPlayer(s => isThisTrack ? s.currentTime : 0);
     const duration = useGlobalPlayer(s => isThisTrack ? s.duration : 0);
     const globalToggle = useGlobalPlayer(s => s.toggle);
     const globalPlay = useGlobalPlayer(s => s.play);
     ```
     This perfectly satisfies the condition "use conditional granular selectors to return constant values for inactive items."

2. **Fix `useGlobalPlayer` destructuring in `src/App.tsx`**
   - Replace `const { currentTrack } = useGlobalPlayer();` with `const currentTrack = useGlobalPlayer(s => s.currentTrack);`.

3. **Fix `useGlobalPlayer` destructuring in `src/pages/CodexPage.tsx`**
   - Replace `const { currentTrack, isPlaying, play, pause, stop } = useGlobalPlayer();` with individual granular selectors.
     ```typescript
     const currentTrack = useGlobalPlayer(s => s.currentTrack);
     const isPlaying = useGlobalPlayer(s => s.isPlaying);
     const play = useGlobalPlayer(s => s.play);
     const pause = useGlobalPlayer(s => s.pause);
     const stop = useGlobalPlayer(s => s.stop);
     ```

4. **Fix `useGlobalPlayer` destructuring in `src/pages/RhythmHome.tsx`**
   - Replace `const { currentTrack } = useGlobalPlayer();` with `const currentTrack = useGlobalPlayer(s => s.currentTrack);`.

5. **Fix `useGlobalPlayer` destructuring in `src/components/GlobalPlayerBar.tsx`**
   - Same issue, it destructures the whole state: `const { currentTrack, isPlaying, progress, currentTime, duration, toggle, stop, seek } = useGlobalPlayer();`
   - Refactor to granular selectors to prevent full-state re-renders, though this component only mounts once. Still good practice.
     ```typescript
     const currentTrack = useGlobalPlayer(s => s.currentTrack);
     const isPlaying = useGlobalPlayer(s => s.isPlaying);
     const progress = useGlobalPlayer(s => s.progress);
     const currentTime = useGlobalPlayer(s => s.currentTime);
     const duration = useGlobalPlayer(s => s.duration);
     const toggle = useGlobalPlayer(s => s.toggle);
     const stop = useGlobalPlayer(s => s.stop);
     const seek = useGlobalPlayer(s => s.seek);
     ```

6. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
