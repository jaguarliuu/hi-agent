# Site Motion Design

Date: 2026-05-11
Status: Draft, ready for staged implementation
Owner: project author + agent

## Summary

This document defines the motion/animation system for the Hi-Agent docs site.

The site is a reading-first course on AI Agent engineering. Motion here is not
decoration — it is a communication channel that answers four questions for the
reader:

- **Spatial:** where did this new element come from, where did it go?
- **State:** is the system idle, loading, ready, running, errored, done?
- **Causal:** I clicked A, what changed in B and why?
- **Progress:** a long async operation (WebContainer boot) is happening, how
  long, how far?

Every motion must serve at least one of these four. Anything else is decoration
and must be cut.

## Why A Formal Spec

We have already shipped several features that introduced ad-hoc transitions
(drawer, tabs, status badges, theme switch). Without a unifying system we will
end up with inconsistent easings, durations, and behaviors across modules, and
with animations that actively harm reading focus. This spec freezes the
principles before the next wave of UX polish begins.

## Design Principles

### P1. Motion must communicate, not decorate

Forbidden by default:
- particle backgrounds, cursor trails, parallax
- 3D card tilt, bounce/elastic easings on core UI
- typewriter on long-form text
- any decorative motion on the main reading surface

### P2. Duration budget

| Class | Range | Example |
|---|---|---|
| Micro-feedback | 80–150ms | hover, active, focus ring |
| Layout/UI | 180–280ms | drawer slide, tab underline, accordion |
| Transitional | 280–400ms | FLIP flights, page transitions |
| Narrative | 400–600ms | staged drawer boot states |

Anything over 400ms on a primary path needs explicit justification in code
review. Over 600ms is banned on reading surfaces.

### P3. Easings

Three curves only. Do not invent more.

| Name | Curve | Use |
|---|---|---|
| `standard` | `cubic-bezier(0.2, 0, 0, 1)` | enter/leave default |
| `decelerate` | `cubic-bezier(0, 0, 0, 1)` | coming in from off-screen |
| `accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | leaving to off-screen |

No bounce, no back, no elastic.

### P4. Reduced motion is a contract

Every non-trivial motion must have a `@media (prefers-reduced-motion: reduce)`
fallback. The fallback is never "nothing happens"; it is the **end state
without animation**. Feedback fidelity must be preserved (copy-confirm still
flashes text, status badges still switch color, just without the tween).

### P5. Respect the dark/light palette

Motion tokens (opacity, shadow, highlight color) must read against both
themes. No white flash on dark, no black flash on light. Pulse/shimmer colors
are chosen per theme via the same `html:not(.dark)` / `html.dark` split used
elsewhere in `globals.css`.

### P6. Composition over magic

Prefer composing three tools in this order:
1. **CSS `transition`** for any property-level tween on a static element
2. **CSS `@keyframes`** for loops (pulse, shimmer, typewriter)
3. **JS orchestration (Framer Motion / Motion One / FLIP)** only when layout
   changes or a sequence of elements must coordinate

Introducing a new animation library requires this spec to be updated.

## Motion Token System

To keep values consistent, the following tokens live in `app/globals.css`
as CSS custom properties on `:root` and are overridden under `html.dark`
only when the value must differ per theme.

```
--ha-motion-duration-xs: 100ms;
--ha-motion-duration-sm: 180ms;
--ha-motion-duration-md: 240ms;
--ha-motion-duration-lg: 320ms;
--ha-motion-duration-xl: 480ms;

--ha-motion-ease-standard:   cubic-bezier(0.2, 0, 0, 1);
--ha-motion-ease-decelerate: cubic-bezier(0, 0, 0, 1);
--ha-motion-ease-accelerate: cubic-bezier(0.3, 0, 1, 1);

--ha-motion-distance-sm: 8px;   /* subtle nudge: hover lift, micro-shake */
--ha-motion-distance-md: 16px;  /* standard slide-in / fade-rise */
--ha-motion-distance-lg: 40px;  /* drawer / modal off-screen start */

--ha-motion-stagger-step: 40ms; /* multiply by index for sequenced reveals */

