# tollgate design system

Single source of truth. Every Claude Code prompt for UI work cites this file. Every visual review checks against this file. If a token isn't here, it doesn't exist yet — add it here first, then implement.

---

## brand

- **Name**: `tollgate` — always lowercase, in headlines, body, code, everywhere. Never `Tollgate` or `TOLLGATE`.
- **Voice**: precise, confident, technically credible, slightly understated. We don't oversell. We don't catastrophize. We describe what the product does in the fewest words possible.
- **What we are**: the policy and approval layer for AI agents.
- **What we are NOT**: a security tool selling fear, an enterprise platform selling complexity, an AI vendor selling magic.

---

## color

### page surfaces (dark mode is default and primary)

| Token | Value | Use |
|---|---|---|
| `bg-page` | `#0a0a0a` | page background |
| `bg-surface-1` | `#131313` | top nav, footer, browser chrome |
| `bg-surface-2` | `#1a1a1a` | elevated cards |
| `border-subtle` | `rgba(255,255,255,0.07)` | default card borders |
| `border-default` | `rgba(255,255,255,0.12)` | secondary buttons, dividers |
| `border-strong` | `rgba(255,255,255,0.2)` | hover states |

### text

| Token | Value | Use |
|---|---|---|
| `text-primary` | `#ffffff` | headlines, primary content |
| `text-secondary` | `rgba(255,255,255,0.62)` | body text, descriptions |
| `text-tertiary` | `rgba(255,255,255,0.42)` | metadata, timestamps |
| `text-quaternary` | `rgba(255,255,255,0.32)` | very faint hints, separators in flow diagrams |

### accent (use sparingly)

| Token | Value | Use |
|---|---|---|
| `accent` | `#F4533C` | the punchline word in headlines, the crossbar in the logo mark, the active-state pulse, primary accent button (rare) |
| `accent-soft` | `#FFB5A8` | text on a tinted accent background |
| `accent-bg` | `rgba(244,83,60,0.06)` | tinted card background for "policy match" or "alert" cards |
| `accent-border` | `rgba(244,83,60,0.22)` | border for tinted accent cards |

### status

| Token | Value | Use |
|---|---|---|
| `success` | `#5BD982` | approved decisions, success states |
| `success-bg` | `rgba(40,200,100,0.05)` | success card background |
| `success-border` | `rgba(40,200,100,0.22)` | success card border |
| `slack-green` | `#1f7a3f` | Approve buttons in Slack-style elements |

