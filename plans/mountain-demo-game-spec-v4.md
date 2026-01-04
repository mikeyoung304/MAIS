# HANDLED "MOUNTAIN DEMO" — One-Page Game Design Spec (FINAL v4)

## Purpose

A 20–45 second optional micro-game embedded in the landing page that demonstrates the Handled promise through experience, not explanation.

- Hero (client) has an idea 💡
- Mountain = admin / tool chaos
- DIY mode feels possible at first, then Sisyphean
- "Get Handled" changes the physics of the world
- Handled is the guide, not the hero

**Primary KPI:** CTA click-through uplift without harming scroll/UX
**Secondary KPIs:** interaction rate, completion rate, downstream signup conversion

---

## Placement on Landing Page (Canonical)

Place immediately after a short "shared problem" paragraph and before the Project Hub wedge and pricing.

### Top → Bottom

1. Hero (promise + CTA)
2. 2–3 line shared problem (recognition)
3. **Mountain Demo (this game)** ← problem + solution in one
4. Project Hub wedge (mechanism)
5. Pricing (3 tiers)
6. Who it's for
7. Closing CTA

**Rationale:** felt understanding → explanation → commitment

---

## Section Layout

### Desktop

- Appears as a card (video-embed style)
- Left: short header + 1-sentence setup
- Right: game canvas (16:9 or 4:3, fixed height)
- Does not auto-play
- Idle preview loop + "Play" overlay

### Mobile

- Full-width card
- Thumb-friendly "Play"
- No full-screen by default (optional later)

**Non-negotiable:**
The game never hijacks scroll. Interaction is opt-in only.

---

## Visual Style (Brand-Safe)

- Minimal stick-figure line art
- Monochrome world (black / white / gray)
- Handled sage accent used **only** for:
  - "Get Handled" button
  - Jetpack glow
  - Success confetti accents (very restrained)
- Generic platformer geometry (no Mario-identifiable silhouettes)
- Labels are the differentiator: modern, relatable burdens
- Never display more than 5–7 labels at once

---

## Controls (One-Input Only)

### DIY Mode (Phase 1)

- Desktop: Space = jump
- Mobile: Tap = jump
- No double jump, no combos

### Handled Mode (Phase 2)

- Desktop: Hold Space = jetpack thrust; release = glide
- Mobile: Press & hold = thrust; release = glide
- Movement becomes intentionally easy

---

## Core Entities

| Entity       | Description                                               |
| ------------ | --------------------------------------------------------- |
| **Player**   | Stick figure + lightbulb (idea)                           |
| **Mountain** | Uneven side-view slope of labeled blocks (system burdens) |
| **Hazards**  | Rolling labeled boulders (interruptions / chaos tax)      |
| **Goal**     | "Success" platform on far right                           |
| **Guide**    | Handled manifested as a jetpack (physics change)          |

**No monsters. No weapons. No enemies.**
Chaos is environmental, not adversarial.

---

## Text Labels

### Mountain Blocks (rotate 5–7 per run)

- SEO
- Website setup
- Payments
- Scheduling
- Tool connections
- Domains
- "Where do leads come from?"
- Automations
- Forms
- Follow-ups

### Rolling Boulders (rotate 3–6 per run)

- Missed texts
- "Quick question"
- Chasing invoices
- Miscommunication
- "Did you see my email?"
- Last-minute changes
- "What did we decide?"
- Calendar conflict

---

## Gameplay Loop

### State A — Idle Preview (Default)

- Subtle loop: player takes a few steps, sees mountain, boulder rolls by
- Overlay:
  - "Tap / Space to start"
  - Primary: **Play**
  - Secondary: **Skip**
- Focus is entered only via Play.

### State B — DIY Mode (Active Play)

- Camera starts tight on player + idea 💡
- Pulls back to reveal the full mountain
- Player auto-runs at constant speed
- Jump to climb uneven block ledges

**Physics (feels unfair but believable):**

- Steep slopes cause sliding
- Some blocks crumble after landing (delayed)
- Boulders periodically roll down from above and knock player back

**Win condition:**
Effectively not winnable in v1 — feels possible for ~5–10 seconds, then escalates.

### Fail Rules (DIY Mode)

Fail triggers any one of:

- 3 boulder hits (tunable)
- ~75% progress → peak collapse event
- 15–18 seconds elapsed (failsafe)

**On fail:**

- Gameplay freezes briefly (no "Game Over")
- Subtle screen shake (2–3px) + soft fade
- Player resets to base of mountain
- Overlay (guide voice):
  - "You don't have to climb this."
  - Primary: **Get Handled**
  - Secondary: **Keep trying**

### State C — Handled Mode (Post-CTA)

- Triggered by clicking **Get Handled**
- Jetpack snaps on with subtle sage glow
- World remains monochrome; only jetpack is colored

**Physics change only:**

- Hold = glide upward
- Release = gentle descent

**Key principle:**
The mountain does not disappear.
Hazards continue — but pass harmlessly below.

**If user does nothing:**

- Jetpack gently auto-guides upward (no death, no pressure)
- Player clears mountain in 6–10 seconds.

### State D — Success

- Player lands on "Success" platform
- Minimal celebration:
  - Small confetti burst
  - Lightbulb brightens
- Text:
  > Do what you love.
  > The rest is handled.
- Buttons:
  - Primary: **Get Started**
  - Secondary: **Play again** (optional)

Gameplay stops; scrolling resumes normally.

---

## Scroll, Focus & Accessibility Contract

- Keyboard input captured **only while focused**
- Focus entered via Play
- Focus exits if:
  - User clicks outside canvas
  - Presses Esc
  - Clicks "Exit" icon
  - Scrolls far enough away
- Scrolling must remain natural at all times

**Respect `prefers-reduced-motion`:**

- Disable shake
- Reduce particle effects

---

## Analytics (Minimum)

- Section viewed (≥50% in viewport)
- Play clicked
- DIY attempts count
- Fail reason (hits / collapse / timeout)
- Get Handled clicked
- Success reached
- CTA clicked from success
- Skip clicked

---

## Performance & Loading

- Lazy-load JS via IntersectionObserver
- Canvas size capped
- No audio by default
- Target: zero layout shift, minimal main-thread work
- 60fps target on modern devices

---

## Tone Check (Non-Negotiable)

This experience should feel:

- ✅ Calm
- ✅ Knowing
- ✅ Slightly wry
- ✅ Relieving

**Not:**

- ❌ Punishing
- ❌ Gimmicky
- ❌ Juvenile
- ❌ Power-fantasy-driven

> **Handled doesn't make you stronger.**
> **Handled makes the climb unnecessary.**
