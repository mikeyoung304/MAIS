# Video Player, Progressive Reveal & Accessibility Patterns

Research compiled 2026-02-20. Actionable recommendations for onboarding flow.

## Video Player

### Muted Autoplay (Browser-Safe)

- **Required attrs:** `autoplay muted loop playsinline` -- all four for cross-browser safety.
- Chrome allows muted autoplay unconditionally. Safari iOS requires `playsinline`. Firefox allows autoplay when no audio track or `muted`.
- Never rely on unmuted autoplay. Design video content to work in silence.
- Detect autoplay failure: call `video.play()`, catch the rejected Promise, show poster + play button fallback.

### Skip Button

- Position: bottom-right overlay, visible after 3s delay. Minimum 44x44px tap target.
- Keyboard: `tabindex="0"`, `Enter`/`Space` to activate. Auto-focus skip button when it appears.
- Label: "Skip video" (not just "Skip"). `aria-label="Skip onboarding video"`.

### Video Hosting & Format

- **For <20MB / 720p / 30-60s onboarding clips:** plain MP4 (H.264 + AAC) served from CDN is sufficient. No HLS/DASH needed.
- Encode at CRF 23-28, 720p, 30fps. Target <8MB for 30s clip. Use `ffmpeg -crf 26 -preset slow`.
- Host on existing CDN (Cloudflare R2, S3+CloudFront, or Vercel Blob). Avoid self-hosting from origin.
- Set `Cache-Control: public, max-age=31536000, immutable` with content-hash filenames.

### Poster & prefers-reduced-motion

- Always set `poster="thumbnail.webp"` -- shown before playback and on load failure.
- `@media (prefers-reduced-motion: reduce)`: hide `<video>`, show poster `<img>` with alt text instead. No autoplay.
- Poster should be a representative frame, not a black screen. Compress to WebP <50KB.

### Captions (WCAG 2.1 AA -- 1.2.2)

- **Required:** Closed captions for all pre-recorded video with audio. Use WebVTT format.
- `<track kind="captions" src="onboarding.vtt" srclang="en" label="English" default>`
- Captions must include meaningful non-speech audio (e.g., "[chime sound]"). Sync within 100ms.
- Minimum caption font size: 16px equivalent. Ensure 4.5:1 contrast against video background.

### Fallback on Load Failure

- On `error` event: hide video, show poster image + text summary of what the video explains.
- Never leave a broken player visible. Use `<noscript>` fallback for JS-disabled contexts.

### Overlay Indicators

- Semi-transparent overlay (`bg-black/50`) with centered text: "Your website is ready!"
- Use `aria-live="polite"` on a visually hidden region to announce the overlay message.
- Overlay appears at specific video timestamp via `timeupdate` event, not on a timer.

### Library vs Native

- **Recommendation: native `<video>` element.** For a single onboarding clip, a library (Video.js, Plyr) adds 30-80KB with no benefit.
- Custom controls: build a thin wrapper with play/pause, mute, progress bar, and captions toggle.
- If future needs include HLS/DASH, adopt `hls.js` (50KB) or Mux Player.

## Progressive Reveal

### Skeleton Shimmer

- **CSS-only approach preferred.** Use `background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)` with `animation: shimmer 1.5s infinite`.
- Match skeleton dimensions to actual content within 5%. Use `border-radius` matching final components.
- Skeleton containers: `aria-hidden="true"` (decorative). Pair with a separate live region for announcements.
- `@media (prefers-reduced-motion: reduce)`: replace shimmer animation with static gray placeholder.

### Cross-Dissolve Animation

- `transition: opacity 200ms ease-in` on content appearance. Skeleton fades out, real content fades in.
- Use CSS `@starting-style` (2025+) or `requestAnimationFrame` for enter animations.
- `prefers-reduced-motion`: skip fade, show content instantly with `transition: none`.

### Section-Level Progress

- Horizontal segmented bar (not dots). Each segment fills as its section completes.
- `role="progressbar" aria-valuenow="3" aria-valuemax="5" aria-label="Onboarding progress: 3 of 5 sections complete"`.
- Minimum 3:1 contrast ratio between filled/unfilled segments. Avoid color-only differentiation.

### Celebration Moment

- Brief confetti or checkmark animation (300-500ms) on final completion. Keep it subtle.
- `prefers-reduced-motion`: show static checkmark icon, no particle animation.
- Use CSS animation only (no heavy libraries like Lottie for a single moment).

### React Patterns

- Use `React.Suspense` with `fallback={<Skeleton />}` for each section boundary.
- `React.lazy()` for heavy components (video player, rich editors) to reduce initial bundle.
- Avoid `useEffect` waterfalls: fetch all section data in parallel, render progressively as each resolves.
- Consider `useDeferredValue` for non-critical UI updates during reveal transitions.

## Accessibility Checklist

### WCAG 2.1 AA -- Video

- [ ] **1.2.2** Captions for pre-recorded audio (WebVTT, synchronized)
- [ ] **1.2.5** Audio description for pre-recorded video (or text alternative if video is decorative)
- [ ] **1.4.2** Audio control: mechanism to pause/stop/mute independently of system volume
- [ ] **2.1.1** All video controls keyboard operable (play, pause, seek, mute, captions, fullscreen)
- [ ] **2.3.1** No content flashes more than 3 times per second
- [ ] **4.1.2** All custom controls have accessible name, role, and state

### Focus Management During Progressive Reveal

- Do NOT auto-move focus to newly revealed sections (disorienting). Use `aria-live` announcements instead.
- Exception: if user explicitly triggers reveal (e.g., "Next" button), move focus to new section heading.
- Ensure focus order follows visual order. Newly inserted DOM elements must not break tab sequence.

### aria-live for Progress

- Single `aria-live="polite"` region (visually hidden) for all progress announcements.
- Announce: "Section 2 of 5 loaded" on each section completion. Debounce rapid updates (500ms minimum).
- Set `aria-busy="true"` on loading container, `false` when complete, to batch screen reader announcements.

### Keyboard Navigation -- Video Controls

- Tab order: play/pause > seek bar > mute > captions > fullscreen > skip button.
- Arrow keys for seek (5s increments), volume (10% increments).
- `Escape` exits fullscreen. `Space` toggles play/pause (prevent page scroll with `preventDefault`).

### Color Contrast -- Progress Indicators

- Filled progress segments: minimum 3:1 against unfilled and background (WCAG 1.4.11 non-text contrast).
- Use both color and pattern/icon differentiation (not color alone per 1.4.1).
- Test with grayscale filter to verify distinguishability.

### Screen Reader -- Skeleton States

- Skeleton elements: `aria-hidden="true"` (purely visual placeholders).
- Companion hidden `<div aria-live="polite">Loading content...</div>` announces loading state.
- On load complete: update live region text to "Content loaded" and set `aria-busy="false"`.
- Do NOT announce each individual skeleton disappearing -- one summary announcement per section.
