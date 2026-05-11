# Site Motion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll out a coherent motion system across the docs site in three waves, communicating spatial / state / causal / progress information without harming reading focus. Driven by `specs/2026-05-11-site-motion-design.md`.

**Architecture:** Centralize motion tokens (durations, easings, highlight colors) as CSS custom properties on `:root` in `globals.css`, layered via `html.dark` / `html:not(.dark)`. Prefer pure CSS for property tweens and `@keyframes` loops; reach for FLIP for layout reflow; reach for Framer Motion (lazy-loaded) only for the drawer narrative orchestration. Every motion ships with a `prefers-reduced-motion` fallback that preserves end-state and feedback fidelity.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS custom properties, View Transitions API (progressive enhancement), Framer Motion (Wave 2+ only, lazy-loaded), `@xterm/xterm`, `@monaco-editor/react`, Vitest, React Testing Library.

---

## Scope

This plan delivers the full motion system across 3 waves. Each wave is shippable on its own and gated by manual + automated verification.

In scope:
- foundation: motion token CSS, reduced-motion utility, dark/light palette tokens
- Wave 1 (foundation + must-have feedback): M2-08 theme switch, M2-05 copy feedback, M5-01/M5-02 hover/active, M4-01/M4-02 drawer slide, M4-05 boot narrative, M4-08 status badge
- Wave 2 (quality lifts): M3-01 magic-line, M4-03 FLIP flight, M4-04 apply highlight, M3-03 tree expand, M2-01 TOC slide, M2-03 route fade, M5-03/M5-04 search
- Wave 3 (delight): M1-01 hero stagger, M1-02/M1-03 module cards & CTA, M2-07 reading progress, M4-06 typewriter, M4-07 prompt pulse, M3-04 chapter slide, M5-05 toast, M5-06 shimmer

Out of scope:
- Lottie assets, animation editor, A/B testing
- Mobile gesture motion (separate plan if needed)
- Translating spec to a Storybook / motion sandbox

## File Structure Map

### Root Style And Token Layer

- Modify: `app/globals.css`
  - add `:root` motion token block (durations, easings, highlight colors)
  - add `@media (prefers-reduced-motion: reduce)` global override block
  - add `html.dark` / `html:not(.dark)` overrides for theme-sensitive motion colors

- Optional add: `app/lib/motion/use-reduced-motion.ts`
  - small hook returning `boolean`, used by JS-driven motion components

- Optional add: `app/lib/motion/motion-tokens.ts`
  - mirror of CSS tokens for JS consumption (Framer Motion `transition` props)

### WebContainer Drawer And Section Components

- Modify: `app/lib/playground/playground-drawer.tsx`
  - drawer slide-in/out (M4-01, M4-02)
  - applied-file highlight pulse (M4-04)
  - tab magic-line (M3-01)

- Modify: `app/lib/playground/playground-provider.tsx`
  - expose boot stage enum (`prelude | loading-kernel | mounting-snapshot | starting-shell | ready`)

- Modify: `app/lib/playground/playground-terminal.tsx`
  - first-boot typewriter (M4-06)
  - running prompt pulse (M4-07)

- Modify: `app/lib/playground/playground-file-tree.tsx`
  - folder expand/collapse (M3-03)

- Modify: `app/lib/playground/playground-section.tsx`
  - status badge color+dot transition (M4-08)

- Modify: `app/lib/runnable-code-block.tsx`
  - copy-button success swap (M2-05) — verify if Nextra's copy already provides this; replace if not
  - "应用" click: trigger FLIP flight to drawer editor tab (M4-03)

### Reading Surface

- Modify: `app/layout.jsx` or top-level layout component
  - smooth-scroll opt-in (M2-06)
  - reading progress bar mount (M2-07)
  - View Transitions API enable (M2-03)

- Modify: `mdx-components.js`
  - wrap copy button if needed for M2-05

- Optional add: `app/lib/reading-progress.tsx`
  - 2px top bar, IntersectionObserver-driven (M2-07)

- Modify: `app/lib/zoomable-image.tsx`
  - confirm spring open/close uses motion tokens (M2-04)

### Landing & Navigation

- Modify: `app/page.jsx`
  - hero stagger (M1-01), module card hover (M1-02), CTA arrow (M1-03)

- Modify: `nextra-theme-docs` overrides via `globals.css`
  - sidebar active-chapter slide (M2-02)
  - TOC active-section slide (M2-01)
  - search focus + result stagger (M5-03, M5-04)
  - chapter prev/next slide-in (M3-04)

### Tests

- Add: `tests/components/motion/reduced-motion.test.tsx`
  - hook returns true under `matchMedia` mock
  - component renders end-state without `transition` style

