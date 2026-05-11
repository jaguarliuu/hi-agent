# Site Motion Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-impact gaps between `specs/2026-05-11-site-motion-design.md` and the current site so motion communicates state, causality, and spatial continuity on the reading surface and in the Playground.

**Architecture:** Build on the motion foundation already shipped instead of restarting Wave 1. First fix the Playground lifecycle so enter/exit and boot state become real state machines rather than CSS-only intent. Then layer in user-visible feedback on top of that stable substrate: copy success, FLIP/apply feedback, and finally route/navigation/search polish.

**Tech Stack:** Next.js 15 App Router, React 19, Nextra 4, `next-themes`, Monaco, xterm, CSS custom properties, View Transitions API, Vitest, React Testing Library.

---

## Scope

This plan is intentionally narrower than `plans/2026-05-11-site-motion-v1.md`. It focuses only on the gaps that materially block the motion spec from feeling true in product use:

- `M4-01 / M4-02` drawer enter/exit
- `M4-05 / M4-08` boot narrative + complete status expression
- `M2-05` copy success feedback
- `M4-03 / M4-04` causal feedback from runnable blocks to the editor
- `M2-03 / M2-01 / M2-02 / M5-03 / M5-04` route/navigation/search polish

Deferred on purpose:

- `M2-07` reading progress bar
- `M4-06 / M4-07` xterm typewriter and prompt pulse
- `M3-02 / M3-04 / M5-05 / M5-06`
- re-deciding whether decorative landing loops should stay or be cut

## Current State Snapshot

Already landed and should be preserved:

- motion tokens, reduced-motion contract, debug slowdown
- `MotionProvider` + `useMotion()`
- theme switch with View Transitions
- partial landing reveal / hover work
- partial Playground status color transitions

Known structural gaps this plan addresses:

- drawer CSS exists but mount/unmount bypasses true open/close animation
- boot state is too coarse to render the narrative required by spec
- copy buttons are styled but not behaviorally wrapped
- runnable actions have no causal animation to the editor target
- route/search/navigation polish is mostly absent

## File Structure Map

### Playground Lifecycle

- Modify: `app/lib/playground/playground-provider.tsx`
  - keep drawer mounted through closing transition
  - drive explicit drawer phase and boot stage state
  - expose data needed by causal feedback hooks

- Modify: `app/lib/playground/playground-state.ts`
  - add `bootStage`
  - optionally add `drawerPhase` if it belongs in reducer state
  - expand events so tests can assert each stage

- Modify: `app/lib/playground/playground-drawer.tsx`
  - render backdrop
  - render boot narrative strip
  - render data attributes for motion state / boot stage
  - hold close until animation completion

- Modify: `app/globals.css`
  - real drawer enter/leave transitions
  - backdrop fade
  - boot narrative strip styles
  - preserve reduced-motion end states

### Code Block Feedback

- Modify: `mdx-components.js`
  - decide the override point for copy feedback if the current Nextra pre wrapper is the cleanest interception layer

- Modify: `app/lib/runnable-code-block.tsx`
  - emit source anchor data for FLIP
  - coordinate apply/open actions with causal motion

- Optional add: `app/lib/motion/copy-feedback-button.tsx`
  - small focused wrapper for copy state if Nextra override needs custom UI

### Editor / Causal Motion

- Modify: `app/lib/playground/playground-editor.tsx`
  - pulse a Monaco decoration on applied/opened target ranges

- Optional add: `app/lib/motion/playground-flight.ts`
  - DOM-only FLIP helper for source → target clone flight

### Reading Surface / Navigation

- Modify: `app/layout.jsx`
  - add a route-transition wrapper for main content

- Modify: `app/globals.css`
  - add route-fade styles
  - add TOC/sidebar active indicator motion
  - add search-result stagger hooks

### Tests

- Modify: `tests/components/playground-drawer.test.tsx`
  - assert drawer lifecycle, boot narrative, status expression

- Modify: `tests/components/theme-transition-toggle.test.tsx`
  - keep green; no new scope

- Add: `tests/components/copy-feedback.test.tsx`
  - assert success label swap / revert

