# Course Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-party Course Studio admin surface for maintaining Hi-Agent lessons, MDX content, WebContainer playground manifests, and workspace files without hand-editing every document.

**Architecture:** Treat the current repository files as the first storage backend, not as UI implementation details. The admin UI reads and writes through a `CourseContentRepository` interface, with a filesystem implementation in V1 and a future database/Git publishing implementation behind the same contract. Course documents are represented as structured lesson blocks plus raw MDX fallback, then serialized back to the existing Nextra/MDX file layout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Nextra/MDX, Zod, Node filesystem APIs, Monaco Editor, existing WebContainer playground modules, Vitest, React Testing Library, Playwright

---

## Product Direction

Course Studio is not a generic CMS. It is a course maintenance workbench for runnable engineering lessons.

The main workflow is:

1. Select a module and lesson.
2. Edit title, description, slug, order, and body blocks.
3. Insert normal Markdown, Callout, code, command, and runnable file snippet blocks.
4. Bind runnable blocks to a WebContainer section manifest.
5. Edit the backing workspace files.
6. Validate MDX, manifest, and workspace consistency.
7. Save changes back to repository files.
8. Preview using the real course rendering path.

V1 intentionally optimizes for the author maintaining content on a server-backed deployment. It should not be constrained by GitHub Pages. It should still keep the existing MDX and `examples/labs` layout as the source of truth until the content model is stable enough to move to a database.

## Non-Goals For V1

- User registration and public account management
- Multi-user collaboration
- Review and approval workflows
- Database-backed content storage
- Full WYSIWYG rich-text editing
- Comments, analytics, learning progress, or classroom features
- Automatic production publishing pipeline
- Complex asset/media library

## Existing Content Sources

Course Studio must preserve these current repository conventions:

- Course routes live under `app/docs/**/page.mdx`.
- Nextra sidebar order and labels live in `app/docs/**/_meta.js`.
- Runnable lab manifests live in `examples/labs/{sectionId}/manifest.json`.
- Runnable workspace files live in `examples/labs/{sectionId}/workspace/**`.
- WebContainer snapshot binaries are generated into `public/webcontainer-snapshots/**`.
- Runtime manifest loading currently happens in `app/lib/playground/manifest-loader.ts`.

## Core Content Model

Create `app/lib/admin/content/content-model.ts`.

```ts
export interface CourseModule {
  id: string;
  title: string;
  routePath: string;
  metaPath: string;
  order: number;
  hidden?: boolean;
}

export interface LessonSummary {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  routePath: string;
  sourcePath: string;
  order: number;
  hidden?: boolean;
  hasPlayground: boolean;
  validationState: 'unknown' | 'valid' | 'warning' | 'error';
}

export interface LessonDocument {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  description?: string;
  routePath: string;
  sourcePath: string;
  order: number;
  frontmatter: Record<string, unknown>;
  imports: MdxImport[];
  blocks: LessonBlock[];
}

export interface MdxImport {
  value: string;
}

export type LessonBlock =
  | HeadingBlock
  | ParagraphBlock
  | CalloutBlock
  | CodeBlock
  | OpenProjectBlock
  | PlaygroundSectionBlock
  | RawMdxBlock;

export interface HeadingBlock {
  type: 'heading';
  depth: 1 | 2 | 3 | 4;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  markdown: string;
}

export interface CalloutBlock {
  type: 'callout';
  variant: 'default' | 'info' | 'warning' | 'error';
  blocks: LessonBlock[];
}

export interface CodeBlock {
  type: 'code';
  wrapper?: 'none' | 'CodeBlock' | 'CommandBlock' | 'RunnableCodeBlock';
  blockId?: string;
  title?: string;
  defaultOpen?: boolean;
  language: string;
  filename?: string;
  code: string;
}

export interface OpenProjectBlock {
  type: 'openProject';
  blockId: string;
  label: string;
}

export interface PlaygroundSectionBlock {
  type: 'playgroundSection';
  sectionId: string;
  children: LessonBlock[];
}

export interface RawMdxBlock {
  type: 'rawMdx';
  value: string;
}
```