- Add: `tests/components/motion/drawer-motion.test.tsx`
  - drawer mount/unmount toggles `data-motion-state` correctly

- Add: `tests/components/motion/copy-feedback.test.tsx`
  - clicking copy swaps text to "✓ 已复制" and reverts after 1.5s

---

## Wave 0 · Foundation (REQUIRED before any wave)

- [x] **Step 0.1** — Add motion token block to `app/globals.css`.
  - Insert under `:root` (or its existing equivalent) the variables defined in the spec's "Motion Token System" section.
  - Add a global `@media (prefers-reduced-motion: reduce)` block that sets `--ha-motion-duration-*` to `0.01ms` and disables animations on `*::before, *::after, *`.
  - Verify by toggling OS-level reduce-motion and confirming no visible tweens.
  - **Landed 2026-05-11.** Tokens (`--ha-motion-duration-{xs..xl}`, `--ha-motion-ease-{standard,decelerate,accelerate}`, `--ha-motion-highlight-apply`) live on `:root`; `html.dark` overrides the highlight only. Reduced-motion block at end of file collapses durations to `0.01ms` (preserves `transitionend` firing) and excludes `.xterm` / `.monaco-editor` from the nuke since their internal animations are functional UX.

- [x] **Step 0.2** — Add `app/lib/motion/use-reduced-motion.ts`.
  - Read `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
  - Subscribe to changes; SSR-safe (return `false` until mounted).
  - Add unit test covering matchMedia mock.
  - **Landed 2026-05-11.** Hook returns `false` until first `useEffect` fires (SSR-safe), then mirrors `matchMedia` and re-syncs on `change` events with a Safari-<14 `addListener` fallback. Companion test at `tests/unit/use-reduced-motion.test.ts` covers initial-true, initial-false, mid-session toggle, listener cleanup, and missing-`matchMedia` host.

- [x] **Step 0.3** — Decide on Framer Motion dependency.
  - If adopting: `npm i framer-motion`, lazy-load via `dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false })` only on Playground.
  - If skipping: document the FLIP-only approach for Wave 2 in this plan and update spec's Open Questions.
  - Update `package.json` and lockfile.
  - **Decided 2026-05-11: skip.** V1 uses CSS `transition` + `transitionend` for drawer enter/leave and raw `getBoundingClientRect` + transform for FLIP. Spec's Technology Decisions table and Open Questions updated. Re-evaluate during Wave 2 only if FLIP orchestration > ~80 LOC, in which case prefer Motion One (~4KB) over the full Framer Motion bundle.

- [x] **Step 0.4** — Verify Wave 0 with `npm run test`. All existing tests must still pass; new reduced-motion test must pass.
  - **Verified 2026-05-11.** `npm run test` → 10 files / 29 tests passing (24 existing + 5 new). `GetDiagnostics` returned no TS/ESLint errors. `package.json` / lockfile untouched (no Framer Motion adopted).

---

## Wave 1 · Foundation & Must-Have Feedback

Theme: feedback fidelity. Without these, the site feels dead.

- [ ] **Step 1.1 — M2-08 theme switch transition.** In `globals.css`, add `transition: background-color var(--ha-motion-duration-md) var(--ha-motion-ease-standard), color var(--ha-motion-duration-md) var(--ha-motion-ease-standard);` on `body, .nextra-content` (scoped to avoid code-block repaint storm). Verify dark↔light switch is soft.

- [ ] **Step 1.2 — M5-01/M5-02 hover/active universal contract.** Audit all `<button>`, `<a>`, `[role="button"]` on top-level components for `transition: 150ms` on color/background/border, plus `:active { transform: scale(0.97); transition-duration: 80ms; }`. Concrete files to touch: `runnable-code-block.tsx`, `command-block.tsx`, `open-project-button.tsx`, `playground-drawer.tsx` chrome buttons. Confirm no regression on existing focus rings.

- [ ] **Step 1.3 — M2-05 copy-button success feedback.** Determine if Nextra 4's copy button already swaps state. If no, intercept via a wrapper in `mdx-components.js` (`pre` override) or component-local logic in `runnable-code-block.tsx`. On success, swap label to `✓ 已复制` for 1500ms, color shifts to success token. Add unit test under `tests/components/motion/copy-feedback.test.tsx`.

- [ ] **Step 1.4 — M4-01 drawer slide-in.** Today the drawer toggles `is-open` class. Replace direct visibility flip with `transform: translateX(100% → 0)` + `opacity` and `transition` using `--ha-motion-duration-lg` and `--ha-motion-ease-decelerate`. Backdrop dim (`background: rgba(0,0,0,0.32)`) fades 240ms. No layout shift on the rest of the page (`position: fixed` already used; verify).

- [ ] **Step 1.5 — M4-02 drawer slide-out.** Symmetric reverse using `--ha-motion-ease-accelerate`. Ensure unmount happens **after** the transition completes (use `transitionend` or Framer Motion `AnimatePresence`); otherwise content snaps off mid-slide.

- [ ] **Step 1.6 — M4-08 status badge color+dot.** In `playground-section.tsx`, add `transition: background-color var(--ha-motion-duration-sm), color var(--ha-motion-duration-sm), border-color var(--ha-motion-duration-sm)` on the badge. Add a 1px-radius dot with `@keyframes ha-status-pulse` (1s) for `status-running` only.

- [ ] **Step 1.7 — M4-05 boot stage narrative.** Extend Playground state machine with `bootStage: 'prelude'|'loading-kernel'|'mounting-snapshot'|'starting-shell'|'ready'`. Render in a small text strip near the status badge: `预检 → 加载内核 → 解压 Snapshot → 启动 Shell → 就绪`. Each stage transition uses an opacity 0→1 swap (180ms). Even if the underlying boot is fast, this stage strip never blinks faster than 200ms per stage to keep it readable. Persist the same stages to `data-boot-stage` attribute for tests.

- [ ] **Step 1.8 — Verification & sign-off (Wave 1).**
  - Run `npm run test` and confirm all tests pass.
  - Run `npm run dev`, manually verify:
    - theme switch is smooth, no flash
    - hover/active works on every interactive element
    - copy button confirms success
    - drawer slides in/out smoothly, no abrupt unmount
    - WebContainer boot shows the 5-stage narrative
  - Toggle OS reduced-motion and confirm motion is disabled but feedback (colors, text swaps) still works.
  - Commit as `feat(motion): wave 1 — foundation & feedback`.

---

## Wave 2 · Quality Lifts

Theme: spatial coherence. Make the UI feel like it has a layout, not a stack.

- [ ] **Step 2.1 — M3-01 tab magic-line.** Replace per-tab border-bottom-on-active with a single absolutely-positioned underline element. On tab change, measure new tab rect via `getBoundingClientRect()` and animate `transform: translateX/scaleX` 240ms. Apply to both Playground tabs and any docs-side tab groups. Add `data-magic-line` test hook.

- [ ] **Step 2.2 — M4-03 FLIP flight (RunnableCodeBlock → drawer editor tab).** When user clicks "应用" on a runnable block:
  1. Read source rect from the clicked block.
  2. Open drawer (Wave 1 motion runs first).
  3. Read target rect of editor tab corresponding to the file.
  4. Insert a clone element with the file label, animate from source rect to target rect (transform + opacity 0.4 → 0), 320ms `--ha-motion-ease-standard`.
  5. Remove clone on `transitionend`.
  Keep the existing functional behavior of `openFile()` unchanged; the flight is purely visual.

- [ ] **Step 2.3 — M4-04 applied-file highlight.** After a file is applied, in the Monaco editor decorate the affected line range with a background using `--ha-motion-highlight-apply` for 600ms, then fade. Use `editor.deltaDecorations` with a CSS class that has `animation: ha-apply-pulse 600ms ease-out forwards`.

- [ ] **Step 2.4 — M3-03 file tree expand/collapse.** In `playground-file-tree.tsx`, replace conditional render of children with always-rendered children inside a `grid-template-rows: 0fr | 1fr` container, transitioning 200ms. Caret icon rotates 200ms. Verify nested collapse works without layout pop.

- [ ] **Step 2.5 — M2-01 TOC active section slide.** In Nextra TOC override, animate the active marker via `transform: translateY` rather than re-rendering. Use `cubic-bezier(0.2, 0, 0, 1)` 220ms.

- [ ] **Step 2.6 — M2-03 route fade.** Wrap `app/layout.jsx`'s main content slot. If View Transitions API is supported (`document.startViewTransition`), use it with a `view-transition-name: main-column` declaration in CSS and a fade keyframe. Fallback: a small `key`-changing wrapper that fades the new content in 180ms. Make sure scroll restoration is not broken.

- [ ] **Step 2.7 — M5-03 search focus + M5-04 result stagger.** Search input width expands 200ms on focus. Result list items have `animation-delay` calculated via inline style or CSS variable to stagger 20ms each, fade-in over 160ms.

- [ ] **Step 2.8 — Verification & sign-off (Wave 2).**
  - All Wave 1 + new Wave 2 tests green.
  - Lighthouse performance score must not drop more than 3 points vs. pre-Wave-2 baseline.
  - Manually verify FLIP flight does not re-trigger on rapid double-clicks (debounce or guard).
  - Commit as `feat(motion): wave 2 — spatial coherence`.

---

## Wave 3 · Delight (Optional)

Theme: personality and polish. Cut anything that doesn't earn its keep.

- [ ] **Step 3.1 — M1-01 hero stagger.** On `app/page.jsx`, fade-in title (0ms) → subtitle (60ms) → seven module grid (each card 30ms apart). Total under 400ms. Disable on second visit (`sessionStorage` flag) to avoid annoying repeat readers.

- [ ] **Step 3.2 — M1-02 module card hover.** `transform: translateY(-2px)` + box-shadow lift, 180ms. Border-color shift to module accent.

- [ ] **Step 3.3 — M1-03 CTA arrow slide.** On hover, arrow `→` translates 4px right; on leave, returns. 150ms.

- [ ] **Step 3.4 — M2-07 reading progress bar.** Top-mounted 2px bar in `app/lib/reading-progress.tsx`. `scroll` event with `requestAnimationFrame` throttle. Pause when `document.hidden`. Hide on landing/index pages, only show on docs/lab routes.

- [ ] **Step 3.5 — M4-06 xterm first-boot typewriter.** In `playground-terminal.tsx`, on first boot of a session (sessionStorage flag), feed welcome banner one character per 30ms. Skip if reduced-motion. Confirm subsequent shells boot instantly without typewriter.

- [ ] **Step 3.6 — M4-07 prompt pulse.** While a command is running (track via webcontainer-manager), apply `@keyframes ha-prompt-pulse` (1s, opacity 0.55 → 1) to the `$ ` prefix character in xterm. Stop immediately on command exit.

- [ ] **Step 3.7 — M3-04 chapter slide-in.** When navigating prev/next chapter via Nextra's pager links, content column slides in from right by 8px + fade. Detect direction via the link target.

- [ ] **Step 3.8 — M5-05 toast system.** Simple `Toast` component slide-down from top, 220ms in / 180ms out, auto-dismiss 2500ms. Use case TBD — maybe surface non-fatal Playground errors here instead of inline.

- [ ] **Step 3.9 — M5-06 shimmer skeletons.** Apply to async loading surfaces (search results loading, lab manifest loading). 2s linear loop, paused under reduced-motion.

- [ ] **Step 3.10 — Verification & sign-off (Wave 3).**
  - All previous tests + manual verification.
  - Bundle-size check: total JS gz delta must be < 30KB across all waves.
  - Commit as `feat(motion): wave 3 — delight & polish`.

---

## Manual Verification Matrix

After each wave, walk this matrix:

| Surface | Wave 1 | Wave 2 | Wave 3 |
|---|---|---|---|
| Theme toggle | ✓ smooth | — | — |
| Hover any button | ✓ 150ms | — | — |
| Click copy on code block | ✓ "✓ 已复制" | — | — |
| Open Playground drawer | ✓ slide-in | + FLIP flight, + apply highlight | — |
| Boot WebContainer | ✓ 5-stage strip | — | + first-boot typewriter, + prompt pulse |
| Switch tabs in Playground | — | ✓ magic-line | — |
| Expand file in tree | — | ✓ smooth | — |
| Navigate to a doc page | — | ✓ fade-in | + chapter slide-in |
| Scroll long doc | — | ✓ TOC tracks | + reading bar |
| Use search | — | ✓ focus + stagger | — |
| Reduced-motion ON | ✓ no tweens, all feedback intact across all waves |

## Risks & Mitigations

- **R1 — Drawer animation makes WebContainer boot feel slower.** Mitigation: drawer slide finishes in 320ms regardless of boot. Boot stage strip uses staged narrative that runs in parallel, not gated by drawer animation.
- **R2 — Framer Motion bundle bloat.** Mitigation: lazy-load only on Playground; baseline bundle (landing, docs reading) must not include it. Monitor with `next build` size report.
- **R3 — Pulse/shimmer accessibility.** Mitigation: enforced via the global reduced-motion block from Wave 0 + per-component check in tests.
- **R4 — View Transitions API edge cases on static export.** Mitigation: feature-detect; fallback to React `key`-based fade. Confirm no double-fade under both paths.
- **R5 — Magic-line race conditions on rapid tab switches.** Mitigation: cancel in-flight rAF on new switch; one source of truth for the underline rect.

## Rollback Strategy

Each wave is committed independently. To roll back:

- Revert the wave's commit(s).
- Token additions in `globals.css` are forward-compatible — leaving them in place after a Wave 1 revert does no harm.

## Change Log

| Date | Change |
|---|---|
| 2026-05-11 | Initial plan, three waves, 30 steps |
| 2026-05-11 | Wave 0 completed — tokens + reduced-motion hook + Framer Motion decision |