--ha-motion-highlight-apply: rgba(242, 128, 28, 0.16); /* code-apply flash */
```

Components consume only these tokens. Hard-coded `200ms ease`, literal
`translateX(40px)`, or ad-hoc stagger delays in a component file are
review-time warnings. If a new value is genuinely needed, extend the
token set here first and cite this spec in the PR.

### Debug Slowdown (dev-only)

Reviewing a 240ms curve with the naked eye is impractical. The
`useMotionDebug()` hook (`app/lib/motion/use-motion-debug.ts`) listens for

- `?motion-debug=1` in the URL (shareable in Slack/screenshots), or
- `localStorage.HA_MOTION_DEBUG === '1'` (persistent across navigations).

When active, it sets `<html data-motion-debug="slow">`. A companion CSS
rule in `globals.css` multiplies every `--ha-motion-duration-*` token by
~4 so standard (240ms) → 960ms, extended (480ms) → 1920ms, etc.

Hard rules:

1. **A11y outranks debug.** If `prefers-reduced-motion: reduce` matches,
   the attribute is never injected and the CSS rule is additionally
   guarded by `@media not (prefers-reduced-motion: reduce)`.
2. **Only durations scale.** Easings and distances must not — otherwise
   reviewers would be evaluating the wrong motion.
3. **Dev-only by convention.** The hook will ship in production builds
   (removing it from the production bundle would add build complexity)
   but requires the explicit opt-in above, so it costs ~0 to users.

### Runtime Wiring

`<MotionProvider>` (`app/lib/motion/motion-context.tsx`) wraps the entire
`<Layout>` tree from `app/layout.jsx`. It owns:

- a single `matchMedia('(prefers-reduced-motion: reduce)')` subscription
  that backs `useMotion().reduced` for every descendant,
- the `useMotionDebug()` invocation that writes/clears the
  `data-motion-debug` attribute on `<html>`.

Two read APIs co-exist deliberately:

| API | Use when |
|---|---|
| `useMotion()` (Context) | Inside the app tree. Preferred. Returns `{ reduced, debug }`. |
| `useReducedMotion()` (hook) | Leaf components / tests that must not depend on Context, or anything mounted outside `<MotionProvider>`. |

Both return the SSR-safe default `false` until the first client effect
runs. Tests can wrap a subject with `<MotionProvider value={{ reduced: true }}>`
to drive the reduced branch deterministically without mocking matchMedia.

## Scene Catalog

Each motion is labeled `M<scene>-<index>`. Wave assignments are specified
in the companion plan (`plans/2026-05-11-site-motion-v1.md`).

### Scene 1: Landing & Docs Home

| ID | Motion | Communicates |
|---|---|---|
| M1-01 | Hero stagger fade-in on first paint | Reading order, information hierarchy |
| M1-02 | Module card hover: lift 2–3px + border glow | Affordance (these are clickable) |
| M1-03 | CTA arrow slides right 4px on hover | Direction of flow |

### Scene 2: Reading (80% of session time)

| ID | Motion | Communicates |
|---|---|---|
| M2-01 | TOC active section highlight slides | Where am I in the page |
| M2-02 | Sidebar active chapter indicator slides | Where am I in the course |
| M2-03 | Route change: main column fade+rise 4px | SPA coherence |
| M2-04 | ZoomableImage open/close spring | Spatial continuity |
| M2-05 | Code copy button text swap "复制 → ✓ 已复制" | Operation confirmed |
| M2-06 | In-page anchor jump: smooth scroll w/ budget | Spatial continuity, non-disorienting |
| M2-07 | Top reading progress bar (optional) | Progress expectation |
| M2-08 | Theme switch 200ms color transition (excl. code blocks) | Soft mode change, not flash |

### Scene 3: Tab / Navigation Switching

| ID | Motion | Communicates |
|---|---|---|
| M3-01 | Magic-line tab underline (FLIP) | Same family, different face |
| M3-02 | Tab content crossfade 100ms-out / 150ms-in | Prevent CLS |
| M3-03 | File tree folder expand/collapse 200ms | There is more below |
| M3-04 | Prev/Next chapter slide-in from right | Continuous course |

### Scene 4: WebContainer Playground (signature surface)

| ID | Motion | Communicates |
|---|---|---|
| M4-01 | Drawer slide-in from right + backdrop dim | This is a tool panel, not navigation |
| M4-02 | Drawer slide-out, symmetric | Clean exit |
| M4-03 | FLIP flight: RunnableCodeBlock → editor tab | I clicked that, it became this |
| M4-04 | Applied file: target region highlight pulse 600ms | New content landed here |
| M4-05 | Boot status narrative: "预检 → 加载内核 → 解压 Snapshot → 启动 Shell" | Managing 5–15s wait anxiety |
| M4-06 | xterm first-run welcome typewriter (first boot only) | Alive, not frozen |
| M4-07 | Running command prompt pulse ($ blinks) | Work in progress |
| M4-08 | Status badge color+dot transition | State change without reading text |

### Scene 5: Global Interaction Feedback

| ID | Motion | Communicates |
|---|---|---|
| M5-01 | Hover transitions on all interactive elements 150ms | Affordance |
| M5-02 | `:active` scale(0.97) 80ms | Physical feedback |
| M5-03 | Search input focus expand + border | Input invitation |
| M5-04 | Search result list stagger fade-in 20ms each | Readable cadence |
| M5-05 | Toast slide-down + fade, auto-dismiss 2.5s | Non-blocking notice |
| M5-06 | Skeleton shimmer during async content | Fill empty anxiety |

## Explicit Non-Goals

- No route-level 3D transitions.
- No "hero video" autoplay backgrounds.
- No mouse trails or cursor effects.
- No scroll-jacking (e.g. locked horizontal scroll sections).
- No "wiggle" on 404 or error states.
- No animation on code-block syntax tokens (re-paint cost + flicker).

## Accessibility Contract

1. Every motion in Scenes 1–5 must ship with a `prefers-reduced-motion: reduce`
   variant. The variant disables the tween but keeps the end state and any
   color/text feedback.
2. Focus rings must never be hidden by `outline: none` without a replacement.
3. Motion must not create seizure-risk flicker (>3 Hz full-screen flash). The
   prompt-pulse and shimmer loops are explicitly designed below 3 Hz.
4. Auto-playing motion (progress bars, shimmers) must pause when the tab is
   `document.hidden`.

## Performance Contract

- Only animate `transform` and `opacity` on any element that appears in the
  reading viewport. Animating `top`/`left`/`width`/`height` on reading surfaces
  requires justification.
- Any `@keyframes` loop longer than 2s on an always-visible element must be
  disabled when `prefers-reduced-motion` is set.
- JS-driven motion (Framer Motion) must be code-split and not loaded on pages
  that do not use it.

## Technology Decisions

| Need | Decision | Reason |
|---|---|---|
| Property tweens (hover/active/focus) | CSS `transition` | Zero runtime cost |
| Layout reflow (tab indicator, flight) | FLIP via CSS transform | GPU path, no jank |
| Component orchestration (drawer stages) | CSS `transition` + `transitionend` (V1); Motion One only if FLIP orchestration exceeds ~80 LOC | Avoid 40KB Framer Motion dependency unless earned |
| Page transitions | View Transitions API (progressive) | Native 2026-era support, graceful fallback |
| Typewriter, pulse, shimmer | Pure CSS `@keyframes` | No JS cost |
| Progress bar | CSS `scaleX` driven by IntersectionObserver/scroll | No layout thrash |

## Rollout Strategy

Three waves, executed independently. Each wave has its own branch/commit set.
See `plans/2026-05-11-site-motion-v1.md` for the checkbox tasks.

- **Wave 1 — Foundation & low-risk gains (MUST HAVE):** motion tokens,
  reduced-motion contract, theme switch, hover/active, code-copy feedback,
  drawer slide, WebContainer boot narrative.
- **Wave 2 — Quality lifts:** tab magic-line, FLIP flight to playground,
  file-tree expand, TOC highlight slide, search focus+stagger, route fade.
- **Wave 3 — Delight / optional:** landing stagger, reading progress bar,
  xterm typewriter, chapter slide-in, toast system.

## Open Questions

- ~~Does the site already depend on `framer-motion`? If no, adding it costs
  ~40KB gz on pages that use it — worth it for the drawer orchestration but
  must be lazy-loaded. Confirm in plan.~~
  **Resolved 2026-05-11 (Wave 0):** No Framer Motion in V1. Drawer
  enter/leave is handled with CSS `transition` + `transitionend`-driven
  unmount; FLIP flights use raw `getBoundingClientRect` + CSS transform.
  Revisit if Wave 2's FLIP flight exceeds ~80 LOC of orchestration code,
  in which case Motion One (~4KB) is the preferred upgrade rather than
  the full framer-motion bundle.
- Should chapter prev/next motion (M3-04) respect directionality for RTL
  future? Keep in mind for i18n backlog (T3-01 in `ideas/`).
- View Transitions API + Next.js App Router static export: the baseline works,
  but cross-document transitions on static-exported sites need `@view-transition`
  CSS and explicit opt-in. Validate during Wave 2.

## Out Of Scope

- Interactive animation editor in docs.
- Lottie assets.
- Server-side animation generation.
- A/B testing motion variants.

## Change Log

| Date | Change |
|---|---|
| 2026-05-11 | Initial draft covering 5 scenes, 3 waves, token system |
| 2026-05-11 | Wave 0 landed: motion tokens + prefers-reduced-motion global block + useReducedMotion hook; resolved Framer Motion open question (not adopted in V1) |
| 2026-05-11 | Wave 0.5 landed: distance + stagger tokens, dev-only debug slowdown, `<MotionProvider>` Context with paired `useMotion()` API, shared `tests/helpers/motion-test-utils.ts` |
