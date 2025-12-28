# HANDLED Brand Visual Refresh

> **Status:** Implemented (2025-12-28)
> **Created:** 2025-12-28
> **Reviewed by:** DHH-style, Kieran (TypeScript), Code Simplicity

---

## The Problem

The copy is punchy ("Yes, it's .ai. The robots do the boring parts.") but the visual language says "quiet dignity" not "cheeky confidence."

| Element    | Current              | Vibe                     |
| ---------- | -------------------- | ------------------------ |
| Primary    | #7B9E87 (muted sage) | Retirement community spa |
| Background | #FFFBF8 (warm cream) | Cozy, approachable       |

**The gap:** Our voice is confident and self-aware. Our visuals are timid.

---

## The Solution: Punch Up the Sage

**Change 2 color values. Ship it. Iterate from there.**

| Token        | Current                          | New     | Rationale                    |
| ------------ | -------------------------------- | ------- | ---------------------------- |
| `sage`       | #7B9E87 (web) / #4A7C6F (client) | #45B37F | Brighter, confident          |
| `sage-hover` | #6B8E77 (web) / #3D6B5F (client) | #3A9D6D | Clear hover state            |
| `sage-light` | varies                           | #6BC495 | Consistent decorative tone   |
| `sage-text`  | (new)                            | #2D7A53 | WCAG 4.5:1 for readable text |

**Impact:** 52 button instances + 70 bg-sage/text-sage/border-sage classes auto-update.

---

## Files to Update

### Config Files (4 lines each)

```js
// apps/web/tailwind.config.js (lines 17-20)
'sage': '#45B37F',        // was #7B9E87
'sage-hover': '#3A9D6D',  // was #6B8E77
'sage-light': '#6BC495',  // was #A3BBA9
'sage-text': '#2D7A53',   // NEW - WCAG compliant for text

// client/tailwind.config.js (lines 13-16)
'sage': '#45B37F',        // was #4A7C6F
'sage-hover': '#3A9D6D',  // was #3D6B5F
'sage-light': '#6BC495',  // was #8FAA9E
'sage-text': '#2D7A53',   // NEW - WCAG compliant for text
```

### Seed File (Kieran's catch - critical)

```typescript
// server/prisma/seeds/handled.ts
primaryColor: '#45B37F',  // was #7B9E87
accentColor: '#45B37F',   // was #7B9E87
```

**Why this matters:** Without updating the seed, new tenants get the old sage color.

---

## Implementation Checklist

- [ ] Update `apps/web/tailwind.config.js` (4 lines)
- [ ] Update `client/tailwind.config.js` (4 lines)
- [ ] Update `server/prisma/seeds/handled.ts` (2 lines)
- [ ] Visual regression test homepage (localhost:3000)
- [ ] Visual regression test tenant storefront (/t/handled)
- [ ] Verify buttons, badges, icons look correct
- [ ] Update `docs/design/BRAND_VOICE_GUIDE.md` color values

**Total scope:** ~10 lines across 3 files + docs update

---

## Success Criteria

After implementation:

1. **Feel more confident** - Brighter sage signals "we know what we're doing"
2. **Match the copy energy** - Visual punch that backs up "Yes, it's .ai"
3. **Keep the warmth** - Background stays warm cream (#FFFBF8)
4. **Maintain accessibility** - Use `sage-text` (#2D7A53) for readable text on light backgrounds

---

## What We're NOT Doing (Yet)

Per reviewer feedback, these are separate PRs if needed:

- Typography tracking changes
- Button scale micro-interactions (note: `sage` variant is the only one missing this)
- Grain textures
- Background color changes
- Font family swaps

**Rationale:** Ship the color, see how it feels, iterate from there.

---

## References

- Current brand guide: `docs/design/BRAND_VOICE_GUIDE.md`
- Tailwind config (web): `apps/web/tailwind.config.js`
- Tailwind config (client): `client/tailwind.config.js`
- Seed file: `server/prisma/seeds/handled.ts`
- Homepage: `apps/web/src/app/page.tsx`

---

## Color Reference

```
sage:       #45B37F  (buttons, icons, accents)
sage-hover: #3A9D6D  (hover states)
sage-light: #6BC495  (decorative, backgrounds)
sage-text:  #2D7A53  (readable text - 4.5:1 contrast)
```

**WCAG Notes:**

- #45B37F = 3.2:1 on cream - OK for icons/large text, NOT for body text
- #2D7A53 = 4.5:1 on cream - OK for all text sizes
