# Multi-Course Architecture Plan

> **Status:** Draft for review · Not yet implemented
> **Author:** AI assistant (with user direction)
> **Date:** 2026-05-16
> **Scope:** Lift Hi-Agent docs site from a single-course site into a multi-course platform, while keeping the brand "Hi-Agent" and all generic infrastructure (WebContainer playground, interactive diagrams, motion shell) reusable across courses.

---

## 1. Goal

Today the repository is structured as if the entire site is one course:

- `/docs/*` route is the Hi-Agent course.
- `app/docs/_meta.js` is hard-coded to that course's seven chapters.
- `app/page.jsx` (home) renders seven module cards, each linking to `/docs/<chapter>`.
- `examples/labs/<section>` is implicitly a Hi-Agent lab.

The user plans to publish a series of additional Agent-themed courses on the same site. Therefore we need to:

1. Promote "course" from an implicit concept (the whole `/docs` tree) into an **explicit, first-class entity** with its own identity, slug, metadata, and chapter list.
2. Keep the brand name **Hi-Agent**. The site is a Hi-Agent course series — every future course is still about Agent engineering.
3. Keep all platform-level components (WebContainer, diagrams, motion, layout) **single-instance and shared** across courses. They are website-level, not course-level.
4. Migrate Hi-Agent course content from `/docs/*` to `/courses/hi-agent/*`, **abandoning the old `/docs/*` URLs** (per user direction; no redirects required).

## 2. Non-Goals (V1)

- No multi-user authoring, no DB, no CMS — we keep MDX + `_meta.js` as the source of truth.
- No i18n. Content stays Chinese-only.
- No per-course theming/branding. All courses share the Hi-Agent visual identity.
- No analytics/learning progress per course.
- No course versioning. Each course slug is a single live track.
- No backwards compatibility for `/docs/*` URLs. They will be deleted, not redirected.

## 3. User-Facing URL Model

| Surface                        | URL                                  | Source file                                         |
| ------------------------------ | ------------------------------------ | --------------------------------------------------- |
| Site home (course hub)         | `/`                                  | `app/page.jsx`                                      |
| All courses index              | `/courses`                           | `app/courses/page.mdx`                              |
| A course's intro / outline     | `/courses/<slug>`                    | `app/courses/<slug>/page.mdx`                       |
| A chapter's intro              | `/courses/<slug>/<chapter>`          | `app/courses/<slug>/<chapter>/page.mdx`             |
| A chapter's lesson page        | `/courses/<slug>/<chapter>/<lesson>` | `app/courses/<slug>/<chapter>/<lesson>/page.mdx`    |
| A course's labs                | `/courses/<slug>/labs/<lab>`         | `app/courses/<slug>/labs/<lab>/page.mdx`            |

`<slug>` examples: `hi-agent` (existing), and reserved slots like `hi-rag`, `hi-mcp`, `hi-eval` for future courses.

## 4. Target Repository Layout

```
app/
├── _meta.js                     ← top-nav: home, courses, (about?)
├── page.jsx                     ← Course Hub (multi-course landing)
├── layout.jsx                   ← navbar/footer/metadata (brand: Hi-Agent)
├── courses/                     ← NEW course root
│   ├── _meta.js                 ← order of courses in sidebar
│   ├── page.mdx                 ← all-courses index page
│   ├── hi-agent/                ← migrated from app/docs/
│   │   ├── _meta.js
│   │   ├── page.mdx             ← course intro (was app/docs/page.mdx)
│   │   ├── chat/
│   │   ├── agent-loop/
│   │   ├── tool/
│   │   ├── context-engineering/
│   │   ├── memory/
│   │   ├── multi-agent/
│   │   ├── harness/
│   │   └── labs/
│   └── (future: hi-rag/, hi-mcp/, …)
├── lib/                         ← UNCHANGED, shared across courses
│   ├── diagrams/                ← interactive diagram framework
│   ├── playground/              ← WebContainer wrapper
│   ├── motion/                  ← page-transition motion
│   ├── code-block.jsx, command-block.tsx, runnable-code-block.tsx, …
│   └── …
├── courses-data.js              ← NEW: course catalog SSOT
└── api/health/route.ts          ← unchanged
examples/
├── hi-agent/                    ← NEW namespace per course
│   └── labs/
│       └── 01-webcontainers-pilot/   ← moved from examples/labs/
└── (future: hi-rag/labs/…)
public/
└── webcontainer-snapshots/      ← built per-course; key by namespaced sectionId
scripts/
└── build-webcontainer-snapshots.mjs  ← updated to scan examples/<course>/labs
```