## Playground Model

Create the admin-facing playground model alongside the existing runtime schema. The existing `app/lib/playground/manifest-schema.ts` remains the runtime validation source. Admin types can wrap it with UI state and file summaries.

```ts
export interface PlaygroundProject {
  sectionId: string;
  manifestPath: string;
  title: string;
  snapshotId: string;
  snapshotUrl: string;
  defaultOpenFile: string;
  startup: {
    installCommands: CommandSpec[];
    runCommands: CommandSpec[];
    env: string[];
  };
  blocks: ManifestBlock[];
  files: WorkspaceFileSummary[];
}

export interface WorkspaceFileSummary {
  path: string;
  kind: 'file' | 'directory';
  language?: string;
  size?: number;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  language?: string;
}
```

## Repository Interface

Create `app/lib/admin/content/content-repository.ts`.

The UI and API should depend only on this interface.

```ts
export interface CourseContentRepository {
  listModules(): Promise<CourseModule[]>;
  listLessons(moduleId?: string): Promise<LessonSummary[]>;
  getLesson(lessonId: string): Promise<LessonDocument>;
  saveLesson(input: SaveLessonInput): Promise<SaveLessonResult>;

  getPlayground(sectionId: string): Promise<PlaygroundProject>;
  savePlayground(input: SavePlaygroundInput): Promise<SavePlaygroundResult>;

  listWorkspaceFiles(sectionId: string): Promise<WorkspaceFileSummary[]>;
  getWorkspaceFile(sectionId: string, filePath: string): Promise<WorkspaceFile>;
  saveWorkspaceFile(input: SaveWorkspaceFileInput): Promise<void>;

  validateLesson(lessonId: string): Promise<ValidationReport>;
}
```

V1 implementation:

- `FileSystemCourseContentRepository`
- Reads and writes the existing repository files.
- Normalizes all user paths through a path utility.
- Rejects writes outside the workspace-owned content roots.

Future implementation:

- `DatabaseCourseContentRepository`
- Can keep the same API and UI.
- Can publish by generating MDX/manifest files, committing to Git, or serving content directly from database records.

## MDX Parsing Strategy

Create:

- `app/lib/admin/content/mdx-parser.ts`
- `app/lib/admin/content/mdx-serializer.ts`

The parser must be conservative. It should structure known patterns and preserve unknown content as `rawMdx`.

Supported structured parsing in V1:

- frontmatter
- import statements
- Markdown headings
- Markdown paragraphs
- fenced code blocks
- `<Callout type="...">...</Callout>`
- `<CodeBlock title="..." defaultOpen>...</CodeBlock>`
- `<CommandBlock blockId="...">...</CommandBlock>`
- `<RunnableCodeBlock blockId="...">...</RunnableCodeBlock>`
- `<OpenProjectButton blockId="...">...</OpenProjectButton>`
- `<PlaygroundSection sectionId="...">...</PlaygroundSection>`

Unknown JSX, complex expressions, tables, and unsupported MDX syntax must become `rawMdx` blocks. Saving must not drop or rewrite these blocks except for surrounding blank-line normalization.

Parsing flow:

1. Split frontmatter.
2. Split top-level import lines.
3. Parse recognized block-level constructs.
4. Convert unknown spans to `rawMdx`.
5. Return `LessonDocument`.

Serialization flow:

1. Write frontmatter.
2. Write imports.
3. Serialize each block.
4. Preserve `rawMdx` values.
5. Normalize blank lines.
6. Parse the result again before replacing the real file.

## File Mapping Rules

Lesson files:

- `moduleId = chat`
- `slug = 01-getting-started`
- `sourcePath = app/docs/chat/01-getting-started/page.mdx`
- `routePath = /docs/chat/01-getting-started`

Module metadata:

- Root modules come from `app/docs/_meta.js`.
- Module lessons come from `app/docs/{moduleId}/_meta.js`.
- V1 can parse and rewrite simple object exports.
- If `_meta.js` contains unsupported JavaScript, it must be treated as read-only until manually simplified.