- Add: `tests/components/playground-flight.test.tsx`
  - assert flight helper creates and cleans up clone or, if too DOM-coupled, cover the orchestration at a component level

- Add: `tests/components/route-motion-shell.test.tsx`
  - assert the route wrapper emits the expected motion attributes without breaking render

## Delivery Order

1. Stabilize Playground lifecycle (`M4-01`, `M4-02`)
2. Add boot narrative + complete status signaling (`M4-05`, `M4-08`)
3. Add copy success feedback (`M2-05`)
4. Add runnable → editor causal motion (`M4-03`, `M4-04`)
5. Add route/navigation/search polish (`M2-03`, `M2-01`, `M2-02`, `M5-03`, `M5-04`)

---

## Task 1: Real Drawer Enter/Exit

**Files:**
- Modify: `app/lib/playground/playground-provider.tsx`
- Modify: `app/lib/playground/playground-drawer.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/playground-drawer.test.tsx`

- [ ] **Step 1: Add a failing drawer-lifecycle test**
  - Extend `tests/components/playground-drawer.test.tsx` so opening the Playground first renders a non-open phase, then reaches open, and closing keeps the drawer in the tree until the closing phase completes.
  - Assert against explicit attributes, not CSS text:
    - `data-drawer-phase="opening|open|closing"`
    - backdrop presence while opening/open/closing
  - Add one reduced-motion case: close should still end in the closed state without a visible tween.

- [ ] **Step 2: Run the focused test and verify it fails for the right reason**
  - Run: `rtk npm test -- tests/components/playground-drawer.test.tsx`
  - Expected: new lifecycle assertions fail because the drawer currently mounts only when `isOpen` is true and unmounts immediately on close.

- [ ] **Step 3: Introduce explicit drawer phase state**
  - In `app/lib/playground/playground-provider.tsx`, replace the single `isOpen` boolean gate with:
    - a semantic `isDrawerVisible` / `drawerPhase` model
    - open path: `closed -> opening -> open`
    - close path: `open -> closing -> closed`
  - Keep the drawer mounted for `opening`, `open`, and `closing`.
  - Move “unmount” to an explicit completion callback instead of `closeDrawer()` directly setting the drawer absent.

- [ ] **Step 4: Wire the drawer component to report transition completion**
  - In `app/lib/playground/playground-drawer.tsx`, accept phase/completion props from the provider.
  - Render:
    - drawer root with `data-drawer-phase`
    - backdrop sibling with matching phase
  - On `transitionend`, promote `opening -> open` and `closing -> closed`.
  - Ensure reduced-motion path can short-circuit to final phase without waiting on a long animation.

- [ ] **Step 5: Replace intent-only CSS with real phase-based motion**
  - In `app/globals.css`, remove the current always-mounted `.ha-playground.is-open` assumption as the only driver.
  - Add phase selectors:
    - `[data-drawer-phase='opening']`
    - `[data-drawer-phase='open']`
    - `[data-drawer-phase='closing']`
  - Add backdrop fade/dim.
  - Use motion tokens instead of literal `0.24s ease`.

- [ ] **Step 6: Re-run the focused drawer test**
  - Run: `rtk npm test -- tests/components/playground-drawer.test.tsx`
  - Expected: drawer lifecycle assertions pass.

---

## Task 2: Boot Narrative And Full Status Signaling

**Files:**
- Modify: `app/lib/playground/playground-state.ts`
- Modify: `app/lib/playground/playground-provider.tsx`
- Modify: `app/lib/playground/playground-drawer.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/playground-drawer.test.tsx`

- [ ] **Step 1: Add a failing boot-stage test**
  - Extend `tests/components/playground-drawer.test.tsx` to assert the narrative stages:
    - `prelude`
    - `loading-kernel`
    - `mounting-snapshot`
    - `starting-shell`
    - `ready`
  - Assert both rendered text and `data-boot-stage`.

- [ ] **Step 2: Run the focused test and verify it fails**
  - Run: `rtk npm test -- tests/components/playground-drawer.test.tsx`
  - Expected: failure because `PlaygroundState` currently has only coarse `status`.