Red-as-error reuses `accent` (the visual language collapses "policy violation" and "tollgate brand" intentionally — when the system says no, that's the brand).

---

## typography

### font stack

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
--font-mono: "SF Mono", Monaco, "Roboto Mono", "Courier New", monospace;
```

For production we self-host Inter (variable font) — system fallbacks are for dev only.

### scale (rem-based, 16px root)

| Token | Size | Line-height | Weight | Letter-spacing | Use |
|---|---|---|---|---|---|
| `display-xl` | 64px | 1.02 | 500 | -0.03em | hero on a feature page |
| `display-lg` | 48px | 1.05 | 500 | -0.025em | section headlines on landing |
| `display-md` | 32px | 1.05 | 500 | -0.025em | hero headline (current mockup) |
| `heading-lg` | 24px | 1.2 | 500 | -0.015em | feature card titles |
| `heading-md` | 18px | 1.3 | 500 | -0.01em | smaller subsections |
| `body-lg` | 15px | 1.6 | 400 | 0 | hero subheadline |
| `body-md` | 13px | 1.65 | 400 | 0 | default body |
| `body-sm` | 12px | 1.5 | 400 | 0 | nav links, button labels |
| `mono-md` | 12px | 1.5 | 400 | 0 | code snippets in features |
| `mono-sm` | 10.5px | 1.5 | 400 | 0 | live data cards |
| `micro` | 10px | 1.4 | 500 | 0.04em uppercase | metadata labels (timestamps, agent names) |

### weight rules

- Two weights only: **400** (regular) and **500** (medium). 
- Never use 600 or 700. They look heavy against our background.
- Never use 300 or below. They look weak.

---

## spacing

- 4px base grid, 8px primary.
- Use multiples of 4: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128.

| Context | Value |
|---|---|
| Section vertical padding (desktop) | 96px to 128px |
| Section vertical padding (mobile) | 64px |
| Container horizontal padding | 24px (mobile), 48px (desktop) |
| Card internal padding | 16px to 20px |
| Component internal gaps | 8px to 12px |
| Inline element gaps | 4px to 8px |

---

## radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | tags, chips inside cards |
| `radius-md` | 7px | buttons |
| `radius-lg` | 8px | cards |
| `radius-xl` | 12px | the page-level browser-style frame |
| `radius-full` | 9999px | pills, status badges |

No rounded-on-one-side hacks. If a corner needs rounding, all four are rounded.

---

## components

### button

**Primary**
```
bg: #ffffff
color: #0a0a0a
padding: 9px 15px
border-radius: 7px
font: body-sm 500
```
Used once per section maximum. Has the only "white" surface on the page.

**Secondary**
```
bg: transparent
color: #ffffff
border: 1px solid border-default
padding: 9px 15px
border-radius: 7px
font: body-sm 500
```
Hover: `border-color: border-strong`.

**Accent (rare)**
```
bg: #F4533C
color: #ffffff
padding: 9px 15px
border-radius: 7px
font: body-sm 500
```
Used only for the single highest-priority CTA on a high-stakes page (e.g. pricing "Talk to founders").

### card

**Default**
```
bg: rgba(255,255,255,0.025)
border: 1px solid border-subtle
border-radius: radius-lg
padding: 16px to 20px
```

**Accented (alert/policy match)**
```
bg: accent-bg
border: 1px solid accent-border
```

**Success**
```
bg: success-bg
border: 1px solid success-border
```

### badge / status pill

```
padding: 4px 10px
border-radius: radius-full
border: 1px solid (matching color at 0.3 alpha)
bg: matching color at 0.06 alpha
font: micro
gap: 6px (between dot and label)
```

---

## motion

### principles

- Motion has meaning. Every animation tells the user something — a state change, a process running, an action acknowledged. Decoration motion is forbidden.
- Never animate hue or layout. Only opacity and transform (translate, scale).
- Reveal easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` — slight overshoot, feels confident.
- Repeat cycles: 20-30 seconds. Long enough that returning attention catches new state, short enough to feel alive on first view.

### standard animations

```css
/* sequential reveal — cards appearing in order, holding, then fading and resetting */
@keyframes tg-reveal {
  0%   { opacity: 0; transform: translateY(10px); }
  4%   { opacity: 1; transform: translateY(0); }
  88%  { opacity: 1; transform: translateY(0); }
  92%  { opacity: 0; transform: translateY(-6px); }
  100% { opacity: 0; transform: translateY(10px); }
}
/* applied with 1200ms stagger between sequential elements, 24s total cycle */

/* terminal cursor — for live request lines */
@keyframes tg-blink {
  0%, 50%   { opacity: 1; }
  51%, 100% { opacity: 0; }
}
/* 1.1s steps(1) infinite */

/* status pulse — for "evaluating" or "active" indicators */
@keyframes tg-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.4); }
}
/* 1.4s ease-in-out infinite */

/* button press — for the Approve button in the demo */
@keyframes tg-press {
  0%, 60%   { transform: scale(1); background: #1f7a3f; }
  65%       { transform: scale(0.94); background: #2a8c4d; }
  70%, 100% { transform: scale(1); background: #1f7a3f; }
}
/* 24s synchronized to demo cycle, delay 3.6s */
```

---

## layout

- Max content width: 1200px.
- Section grid: 12 columns, 24px gap on desktop, 16px on mobile.
- Hero uses asymmetric grid: copy 1.05fr / demo 1fr.
- Footer is always full width.

---

## logo

### mark

```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <line x1="5" y1="6" x2="5" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="19" y1="6" x2="19" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="5" y1="12" x2="19" y2="12" stroke="#F4533C" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

The two vertical lines use `currentColor` (so they adapt to context — white on dark, black on light if we ever need it). The crossbar is always accent.

### wordmark + mark

- Mark on the left, wordmark on the right.
- 9px gap between them.
- Wordmark: `tollgate` in `body-sm` size when in nav, `display-lg` in the footer treatment, always weight 500, always lowercase.

---

## copy library (canonical text — these are not drafts)

| Slot | Text |
|---|---|
| Hero headline (line 1) | `Bounded autonomy` |
| Hero headline (line 2) | `for AI agents.` (in accent color) |
| Hero subhead | `Define what your agents can do. Approve what's risky. Audit everything. tollgate is the policy and approval layer between your agents and the real world.` |
| Primary CTA | `Get started →` |
| Secondary CTA | `Read docs` |
| Status pill | `v0.7 · live` |
| Nav: docs | `Docs` |
| Nav: pricing | `Pricing` |
| Nav: company | `Company` |
| Nav: sign in | `Sign in` |
| Nav: get started | `Get started` |

Section copy (features, social proof, pricing, footer) will be added here once those sections are designed. Ship copy from this file or update this file — never write one-off copy in components.

---

## things this spec deliberately does NOT include yet

These will be added as we design those sections:

- Form components (input, select, textarea) — needed for signup, dashboard
- Modal / dialog components
- Table styles — needed for audit log
- Code block styles — needed for docs
- Empty states
- Toast / notification patterns
- Photography / illustration treatment
- Light mode variants of every token

Don't invent these in components. Add them here first.

---

## verification checklist

Before any UI work is considered complete, it passes all of these:

- [ ] Every color used appears in the token table above. No off-spec hex values in components.
- [ ] Every text element uses one of the typography sizes above. No one-off `font-size`.
- [ ] All weights are 400 or 500. No 600+ or 300-.
- [ ] Spacing values are multiples of 4.
- [ ] Border radius values match the token table.
- [ ] Animations use the curves and durations above. No new easing or timing without adding to this spec first.
- [ ] Copy matches the copy library exactly. No paraphrases.
- [ ] Mark is rendered at correct size and uses correct color tokens.
- [ ] Lowercase brand name everywhere (`tollgate`, never `Tollgate`).
