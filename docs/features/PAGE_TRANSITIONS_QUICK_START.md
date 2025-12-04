# Page Transitions - Quick Start Guide

## Test the Feature in 60 Seconds

### 1. Start the Dev Server

```bash
cd /Users/mikeyoung/CODING/MAIS
npm run dev:client
```

### 2. Open the App

Navigate to: http://localhost:5173

### 3. Test the Animation

Click through these routes and watch for the subtle fade-in:

- Home → Packages (click "Browse Packages")
- Packages → Login (click "Log In")
- Login → Home (click "Macon AI Solutions" logo)

**What to look for:**

- Content fades in smoothly (opacity 0 → 1)
- Slight upward slide effect (8px)
- Duration: 250ms (quick but perceptible)
- Professional, polished feel

### 4. Test Accessibility (Reduced Motion)

**Option A: Chrome DevTools**

1. Open DevTools (F12)
2. Press CMD+SHIFT+P (Mac) or CTRL+SHIFT+P (Windows)
3. Type "reduced motion"
4. Select "Emulate CSS prefers-reduced-motion: reduce"
5. Navigate between routes
6. **Expected:** Instant transitions (no animation)

**Option B: System Settings (macOS)**

1. System Settings → Accessibility → Display
2. Enable "Reduce motion"
3. Refresh browser
4. Navigate between routes
5. **Expected:** Instant transitions (no animation)

### 5. Verify E2E Tests Still Work

```bash
cd /Users/mikeyoung/CODING/MAIS
npm run test:e2e
```

**Expected:** Tests run normally (animations disabled in test mode)

## What You Should See

### Normal Mode (Animation Enabled)

```
Route Change → Content fades in + slides up → Smooth UX ✨
Duration: 250ms
```

### Reduced Motion Mode

```
Route Change → Content appears instantly → Accessibility ✅
Duration: 0ms
```

### E2E Test Mode

```
Route Change → No animation wrapper → Fast tests ⚡
```

## Technical Details

### Animation Properties

- **Opacity:** 0 → 1
- **TranslateY:** 8px → 0px
- **Duration:** 250ms
- **Easing:** Custom cubic-bezier [0.22, 1, 0.36, 1]

### Performance

- GPU-accelerated (transform + opacity)
- No layout shifts
- 60fps animation

### Browser Support

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13.1+
- ✅ Edge 80+

## Troubleshooting

### "I don't see any animation"

1. Check if "Reduce motion" is enabled in system settings
2. Verify you're not in E2E mode (`data-e2e` attribute)
3. Try hard refresh (CMD+SHIFT+R / CTRL+SHIFT+R)

### "Animation looks choppy"

- Check browser DevTools Performance tab
- Verify GPU acceleration is working
- May be normal on very low-end devices

### "E2E tests are failing"

- Verify `VITE_E2E=1` is set in Playwright config
- Check that animations are disabled in test screenshots
- Review error context - likely unrelated to transitions

## Files to Review

### Implementation

- `/client/src/components/transitions/PageTransition.tsx` - Animation component
- `/client/src/app/AppShell.tsx` - Integration point

### Documentation

- `/client/src/components/transitions/README.md` - Detailed docs
- `/docs/features/PAGE_TRANSITIONS.md` - Implementation summary

## Next Steps

After testing:

1. Gather user feedback on animation speed/feel
2. Consider customizing for specific routes if needed
3. Deploy to staging environment
4. Monitor Core Web Vitals for performance impact

---

**Questions?** Check the full documentation in `/docs/features/PAGE_TRANSITIONS.md`