- [ ] **Step 3: Extend reducer state and events**
  - In `app/lib/playground/playground-state.ts`:
    - add `bootStage: 'idle' | 'prelude' | 'loading-kernel' | 'mounting-snapshot' | 'starting-shell' | 'ready'`
    - add reducer events for stage transitions
  - Keep `status` as the coarse external state and use `bootStage` for narrative detail.

- [ ] **Step 4: Emit stages from provider orchestration**
  - In `app/lib/playground/playground-provider.tsx`, dispatch:
    - `prelude` before environment checks
    - `loading-kernel` before `getWebcontainer()`
    - `mounting-snapshot` before `prepareSectionWorkspace(...)`
    - `starting-shell` before `ensureInteractiveShell(...)`
    - `ready` once shell/file loading is complete
  - Clamp fast transitions so the narrative remains readable instead of blinking through several stages in one frame.

- [ ] **Step 5: Render the narrative strip**
  - In `app/lib/playground/playground-drawer.tsx`, add a small boot-stage line near the existing header status badge.
  - Render human-readable Chinese labels and a `data-boot-stage` attribute.

- [ ] **Step 6: Style and animate stage changes**
  - In `app/globals.css`, add a low-key opacity/color swap for stage changes using motion tokens.
  - Preserve end-state instantly under reduced motion.
  - Keep the existing status dot pulse for `running`, but make the header badge and narrative coherent with each other.

- [ ] **Step 7: Re-run drawer tests**
  - Run: `rtk npm test -- tests/components/playground-drawer.test.tsx`
  - Expected: stage assertions pass.

---

## Task 3: Copy Success Feedback

**Files:**
- Modify: `mdx-components.js`
- Modify or Add: `app/lib/motion/copy-feedback-button.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/copy-feedback.test.tsx`

- [ ] **Step 1: Add a failing copy-feedback test**
  - Create `tests/components/copy-feedback.test.tsx`.
  - Cover:
    - default label / title
    - click copies content
    - UI swaps to `✓ 已复制`
    - state reverts after ~1500ms
    - reduced-motion still swaps text instantly

- [ ] **Step 2: Run the focused test and verify it fails**
  - Run: `rtk npm test -- tests/components/copy-feedback.test.tsx`
  - Expected: fail because there is no custom feedback wrapper today.

- [ ] **Step 3: Choose the lowest-friction interception point**
  - Inspect the current Nextra pre/code integration and decide whether:
    - to override the copy button at the MDX pre wrapper level, or
    - to inject a narrow client wrapper only where the site renders code blocks
  - Do not rewrite all code block rendering if a small wrapper is sufficient.

- [ ] **Step 4: Implement the button state machine**
  - Introduce local state:
    - `idle`
    - `copied`
  - On success:
    - call clipboard API
    - swap visible text / accessible label to `✓ 已复制`
    - restore after `1500ms`
  - Keep failure behavior explicit; no silent swallow if clipboard access is denied.

- [ ] **Step 5: Style the success state without over-animating code blocks**
  - In `app/globals.css`, add a small color/border swap for the copied state.
  - Avoid animating syntax tokens or large code surfaces.

- [ ] **Step 6: Re-run the focused test**
  - Run: `rtk npm test -- tests/components/copy-feedback.test.tsx`
  - Expected: pass.

---

## Task 4: Runnable-to-Editor Causal Feedback

**Files:**
- Modify: `app/lib/runnable-code-block.tsx`
- Modify: `app/lib/playground/playground-provider.tsx`
- Modify: `app/lib/playground/playground-editor.tsx`
- Add or Modify: `app/lib/motion/playground-flight.ts`
- Modify: `app/globals.css`
- Test: `tests/components/playground-flight.test.tsx`

- [ ] **Step 1: Add a failing causal-feedback test**
  - Create `tests/components/playground-flight.test.tsx`.
  - Assert the orchestration contract, not pixel-perfect animation:
    - source block emits enough metadata to identify its rect
    - opening a file schedules a flight attempt
    - the helper cleans up its temporary clone
    - editor receives an “applied/opened” highlight trigger