Playground files:

- `sectionId = labs-01-webcontainers-pilot`
- `manifestPath = examples/labs/labs-01-webcontainers-pilot/manifest.json` by convention for new projects.
- Existing project path `examples/labs/01-webcontainers-pilot/manifest.json` must be supported by registry lookup.
- `workspaceRoot = examples/labs/{projectSlug}/workspace`

Manifest registry:

- Existing `app/lib/playground/manifest-loader.ts` currently imports known manifests manually.
- V1 can update this file for newly created playgrounds.
- A later improvement should generate a registry file from manifests to avoid hand-edited imports.

## Admin API

Create route handlers under `app/api/admin`.

```txt
GET    /api/admin/modules
GET    /api/admin/lessons
GET    /api/admin/lessons?moduleId=chat
GET    /api/admin/lessons/[lessonId]
PUT    /api/admin/lessons/[lessonId]
POST   /api/admin/lessons
POST   /api/admin/lessons/[lessonId]/validate

GET    /api/admin/playgrounds/[sectionId]
PUT    /api/admin/playgrounds/[sectionId]

GET    /api/admin/playgrounds/[sectionId]/files
GET    /api/admin/playgrounds/[sectionId]/files?path=src/main.js
PUT    /api/admin/playgrounds/[sectionId]/files
POST   /api/admin/playgrounds/[sectionId]/snapshot
```

V1 can keep authentication out of scope, but the API module should be isolated so an auth guard can be added in one place later.

## Admin UI

Create:

- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/admin-shell.tsx`
- `app/admin/course-editor.tsx`

The UI should be a dense engineering workbench:

- Left column: course tree.
- Center column: structured block editor.
- Right column: preview and playground binding panel.

Left column:

- Module list
- Lesson list
- New module
- New lesson
- Rename
- Reorder
- Hidden state
- Unsaved and validation indicators

Center column:

- Frontmatter editor
- Block editor
- Add block menu
- Drag or move blocks
- Duplicate block
- Delete block
- Source mode fallback

Right column:

- Live preview
- Current `PlaygroundSection`
- Manifest block list
- Workspace file tree
- Current file editor
- Validation report
- Snapshot action

Preview approach:

- V1 should use structured editing plus real preview, not full WYSIWYG editing.
- The editor edits fields and blocks.
- The preview renders the serialized MDX through the same component set as the course site where feasible.
- If full server-side MDX compilation is too large for V1, show MDX source preview first, then add rendered preview in the next task.

## Runnable Block Workflow

File snippet insertion:

1. User chooses "Insert runnable file snippet".
2. User selects or creates a workspace file.
3. User edits code.
4. User enters or accepts generated `blockId`.
5. System inserts a `RunnableCodeBlock` in the lesson.
6. System inserts a `file-snippet` block in manifest.
7. System writes or updates the workspace file.
8. System validates filename, manifest path, and blockId consistency.

Command insertion:

1. User chooses "Insert command block".
2. User enters command text, such as `npm run chat`.
3. System parses it into `{ cmd: "npm", args: ["run", "chat"] }`.
4. System inserts a `CommandBlock` in the lesson.
5. System inserts a `command` block in manifest.
6. System validates command parsing and manifest consistency.

Open project insertion:

1. User chooses "Insert open project button".
2. User enters label and `blockId`.
3. System inserts `OpenProjectButton`.
4. System inserts `project-open` manifest block.

## Validation Rules

Create `app/lib/admin/content/validation.ts`.

MDX validation:

- `title` exists.
- Imports are not duplicated.
- JSX wrappers are closed.
- `PlaygroundSection` is not nested.
- `CommandBlock`, `RunnableCodeBlock`, and `OpenProjectButton` are inside a `PlaygroundSection`.
- `blockId` is unique within a section.

Manifest validation:

- Each command block in MDX exists in manifest.
- Each runnable file block in MDX exists in manifest.
- Each open project block in MDX exists in manifest.
- Manifest does not contain stale blocks unless marked as warning.
- `defaultOpenFile` exists in workspace.
- `snapshotId` and `snapshotUrl` follow project conventions.

Workspace validation:

- `file-snippet.path` exists.
- MDX `filename` matches manifest path.
- Workspace file content and MDX snippet content are either synchronized or explicitly marked divergent.
- `package.json` scripts contain startup commands when applicable.
- Real API keys are not written to `.env` or MDX snippets.

Authority rule:

- Workspace files are the durable source for runnable file content.
- MDX file snippets are display snapshots.
- Editing either side in the admin should show the sync impact before saving.

## Save Flow

Saving must be cautious and transparent.

1. Receive `LessonDocument`.
2. Normalize `slug`, `blockId`, and paths.
3. Validate the document.
4. Serialize MDX.
5. Serialize manifest if playground blocks changed.
6. Write temp files.
7. Re-read and parse temp files.
8. Replace target files.
9. Return changed files, warnings, and errors.

```ts
export interface SaveLessonResult {
  ok: boolean;
  changedFiles: string[];
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
}
```

## Implementation Phases

### Phase 1: Read-Only Foundation

Build the repository and API read path.

Required outcomes:

- `/api/admin/modules` returns modules.
- `/api/admin/lessons` returns lesson summaries.
- `/api/admin/lessons/[lessonId]` returns a parsed `LessonDocument`.
- `/admin` shows a course tree and selected lesson blocks.
- Unsupported MDX appears as `rawMdx`.

### Phase 2: MDX Save Path

Add write support for safe block types.

Required outcomes:

- Edit title and description.
- Edit headings, paragraphs, and normal code blocks.
- Save back to `page.mdx`.
- Re-read saved file and preserve block structure.
- Keep raw MDX unchanged.

### Phase 3: Structured Course Blocks

Add custom course block support.

Required outcomes:

- Edit Callout blocks.
- Edit CodeBlock wrapper blocks.
- Edit CommandBlock blocks.
- Edit RunnableCodeBlock blocks.
- Edit OpenProjectButton blocks.
- Edit PlaygroundSection containers.

### Phase 4: Playground Integration

Add manifest and workspace support.

Required outcomes:

- Read and edit manifest metadata.
- List workspace files.
- Edit workspace files.
- Insert command blocks with manifest sync.
- Insert file snippets with workspace and manifest sync.
- Validate stale and missing block links.

### Phase 5: Preview And Validation UX

Add authoring feedback.

Required outcomes:

- Show validation report in the right panel.
- Show changed files before saving.
- Add source mode fallback.
- Add MDX preview.
- Add rendered preview if compilation cost is acceptable.

### Phase 6: Snapshot And Build Hooks

Add operational actions.

Required outcomes:

- Trigger snapshot generation for a playground.
- Show command output.
- Add guarded build/test action buttons.
- Keep long-running actions explicit.

## Testing Strategy

Unit tests:

- `tests/unit/admin-mdx-parser.test.ts`
- `tests/unit/admin-mdx-serializer.test.ts`
- `tests/unit/admin-validation.test.ts`
- `tests/unit/admin-filesystem-repository.test.ts`

Component tests:

- `tests/components/admin-course-tree.test.tsx`
- `tests/components/admin-block-editor.test.tsx`
- `tests/components/admin-playground-panel.test.tsx`

E2E tests:

- `tests/e2e/admin-course-studio.spec.ts`

Minimum verification per phase:

- `npm test`
- targeted Vitest files for parser, serializer, repository, and validation
- `npm run build` after API/UI integration

## Open Decisions

- Whether V1 should add a temporary admin access token guard before user auth exists.
- Whether rendered preview should compile arbitrary MDX server-side in V1 or start with source preview.
- Whether new playground registry entries should update `manifest-loader.ts` directly or use a generated registry file.
- Whether `_meta.js` should be migrated to a stricter data format later to simplify admin writes.

## Recommended First Task

Start with Phase 1. Do not begin with the visual editor. The parser, repository, and read-only API should exist first so the UI is grounded in real content.