`app/docs/` is **deleted** in this plan. The `/docs/*` route ceases to exist.

## 5. Course Catalog (Single Source of Truth)

New file: `app/courses-data.js` (CommonJS-friendly ESM, importable from server components and from MDX via `import`).

```js
// app/courses-data.js
/**
 * @typedef {Object} CourseMeta
 * @property {string} slug              - URL slug, e.g. 'hi-agent'
 * @property {string} title             - display name, e.g. 'Hi-Agent'
 * @property {string} subtitle          - short tagline
 * @property {string} description       - 1-2 sentence summary for cards
 * @property {string} status            - 'live' | 'draft' | 'planned'
 * @property {string} tag               - 'Foundations' | 'Advanced' | 'Lab' …
 * @property {string} cover             - relative image path (under public/)
 * @property {string} startChapterSlug  - first chapter slug for "Start" CTA
 * @property {string} updatedAt         - ISO date for "last updated"
 * @property {string[]} chapters        - chapter slugs in order
 */

export const COURSES = [
  {
    slug: 'hi-agent',
    title: 'Hi-Agent',
    subtitle: '构建会思考的 AI Agent',
    description:
      '从 Chat、Agent Loop、Tool、Context Engineering，到 Memory、Multi-Agent、Harness——七个模块，从“会调 API”到“能造 Agent”。',
    status: 'live',
    tag: 'Foundations',
    cover: '/images/courses/hi-agent.png',
    startChapterSlug: 'chat',
    updatedAt: '2026-05-16',
    chapters: [
      'chat',
      'agent-loop',
      'tool',
      'context-engineering',
      'memory',
      'multi-agent',
      'harness'
    ]
  }
  // future courses appended here
];

export function getCourse(slug) {
  return COURSES.find((c) => c.slug === slug);
}
```

**Why a JS file, not JSON or MDX frontmatter?** Because both `app/page.jsx` and MDX index pages need to import it as a typed module under static export, and `_meta.js` files are also JS. Keeping the same format minimizes friction.

## 6. Top-Level Navigation & Brand

- `app/_meta.js`:
  ```js
  export default {
    index: { type: 'page', title: '首页', display: 'hidden' },
    courses: { type: 'page', title: '课程' }
    // 'docs' entry removed
  };
  ```
- `app/layout.jsx`:
  - **Brand stays:** logo text `Hi-Agent`, badge `Series` (replacing `Docs`).
  - `metadata.title.default` = `Hi-Agent — Agent 工程系列课程`.
  - `metadata.description` updated to reflect a course series, not a single course.
  - Banner copy adjusted to "Hi-Agent 系列 · 持续更新" (or kept as-is if user prefers).
- Footer copy updated to "© Hi-Agent 系列 · 一份关于 Agent 工程的系统课程合集".

## 7. Home Page (Course Hub) — `app/page.jsx`

Rewrite the home page to be a **course hub**, not a chapter index:

- Hero copy slightly generalized — still about "Agent 工程"，but no longer hard-coded to "七个模块".
- Replace the 7-card chapter grid with a **course card grid**, sourced from `COURSES`:
  - Each card shows: cover, title, subtitle, description, status pill (`Live` / `Coming Soon`), tag, "进入课程" CTA → `/courses/<slug>`.
  - `live` courses are clickable; `draft`/`planned` courses render as disabled with a subtle "敬请期待" badge.