- [ ] **Step 2: Run the focused test and verify it fails**
  - Run: `rtk npm test -- tests/components/playground-flight.test.tsx`
  - Expected: fail because no flight/highlight orchestration exists.

- [ ] **Step 3: Add source and target anchors**
  - In `app/lib/runnable-code-block.tsx`, emit a stable source attribute for the clicked action.
  - In the editor tab shell or editor pane, emit a stable target attribute so the flight helper can resolve a destination rect after the drawer opens.

- [ ] **Step 4: Implement FLIP helper**
  - In `app/lib/motion/playground-flight.ts`, implement:
    - source rect read
    - target rect read
    - temporary clone insertion
    - transform/opacity animation
    - cleanup on `transitionend`
  - Guard against rapid re-entry; only one active flight per interaction.

- [ ] **Step 5: Trigger Monaco highlight pulse**
  - In `app/lib/playground/playground-editor.tsx`, add a short-lived decoration class for the target range or opened file region.
  - Use `--ha-motion-highlight-apply`.
  - Skip the animation tween under reduced motion, but still show the end-state flash briefly if feasible.

- [ ] **Step 6: Re-run the focused test**
  - Run: `rtk npm test -- tests/components/playground-flight.test.tsx`
  - Expected: pass.

---

## Task 5: Route / Navigation / Search Polish

**Files:**
- Modify: `app/layout.jsx`
- Modify: `app/globals.css`
- Add: `tests/components/route-motion-shell.test.tsx`

- [ ] **Step 1: Add a failing route-shell test**
  - Create `tests/components/route-motion-shell.test.tsx`.
  - Assert that the main content wrapper renders stable hooks for route motion without altering page content semantics.

- [ ] **Step 2: Run the focused test and verify it fails**
  - Run: `rtk npm test -- tests/components/route-motion-shell.test.tsx`
  - Expected: fail because no dedicated motion shell exists yet.

- [ ] **Step 3: Add the route-transition shell**
  - In `app/layout.jsx`, wrap the main content slot in a dedicated element with a stable class / data attribute for route motion.
  - Feature-detect View Transitions where appropriate, but keep a CSS-only fallback path.

- [ ] **Step 4: Add route fade styling**
  - In `app/globals.css`, add a small fade+rise transition for the main content shell.
  - Keep it low-amplitude and reading-safe.

- [ ] **Step 5: Add TOC/sidebar active-indicator motion hooks**
  - In `app/globals.css`, target the Nextra-generated active states and animate their indicator movement with transform/opacity rather than layout changes.
  - Keep selectors local enough that future Nextra upgrades are easy to re-audit.

- [ ] **Step 6: Finish search polish**
  - Preserve the existing input expand behavior.
  - Add result-item stagger hooks only when results mount, not on every keystroke repaint.

- [ ] **Step 7: Re-run the focused test, then full tests**
  - Run: `rtk npm test -- tests/components/route-motion-shell.test.tsx`
  - Then run: `rtk npm test`
  - Expected: both pass.

---

## Verification Matrix

Run after each task:

- Focused test for the task you just changed
- `rtk npm test`

Run after Task 5:

- `rtk npm run build`

Manual checks after Task 5:

- dark/light theme switch remains smooth and does not regress
- opening Playground slides in with backdrop, closing slides out without snap-off
- boot narrative is readable during cold open
- copy button visibly confirms success
- clicking a runnable file action visually connects source and editor target
- route changes feel coherent but not heavy
- reduced-motion keeps state/text/color feedback while removing tweens

## Risks

- Drawer lifecycle changes may expose stale async updates from WebContainer boot. Guard every async branch with the existing request-id mechanism.
- FLIP orchestration can become brittle if it depends on ephemeral DOM structure. Prefer explicit `data-*` anchors over selector archaeology.
- Nextra search / TOC DOM may shift across upgrades. Keep selectors auditable and document them inline.

## Recommended Execution Order

If implementing immediately, do not batch all five tasks at once. Stop for review after:

1. Task 1
2. Task 2
3. Task 3
4. Tasks 4 and 5 together only if Task 4 stays small and local