- Bottom CTA card: "从 Hi-Agent 开始" → `/courses/hi-agent` (since it's the flagship & first course).
- The `Modules / Format / Level / Updated` meta strip changes to: `Courses (N) / Format / Level / Updated`.

## 8. `/courses` Index Page

`app/courses/page.mdx` — a thin MDX page that renders the same course list as the home hub but with a fuller description and chapter peek per course. Useful as a sidebar root. It can simply `import { COURSES } from '../courses-data'` and render via existing `<Cards>` from `nextra/components`, or via a small custom client component if richer.

## 9. `/courses` `_meta.js`

```js
// app/courses/_meta.js
export default {
  index: '全部课程',
  '---series---': { type: 'separator', title: '课程系列' },
  'hi-agent': 'Hi-Agent · 构建会思考的 AI Agent'
  // future: 'hi-rag': 'Hi-RAG · …'
};
```

## 10. Hi-Agent Course Migration Map

Source paths under `app/docs/` map 1:1 to destinations under `app/courses/hi-agent/`. The chapter contents (MDX bodies) are copied verbatim — only **internal links** need rewriting.

| From                                            | To                                                          |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `app/docs/_meta.js`                             | `app/courses/hi-agent/_meta.js`                             |
| `app/docs/page.mdx`                             | `app/courses/hi-agent/page.mdx`                             |
| `app/docs/chat/**`                              | `app/courses/hi-agent/chat/**`                              |
| `app/docs/agent-loop/**`                        | `app/courses/hi-agent/agent-loop/**`                        |
| `app/docs/tool/**`                              | `app/courses/hi-agent/tool/**`                              |
| `app/docs/context-engineering/**`               | `app/courses/hi-agent/context-engineering/**`               |
| `app/docs/memory/**`                            | `app/courses/hi-agent/memory/**`                            |
| `app/docs/multi-agent/**`                       | `app/courses/hi-agent/multi-agent/**`                       |
| `app/docs/harness/**`                           | `app/courses/hi-agent/harness/**`                           |
| `app/docs/labs/**`                              | `app/courses/hi-agent/labs/**`                              |

**Internal link rewrites required** (search & replace inside MDX/JSX):

- `/docs/chat` → `/courses/hi-agent/chat` (and same for all 7 chapters)
- `/docs` → `/courses/hi-agent`
- `/docs/labs/...` → `/courses/hi-agent/labs/...`
- Any `withBase('/docs/...')` callsites
- `<Cards.Card href="/docs/...">` in `page.mdx`
- `app/page.jsx` — entirely rewritten (Section 7)

## 11. Labs / WebContainer Workspace Migration

Today: `examples/labs/<sectionId>/`.
Target: `examples/<courseSlug>/labs/<sectionId>/`.

Concretely:
- Move `examples/labs/01-webcontainers-pilot/` → `examples/hi-agent/labs/01-webcontainers-pilot/`.
- Update `scripts/build-webcontainer-snapshots.mjs` to scan `examples/*/labs/**/manifest.json` and to **prefix snapshot output keys with the course slug** (e.g. snapshot file becomes `public/webcontainer-snapshots/hi-agent/01-webcontainers-pilot.snapshot.bin`).
- Update `app/lib/playground/manifest-loader.ts` to accept a `courseSlug` param when loading manifests (or to read snapshot/manifest paths that already include the slug).
- Update any MDX page that mounts a Playground component to pass the new `courseSlug` (or to point at the new manifest URL).

The manifest schema (`app/lib/playground/manifest-schema.ts`) does not need new fields — the namespacing happens at the file path level.

## 12. Tests

- Existing tests under `tests/` should continue to pass with **path updates only**.
- Add one new unit test: `tests/unit/courses-data.test.ts`
  - All `COURSES[i].slug` are unique.
  - Each `live` course has a corresponding `app/courses/<slug>/page.mdx` (use `fs.access`).
  - Each `live` course's `startChapterSlug` exists in its `chapters` array.
- Add one smoke component test: `tests/components/home-course-hub.test.tsx`
  - Renders `app/page.jsx` and asserts it lists every `live` course title.
  - Asserts old `/docs/*` strings are absent from rendered output.
- Update tests that referenced `/docs/...` paths to `/courses/hi-agent/...`.

## 13. Build & Static Export Considerations

- `next.config.mjs` does not need changes — `output: 'export'` plus the new file structure produces `out/courses/<slug>/<chapter>/index.html` automatically.
- GitHub Pages basePath logic stays untouched.
- After migration, `out/docs/**` should not exist. CI smoke check: `! test -d out/docs`.

## 14. Risk Register

| Risk                                                        | Mitigation                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Stale internal links from external referrers (now 404)      | Acceptable per user decision (chose option C: drop old links). Add a `404.mdx` hint suggesting `/courses/hi-agent`. |
| WebContainer snapshot path drift                            | Bump snapshot path scheme behind a small adapter; rebuild snapshots in one CI step.   |
| Pagefind search index loses the old `/docs` slugs           | Acceptable; site is small and rebuild repopulates it.                                 |
| MDX components imported with relative paths break post-move | Audit imports per file (`../lib/...` depth changes by one); fix during migration.     |
| Future courses bloat home page                              | Keep `COURSES` ordered; if N > ~6, switch home grid to a paginated/tabbed presentation in a follow-up. |

## 15. Implementation Phases

Execute in order. Each phase ends in a passing `npm test` and a successful `npm run build`.

### Phase A — Catalog & Brand Foundations
1. Add `app/courses-data.js` with the single Hi-Agent entry.
2. Add `tests/unit/courses-data.test.ts` (assertions still pass against `app/docs` for now — see Phase B note below).
3. Update `app/layout.jsx` brand strings (logo badge, metadata, footer).

### Phase B — File Migration (atomic)
4. Move (`git mv`) `app/docs/**` → `app/courses/hi-agent/**`.
5. Move `examples/labs/**` → `examples/hi-agent/labs/**`.
6. Update `app/_meta.js` to drop `docs`, add `courses`.
7. Add `app/courses/_meta.js` and `app/courses/page.mdx`.
8. Search-and-replace internal `/docs` link references inside MDX/JSX (Section 10 list).

### Phase C — Tooling Update
9. Update `scripts/build-webcontainer-snapshots.mjs` for `examples/<course>/labs` scan + namespaced output.
10. Update `app/lib/playground/manifest-loader.ts` (and any caller) to use the namespaced manifest path.
11. Run `npm run build:snapshots` and confirm snapshot file paths.

### Phase D — Home Hub & Course Index
12. Rewrite `app/page.jsx` to render the course hub from `COURSES` (Section 7).
13. Author `app/courses/page.mdx` (Section 8).
14. Update or add tests under `tests/components/`.

### Phase E — Verification
15. `npm run test` (unit + component) green.
16. `npm run build` succeeds, output contains `out/courses/hi-agent/*`, contains no `out/docs/*`.
17. Manual preview via `npm run dev` + `OpenPreview`:
    - `/` shows Hi-Agent course card.
    - `/courses` lists Hi-Agent.
    - `/courses/hi-agent` renders the original course intro.
    - `/courses/hi-agent/chat` renders chapter 01.
    - `/courses/hi-agent/labs/01-webcontainers-pilot` boots WebContainer.
18. Tag plan as **completed**; create scaffolding template doc for adding course #2 (separate plan).

## 16. Adding a New Course (Forward-Looking)

Once Phase E lands, adding course #2 (e.g. `hi-rag`) is reduced to:

1. Append a new entry to `COURSES` in `app/courses-data.js` (status `'draft'` until ready).
2. Add `app/courses/hi-rag/_meta.js` and `page.mdx` plus chapter folders.
3. (Optional) Add `examples/hi-rag/labs/<lab>/` workspace + `manifest.json` and rebuild snapshots.
4. Flip status to `'live'` in `courses-data.js`.

No changes to the home page, navbar, layout, build script, or playground are required.

## 17. Open Questions for Reviewer

1. **Logo badge text.** Confirm `Hi-Agent · Series` (replacing the current `Docs`). Alternatives: `课程` or remove the badge entirely.
2. **Future course slugs.** Are `hi-rag`, `hi-mcp`, `hi-eval` reasonable working names? They only affect URL strings later — naming can change before launch.
3. **404 page hint.** OK to add a small "你访问的页面已迁移到 `/courses/hi-agent`" hint on a custom 404 mdx? Helps soften the no-redirect decision. (Default: yes.)
4. **Snapshot path scheme.** Approve `public/webcontainer-snapshots/<courseSlug>/<sectionId>.snapshot.bin`?
5. **Top-nav entry name.** `课程` (current `docs` label translated) vs `课程合集` vs `Courses`?

---

**Next action after approval:** execute Phases A → E in order, opening a follow-up PR per phase or a single PR per phase pair (A+B, C+D) depending on review preference.
